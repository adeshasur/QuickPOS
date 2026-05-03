// Database helper - Single file for all database operations

// Call main process via IPC (secure)
const ipcRenderer = window.electronAPI;

// Products
async function getProducts() {
    const result = await ipcRenderer.dbQuery('SELECT * FROM products ORDER BY name', []);
    return result.success ? result.data : [];
}

async function addProduct(product) {
    const sql = `INSERT INTO products (name, price, category, stock, unitType, isWeighted) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [product.name, product.price, product.category, product.stock, product.unitType, product.isWeighted];
    return await ipcRenderer.dbQuery(sql, params);
}

async function updateProductStock(productId, newStock) {
    const sql = 'UPDATE products SET stock = ? WHERE id = ?';
    return await ipcRenderer.dbQuery(sql, [newStock, productId]);
}

// Customers
async function getCustomers() {
    const result = await ipcRenderer.dbQuery('SELECT * FROM customers ORDER BY name', []);
    return result.success ? result.data : [];
}

async function addCustomer(customer) {
    const sql = `INSERT INTO customers (name, phone, balance) VALUES (?, ?, ?)`;
    const params = [customer.name, customer.phone, customer.balance || 0];
    return await ipcRenderer.dbQuery(sql, params);
}

async function updateCustomerBalance(customerId, newBalance) {
    const sql = 'UPDATE customers SET balance = ? WHERE id = ?';
    return await ipcRenderer.dbQuery(sql, [newBalance, customerId]);
}

// Sales
async function saveSale(sale) {
    const sql = `INSERT INTO sales (timestamp, total, paymentMethod, customerId, customerCount) 
                 VALUES (?, ?, ?, ?, ?)`;
    const params = [sale.timestamp, sale.total, sale.paymentMethod, sale.customerId, sale.customerCount];
    return await ipcRenderer.dbQuery(sql, params);
}

async function saveSaleItems(saleId, items) {
    const promises = items.map(item => {
        const sql = `INSERT INTO sale_items (saleId, productId, productName, quantity, price) 
                     VALUES (?, ?, ?, ?, ?)`;
        const params = [saleId, item.productId, item.name, item.quantity, item.price];
        return ipcRenderer.dbQuery(sql, params);
    });
    return Promise.all(promises);
}

async function getSalesByDateRange(startDate, endDate) {
    const sql = `SELECT * FROM sales WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC`;
    const result = await ipcRenderer.dbQuery(sql, [startDate.getTime(), endDate.getTime()]);
    return result.success ? result.data : [];
}

// User/Staff
async function validateUser(username, password) {
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    const result = await ipcRenderer.dbQuery(sql, [username, password]);
    if (result.success && result.data.length > 0) {
        return { success: true, user: result.data[0] };
    }
    return { success: false, message: 'Invalid credentials' };
}

// Reports
async function getTotalRevenue(startDate, endDate) {
    const sql = `SELECT SUM(total) as revenue FROM sales WHERE timestamp >= ? AND timestamp <= ?`;
    const result = await ipcRenderer.dbQuery(sql, [startDate.getTime(), endDate.getTime()]);
    return result.success && result.data[0] ? result.data[0].revenue || 0 : 0;
}

async function getTopSellingProducts(limit = 5) {
    const sql = `
        SELECT productName as name, SUM(quantity) as quantity, SUM(quantity * price) as revenue
        FROM sale_items 
        GROUP BY productName 
        ORDER BY quantity DESC 
        LIMIT ?
    `;
    const result = await ipcRenderer.dbQuery(sql, [limit]);
    return result.success ? result.data : [];
}

// Initialize database tables (call once on app start)
async function initDatabase() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT,
            stock INTEGER DEFAULT 0,
            unitType TEXT,
            isWeighted BOOLEAN DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            balance REAL DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            total REAL NOT NULL,
            paymentMethod TEXT,
            customerId INTEGER,
            customerCount INTEGER DEFAULT 1,
            FOREIGN KEY (customerId) REFERENCES customers(id)
        )`,
        `CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            saleId INTEGER NOT NULL,
            productId INTEGER,
            productName TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (saleId) REFERENCES sales(id)
        )`,
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    for (const sql of queries) {
        await ipcRenderer.dbQuery(sql, []);
    }
}
    
    // Insert default users if not exist
    const checkUsers = await ipcRenderer.dbQuery('SELECT COUNT(*) as count FROM users', []);
    if (checkUsers.success && checkUsers.data[0].count === 0) {
        await ipcRenderer.dbQuery(
            'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
            ['admin', '123', 'Admin User', 'owner']
        );
        await ipcRenderer.dbQuery(
            'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
            ['staff', '456', 'Cashier User', 'cashier']
        );
    }
}

// Export all functions
window.dbHelper = {
    getProducts,
    addProduct,
    updateProductStock,
    getCustomers,
    addCustomer,
    updateCustomerBalance,
    saveSale,
    saveSaleItems,
    getSalesByDateRange,
    validateUser,
    getTotalRevenue,
    getTopSellingProducts,
    initDatabase
};
