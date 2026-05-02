const { app, BrowserWindow } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// ඩේටාබේස් එක කනෙක්ට් කිරීම (මේකෙන් pos_database.sqlite කියලා අලුත් ෆයිල් එකක් හැදෙනවා)
const db = new sqlite3.Database('./pos_database.sqlite', (err) => {
    if (err) {
        console.error('Database Error: ', err.message);
    } else {
        console.log('SQLite Database Connected Successfully!');
    }
});

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        // ඔයාගේ icon.jpeg ලෝගෝ එක මෙතනින් තමයි ඇප් එකට සෙට් කරන්නේ
        icon: path.join(__dirname, 'QuickPOS Hardware', 'icon.jpeg'), 
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // ඇප් එක ඕපන් වෙද්දිම මුලින්ම ලොගින් පේජ් එක ලෝඩ් කරන්න
    mainWindow.loadFile(path.join(__dirname, 'QuickPOS Hardware', 'login.html'));
    
    // මෙනු බාර් එක අයින් කරන්න ඕනේ නම් මේක පාවිච්චි කරන්න
    mainWindow.setMenuBarVisibility(false); 
}

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
