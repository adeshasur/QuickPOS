const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

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

    const parts = stored.split('$');
    // Expected format: pbkdf2$<iterations>$<salt>$<hash>
    if (parts.length < 4) return false;
    const [, iterStr, salt, hash] = parts;
    const iterations = Number(iterStr);
    if (!salt || !hash || isNaN(iterations) || iterations < 1) return false;

    try {
        const computed = crypto.pbkdf2Sync(plain, salt, iterations, 64, 'sha512').toString('hex');
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
    } catch (_) {
        return false;
    }
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

ipcMain.handle('verify-admin-pin', async (event, pin) => {
    try {
        const rows = await allAsync("SELECT * FROM users WHERE role IN ('owner', 'admin')");
        for (const row of rows) {
            if (verifyPassword(row.password, pin) || row.password === pin) {
                return { success: true, user: row.name };
            }
        }
        return { success: false, message: 'Invalid Admin PIN' };
    } catch (err) {
        return { success: false, message: err.message };
    }
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
    return withTransaction(async () => {
        const result = await runAsync(
            `INSERT INTO products (barcode, name, category_id, cost_price, selling_price, current_stock, unit_type, expiry_date, alert_level, is_weighted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                p.barcode,
                p.name,
                p.categoryId,
                Number(p.cost || 0),
                Number(p.price || 0),
                Number(p.stock || 0),
                p.unit,
                p.expiry || null,
                Number(p.alertLevel || 10),
                p.isWeighted ? 1 : 0
            ]
        );

        const openingStock = Number(p.stock || 0);
        if (openingStock > 0) {
            await runAsync(
                `INSERT INTO inventory_batches (product_id, batch_code, received_qty, remaining_qty, cost_price, selling_price, expiry_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    result.lastID,
                    `OPEN-${result.lastID}-${Date.now()}`,
                    openingStock,
                    openingStock,
                    Number(p.cost || 0),
                    Number(p.price || 0),
                    p.expiry || null
                ]
            );
        }

        return { id: result.lastID };
    });
});

ipcMain.handle('get-products', async () => allAsync('SELECT * FROM products'));

ipcMain.handle('update-product', async (event, p) => {
    await runAsync(
        'UPDATE products SET barcode = ?, name = ?, category_id = ?, cost_price = ?, selling_price = ?, alert_level = ?, unit_type = ?, is_weighted = ? WHERE id = ?',
        [p.barcode, p.name, p.categoryId, p.cost, p.price, p.alertLevel, p.unitType, p.isWeighted ? 1 : 0, p.id]
    );
    return { success: true };
});

ipcMain.handle('delete-product', async (event, id) => {
    await runAsync('DELETE FROM products WHERE id = ?', [id]);
    return { success: true };
});

