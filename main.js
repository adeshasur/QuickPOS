const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database.js');

function createWindow() {
    // App window එක හදන තැන
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1000,
        minHeight: 600,
        // මෙතනින් තමයි icon එක සෙට් කරන්නේ
        icon: path.join(__dirname, 'assets/images/icon.png'),
        webPreferences: {
            nodeIntegration: false, // Security එකට හොඳ මෙහෙම කරන එක
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // මුලින්ම පේන්න ඕනේ පේජ් එක (login.html)
    mainWindow.loadFile(path.join(__dirname, 'pages/login.html'));

    // Menu bar එක hide කරනවා (Professional look එකට)
    mainWindow.setMenuBarVisibility(false);
}

// --- IPC Handlers (Security & Data Integrity) ---

// 1. Authentication
ipcMain.handle('login-auth', async (event, { username, password, role }) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE username = ? AND password = ? AND role = ?", 
        [username, password, role], (err, row) => {
            if (err) reject(err);
            if (row) resolve({ success: true, user: { name: row.name, role: row.role } });
            else resolve({ success: false, message: "Invalid credentials" });
        });
    });
});

// 2. Products Handlers
ipcMain.handle('add-product', async (event, p) => {
    const sql = `INSERT INTO products (barcode, name, category_id, cost_price, selling_price, current_stock, unit_type, expiry_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    return new Promise((resolve, reject) => {
        db.run(sql, [p.barcode, p.name, p.categoryId, p.cost, p.price, p.stock, p.unit, p.expiry], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
        });
    });
});

ipcMain.handle('get-products', async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM products", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('search-barcode', async (event, barcode) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM products WHERE barcode = ?", [barcode], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
});

ipcMain.handle('get-expired-items', async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM products WHERE expiry_date <= date('now', '+30 days')", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

// 3. Category Handlers
ipcMain.handle('get-categories', async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM categories", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('add-category', async (event, name) => {
    const sql = `INSERT INTO categories (name) VALUES (?)`;
    return new Promise((resolve, reject) => {
        db.run(sql, [name], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
        });
    });
});

// 4. Sales & Inventory Integrity (TRANSACTIONAL)
ipcMain.handle('save-sale', async (event, saleData) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION"); // මාරම වැදගත් කොටස

            const stmt = db.prepare(`INSERT INTO sales (bill_id, customer_id, total_amount, payment_method, received_amount, balance_amount, cashier_name) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            stmt.run([saleData.billId, saleData.customerId, saleData.total, saleData.method, saleData.received, saleData.change, saleData.cashier], function(err) {
                if (err) { db.run("ROLLBACK"); reject(err); return; }
                
                const saleId = this.lastID;
                const itemStmt = db.prepare(`INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)`);
                const stockStmt = db.prepare(`UPDATE products SET current_stock = current_stock - ? WHERE id = ?`);

                saleData.items.forEach(item => {
                    itemStmt.run([saleId, item.id, item.qty, item.price, (item.qty * item.price)]);
                    stockStmt.run([item.qty, item.id]); // ස්ටොක් එක අඩු කරන තැන
                });

                itemStmt.finalize();
                stockStmt.finalize();
                db.run("COMMIT", (err) => {
                    if (err) { db.run("ROLLBACK"); reject(err); }
                    else resolve({ success: true, id: saleId });
                });
            });
        });
    });
});

ipcMain.handle('get-sales-history', async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM sales ORDER BY timestamp DESC", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

app.whenReady().then(createWindow);

// Windows ඔක්කොම වහපු ගමන් app එක quit වෙන්න
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
hen(createWindow);

// Windows ඔක්කොම වහපු ගමන් app එක quit වෙන්න
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});