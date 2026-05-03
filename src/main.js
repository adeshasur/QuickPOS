const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { db, setupDatabase } = require('./database/db');

setupDatabase();

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, 'renderer', 'assets', 'img', 'icon.jpeg'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'pages', 'auth', 'login.html'));
    mainWindow.maximize();
    mainWindow.setMenuBarVisibility(false);
}

ipcMain.on('login-attempt', (event, { username, password, role }) => {
    const query = "SELECT id, username, full_name, role FROM users WHERE username = ? AND password = ? AND role = ?";
    db.get(query, [username, password, role], (err, row) => {
        if (err) {
            event.reply('login-response', { success: false, message: 'Database Error' });
        } else if (row) {
            event.reply('login-response', { success: true, user: row });
        } else {
            event.reply('login-response', { success: false, message: 'Invalid Credentials or Role' });
        }
    });
});

ipcMain.handle('get-all-products', async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('get-product', async (_, id) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM products WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
});

ipcMain.handle('add-product', async (_, product) => {
    return new Promise((resolve, reject) => {
        const { name, sku, category_id, base_price, sale_price, cost_price, current_stock, alert_level, is_weighted, description } = product;
        db.run(
            "INSERT INTO products (name, sku, category_id, base_price, sale_price, cost_price, current_stock, alert_level, is_weighted, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [name, sku, category_id, base_price, sale_price, cost_price, current_stock, alert_level || 10, is_weighted ? 1 : 0, description],
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            }
        );
    });
});

ipcMain.handle('update-product', async (_, product) => {
    return new Promise((resolve, reject) => {
        const { id, name, sku, category_id, base_price, sale_price, cost_price, current_stock, alert_level, is_weighted, description } = product;
        db.run(
            "UPDATE products SET name=?, sku=?, category_id=?, base_price=?, sale_price=?, cost_price=?, current_stock=?, alert_level=?, is_weighted=?, description=? WHERE id=?",
            [name, sku, category_id, base_price, sale_price, cost_price, current_stock, alert_level, is_weighted ? 1 : 0, description, id],
            function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            }
        );
    });
});

ipcMain.handle('delete-product', async (_, id) => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM products WHERE id = ?", [id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
});

ipcMain.handle('get-all-categories', async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM categories ORDER BY name", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('add-category', async (_, { name, description }) => {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO categories (name, description) VALUES (?, ?)", [name, description || ''], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
        });
    });
});

ipcMain.handle('update-category', async (_, { id, name, description }) => {
    return new Promise((resolve, reject) => {
        db.run("UPDATE categories SET name=?, description=? WHERE id=?", [name, description, id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
});

ipcMain.handle('delete-category', async (_, id) => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM categories WHERE id = ?", [id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
});

ipcMain.handle('get-all-customers', async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM customers ORDER BY name", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('add-customer', async (_, customer) => {
    return new Promise((resolve, reject) => {
        const { name, phone, email, address } = customer;
        db.run(
            "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
            [name, phone, email, address],
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            }
        );
    });
});

ipcMain.handle('update-customer', async (_, customer) => {
    return new Promise((resolve, reject) => {
        const { id, name, phone, email, address } = customer;
        db.run(
            "UPDATE customers SET name=?, phone=?, email=?, address=? WHERE id=?",
            [name, phone, email, address, id],
            function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            }
        );
    });
});

ipcMain.handle('delete-customer', async (_, id) => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM customers WHERE id = ?", [id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
});

ipcMain.handle('complete-sale', async (_, saleData) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            const { customer_id, user_id, subtotal, discount, tax, total, payment_method, items } = saleData;
            const invoice_no = 'POS-' + Date.now();
            
            db.run(
                "INSERT INTO sales (invoice_no, customer_id, user_id, subtotal, discount, tax, total, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [invoice_no, customer_id || null, user_id || null, subtotal, discount, tax, total, payment_method],
                function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        reject(err);
                        return;
                    }
                    
                    const saleId = this.lastID;
                    const itemStmt = db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)");
                    const stockStmt = db.prepare("UPDATE products SET current_stock = current_stock - ? WHERE id = ?");
                    
                    let error = null;
                    items.forEach(item => {
                        itemStmt.run(saleId, item.product_id, item.quantity, item.unit_price, item.total, (err) => {
                            if (err) error = err;
                        });
                        stockStmt.run(item.quantity, item.product_id, (err) => {
                            if (err) error = err;
                        });
                    });
                    
                    itemStmt.finalize();
                    stockStmt.finalize();
                    
                    if (error) {
                        db.run("ROLLBACK");
                        reject(error);
                    } else {
                        db.run("COMMIT", (err) => {
                            if (err) reject(err);
                            else resolve({ success: true, invoice_no, sale_id: saleId });
                        });
                    }
                }
            );
        });
    });
});

ipcMain.handle('get-sales-history', async () => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT s.*, c.name as customer_name, u.username 
            FROM sales s 
            LEFT JOIN customers c ON s.customer_id = c.id 
            LEFT JOIN users u ON s.user_id = u.id 
            ORDER BY s.created_at DESC
        `, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('get-sale-details', async (_, saleId) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM sales WHERE id = ?", [saleId], (err, sale) => {
            if (err) reject(err);
            else {
                db.all(`
                    SELECT si.*, p.name as product_name 
                    FROM sale_items si 
                    LEFT JOIN products p ON si.product_id = p.id 
                    WHERE si.sale_id = ?
                `, [saleId], (err, items) => {
                    if (err) reject(err);
                    else resolve({ ...sale, items });
                });
            }
        });
    });
});

ipcMain.handle('adjust-stock', async (_, { product_id, change_type, quantity, notes }) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            const change = change_type === 'add' ? quantity : -quantity;
            db.run("UPDATE products SET current_stock = current_stock + ? WHERE id = ?", [change, product_id], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    reject(err);
                    return;
                }
                
                db.run(
                    "INSERT INTO stock_history (product_id, change_type, quantity, notes) VALUES (?, ?, ?, ?)",
                    [product_id, change_type, quantity, notes || ''],
                    function(err) {
                        if (err) {
                            db.run("ROLLBACK");
                            reject(err);
                        } else {
                            db.run("COMMIT", (err) => {
                                if (err) reject(err);
                                else resolve({ success: true });
                            });
                        }
                    }
                );
            });
        });
    });
});

ipcMain.handle('get-stock-history', async (_, productId) => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM stock_history WHERE product_id = ? ORDER BY created_at DESC", [productId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

ipcMain.handle('get-dashboard-stats', async () => {
    return new Promise((resolve, reject) => {
        const stats = {};
        
        db.get("SELECT COALESCE(SUM(total), 0) as total_revenue FROM sales WHERE date(created_at) = date('now')", [], (err, row) => {
            if (err) { reject(err); return; }
            stats.today_revenue = row.total_revenue;
            
            db.get("SELECT COUNT(*) as count FROM sales WHERE date(created_at) = date('now')", [], (err, row) => {
                if (err) { reject(err); return; }
                stats.today_orders = row.count;
                
                db.get("SELECT COUNT(*) as count FROM customers", [], (err, row) => {
                    if (err) { reject(err); return; }
                    stats.total_customers = row.count;
                    
                    db.get("SELECT COUNT(*) as count FROM products WHERE current_stock <= alert_level", [], (err, row) => {
                        if (err) { reject(err); return; }
                        stats.low_stock_items = row.count;
                        
                        resolve(stats);
                    });
                });
            });
        });
    });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    db.close();
});
