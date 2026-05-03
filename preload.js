const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Products සම්බන්ධ වැඩ
    addProduct: (product) => ipcRenderer.invoke('add-product', product),
    getProducts: () => ipcRenderer.invoke('get-products'),
    searchProductByBarcode: (barcode) => ipcRenderer.invoke('search-barcode', barcode),
    
    // Categories සම්බන්ධ වැඩ
    getCategories: () => ipcRenderer.invoke('get-categories'),
    addCategory: (name) => ipcRenderer.invoke('add-category', name),
    
    // Sales (බිල්) සම්බන්ධ වැඩ
    saveSale: (saleData) => ipcRenderer.invoke('save-sale', saleData),
    getSalesHistory: () => ipcRenderer.invoke('get-sales-history')
});
