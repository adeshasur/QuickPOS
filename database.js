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

    db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        phone TEXT,
        email TEXT,
        address TEXT,
        contact_person TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS product_discounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        discount_type TEXT NOT NULL DEFAULT 'amount',
        discount_value REAL NOT NULL DEFAULT 0,
        starts_at DATE,
        ends_at DATE,
        active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        batch_id INTEGER,
        adjustment_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reason TEXT,
        note TEXT,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (batch_id) REFERENCES inventory_batches (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        bill_id TEXT,
        customer_id INTEGER,
        refund_amount REAL NOT NULL DEFAULT 0,
        reason TEXT,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE SET NULL,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL,
        sale_item_id INTEGER,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL DEFAULT 0,
        subtotal REAL NOT NULL DEFAULT 0,
        restock INTEGER DEFAULT 1,
        FOREIGN KEY (return_id) REFERENCES returns (id) ON DELETE CASCADE,
        FOREIGN KEY (sale_item_id) REFERENCES sale_items (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS unit_conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        from_unit TEXT NOT NULL,
        to_unit TEXT NOT NULL,
        factor REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        old_cost_price REAL,
        new_cost_price REAL,
        old_selling_price REAL,
        new_selling_price REAL,
        changed_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        action TEXT NOT NULL,
        detail TEXT,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS supplier_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        product_id INTEGER NOT NULL,
        batch_id INTEGER,
        quantity REAL NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (batch_id) REFERENCES inventory_batches (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS purchase_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER,
        invoice_no TEXT,
        grn_no TEXT,
        invoice_total REAL DEFAULT 0,
        received_total REAL DEFAULT 0,
        status TEXT DEFAULT 'draft',
        invoice_date DATE,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        promo_type TEXT NOT NULL,
        target_type TEXT DEFAULT 'product',
        target_id INTEGER,
        buy_qty REAL DEFAULT 0,
        get_qty REAL DEFAULT 0,
        discount_type TEXT DEFAULT 'amount',
        discount_value REAL DEFAULT 0,
        starts_at DATETIME,
        ends_at DATETIME,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        sale_id INTEGER,
        points INTEGER NOT NULL DEFAULT 0,
        transaction_type TEXT NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id),
        FOREIGN KEY (sale_id) REFERENCES sales (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS till_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movement_type TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        cashier_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sale_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        amount REAL NOT NULL,
        ref_no TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS void_bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        bill_id TEXT,
        reason TEXT,
        approved_by TEXT,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS held_bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hold_code TEXT UNIQUE,
        customer_id INTEGER,
        cart_json TEXT NOT NULL,
        note TEXT,
        cashier_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tax_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        rate REAL NOT NULL DEFAULT 0,
        active INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        address TEXT,
        phone TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_branch_id INTEGER,
        to_branch_id INTEGER,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        note TEXT,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_branch_id) REFERENCES branches (id),
        FOREIGN KEY (to_branch_id) REFERENCES branches (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_counts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        count_code TEXT UNIQUE,
        status TEXT DEFAULT 'draft',
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_count_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_count_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        system_qty REAL NOT NULL DEFAULT 0,
        counted_qty REAL NOT NULL DEFAULT 0,
        variance_qty REAL NOT NULL DEFAULT 0,
        note TEXT,
        FOREIGN KEY (stock_count_id) REFERENCES stock_counts (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS shelf_label_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        label_type TEXT DEFAULT 'price',
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS scale_barcode_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prefix TEXT NOT NULL,
        product_digits INTEGER DEFAULT 5,
        value_digits INTEGER DEFAULT 5,
        value_type TEXT DEFAULT 'weight',
        active INTEGER DEFAULT 1
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
    db.run("ALTER TABLE inventory_batches ADD COLUMN supplier_id INTEGER", () => {});
    db.run("ALTER TABLE inventory_batches ADD COLUMN grn_no TEXT", () => {});
    db.run("ALTER TABLE inventory_batches ADD COLUMN purchase_invoice_no TEXT", () => {});
    db.run("ALTER TABLE customers ADD COLUMN credit_limit REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE customers ADD COLUMN credit_due_days INTEGER DEFAULT 30", () => {});
    db.run("ALTER TABLE products ADD COLUMN reorder_qty REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE products ADD COLUMN tax_category_id INTEGER", () => {});
    db.run("ALTER TABLE products ADD COLUMN age_restricted INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE products ADD COLUMN age_limit INTEGER DEFAULT 0", () => {});
}); // end outer db.serialize




module.exports = db;
