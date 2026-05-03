// Preload script for secure IPC communication

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Database operations
    dbQuery: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
    
    // File operations
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
    
    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    
    // Window controls
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close')
});
