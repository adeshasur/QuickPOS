const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.env.QUICKPOS_DB_DIR = app.getPath('userData');
const db = require('./database.js');

const DB_FILE_PATH = path.join(process.env.QUICKPOS_DB_DIR, 'quickpos.db');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1000,
        minHeight: 600,
        show: false,
        backgroundColor: '#f3f3f6',
        icon: path.join(__dirname, 'assets/images/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'pages/login.html'));
    mainWindow.setMenuBarVisibility(false);

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
    });
}

const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
        if (err) {
            reject(err);
            return;
        }
        resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const getAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

async function getNextBillId() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dayKey = `${y}${m}${d}`;
    const counterKey = `bill_counter_${dayKey}`;
    const row = await getAsync('SELECT value FROM settings WHERE key = ?', [counterKey]);
    const current = Number(row?.value || 0);
    const next = current + 1;
    await runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [counterKey, String(next)]);
    return `INV-${dayKey}-${String(next).padStart(4, '0')}`;
}

const closeDbAsync = () => new Promise((resolve, reject) => {
    db.close((err) => {
        if (err) reject(err);
        else resolve();
    });
});

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
    return `pbkdf2$120000$${salt}$${hash}`;
}

function verifyPassword(stored, plain) {
    if (!stored) return false;
    if (!stored.startsWith('pbkdf2$')) return stored === plain;

    const [, iterations, salt, hash] = stored.split('$');
    const computed = crypto.pbkdf2Sync(plain, salt, Number(iterations), 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
}

async function withTransaction(work) {
    await runAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
        const result = await work();
        await runAsync('COMMIT');
        return result;
    } catch (error) {
        try {
            await runAsync('ROLLBACK');
        } catch (_) {
            // Ignore rollback errors so original error is returned.
        }
        throw error;
    }
}

ipcMain.handle('login-auth', async (event, { username, password, role }) => {
    const row = await getAsync('SELECT * FROM users WHERE username = ? AND role = ?', [username, role]);
    if (!row) return { success: false, message: 'Invalid credentials' };

    const ok = verifyPassword(row.password, password);
    if (!ok) return { success: false, message: 'Invalid credentials' };

    if (!String(row.password).startsWith('pbkdf2$')) {
        await runAsync('UPDATE users SET password = ? WHERE id = ?', [hashPassword(password), row.id]);
    }

    return {
        success: true,
        user: {
            name: row.name,
            role: row.role,
            canViewReports: Number(row.can_view_reports || 0) === 1
        }
    };
});

