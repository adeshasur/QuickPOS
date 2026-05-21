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
        ref_no TEXT,
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

    db.run(`CREATE TABLE IF NOT EXISTS inventory_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        batch_code TEXT,
        received_qty REAL NOT NULL,
        remaining_qty REAL NOT NULL,
        cost_price REAL NOT NULL DEFAULT 0,
        selling_price REAL NOT NULL DEFAULT 0,
        expiry_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sale_item_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        sale_item_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        batch_id INTEGER,
        qty REAL NOT NULL,
        cost_price REAL NOT NULL DEFAULT 0,
        subtotal_cost REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
        FOREIGN KEY (sale_item_id) REFERENCES sale_items (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (batch_id) REFERENCES inventory_batches (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_override_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER NOT NULL,
        requested_qty REAL NOT NULL,
        available_qty REAL NOT NULL DEFAULT 0,
        override_qty REAL NOT NULL DEFAULT 0,
        cashier_name TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS shift_reconciliations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashier_name TEXT NOT NULL,
        shift_start DATETIME,
        shift_end DATETIME DEFAULT CURRENT_TIMESTAMP,
        opening_float REAL NOT NULL DEFAULT 0,
        cash_sales REAL NOT NULL DEFAULT 0,
        card_sales REAL NOT NULL DEFAULT 0,
        credit_sales REAL NOT NULL DEFAULT 0,
        total_sales REAL NOT NULL DEFAULT 0,
        expected_drawer REAL NOT NULL DEFAULT 0,
        actual_drawer REAL NOT NULL DEFAULT 0,
        variance REAL NOT NULL DEFAULT 0,
        items_sold REAL NOT NULL DEFAULT 0,
        salary_basis TEXT,
        salary_amount REAL NOT NULL DEFAULT 0,
        salary_earned REAL NOT NULL DEFAULT 0,
        notes TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // Demo/sample seed data has been removed from runtime startup.
    // Use a dedicated seeding script for controlled supermarket datasets.

    db.run("ALTER TABLE sales ADD COLUMN ref_no TEXT", (err) => {
        // Ignore error if column already exists
    });

    db.run("ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0", (err) => {
        // Ignore error if column already exists
    });

    db.run("ALTER TABLE sale_items ADD COLUMN cost_per_unit REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE sale_items ADD COLUMN cost_total REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE sale_items ADD COLUMN profit_total REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE sale_items ADD COLUMN batch_trace TEXT", () => {});
    db.run("ALTER TABLE sales ADD COLUMN gross_profit REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE shift_reconciliations ADD COLUMN salary_basis TEXT", () => {});
    db.run("ALTER TABLE shift_reconciliations ADD COLUMN salary_amount REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE shift_reconciliations ADD COLUMN salary_earned REAL DEFAULT 0", () => {});
}); // end outer db.serialize




module.exports = db;
