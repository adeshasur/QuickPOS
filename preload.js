const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Products
    addProduct: (product) => ipcRenderer.invoke('add-product', product),
    getProducts: () => ipcRenderer.invoke('get-products'),
    updateProduct: (product) => ipcRenderer.invoke('update-product', product),
    deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
    searchProductByBarcode: (barcode) => ipcRenderer.invoke('search-barcode', barcode),
    
    // Categories
    getCategories: () => ipcRenderer.invoke('get-categories'),
    saveCategory: (category) => ipcRenderer.invoke('save-category', category),
    deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),
    
    // Customers
    getCustomers: () => ipcRenderer.invoke('get-customers'),
    saveCustomer: (customer) => ipcRenderer.invoke('save-customer', customer),
    deleteCustomer: (id) => ipcRenderer.invoke('delete-customer', id),

    // Users
    getUsers: () => ipcRenderer.invoke('get-users'),
    saveUser: (user) => ipcRenderer.invoke('save-user', user),
    deleteUser: (id) => ipcRenderer.invoke('delete-user', id),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSetting: (key, value) => ipcRenderer.invoke('save-setting', key, value),

    // Sales (à¶¶à·’à¶½à·Š)
    saveSale: (saleData) => ipcRenderer.invoke('save-sale', saleData),
    getSalesHistory: () => ipcRenderer.invoke('get-sales-history'),
    getSaleDetails: (saleId) => ipcRenderer.invoke('get-sale-details', saleId),
    recordCreditPayment: (paymentData) => ipcRenderer.invoke('record-credit-payment', paymentData),

    // Security & Logic
    loginAuth: (creds) => ipcRenderer.invoke('login-auth', creds),
    backupDatabase: () => ipcRenderer.invoke('backup-database'),
    restoreDatabase: () => ipcRenderer.invoke('restore-database'),
    getExpiredItems: () => ipcRenderer.invoke('get-expired-items'),
    // Printing
    printReceiptSilent: (options) => ipcRenderer.invoke('print-receipt-silent', options),
    getPrinters: () => ipcRenderer.invoke('get-printers')
});
