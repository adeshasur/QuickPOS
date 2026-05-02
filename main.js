const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// ඩේටාබේස් එක කනෙක්ට් කිරීම
const db = new sqlite3.Database('./pos_database.sqlite', (err) => {
    if (err) {
        console.error('Database Error: ', err.message);
    } else {
        console.log('SQLite Database Connected Successfully!');
        setupDatabase();
    }
});

function setupDatabase() {
    db.serialize(() => {
        // Users table එක හැදීම
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        )`, (err) => {
            if (err) {
                // SQLite doesn't support AUTO_INCREMENT like this, it's AUTOINCREMENT or just INTEGER PRIMARY KEY
                // Let's use the correct SQLite syntax
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password TEXT,
                    role TEXT
                )`);
            }
        });

        // Seed Users
        const stmt = db.prepare("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)");
        stmt.run("Sunil Perera", "admin123", "Owner");
        stmt.run("Sandun Perera", "user123", "Cashier");
        stmt.finalize();
    });
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        icon: path.join(__dirname, 'QuickPOS Hardware', 'icon.jpeg'), 
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'QuickPOS Hardware', 'login.html'));
    mainWindow.setMenuBarVisibility(false); 
}

// Login IPC Listener
ipcMain.on('login-attempt', (event, { username, password, role }) => {
    const query = "SELECT * FROM users WHERE username = ? AND password = ? AND role = ?";
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