ipcMain.handle('add-stock', async (event, { productId, quantity, costPrice, sellingPrice, expiryDate }) => {
    return withTransaction(async () => {
        const qty = Number(quantity || 0);
        if (qty <= 0) throw new Error('Stock quantity must be greater than zero.');

        await runAsync(
            `INSERT INTO inventory_batches (product_id, batch_code, received_qty, remaining_qty, cost_price, selling_price, expiry_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                productId,
                `GRN-${productId}-${Date.now()}`,
                qty,
                qty,
                Number(costPrice || 0),
                Number(sellingPrice || 0),
                expiryDate || null
            ]
        );

        await runAsync(
            'UPDATE products SET current_stock = current_stock + ?, cost_price = ?, selling_price = ?, expiry_date = ? WHERE id = ?',
            [qty, Number(costPrice || 0), Number(sellingPrice || 0), expiryDate || null, productId]
        );
        return { success: true };
    });
});

ipcMain.handle('discard-stock', async (event, { productId, quantity }) => {
    return withTransaction(async () => {
        const discardQty = Number(quantity || 0);
        if (discardQty <= 0) throw new Error('Discard quantity must be greater than zero.');

        await ensureLegacyBatchCoverage(productId);
        let needed = discardQty;

        const batches = await allAsync(
            `SELECT id, remaining_qty
             FROM inventory_batches
             WHERE product_id = ? AND remaining_qty > 0
             ORDER BY CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END ASC,
                      expiry_date ASC,
                      created_at ASC,
                      id ASC`,
            [productId]
        );

        for (let i = 0; i < batches.length && needed > 0; i += 1) {
            const b = batches[i];
            const takeQty = Math.min(needed, Number(b.remaining_qty || 0));
            if (takeQty <= 0) continue;
            await runAsync('UPDATE inventory_batches SET remaining_qty = remaining_qty - ? WHERE id = ?', [takeQty, b.id]);
            needed -= takeQty;
        }

        const actualDiscard = discardQty - Math.max(0, needed);
        await runAsync(
            'UPDATE products SET current_stock = MAX(0, current_stock - ?) WHERE id = ?',
            [actualDiscard, productId]
        );

        const product = await getAsync('SELECT current_stock FROM products WHERE id = ?', [productId]);
        return { success: true, newStock: Number(product?.current_stock || 0), discarded: actualDiscard };
    });
});

ipcMain.handle('search-barcode', async (event, barcode) => getAsync('SELECT * FROM products WHERE barcode = ?', [barcode]));
ipcMain.handle('get-expired-items', async () => allAsync("SELECT * FROM products WHERE expiry_date <= date('now', '+30 days')"));
ipcMain.handle('get-categories', async () => allAsync('SELECT * FROM categories'));
ipcMain.handle('get-top-selling-category', async () => {
    const row = await getAsync(`
        SELECT c.name, SUM(si.quantity) AS total_qty
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        GROUP BY c.name
        ORDER BY total_qty DESC
        LIMIT 1
    `);
    return row ? row.name : 'None';
});
ipcMain.handle('get-categories-revenue', async () => {
    return allAsync(`
        SELECT c.id, c.name, COALESCE(SUM(si.subtotal), 0) AS revenue
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        LEFT JOIN sale_items si ON si.product_id = p.id
        GROUP BY c.id, c.name
    `);
});

ipcMain.handle('get-active-products-count', async () => {
    const row = await getAsync(`
        SELECT COUNT(*) AS count 
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE c.description != 'Inactive' OR c.description IS NULL
    `);
    return row ? row.count : 0;
});

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
        await runAsync('UPDATE customers SET name = ?, phone = ?, address = ?, balance = ?, loyalty_points = ? WHERE id = ?', [c.name, c.phone, c.address, c.balance, c.loyaltyPoints || 0, c.id]);
        return { success: true };
    }
    const result = await runAsync('INSERT INTO customers (name, phone, address, balance, loyalty_points) VALUES (?, ?, ?, ?, ?)', [c.name, c.phone, c.address, c.balance, c.loyaltyPoints || 0]);
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

    const insufficient = [];
    for (const item of saleData.items) {
        const product = await getAsync('SELECT id, name, current_stock FROM products WHERE id = ?', [item.id]);
        if (!product) throw new Error(`Product not found (ID: ${item.id})`);
        if (Number(product.current_stock) < Number(item.qty)) insufficient.push(product.name);
    }
    if (insufficient.length && !saleData.allowStockOverride) {
        throw new Error(`INSUFFICIENT_STOCK: ${insufficient.join(', ')}`);
    }

    const finalBillId = saleData.billId || await getNextBillId();

    const saleInsert = await runAsync(
        `INSERT INTO sales (bill_id, customer_id, total_amount, payment_method, received_amount, balance_amount, ref_no, cashier_name, gross_profit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [finalBillId, saleData.customerId, saleData.total, saleData.method, saleData.received, saleData.balanceDue, saleData.refNo, saleData.cashier]
    );

    let grossProfitTotal = 0;
    let overrideCount = 0;

    for (const item of saleData.items) {
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.price || 0);
        const subtotal = qty * unitPrice;

        const product = await getAsync(
            'SELECT id, name, cost_price, current_stock FROM products WHERE id = ?',
            [item.id]
        );
        if (!product) throw new Error(`Product not found (ID: ${item.id})`);

        const saleItemInsert = await runAsync(
            `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [saleInsert.lastID, item.id, item.name, qty, unitPrice, subtotal]
        );

        const allocation = await allocateFifoBatchesForSale({
            saleId: saleInsert.lastID,
            saleItemId: saleItemInsert.lastID,
            product,
            requestedQty: qty,
            allowStockOverride: Boolean(saleData.allowStockOverride),
            cashierName: saleData.cashier,
            overrideNote: saleData.overrideReason || null
        });

        const itemCostTotal = Number(allocation.costTotal || 0);
        const itemProfit = subtotal - itemCostTotal;
        grossProfitTotal += itemProfit;
        if (allocation.allocations.some((x) => x.override)) overrideCount += 1;

        await runAsync(
            `UPDATE sale_items
             SET cost_per_unit = ?, cost_total = ?, profit_total = ?, batch_trace = ?
             WHERE id = ?`,
            [
                qty > 0 ? (itemCostTotal / qty) : 0,
                itemCostTotal,
                itemProfit,
                JSON.stringify(allocation.allocations),
                saleItemInsert.lastID
            ]
        );

        const stockUpdate = saleData.allowStockOverride
            ? await runAsync('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [qty, item.id])
            : await runAsync('UPDATE products SET current_stock = current_stock - ? WHERE id = ? AND current_stock >= ?', [qty, item.id, qty]);
        if (stockUpdate.changes !== 1) throw new Error(`Failed to update stock for product ${item.name}`);
    }

    if (saleData.method === 'Credit' && saleData.customerId) {
        await runAsync('UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [saleData.balanceDue, saleData.customerId]);
    }

    await runAsync('UPDATE sales SET gross_profit = ? WHERE id = ?', [grossProfitTotal, saleInsert.lastID]);

    return {
        success: true,
        id: saleInsert.lastID,
        billId: finalBillId,
        grossProfit: grossProfitTotal,
        stockOverrideUsed: overrideCount > 0
    };
}));

function buildThermalReceiptHtml(payload) {
    const itemsHtml = (payload.items || []).map((item) => {
        const subtotal = Number(item.qty || 0) * Number(item.price || 0);
        return `
          <tr>
            <td style="padding:3px 0; word-break:break-word">${item.name}</td>
            <td style="padding:3px 0; text-align:center">${Number(item.qty || 0).toFixed(2).replace(/\\.00$/, '')}</td>
            <td style="padding:3px 0; text-align:right">${subtotal.toFixed(2)}</td>
          </tr>`;
    }).join('');

    const paidAmount = Number(payload.received || payload.total || 0);
    const totalAmount = Number(payload.total || 0);
    const changeDue = Math.max(0, paidAmount - totalAmount);

    return `
      <div style="font-family: 'Noto Sans Sinhala','Iskoola Pota','Manrope',sans-serif; width: 302px; max-width: 302px; padding: 8px 10px; font-size: 11px; color: #111;">
        <div style="text-align:center; margin-bottom:6px;">
          <div style="font-size:17px; font-weight:800; letter-spacing:.2px;">QuickPOS Supermarket</div>
          <div style="font-size:10px; margin-top:2px;">80mm Digital Thermal Receipt</div>
        </div>
        <div style="border-top:1px dashed #000; margin:6px 0;"></div>
        <p style="margin:2px 0;">Bill: <strong>${payload.billId || '-'}</strong></p>
        <p style="margin:2px 0;">Cashier: ${payload.cashier || 'Cashier'}</p>
        <p style="margin:2px 0;">Date: ${new Date(payload.timestamp || Date.now()).toLocaleString()}</p>
        <p style="margin:2px 0;">Payment: ${payload.method || '-'}</p>
        <div style="border-top:1px dashed #000; margin:6px 0;"></div>
        <table style="width:100%; font-size:11px; border-collapse:collapse;">
          <thead><tr><th style="text-align:left;">Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Sub</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="border-top:1px solid #000; border-bottom:1px solid #000; margin:8px 0; padding:5px 0;">
          <p style="margin:2px 0;text-align:right;font-weight:800; font-size:14px;">TOTAL: LKR ${totalAmount.toFixed(2)}</p>
          <p style="margin:2px 0;text-align:right;">PAID: LKR ${paidAmount.toFixed(2)}</p>
          <p style="margin:2px 0;text-align:right;">CHANGE: LKR ${changeDue.toFixed(2)}</p>
        </div>
        <p style="text-align:center;margin-top:10px; font-size:12px; font-weight:700;">Thank you! Come Again.</p>
      </div>`;
}

async function ensureLegacyBatchCoverage(productId) {
    const product = await getAsync(
        'SELECT id, current_stock, cost_price, selling_price, expiry_date FROM products WHERE id = ?',
        [productId]
    );
    if (!product) return;

    const sumRow = await getAsync(
        'SELECT COALESCE(SUM(remaining_qty), 0) AS batch_stock FROM inventory_batches WHERE product_id = ?',
        [productId]
    );

    const productStock = Number(product.current_stock || 0);
    const batchStock = Number(sumRow?.batch_stock || 0);
    const delta = Number((productStock - batchStock).toFixed(6));

    if (delta > 0.000001) {
        await runAsync(
            `INSERT INTO inventory_batches (product_id, batch_code, received_qty, remaining_qty, cost_price, selling_price, expiry_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                productId,
                `LEGACY-${productId}-${Date.now()}`,
                delta,
                delta,
                Number(product.cost_price || 0),
                Number(product.selling_price || 0),
                product.expiry_date || null
            ]
        );
    }
}

async function allocateFifoBatchesForSale({
    saleId,
    saleItemId,
    product,
    requestedQty,
    allowStockOverride,
    cashierName,
    overrideNote
}) {
    await ensureLegacyBatchCoverage(product.id);

    let needed = Number(requestedQty || 0);
    if (needed <= 0) {
        return { costTotal: 0, allocations: [], availableStock: 0 };
    }

    const availableRow = await getAsync(
        'SELECT COALESCE(SUM(remaining_qty), 0) AS qty FROM inventory_batches WHERE product_id = ?',
        [product.id]
    );
    const availableStock = Number(availableRow?.qty || 0);

    if (availableStock + 0.000001 < needed && !allowStockOverride) {
        throw new Error(`INSUFFICIENT_STOCK: ${product.name}`);
    }

    const fifoBatches = await allAsync(
        `SELECT id, remaining_qty, cost_price, expiry_date, created_at
         FROM inventory_batches
         WHERE product_id = ? AND remaining_qty > 0
         ORDER BY CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END ASC,
                  expiry_date ASC,
                  created_at ASC,
                  id ASC`,
        [product.id]
    );

    const allocations = [];
    let costTotal = 0;

    for (let i = 0; i < fifoBatches.length && needed > 0; i += 1) {
        const batch = fifoBatches[i];
        const batchRemaining = Number(batch.remaining_qty || 0);
        if (batchRemaining <= 0) continue;

        const takeQty = Math.min(needed, batchRemaining);
        if (takeQty <= 0) continue;

        await runAsync('UPDATE inventory_batches SET remaining_qty = remaining_qty - ? WHERE id = ?', [takeQty, batch.id]);

        const costPrice = Number(batch.cost_price || 0);
        const subtotalCost = takeQty * costPrice;
        costTotal += subtotalCost;

        await runAsync(
            `INSERT INTO sale_item_batches (sale_id, sale_item_id, product_id, batch_id, qty, cost_price, subtotal_cost)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [saleId, saleItemId, product.id, batch.id, takeQty, costPrice, subtotalCost]
        );

        allocations.push({
            batchId: batch.id,
            qty: takeQty,
            costPrice,
            expiryDate: batch.expiry_date || null
        });

        needed -= takeQty;
    }

    if (needed > 0) {
        if (!allowStockOverride) {
            throw new Error(`INSUFFICIENT_STOCK: ${product.name}`);
        }

        const fallbackCostPrice = Number(product.cost_price || 0);
        const overrideSubtotalCost = needed * fallbackCostPrice;
        costTotal += overrideSubtotalCost;

        await runAsync(
            `INSERT INTO sale_item_batches (sale_id, sale_item_id, product_id, batch_id, qty, cost_price, subtotal_cost)
             VALUES (?, ?, ?, NULL, ?, ?, ?)`,
            [saleId, saleItemId, product.id, needed, fallbackCostPrice, overrideSubtotalCost]
        );

        await runAsync(
            `INSERT INTO stock_override_audit (sale_id, product_id, requested_qty, available_qty, override_qty, cashier_name, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [saleId, product.id, Number(requestedQty || 0), availableStock, needed, cashierName || 'Cashier', overrideNote || null]
        );

        allocations.push({
            batchId: null,
            qty: needed,
            costPrice: fallbackCostPrice,
            override: true
        });
        needed = 0;
    }

    return { costTotal, allocations, availableStock };
}

ipcMain.handle('export-thermal-receipt-pdf', async (event, payload) => {
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fff;">${buildThermalReceiptHtml(payload)}</body></html>`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        pageSize: { width: 80000, height: 220000 }
    });
    win.close();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = path.join(os.homedir(), 'Documents', `receipt-${payload.billId || stamp}.pdf`);
    const save = await dialog.showSaveDialog({ title: 'Save Thermal Receipt PDF', defaultPath, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (save.canceled || !save.filePath) return { success: false, cancelled: true };
    fs.writeFileSync(save.filePath, pdfData);
    return { success: true, path: save.filePath };
});

ipcMain.handle('generate-thermal-receipt-pdf-auto', async (event, payload) => {
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fff;">${buildThermalReceiptHtml(payload)}</body></html>`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        pageSize: { width: 80000, height: 220000 }
    });
    win.close();

    const outDir = path.join(os.homedir(), 'Documents', 'QuickPOS', 'ThermalReceipts');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(outDir, `receipt-${payload.billId || stamp}.pdf`);
    fs.writeFileSync(outPath, pdfData);
    return { success: true, path: outPath };
});

ipcMain.handle('print-thermal-receipt', async (event, payload) => {
    return new Promise(async (resolve) => {
        const printWin = new BrowserWindow({
            show: false,
            webPreferences: { nodeIntegration: false, contextIsolation: true }
        });
        const html = `<!doctype html><html><body style="margin:0;padding:0;">${buildThermalReceiptHtml(payload)}</body></html>`;
        await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        
        printWin.webContents.print({
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: { width: 80000, height: 220000 }
        }, (success, failureReason) => {
            printWin.close();
            resolve({ success, failureReason });
        });
    });
});

ipcMain.handle('export-shift-summary-pdf', async (event, summary) => {
    const html = `<!doctype html><html><body style="font-family:Manrope,Arial,sans-serif;padding:24px;color:#111">
      <h2 style="margin:0 0 8px 0">Shift Summary (Z-Report)</h2>
      <p style="margin:0 0 14px 0">Cashier: ${summary.cashierName || '-'} | Started: ${summary.startedTime || '-'} | Duration: ${summary.duration || '-'}</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Cash Sales</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">LKR ${Number(summary.cashTotal || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Card Sales</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">LKR ${Number(summary.cardTotal || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Credit Sales</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">LKR ${Number(summary.creditTotal || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Items Sold</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">${Number(summary.itemsSold || 0).toFixed(0)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Opening Float</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">LKR ${Number(summary.openingFloat || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Expected Drawer</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">LKR ${Number(summary.expectedDrawer || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Actual Drawer</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">LKR ${Number(summary.actualDrawer || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Variance</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right; color:${Number(summary.variance || 0) === 0 ? '#111' : '#dc2626'}">LKR ${Number(summary.variance || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea;font-weight:700">Total Revenue</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right;font-weight:700">LKR ${Number(summary.revenueTotal || 0).toFixed(2)}</td></tr>
      </table>
    </body></html>`;
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
    win.close();
    const stamp = new Date().toISOString().slice(0, 10);
    const save = await dialog.showSaveDialog({
        title: 'Save Shift Summary PDF',
        defaultPath: path.join(os.homedir(), 'Documents', `shift-summary-${stamp}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (save.canceled || !save.filePath) return { success: false, cancelled: true };
    fs.writeFileSync(save.filePath, pdfData);
    return { success: true, path: save.filePath };
});

ipcMain.handle('record-shift-reconciliation', async (event, payload) => withTransaction(async () => {
    const result = await runAsync(
        `INSERT INTO shift_reconciliations (
            cashier_name, shift_start, shift_end, opening_float, cash_sales, card_sales, credit_sales,
            total_sales, expected_drawer, actual_drawer, variance, items_sold, notes
         ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.cashierName || 'Cashier',
            payload.shiftStart || null,
            Number(payload.openingFloat || 0),
            Number(payload.cashTotal || 0),
            Number(payload.cardTotal || 0),
            Number(payload.creditTotal || 0),
            Number(payload.revenueTotal || 0),
            Number(payload.expectedDrawer || 0),
            Number(payload.actualDrawer || 0),
            Number(payload.variance || 0),
            Number(payload.itemsSold || 0),
            payload.notes || null
        ]
    );
    return { success: true, id: result.lastID };
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

ipcMain.handle('get-sales-history', async () => {
    const sales = await allAsync('SELECT * FROM sales ORDER BY timestamp DESC');
    const items = await allAsync('SELECT sale_id, product_name, product_id, quantity, unit_price, subtotal, cost_total, profit_total, batch_trace FROM sale_items');
    const itemsBySaleId = {};
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!itemsBySaleId[item.sale_id]) {
            itemsBySaleId[item.sale_id] = [];
        }
        itemsBySaleId[item.sale_id].push(item);
    }
    for (let i = 0; i < sales.length; i++) {
        sales[i].items = itemsBySaleId[sales[i].id] || [];
    }
    return sales;
});
ipcMain.handle('get-sale-details', async (event, saleId) => allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]));

ipcMain.handle('get-printers', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win.webContents.getPrintersAsync();
});



app.whenReady().then(async () => {
    // Upgrade any remaining plain-text passwords
    const plainUsers = await allAsync("SELECT id, password FROM users WHERE password NOT LIKE 'pbkdf2$%'");
    for (const u of plainUsers) {
        await runAsync('UPDATE users SET password = ? WHERE id = ?', [hashPassword(u.password), u.id]);
    }

    // Repair any malformed pbkdf2 hashes (e.g. written by external scripts during DB lock)
    const allUsers = await allAsync("SELECT id, username, role, password FROM users WHERE password LIKE 'pbkdf2$%'");
    for (const u of allUsers) {
        const parts = u.password.split('$');
        const iterations = Number(parts[1]);
        if (parts.length < 4 || isNaN(iterations) || iterations < 1) {
            // Hash is corrupt — reset to a safe default so user can login & change via Settings
            const defaultPass = u.role === 'owner' ? '123' : '456';
            console.warn(`[STARTUP] Repaired malformed hash for user: ${u.username} (role: ${u.role}) → reset to default`);
            await runAsync('UPDATE users SET password = ? WHERE id = ?', [hashPassword(defaultPass), u.id]);
        }
    }

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('print-receipt-silent', async (event, options = {}) => {
    console.log('[PRINT DEBUG] Main process received print request for device:', options.deviceName || 'default');
    
    if (options.html) {
        return new Promise(async (resolve) => {
            const printWin = new BrowserWindow({
                show: false,
                webPreferences: { nodeIntegration: false, contextIsolation: true }
            });
            
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body { margin: 0; padding: 0; background: #fff; color: #000; }
                    ${options.css || ''}
                  </style>
                </head>
                <body>${options.html}</body>
                </html>
            `;
            
            await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
            
            console.log('[PRINT DEBUG] Hidden print window loaded HTML. Triggering print...');
            const printOptions = {
                silent: true,
                printBackground: true,
                margins: { marginType: 'none' },
                pageSize: { width: 80000, height: 297000 } // 80mm width, 297mm height in microns
            };
            if (options.deviceName) printOptions.deviceName = options.deviceName;
            
            printWin.webContents.print(printOptions, (success, failureReason) => {
                console.log(`[PRINT DEBUG] Print finished. Success: ${success}, Reason: ${failureReason}`);
                if (!success) console.error(`[PRINT ERROR] Details: ${failureReason}`);
                printWin.close();
                resolve({ success, failureReason });
            });
        });
    }

    const win = BrowserWindow.fromWebContents(event.sender);
    return new Promise((resolve) => {
        const printOptions = { silent: true, printBackground: true, margins: { marginType: 'none' } };
        if (options.deviceName) printOptions.deviceName = options.deviceName;
        
        win.webContents.print(printOptions, (success, failureReason) => {
            resolve({ success, failureReason });
        });
    });
});