ipcMain.handle('backup-database', async () => {
    await runAsync('PRAGMA wal_checkpoint(FULL)');

    const stamp = new Date().toISOString().slice(0, 10);
    const saveResult = await dialog.showSaveDialog({
        title: 'Save QuickPOS Backup',
        defaultPath: `quickpos-backup-${stamp}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, cancelled: true };
    }

    fs.copyFileSync(DB_FILE_PATH, saveResult.filePath);
    return { success: true, path: saveResult.filePath };
});

ipcMain.handle('restore-database', async () => {
    const openResult = await dialog.showOpenDialog({
        title: 'Select QuickPOS Backup',
        properties: ['openFile'],
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (openResult.canceled || !openResult.filePaths?.length) {
        return { success: false, cancelled: true };
    }

    const sourceFile = openResult.filePaths[0];
    await runAsync('PRAGMA wal_checkpoint(TRUNCATE)');
    await closeDbAsync();

    fs.copyFileSync(sourceFile, DB_FILE_PATH);

    app.relaunch();
    app.exit(0);
    return { success: true };
});

ipcMain.handle('add-product', async (event, p) => {
    const result = await runAsync(
        `INSERT INTO products (barcode, name, category_id, cost_price, selling_price, current_stock, unit_type, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.barcode, p.name, p.categoryId, p.cost, p.price, p.stock, p.unit, p.expiry]
    );
    return { id: result.lastID };
});

ipcMain.handle('get-products', async () => allAsync('SELECT * FROM products'));

ipcMain.handle('update-product', async (event, p) => {
    await runAsync(
        'UPDATE products SET name = ?, category_id = ?, cost_price = ?, selling_price = ?, alert_level = ?, unit_type = ?, is_weighted = ? WHERE id = ?',
        [p.name, p.categoryId, p.cost, p.price, p.alertLevel, p.unitType, p.isWeighted ? 1 : 0, p.id]
    );
    return { success: true };
});

ipcMain.handle('delete-product', async (event, id) => {
    await runAsync('DELETE FROM products WHERE id = ?', [id]);
    return { success: true };
});

ipcMain.handle('search-barcode', async (event, barcode) => getAsync('SELECT * FROM products WHERE barcode = ?', [barcode]));
ipcMain.handle('get-expired-items', async () => allAsync("SELECT * FROM products WHERE expiry_date <= date('now', '+30 days')"));
ipcMain.handle('get-categories', async () => allAsync('SELECT * FROM categories'));

ipcMain.handle('save-category', async (event, c) => {
    if (c.id) {
        await runAsync('UPDATE categories SET name = ?, description = ? WHERE id = ?', [c.name, c.description, c.id]);
        return { success: true };
    }
    const result = await runAsync('INSERT INTO categories (name, description) VALUES (?, ?)', [c.name, c.description]);
    return { success: true, id: result.lastID };
});

ipcMain.handle('delete-category', async (event, id) => {
    const linkedProducts = await getAsync('SELECT COUNT(*) AS count FROM products WHERE category_id = ?', [id]);
    if ((linkedProducts?.count || 0) > 0) return { success: false, message: 'Cannot delete category with existing products.' };
    await runAsync('DELETE FROM categories WHERE id = ?', [id]);
    return { success: true };
});

ipcMain.handle('get-customers', async () => allAsync('SELECT * FROM customers'));

ipcMain.handle('save-customer', async (event, c) => {
    if (c.id) {
        await runAsync('UPDATE customers SET name = ?, phone = ?, address = ?, balance = ? WHERE id = ?', [c.name, c.phone, c.address, c.balance, c.id]);
        return { success: true };
    }
    const result = await runAsync('INSERT INTO customers (name, phone, address, balance) VALUES (?, ?, ?, ?)', [c.name, c.phone, c.address, c.balance]);
    return { success: true, id: result.lastID };
});

ipcMain.handle('delete-customer', async (event, id) => {
    await runAsync('DELETE FROM customers WHERE id = ?', [id]);
    return { success: true };
});

ipcMain.handle('get-users', async () => allAsync('SELECT id, name, username, role, can_view_reports FROM users'));

ipcMain.handle('save-user', async (event, u) => {
    if (u.id) {
        const sql = `UPDATE users SET name = ?, username = ?, role = ?, can_view_reports = ? ${u.password ? ', password = ?' : ''} WHERE id = ?`;
        const params = [u.name, u.username, u.role, u.canViewReports ? 1 : 0];
        if (u.password) params.push(hashPassword(u.password));
        params.push(u.id);
        await runAsync(sql, params);
        return { success: true };
    }
    const hashed = hashPassword(u.password);
    const result = await runAsync(
        'INSERT INTO users (name, username, password, role, can_view_reports) VALUES (?, ?, ?, ?, ?)',
        [u.name, u.username, hashed, u.role, u.canViewReports ? 1 : 0]
    );
    return { success: true, id: result.lastID };
});

ipcMain.handle('delete-user', async (event, id) => {
    await runAsync('DELETE FROM users WHERE id = ?', [id]);
    return { success: true };
});

ipcMain.handle('get-settings', async () => {
    const rows = await allAsync('SELECT * FROM settings');
    const settings = {};
    rows.forEach((row) => { settings[row.key] = row.value; });
    return settings;
});

ipcMain.handle('save-setting', async (event, key, value) => {
    await runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    return { success: true };
});

ipcMain.handle('save-sale', async (event, saleData) => withTransaction(async () => {
    if (!Array.isArray(saleData.items) || saleData.items.length === 0) throw new Error('Cannot save an empty sale.');

    for (const item of saleData.items) {
        const product = await getAsync('SELECT id, name, current_stock FROM products WHERE id = ?', [item.id]);
        if (!product) throw new Error(`Product not found (ID: ${item.id})`);
        if (Number(product.current_stock) < Number(item.qty)) throw new Error(`Insufficient stock for ${product.name}`);
    }

    const finalBillId = saleData.billId || await getNextBillId();

    const saleInsert = await runAsync(
        `INSERT INTO sales (bill_id, customer_id, total_amount, payment_method, received_amount, balance_amount, cashier_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [finalBillId, saleData.customerId, saleData.total, saleData.method, saleData.received, saleData.balanceDue, saleData.cashier]
    );

    for (const item of saleData.items) {
        const subtotal = Number(item.qty) * Number(item.price);
        await runAsync(
            `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [saleInsert.lastID, item.id, item.name, item.qty, item.price, subtotal]
        );

        const stockUpdate = await runAsync(
            'UPDATE products SET current_stock = current_stock - ? WHERE id = ? AND current_stock >= ?',
            [item.qty, item.id, item.qty]
        );

        if (stockUpdate.changes !== 1) throw new Error(`Failed to update stock for product ${item.name}`);
    }

    if (saleData.method === 'Credit' && saleData.customerId) {
        await runAsync('UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [saleData.balanceDue, saleData.customerId]);
    }

    return { success: true, id: saleInsert.lastID, billId: finalBillId };
}));

ipcMain.handle('record-credit-payment', async (event, paymentData) => withTransaction(async () => {
    const sale = await getAsync('SELECT * FROM sales WHERE id = ? AND payment_method = ?', [paymentData.saleId, 'Credit']);
    if (!sale) throw new Error('Credit bill not found.');

    const currentBalance = Number(sale.balance_amount || 0);
    const paymentAmount = Number(paymentData.amount || 0);

    if (paymentAmount <= 0) throw new Error('Payment amount must be greater than 0.');
    if (paymentAmount > currentBalance) throw new Error('Payment amount exceeds remaining credit.');

    const newBalance = Math.max(0, currentBalance - paymentAmount);
    await runAsync('UPDATE sales SET balance_amount = ? WHERE id = ?', [newBalance, sale.id]);
    if (sale.customer_id) {
        await runAsync('UPDATE customers SET balance = MAX(0, COALESCE(balance,0) - ?) WHERE id = ?', [paymentAmount, sale.customer_id]);
    }

    return { success: true, remainingBalance: newBalance };
}));

ipcMain.handle('get-sales-history', async () => allAsync('SELECT * FROM sales ORDER BY timestamp DESC'));
ipcMain.handle('get-sale-details', async (event, saleId) => allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]));

app.whenReady().then(async () => {
    const plainUsers = await allAsync("SELECT id, password FROM users WHERE password NOT LIKE 'pbkdf2$%'");
    for (const u of plainUsers) {
        await runAsync('UPDATE users SET password = ? WHERE id = ?', [hashPassword(u.password), u.id]);
    }
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
