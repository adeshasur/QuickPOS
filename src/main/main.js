// Main Electron process file with SQLite integration

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

let mainWindow;
let db;

// Database path
const dbPath = path.join(__dirname, '../../database/pos_database.sqlite');

// Initialize database connection
function initDatabase() {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Database connection error:', err.message);
        } else {
            console.log('Connected to SQLite database at:', dbPath);
            createTables();
        }
    });
}

// Create tables if they don't exist
function createTables() {
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

    queries.forEach(query => {
        db.run(query, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    });

    // Insert default users if not exist
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (!err && row.count === 0) {
            db.run(
                'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
                ['admin', '123', 'Admin User', 'owner']
            );
            db.run(
                'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
                ['staff', '456', 'Cashier User', 'cashier']
            );
            console.log('Default users created');
        }
    });
}

// Database query helper
function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Query error:', err.message);
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, data: rows });
                }
            });
        } else {
            db.run(sql, params, function(err) {
                if (err) {
                    console.error('Query error:', err.message);
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, lastID: this.lastID, changes: this.changes });
                }
            });
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        // icon: path.join(__dirname, '../assets/icon.png'), // Uncomment when you have an icon file
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load login page
    mainWindow.loadFile(path.join(__dirname, '../renderer/login.html'));

    // Open DevTools in development
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    initDatabase();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (db) {
            db.close((err) => {
                if (err) console.error('Error closing database:', err.message);
                console.log('Database connection closed');
            });
        }
        app.quit();
    }
});

// IPC handler for database queries
ipcMain.handle('db-query', async (event, sql, params) => {
    return await dbQuery(sql, params);
});

// Handle file operations
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
    try {
        fs.writeFileSync(filePath, data, 'utf8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Window control handlers
ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});
