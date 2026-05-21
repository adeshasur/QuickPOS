const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

process.env.QUICKPOS_DB_DIR = app.getPath('userData');
const db = require('./database.js');

const DB_FILE_PATH = path.join(process.env.QUICKPOS_DB_DIR, 'quickpos.db');
let autoBackupTimer = null;

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

async function getSettingValue(key, fallback = '') {
    const row = await getAsync('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value ?? fallback;
}

async function saveSettingValue(key, value) {
    await runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
}

async function logAudit(entityType, entityId, action, detail = '', userName = '') {
    await runAsync(
        'INSERT INTO audit_log (entity_type, entity_id, action, detail, user_name) VALUES (?, ?, ?, ?, ?)',
        [entityType, entityId || null, action, typeof detail === 'string' ? detail : JSON.stringify(detail), userName || 'System']
    );
}

function getLocalDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function sanitizeFilePart(value) {
    return String(value || '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '-')
        .slice(0, 80) || 'quickpos';
}

function findGoogleDriveBackupDir() {
    const home = os.homedir();
    const candidates = [
        path.join(home, 'Google Drive', 'My Drive'),
        path.join(home, 'Google Drive'),
        path.join(home, 'My Drive')
    ];

    for (let code = 67; code <= 90; code += 1) {
        const letter = String.fromCharCode(code);
        candidates.push(`${letter}:\\My Drive`);
        candidates.push(`${letter}:\\Google Drive`);
    }

    const root = candidates.find((candidate) => fs.existsSync(candidate));
    if (root) {
        return { dir: path.join(root, 'QuickPOS Backups'), storage: 'Google Drive' };
    }

    return {
        dir: path.join(app.getPath('userData'), 'AutoBackups'),
        storage: 'Local fallback'
    };
}

async function createDatabaseBackupFile(targetDir, email) {
    await runAsync('PRAGMA wal_checkpoint(FULL)');
    fs.mkdirSync(targetDir, { recursive: true });

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const emailPart = sanitizeFilePart(email).replace('@', '-at-');
    const filePath = path.join(targetDir, `quickpos-${emailPart}-${stamp}.db`);
    fs.copyFileSync(DB_FILE_PATH, filePath);
    return filePath;
}

async function runGoogleDriveAutoBackup({ force = false } = {}) {
    const email = String(await getSettingValue('googleDriveBackupEmail', '')).trim();
    if (!email) {
        return { success: false, skipped: true, message: 'Add a Gmail address to enable daily auto backup.' };
    }

    const todayKey = getLocalDateKey();
    const lastDate = await getSettingValue('googleDriveBackupLastDate', '');
    if (!force && lastDate === todayKey) {
        const lastPath = await getSettingValue('googleDriveBackupLastPath', '');
        return { success: true, skipped: true, path: lastPath, message: 'Today backup already completed.' };
    }

    const backupTarget = findGoogleDriveBackupDir();
    try {
        const backupPath = await createDatabaseBackupFile(backupTarget.dir, email);
        const nowIso = new Date().toISOString();
        await saveSettingValue('googleDriveBackupLastDate', todayKey);
        await saveSettingValue('googleDriveBackupLastAt', nowIso);
        await saveSettingValue('googleDriveBackupLastPath', backupPath);
        await saveSettingValue('googleDriveBackupStorage', backupTarget.storage);
        await saveSettingValue('googleDriveBackupLastResult', 'success');
        return { success: true, path: backupPath, storage: backupTarget.storage, lastAt: nowIso };
    } catch (err) {
        await saveSettingValue('googleDriveBackupLastResult', `failed: ${err.message}`);
        throw err;
    }
}

function scheduleGoogleDriveAutoBackup() {
    if (autoBackupTimer) clearInterval(autoBackupTimer);

    const run = () => {
        runGoogleDriveAutoBackup().catch((err) => {
            console.error('[AUTO BACKUP] Failed:', err);
        });
    };

    setTimeout(run, 5000);
    autoBackupTimer = setInterval(run, 60 * 60 * 1000);
}

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

async function ensureDefaultLoginUsers() {
    const defaults = [
        ['Nadeesha Perera', 'owner', 'owner@123', 'owner', 1],
        ['Kasun Fernando', 'cashier1', 'cashier@123', 'cashier', 0]
    ];

    for (const [name, username, password, role, canViewReports] of defaults) {
        const existing = await getAsync('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) continue;

        await runAsync(
            'INSERT INTO users (name, username, password, role, can_view_reports) VALUES (?, ?, ?, ?, ?)',
            [name, username, hashPassword(password), role, canViewReports]
        );
    }
}

async function ensureGoogleDriveBackupSettings() {
    const defaults = {
        googleDriveBackupEmail: '',
        googleDriveBackupLastDate: '',
        googleDriveBackupLastAt: '',
        googleDriveBackupLastPath: '',
        googleDriveBackupStorage: '',
        googleDriveBackupLastResult: ''
    };

    for (const [key, value] of Object.entries(defaults)) {
        const row = await getAsync('SELECT key FROM settings WHERE key = ?', [key]);
        if (!row) await saveSettingValue(key, value);
    }
}

async function ensurePerformanceIndexes() {
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)',
        'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
        'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
        'CREATE INDEX IF NOT EXISTS idx_products_stock_alert ON products(current_stock, alert_level)',
        'CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date)',
        'CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_sales_bill_id ON sales(bill_id)',
        'CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_name)',
        'CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)',
        'CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)',
        'CREATE INDEX IF NOT EXISTS idx_batches_product_remaining ON inventory_batches(product_id, remaining_qty)'
    ];

    for (const sql of indexes) {
        await runAsync(sql);
    }
}

async function ensureShiftSalaryColumns() {
    const columns = await allAsync('PRAGMA table_info(shift_reconciliations)');
    const names = new Set(columns.map((col) => col.name));
    if (!names.has('salary_basis')) await runAsync('ALTER TABLE shift_reconciliations ADD COLUMN salary_basis TEXT');
    if (!names.has('salary_amount')) await runAsync('ALTER TABLE shift_reconciliations ADD COLUMN salary_amount REAL DEFAULT 0');
    if (!names.has('salary_earned')) await runAsync('ALTER TABLE shift_reconciliations ADD COLUMN salary_earned REAL DEFAULT 0');
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

ipcMain.handle('run-google-drive-backup-now', async () => runGoogleDriveAutoBackup({ force: true }));

ipcMain.handle('get-google-drive-backup-status', async () => ({
    email: await getSettingValue('googleDriveBackupEmail', ''),
    lastAt: await getSettingValue('googleDriveBackupLastAt', ''),
    lastPath: await getSettingValue('googleDriveBackupLastPath', ''),
    storage: await getSettingValue('googleDriveBackupStorage', ''),
    lastResult: await getSettingValue('googleDriveBackupLastResult', '')
}));

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

ipcMain.handle('get-products', async (event, options = {}) => {
    const limit = Math.min(Math.max(Number(options.limit || 1000), 1), 5000);
    return allAsync('SELECT * FROM products ORDER BY id DESC LIMIT ?', [limit]);
});

ipcMain.handle('get-products-page', async (event, options = {}) => {
    const limit = Math.min(Math.max(Number(options.limit || 100), 1), 500);
    const offset = Math.max(Number(options.offset || 0), 0);
    const search = String(options.search || '').trim();
    const categoryId = Number(options.categoryId || 0);
    const where = [];
    const params = [];

    if (search) {
        where.push('(name LIKE ? OR barcode LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    if (categoryId) {
        where.push('category_id = ?');
        params.push(categoryId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRow = await getAsync(`SELECT COUNT(*) AS count FROM products ${whereSql}`, params);
    const items = await allAsync(
        `SELECT * FROM products ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    return { items, total: Number(countRow?.count || 0), limit, offset };
});

ipcMain.handle('search-products', async (event, options = {}) => {
    const q = String(options.query || '').trim();
    const categoryId = Number(options.categoryId || 0);
    const limit = Math.min(Math.max(Number(options.limit || 50), 1), 100);
    const where = [];
    const params = [];

    if (q) {
        where.push('(barcode = ? OR barcode LIKE ? OR name LIKE ?)');
        params.push(q, `${q}%`, `%${q}%`);
    }
    if (categoryId) {
        where.push('category_id = ?');
        params.push(categoryId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return allAsync(
        `SELECT * FROM products ${whereSql} ORDER BY CASE WHEN barcode = ? THEN 0 ELSE 1 END, name ASC LIMIT ?`,
        [...params, q, limit]
    );
});

ipcMain.handle('get-product-stats', async () => {
    const row = await getAsync(`
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(current_stock, 0) <= COALESCE(alert_level, 0) THEN 1 ELSE 0 END) AS low_stock,
            SUM(CASE WHEN COALESCE(current_stock, 0) = 0 THEN 1 ELSE 0 END) AS out_of_stock,
            SUM(COALESCE(current_stock, 0) * COALESCE(selling_price, 0)) AS total_value
        FROM products
    `);
    return {
        total: Number(row?.total || 0),
        lowStock: Number(row?.low_stock || 0),
        outOfStock: Number(row?.out_of_stock || 0),
        totalValue: Number(row?.total_value || 0)
    };
});

ipcMain.handle('get-low-stock-summary', async () => {
    const countRow = await getAsync(`
        SELECT COUNT(*) AS count
        FROM products
        WHERE COALESCE(current_stock, 0) >= 0
          AND COALESCE(current_stock, 0) <= COALESCE(alert_level, 0)
    `);
    const items = await allAsync(`
        SELECT id, name, current_stock
        FROM products
        WHERE COALESCE(current_stock, 0) >= 0
          AND COALESCE(current_stock, 0) <= COALESCE(alert_level, 0)
        ORDER BY current_stock ASC, name ASC
        LIMIT 8
    `);
    return { count: Number(countRow?.count || 0), items };
});

ipcMain.handle('get-notification-summary', async () => {
    const lowCountRow = await getAsync(`
        SELECT COUNT(*) AS count
        FROM products
        WHERE COALESCE(current_stock, 0) >= 0
          AND COALESCE(current_stock, 0) <= COALESCE(alert_level, 0)
    `);
    const lowItems = await allAsync(`
        SELECT id, name, current_stock, alert_level
        FROM products
        WHERE COALESCE(current_stock, 0) >= 0
          AND COALESCE(current_stock, 0) <= COALESCE(alert_level, 0)
        ORDER BY current_stock ASC, name ASC
        LIMIT 8
    `);

    const stockProducts = await allAsync('SELECT id FROM products WHERE COALESCE(current_stock, 0) > 0');
    for (const product of stockProducts) {
        await ensureLegacyBatchCoverage(product.id);
    }

    const expiryCountRow = await getAsync(`
        SELECT COUNT(*) AS count
        FROM inventory_batches
        WHERE COALESCE(remaining_qty, 0) > 0
          AND expiry_date IS NOT NULL
          AND expiry_date != ''
          AND date(expiry_date) >= date('now')
          AND date(expiry_date) <= date('now', '+30 days')
    `);
    const expiryItems = await allAsync(`
        SELECT
            b.id,
            p.name,
            b.remaining_qty,
            b.expiry_date,
            CAST(julianday(date(b.expiry_date)) - julianday(date('now')) AS INTEGER) AS days_left
        FROM inventory_batches b
        JOIN products p ON p.id = b.product_id
        WHERE COALESCE(b.remaining_qty, 0) > 0
          AND b.expiry_date IS NOT NULL
          AND b.expiry_date != ''
          AND date(b.expiry_date) >= date('now')
          AND date(b.expiry_date) <= date('now', '+30 days')
        ORDER BY date(b.expiry_date) ASC, p.name ASC
        LIMIT 8
    `);

    const lowCount = Number(lowCountRow?.count || 0);
    const expiryCount = Number(expiryCountRow?.count || 0);
    return {
        total: lowCount + expiryCount,
        lowStock: { count: lowCount, items: lowItems },
        expiringSoon: { count: expiryCount, items: expiryItems }
    };
});

ipcMain.handle('get-inventory-batches', async () => {
    const stockProducts = await allAsync('SELECT id FROM products WHERE COALESCE(current_stock, 0) > 0');
    for (const product of stockProducts) {
        await ensureLegacyBatchCoverage(product.id);
    }

    return allAsync(`
        SELECT
            b.id AS batch_id,
            b.product_id,
            b.batch_code,
            b.received_qty,
            b.remaining_qty,
            b.cost_price,
            b.selling_price,
            b.expiry_date,
            b.created_at,
            p.name,
            p.category_id,
            p.unit_type,
            p.current_stock,
            c.name AS category_name
        FROM inventory_batches b
        JOIN products p ON p.id = b.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE COALESCE(b.remaining_qty, 0) > 0
        ORDER BY CASE WHEN b.expiry_date IS NULL OR b.expiry_date = '' THEN 1 ELSE 0 END ASC,
                 date(b.expiry_date) ASC,
                 p.name ASC,
                 b.id ASC
    `);
});

ipcMain.handle('get-suppliers', async () => allAsync('SELECT * FROM suppliers ORDER BY name ASC'));

ipcMain.handle('save-supplier', async (event, supplier) => {
    const id = Number(supplier.id || 0);
    if (!String(supplier.name || '').trim()) throw new Error('Supplier name is required.');
    if (id) {
        await runAsync(
            `UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, contact_person = ? WHERE id = ?`,
            [supplier.name, supplier.phone || '', supplier.email || '', supplier.address || '', supplier.contactPerson || '', id]
        );
        await logAudit('supplier', id, 'update', supplier, supplier.userName);
        return { success: true, id };
    }
    const result = await runAsync(
        `INSERT INTO suppliers (name, phone, email, address, contact_person) VALUES (?, ?, ?, ?, ?)`,
        [supplier.name, supplier.phone || '', supplier.email || '', supplier.address || '', supplier.contactPerson || '']
    );
    await logAudit('supplier', result.lastID, 'create', supplier, supplier.userName);
    return { success: true, id: result.lastID };
});

ipcMain.handle('get-product-discounts', async () => allAsync(`
    SELECT d.*, p.name AS product_name
    FROM product_discounts d
    JOIN products p ON p.id = d.product_id
    ORDER BY d.active DESC, d.created_at DESC
`));

ipcMain.handle('save-product-discount', async (event, discount) => {
    const productId = Number(discount.productId || discount.product_id || 0);
    const value = Number(discount.discountValue ?? discount.discount_value ?? 0);
    if (!productId) throw new Error('Product is required.');
    if (value < 0) throw new Error('Discount cannot be negative.');
    const result = await runAsync(
        `INSERT INTO product_discounts (product_id, discount_type, discount_value, starts_at, ends_at, active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [productId, discount.discountType || 'amount', value, discount.startsAt || null, discount.endsAt || null, discount.active === false ? 0 : 1, discount.userName || 'System']
    );
    await logAudit('discount', result.lastID, 'create', discount, discount.userName);
    return { success: true, id: result.lastID };
});

ipcMain.handle('record-stock-adjustment', async (event, payload) => {
    return withTransaction(async () => {
        const productId = Number(payload.productId || 0);
        const batchId = payload.batchId ? Number(payload.batchId) : null;
        const qty = Number(payload.quantity || 0);
        const type = String(payload.adjustmentType || 'wastage');
        if (!productId || qty <= 0) throw new Error('Valid product and quantity are required.');

        if (['wastage', 'damage', 'expired', 'decrease'].includes(type)) {
            await ensureLegacyBatchCoverage(productId);
            let needed = qty;
            const batches = await allAsync(
                `SELECT id, remaining_qty FROM inventory_batches
                 WHERE product_id = ? AND remaining_qty > 0 ${batchId ? 'AND id = ?' : ''}
                 ORDER BY CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END ASC, expiry_date ASC, created_at ASC, id ASC`,
                batchId ? [productId, batchId] : [productId]
            );
            for (const batch of batches) {
                if (needed <= 0) break;
                const takeQty = Math.min(needed, Number(batch.remaining_qty || 0));
                if (takeQty <= 0) continue;
                await runAsync('UPDATE inventory_batches SET remaining_qty = remaining_qty - ? WHERE id = ?', [takeQty, batch.id]);
                needed -= takeQty;
            }
            const actual = qty - Math.max(0, needed);
            await runAsync('UPDATE products SET current_stock = MAX(0, current_stock - ?) WHERE id = ?', [actual, productId]);
        } else {
            await runAsync('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [qty, productId]);
        }

        const result = await runAsync(
            `INSERT INTO stock_adjustments (product_id, batch_id, adjustment_type, quantity, reason, note, user_name)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [productId, batchId, type, qty, payload.reason || '', payload.note || '', payload.userName || 'System']
        );
        await logAudit('stock_adjustment', result.lastID, type, payload, payload.userName);
        return { success: true, id: result.lastID };
    });
});

ipcMain.handle('record-return', async (event, payload) => {
    return withTransaction(async () => {
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (!items.length) throw new Error('Return items are required.');
        const refundAmount = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
        const result = await runAsync(
            `INSERT INTO returns (sale_id, bill_id, customer_id, refund_amount, reason, user_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [payload.saleId || null, payload.billId || '', payload.customerId || null, refundAmount, payload.reason || '', payload.userName || 'System']
        );
        for (const item of items) {
            const qty = Number(item.quantity || 0);
            const unitPrice = Number(item.unitPrice || 0);
            await runAsync(
                `INSERT INTO return_items (return_id, sale_item_id, product_id, quantity, unit_price, subtotal, restock)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [result.lastID, item.saleItemId || null, item.productId, qty, unitPrice, qty * unitPrice, item.restock === false ? 0 : 1]
            );
            if (item.restock !== false) {
                await runAsync('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [qty, item.productId]);
                const product = await getAsync('SELECT cost_price, selling_price, expiry_date FROM products WHERE id = ?', [item.productId]);
                await runAsync(
                    `INSERT INTO inventory_batches (product_id, batch_code, received_qty, remaining_qty, cost_price, selling_price, expiry_date)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [item.productId, `RETURN-${result.lastID}-${Date.now()}`, qty, qty, Number(product?.cost_price || 0), Number(product?.selling_price || unitPrice), product?.expiry_date || null]
                );
            }
        }
        await logAudit('return', result.lastID, 'create', payload, payload.userName);
        return { success: true, id: result.lastID, refundAmount };
    });
});

ipcMain.handle('get-stock-adjustments', async () => allAsync(`
    SELECT a.*, p.name AS product_name
    FROM stock_adjustments a
    JOIN products p ON p.id = a.product_id
    ORDER BY a.created_at DESC
    LIMIT 500
`));

ipcMain.handle('get-returns', async () => allAsync('SELECT * FROM returns ORDER BY created_at DESC LIMIT 500'));

ipcMain.handle('save-unit-conversion', async (event, payload) => {
    const factor = Number(payload.factor || 0);
    if (!payload.fromUnit || !payload.toUnit || factor <= 0) throw new Error('Valid unit conversion is required.');
    const result = await runAsync(
        `INSERT INTO unit_conversions (product_id, from_unit, to_unit, factor) VALUES (?, ?, ?, ?)`,
        [payload.productId || null, payload.fromUnit, payload.toUnit, factor]
    );
    await logAudit('unit_conversion', result.lastID, 'create', payload, payload.userName);
    return { success: true, id: result.lastID };
});

ipcMain.handle('get-unit-conversions', async () => allAsync(`
    SELECT u.*, p.name AS product_name
    FROM unit_conversions u
    LEFT JOIN products p ON p.id = u.product_id
    ORDER BY u.created_at DESC
`));

ipcMain.handle('get-price-history', async (event, productId = null) => allAsync(`
    SELECT h.*, p.name AS product_name
    FROM price_history h
    JOIN products p ON p.id = h.product_id
    ${productId ? 'WHERE h.product_id = ?' : ''}
    ORDER BY h.created_at DESC
    LIMIT 500
`, productId ? [productId] : []));

ipcMain.handle('get-reorder-list', async () => allAsync(`
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE COALESCE(p.current_stock, 0) <= COALESCE(p.alert_level, 0)
    ORDER BY p.current_stock ASC, p.name ASC
`));

ipcMain.handle('get-audit-log', async () => allAsync('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500'));

ipcMain.handle('update-product', async (event, p) => {
    const oldProduct = await getAsync('SELECT cost_price, selling_price FROM products WHERE id = ?', [p.id]);
    await runAsync(
        'UPDATE products SET barcode = ?, name = ?, category_id = ?, cost_price = ?, selling_price = ?, alert_level = ?, unit_type = ?, is_weighted = ?, expiry_date = COALESCE(?, expiry_date), reorder_qty = COALESCE(?, reorder_qty) WHERE id = ?',
        [p.barcode, p.name, p.categoryId, p.cost, p.price, p.alertLevel, p.unitType, p.isWeighted ? 1 : 0, p.expiryDate || null, p.reorderQty ?? null, p.id]
    );
    if (oldProduct && (Number(oldProduct.cost_price || 0) !== Number(p.cost || 0) || Number(oldProduct.selling_price || 0) !== Number(p.price || 0))) {
        await runAsync(
            `INSERT INTO price_history (product_id, old_cost_price, new_cost_price, old_selling_price, new_selling_price, changed_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [p.id, oldProduct.cost_price, p.cost, oldProduct.selling_price, p.price, p.userName || 'System']
        );
        await logAudit('product', p.id, 'price_change', {
            oldCost: oldProduct.cost_price,
            newCost: p.cost,
            oldPrice: oldProduct.selling_price,
            newPrice: p.price
        }, p.userName);
    }
    return { success: true };
});

ipcMain.handle('delete-product', async (event, id) => {
    await runAsync('DELETE FROM products WHERE id = ?', [id]);
    return { success: true };
});

ipcMain.handle('add-stock', async (event, { productId, quantity, costPrice, sellingPrice, expiryDate, supplierId, grnNo, purchaseInvoiceNo, userName }) => {
    return withTransaction(async () => {
        const qty = Number(quantity || 0);
        if (qty <= 0) throw new Error('Stock quantity must be greater than zero.');

        const batchResult = await runAsync(
            `INSERT INTO inventory_batches (product_id, batch_code, received_qty, remaining_qty, cost_price, selling_price, expiry_date, supplier_id, grn_no, purchase_invoice_no)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                productId,
                grnNo || `GRN-${productId}-${Date.now()}`,
                qty,
                qty,
                Number(costPrice || 0),
                Number(sellingPrice || 0),
                expiryDate || null,
                supplierId || null,
                grnNo || '',
                purchaseInvoiceNo || ''
            ]
        );

        await runAsync(
            'UPDATE products SET current_stock = current_stock + ?, cost_price = ?, selling_price = ?, expiry_date = ? WHERE id = ?',
            [qty, Number(costPrice || 0), Number(sellingPrice || 0), expiryDate || null, productId]
        );
        await logAudit('inventory_batch', batchResult.lastID, 'receive_stock', { productId, quantity: qty, supplierId, grnNo, purchaseInvoiceNo, expiryDate }, userName);
        return { success: true, batchId: batchResult.lastID };
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
    await runAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
        await runAsync('UPDATE products SET category_id = NULL WHERE category_id = ?', [id]);
        await runAsync('DELETE FROM categories WHERE id = ?', [id]);
        await runAsync('COMMIT');
        return { success: true, uncategorizedProducts: linkedProducts?.count || 0 };
    } catch (err) {
        await runAsync('ROLLBACK');
        return { success: false, message: err.message || 'Could not delete category.' };
    }
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

ipcMain.handle('get-user-shift-history', async (event, { cashierName, limit = 50 } = {}) => {
    const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200);
    const rows = await allAsync(
        `SELECT *
         FROM shift_reconciliations
         WHERE cashier_name = ?
         ORDER BY shift_end DESC, id DESC
         LIMIT ?`,
        [cashierName || '', safeLimit]
    );
    const summary = await getAsync(
        `SELECT
            COUNT(*) AS shift_count,
            COALESCE(SUM(total_sales), 0) AS total_sales,
            COALESCE(SUM(items_sold), 0) AS total_items,
            COALESCE(SUM(salary_earned), 0) AS total_salary,
            COALESCE(SUM(variance), 0) AS total_variance
         FROM shift_reconciliations
         WHERE cashier_name = ?`,
        [cashierName || '']
    );
    return { rows, summary };
});

ipcMain.handle('get-settings', async () => {
    const rows = await allAsync('SELECT * FROM settings');
    const settings = {};
    rows.forEach((row) => { settings[row.key] = row.value; });
    return settings;
});

ipcMain.handle('save-setting', async (event, key, value) => {
    await runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    if (key === 'googleDriveBackupEmail') scheduleGoogleDriveAutoBackup();
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
    const esc = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '\'': '&#39;',
        '"': '&quot;'
    }[char]));

    const itemsHtml = (payload.items || []).map((item) => {
        const qty = Number(item.qty || 0);
        const subtotal = qty * Number(item.price || 0);
        return `
          <tr>
            <td style="padding:4px 0; font-size:11px; line-height:1.45; color:#0f172a; font-weight:700; word-break:break-word; overflow-wrap:anywhere;">
              ${esc(item.name)}
            </td>
            <td style="padding:4px 0; text-align:center; font-size:11px; line-height:1.4; color:#0f172a; font-weight:700;">
              ${qty.toFixed(2).replace(/\\.00$/, '')}
            </td>
            <td style="padding:4px 0; text-align:right; font-size:11px; line-height:1.4; color:#0f172a; font-weight:800;">
              ${subtotal.toFixed(2)}
            </td>
          </tr>`;
    }).join('');

    const paidAmount = Number(payload.received || payload.total || 0);
    const totalAmount = Number(payload.total || 0);
    const changeDue = Math.max(0, paidAmount - totalAmount);
    const receiptDate = new Date(payload.timestamp || Date.now()).toLocaleString();

    return `
      <div style="font-family:'Noto Sans Sinhala','Iskoola Pota',sans-serif; width:302px; max-width:302px; padding:8px 10px; color:#0f172a; background:#ffffff;">
        <div style="text-align:center; margin-bottom:6px;">
          <div style="font-size:16px; line-height:1.25; font-weight:800; color:#0f172a;">QuickPOS Pro</div>
          <div style="font-size:10px; line-height:1.35; font-weight:700; color:#0f172a;">සිංහල බිල්පත</div>
        </div>

        <div style="border-top:1px dashed #0f172a; margin:6px 0;"></div>
        <p style="margin:2px 0; font-size:11px; line-height:1.35; color:#0f172a;"><strong>Bill:</strong> ${esc(payload.billId || '-')}</p>
        <p style="margin:2px 0; font-size:11px; line-height:1.35; color:#0f172a;"><strong>Cashier:</strong> ${esc(payload.cashier || 'Cashier')}</p>
        <p style="margin:2px 0; font-size:11px; line-height:1.35; color:#0f172a;"><strong>Date:</strong> ${esc(receiptDate)}</p>
        <p style="margin:2px 0; font-size:11px; line-height:1.35; color:#0f172a;"><strong>Payment:</strong> ${esc(payload.method || '-')}</p>
        <div style="border-top:1px dashed #0f172a; margin:6px 0;"></div>

        <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
          <colgroup>
            <col style="width:58%;">
            <col style="width:14%;">
            <col style="width:28%;">
          </colgroup>
          <thead>
            <tr>
              <th style="text-align:left; font-size:10px; line-height:1.35; color:#0f172a; font-weight:800; padding:2px 0;">භාණ්ඩය</th>
              <th style="text-align:center; font-size:10px; line-height:1.35; color:#0f172a; font-weight:800; padding:2px 0;">ප්‍ර.</th>
              <th style="text-align:right; font-size:10px; line-height:1.35; color:#0f172a; font-weight:800; padding:2px 0;">මුදල</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="border-top:1px solid #0f172a; border-bottom:1px solid #0f172a; margin:8px 0; padding:6px 0;">
          <p style="margin:2px 0; text-align:right; font-size:13px; line-height:1.35; color:#0f172a; font-weight:800;">එකතුව: LKR ${totalAmount.toFixed(2)}</p>
          <p style="margin:2px 0; text-align:right; font-size:11px; line-height:1.35; color:#0f172a; font-weight:700;">ගෙවූ මුදල: LKR ${paidAmount.toFixed(2)}</p>
          <p style="margin:2px 0; text-align:right; font-size:11px; line-height:1.35; color:#0f172a; font-weight:700;">ඉතුරු: LKR ${changeDue.toFixed(2)}</p>
        </div>

        <p style="text-align:center; margin-top:8px; font-size:11px; line-height:1.35; color:#0f172a; font-weight:700;">ස්තුතියි. නැවත එන්න.</p>
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
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Salary Basis</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">${String(summary.salaryBasis || '-')}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Salary Amount</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">LKR ${Number(summary.salaryAmount || 0).toFixed(2)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #dbe1ea">Salary Earned</td><td style="padding:8px;border:1px solid #dbe1ea;text-align:right">LKR ${Number(summary.salaryEarned || 0).toFixed(2)}</td></tr>
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

ipcMain.handle('export-report-pdf', async (event, payload = {}) => {
    const html = String(payload.html || '').trim();
    if (!html) throw new Error('Report content is empty.');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = String(payload.fileName || `quickpos-report-${stamp}.pdf`)
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\.pdf$/i, '');

    let targetPath;
    if (payload.mode === 'view') {
        const previewDir = path.join(app.getPath('userData'), 'ReportPreviews');
        fs.mkdirSync(previewDir, { recursive: true });
        targetPath = path.join(previewDir, `${safeName}.pdf`);
    } else {
        const save = await dialog.showSaveDialog({
            title: 'Save Report PDF',
            defaultPath: path.join(os.homedir(), 'Documents', `${safeName}.pdf`),
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });
        if (save.canceled || !save.filePath) return { success: false, cancelled: true };
        targetPath = save.filePath;
    }

    const win = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 24, bottom: 24, left: 20, right: 20 }
    });
    win.close();

    fs.writeFileSync(targetPath, pdfData);
    if (payload.mode === 'view') await shell.openPath(targetPath);

    return { success: true, path: targetPath };
});

ipcMain.handle('record-shift-reconciliation', async (event, payload) => withTransaction(async () => {
    const result = await runAsync(
        `INSERT INTO shift_reconciliations (
            cashier_name, shift_start, shift_end, opening_float, cash_sales, card_sales, credit_sales,
            total_sales, expected_drawer, actual_drawer, variance, items_sold,
            salary_basis, salary_amount, salary_earned, notes
         ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            payload.salaryBasis || null,
            Number(payload.salaryAmount || 0),
            Number(payload.salaryEarned || 0),
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

ipcMain.handle('get-sales-history', async (event, options = {}) => {
    const limit = Math.min(Math.max(Number(options.limit || 500), 1), 5000);
    const offset = Math.max(Number(options.offset || 0), 0);
    const sales = await allAsync('SELECT * FROM sales ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?', [limit, offset]);
    const saleIds = sales.map((sale) => sale.id);
    if (!saleIds.length) return [];

    const placeholders = saleIds.map(() => '?').join(',');
    const items = await allAsync(
        `SELECT sale_id, product_name, product_id, quantity, unit_price, subtotal, cost_total, profit_total, batch_trace
         FROM sale_items
         WHERE sale_id IN (${placeholders})`,
        saleIds
    );
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

ipcMain.handle('get-sales-page', async (event, options = {}) => {
    const limit = Math.min(Math.max(Number(options.limit || 100), 1), 500);
    const offset = Math.max(Number(options.offset || 0), 0);
    const from = String(options.from || '').trim();
    const to = String(options.to || '').trim();
    const where = [];
    const params = [];

    if (from) {
        where.push('date(timestamp) >= date(?)');
        params.push(from);
    }
    if (to) {
        where.push('date(timestamp) <= date(?)');
        params.push(to);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRow = await getAsync(`SELECT COUNT(*) AS count FROM sales ${whereSql}`, params);
    const items = await allAsync(
        `SELECT * FROM sales ${whereSql} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    return { items, total: Number(countRow?.count || 0), limit, offset };
});
ipcMain.handle('get-sale-details', async (event, saleId) => allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]));

ipcMain.handle('get-printers', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win.webContents.getPrintersAsync();
});



app.whenReady().then(async () => {
    await ensureDefaultLoginUsers();
    await ensureGoogleDriveBackupSettings();
    await ensureShiftSalaryColumns();
    await ensurePerformanceIndexes();

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
            const defaultPass = u.role === 'owner' ? 'owner@123' : 'cashier@123';
            console.warn(`[STARTUP] Repaired malformed hash for user: ${u.username} (role: ${u.role}) → reset to default`);
            await runAsync('UPDATE users SET password = ? WHERE id = ?', [hashPassword(defaultPass), u.id]);
        }
    }

    createWindow();
    scheduleGoogleDriveAutoBackup();
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
