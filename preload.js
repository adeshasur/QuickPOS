const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Products
    addProduct: (product) => ipcRenderer.invoke('add-product', product),
    getProducts: () => ipcRenderer.invoke('get-products'),
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

    // Sales (බිල්)
    saveSale: (saleData) => ipcRenderer.invoke('save-sale', saleData),
    getSalesHistory: () => ipcRenderer.invoke('get-sales-history'),
    getSaleDetails: (saleId) => ipcRenderer.invoke('get-sale-details', saleId),

    // Security & Logic
    loginAuth: (creds) => ipcRenderer.invoke('login-auth', creds),
    getExpiredItems: () => ipcRenderer.invoke('get-expired-items')
});
