const { app, BrowserWindow } = require('electron');
const path = require('path');
const db = require('./database.js');

function createWindow() {
    // App window එක හදන තැන
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1000,
        minHeight: 600,
        // මෙතනින් තමයි icon එක සෙට් කරන්නේ
        icon: path.join(__dirname, 'assets/images/icon.png'),
        webPreferences: {
            nodeIntegration: false, // Security එකට හොඳ මෙහෙම කරන එක
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // පස්සේ අපි මේක හදමු
        }
    });

    // මුලින්ම පේන්න ඕනේ පේජ් එක (login.html)
    mainWindow.loadFile(path.join(__dirname, 'pages/login.html'));

    // Menu bar එක hide කරනවා (Professional look එකට)
    mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

// Windows ඔක්කොම වහපු ගමන් app එක quit වෙන්න
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});