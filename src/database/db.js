const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'data', 'pos_database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database Error: ', err.message);
    } else {
        console.log('SQLite Database Connected Successfully!');
    }
});

function setupDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE COLLATE NOCASE,
            full_name TEXT,
            password TEXT,
            role TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sku TEXT UNIQUE,
            category_id INTEGER,
            base_price REAL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            cost_price REAL DEFAULT 0,
            current_stock INTEGER DEFAULT 0,
            alert_level INTEGER DEFAULT 10,
            is_weighted INTEGER DEFAULT 0,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            total_spent REAL DEFAULT 0,
            points INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT UNIQUE,
            customer_id INTEGER,
            user_id INTEGER,
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            payment_method TEXT DEFAULT 'Cash',
            status TEXT DEFAULT 'Completed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER,
            product_id INTEGER,
            quantity INTEGER DEFAULT 1,
            unit_price REAL DEFAULT 0,
            total REAL DEFAULT 0,
            FOREIGN KEY (sale_id) REFERENCES sales(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS stock_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            change_type TEXT,
            quantity INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`);

        const userStmt = db.prepare("INSERT OR IGNORE INTO users (username, full_name, password, role) VALUES (?, ?, ?, ?)");
        userStmt.run("Sunil", "Sunil Perera", "admin123", "Owner");
        userStmt.run("Sandun", "Sandun Perera", "user123", "Cashier");
        userStmt.finalize();

        const catStmt = db.prepare("INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)");
        catStmt.run("Groceries", "Daily grocery items");
        catStmt.run("Beverages", "Drinks and beverages");
        catStmt.run("Snacks", "Snack items");
        catStmt.run("Household", "Household products");
        catStmt.finalize();

        const prodStmt = db.prepare(`INSERT OR IGNORE INTO products 
            (name, sku, category_id, base_price, sale_price, cost_price, current_stock, alert_level, is_weighted) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        prodStmt.run("Keells Dhal 500g", "SKU001", 1, 450, 420, 350, 100, 20, 0);
        prodStmt.run("Coca Cola 1L", "SKU002", 2, 350, 320, 250, 150, 30, 0);
        prodStmt.run("Munchee Digestive", "SKU003", 3, 280, 260, 200, 80, 15, 0);
        prodStmt.run("Rice 1kg", "SKU004", 1, 320, 300, 250, 200, 50, 1);
        prodStmt.run("Sugar 1kg", "SKU005", 1, 280, 260, 220, 120, 25, 0);
        prodStmt.run("Tea Bags 100s", "SKU006", 2, 550, 520, 420, 60, 10, 0);
        prodStmt.run("Milk Powder 400g", "SKU007", 2, 850, 820, 700, 40, 10, 0);
        prodStmt.run("Biscuit Mix", "SKU008", 3, 180, 160, 120, 200, 30, 0);
        prodStmt.finalize();

        const custStmt = db.prepare("INSERT OR IGNORE INTO customers (name, phone, email, total_spent, points) VALUES (?, ?, ?, ?, ?)");
        custStmt.run("John Doe", "0771234567", "john@email.com", 45200, 120);
        custStmt.run("Jane Smith", "0779876543", "jane@email.com", 32100, 85);
        custStmt.finalize();
    });
}

module.exports = { db, setupDatabase };
