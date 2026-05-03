const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ඩේටාබේස් ෆයිල් එක සේව් වෙන තැන
const dbPath = path.join(__dirname, 'quickpos.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database.');
});

// ටේබල් ටික ක්රියේට් කිරීම
db.serialize(() => {
    // 1. Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        can_view_reports INTEGER DEFAULT 1
    )`);

    // 2. Categories Table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT
    )`);

    // 3. Products Table (Supermarket Edition)
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE, -- බාර්කෝඩ් එකක් අනිවාර්යයි
        name TEXT,
        category_id INTEGER,
        cost_price REAL,
        selling_price REAL,
        current_stock REAL DEFAULT 0,
        alert_level REAL DEFAULT 10, -- Supermarket නිසා මේක 10 වගේ තිබ්බම හොඳයි
        unit_type TEXT, -- kg, g, pcs, pkt, bottle, bundle
        is_weighted INTEGER DEFAULT 0, -- කිරලා දෙන බඩු වලට (උදා: එළවළු)
        expiry_date DATE, -- Supermarket බඩු වලට මේක මාරම වැදගත්
        FOREIGN KEY (category_id) REFERENCES categories (id)
    )`);

    // 4. Customers Table
    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        address TEXT,
        balance REAL DEFAULT 0
    )`);

    // 5. Sales Table (Main Bill Info)
    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id TEXT UNIQUE,
        customer_id INTEGER,
        total_amount REAL,
        payment_method TEXT,
        received_amount REAL,
        balance_amount REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        cashier_name TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
    )`);

    // 6. Sale Items Table (Products inside a bill)
    db.run(`CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER,
        product_name TEXT, -- Added for historical accuracy
        quantity REAL,
        unit_price REAL,
        subtotal REAL,
        FOREIGN KEY (sale_id) REFERENCES sales (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    // 7. Settings Table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // Default Admin User කෙනෙක්ව ඇඩ් කරමු (මුලින්ම ඇප් එක දාද්දි විතරයි මේක වෙන්නේ)
    db.run(`INSERT OR IGNORE INTO users (name, username, password, role) 
            VALUES ('Administrator', 'admin', '123', 'owner')`);
    db.run(`INSERT OR IGNORE INTO users (name, username, password, role) 
            VALUES ('Cashier Staff', 'staff', '123', 'cashier')`);

    // --- Supermarket Initial Data Seeding ---
    
    // 1. Categories
    const categories = ['Groceries', 'Beverages', 'Vegetables', 'Dairy', 'Bakery', 'Household'];
    categories.forEach(cat => {
        db.run(`INSERT OR IGNORE INTO categories (name) VALUES (?)`, [cat]);
    });

    // 2. Sample Products
    const samples = [
        ['001', 'Fresh Milk 1L', 1, 350.00, 420.00, 50, 'bottle', '2026-06-01'],
        ['002', 'Keeri Samba 5kg', 1, 1400.00, 1650.00, 20, 'pkt', '2027-01-01'],
        ['003', 'Munchee Super Cream Cracker', 5, 180.00, 210.00, 100, 'pkt', '2026-12-31']
    ];
    
    samples.forEach(p => {
        db.run(`INSERT OR IGNORE INTO products (barcode, name, category_id, cost_price, selling_price, current_stock, unit_type, expiry_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, p);
    });
});

module.exports = db;
