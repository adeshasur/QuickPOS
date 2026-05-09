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

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    db.run(`INSERT OR IGNORE INTO users (name, username, password, role)
            VALUES ('Administrator', 'admin', '123', 'owner')`);
    db.run(`INSERT OR IGNORE INTO users (name, username, password, role)
            VALUES ('Cashier Staff', 'staff', '123', 'cashier')`);

    const categories = ['Groceries', 'Beverages', 'Vegetables', 'Dairy', 'Bakery', 'Household', 'Personal Care', 'Snacks'];
    categories.forEach((cat) => {
        db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [cat]);
    });

    // Use a small delay or db.serialize to ensure categories are there
    db.all('SELECT id, name FROM categories', (err, catRows) => {
        if (err || !catRows.length) return;
        
        const catMap = {};
        catRows.forEach(r => catMap[r.name] = r.id);

        const samples = [
            ['001', 'Fresh Milk 1L', catMap['Dairy'] || catRows[0].id, 350.0, 420.0, 50, 'bottle', '2026-06-01'],
            ['002', 'Keeri Samba 5kg', catMap['Groceries'] || catRows[0].id, 1400.0, 1650.0, 5, 'pkt', '2027-01-01'],
            ['003', 'Munchee Super Cream Cracker', catMap['Snacks'] || catRows[0].id, 180.0, 210.0, 100, 'pkt', '2026-12-31'],
            ['004', 'Coca Cola 1.5L', catMap['Beverages'] || catRows[0].id, 220.0, 280.0, 12, 'bottle', '2026-08-15'],
            ['005', 'Red Onions 1kg', catMap['Vegetables'] || catRows[0].id, 250.0, 320.0, 8, 'kg', '2026-05-20'],
            ['006', 'Lifebuoy Soap 100g', catMap['Personal Care'] || catRows[0].id, 85.0, 110.0, 45, 'bar', '2028-01-01'],
            ['007', 'Anchor Milk Powder 400g', catMap['Dairy'] || catRows[0].id, 950.0, 1150.0, 15, 'pkt', '2027-03-01'],
            ['008', 'Sunsilk Shampoo 180ml', catMap['Personal Care'] || catRows[0].id, 450.0, 520.0, 20, 'bottle', '2027-11-01'],
            ['009', 'Astra Margarine 250g', catMap['Dairy'] || catRows[0].id, 380.0, 440.0, 3, 'tub', '2026-09-01'],
            ['010', 'Washing Powder 1kg', catMap['Household'] || catRows[0].id, 550.0, 680.0, 10, 'pkt', '2028-06-01'],
            ['011', 'Ceylon Tea 200g', catMap['Beverages'] || catRows[0].id, 320.0, 380.0, 40, 'pkt', '2027-05-01'],
            ['012', 'Sugar 1kg', catMap['Groceries'] || catRows[0].id, 240.0, 290.0, 60, 'pkt', '2026-10-01'],
            ['013', 'Bread Flour 1kg', catMap['Bakery'] || catRows[0].id, 180.0, 220.0, 25, 'pkt', '2026-07-01'],
            ['014', 'Eggs (Pack of 10)', catMap['Dairy'] || catRows[0].id, 450.0, 550.0, 15, 'pack', '2026-05-25'],
            ['015', 'Cooking Oil 1L', catMap['Groceries'] || catRows[0].id, 650.0, 780.0, 30, 'bottle', '2027-02-01']
        ];

        samples.forEach((p) => {
            db.run(
                `INSERT OR IGNORE INTO products (barcode, name, category_id, cost_price, selling_price, current_stock, unit_type, expiry_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                p
            );
        });

        // Sample Sales logic removed to prevent data loss for the user.
        // Data will now persist correctly.
    }); // end outer db.all

    db.run("ALTER TABLE sales ADD COLUMN ref_no TEXT", (err) => {
        // Ignore error if column already exists
    });
}); // end outer db.serialize




module.exports = db;
