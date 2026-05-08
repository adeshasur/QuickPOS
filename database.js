const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = process.env.QUICKPOS_DB_DIR || __dirname;
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'quickpos.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database at', dbPath);
});

db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA busy_timeout = 5000');

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        can_view_reports INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        name TEXT,
        category_id INTEGER,
        cost_price REAL,
        selling_price REAL,
        current_stock REAL DEFAULT 0,
        alert_level REAL DEFAULT 10,
        unit_type TEXT,
        is_weighted INTEGER DEFAULT 0,
        expiry_date DATE,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        address TEXT,
        balance REAL DEFAULT 0
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        quantity REAL,
        unit_price REAL,
        subtotal REAL,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    db.run(`INSERT OR IGNORE INTO users (name, username, password, role)
            VALUES ('Administrator', 'admin', '123', 'owner')`);
    db.run(`INSERT OR IGNORE INTO users (name, username, password, role)
            VALUES ('Cashier Staff', 'staff', '123', 'cashier')`);

    const categories = ['Groceries', 'Beverages', 'Vegetables', 'Dairy', 'Bakery', 'Household'];
    categories.forEach((cat) => {
        db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [cat]);
    });

    const samples = [
        ['001', 'Fresh Milk 1L', 1, 350.0, 420.0, 50, 'bottle', '2026-06-01'],
        ['002', 'Keeri Samba 5kg', 1, 1400.0, 1650.0, 20, 'pkt', '2027-01-01'],
        ['003', 'Munchee Super Cream Cracker', 5, 180.0, 210.0, 100, 'pkt', '2026-12-31']
    ];

    samples.forEach((p) => {
        db.run(
            `INSERT OR IGNORE INTO products (barcode, name, category_id, cost_price, selling_price, current_stock, unit_type, expiry_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            p
        );
    });
});

module.exports = db;
