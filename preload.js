const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Products
    addProduct: (product) => ipcRenderer.invoke('add-product', product),
    getProducts: () => ipcRenderer.invoke('get-products'),
    updateProduct: (product) => ipcRenderer.invoke('update-product', product),
    deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
    addStock: (data) => ipcRenderer.invoke('add-stock', data),
    discardStock: (data) => ipcRenderer.invoke('discard-stock', data),
    searchProductByBarcode: (barcode) => ipcRenderer.invoke('search-barcode', barcode),
    
    // Categories
    getCategories: () => ipcRenderer.invoke('get-categories'),
    saveCategory: (category) => ipcRenderer.invoke('save-category', category),
    deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),
    getTopSellingCategory: () => ipcRenderer.invoke('get-top-selling-category'),
    getCategoriesRevenue: () => ipcRenderer.invoke('get-categories-revenue'),
    getActiveProductsCount: () => ipcRenderer.invoke('get-active-products-count'),
    
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
    verifyAdminPin: (pin) => ipcRenderer.invoke('verify-admin-pin', pin),
    backupDatabase: () => ipcRenderer.invoke('backup-database'),
    restoreDatabase: () => ipcRenderer.invoke('restore-database'),
    runGoogleDriveBackupNow: () => ipcRenderer.invoke('run-google-drive-backup-now'),
    getGoogleDriveBackupStatus: () => ipcRenderer.invoke('get-google-drive-backup-status'),
    getExpiredItems: () => ipcRenderer.invoke('get-expired-items'),
    // Printing
    printReceiptSilent: (options) => ipcRenderer.invoke('print-receipt-silent', options),
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    exportShiftSummaryPdf: (summary) => ipcRenderer.invoke('export-shift-summary-pdf', summary),
    exportReportPdf: (payload) => ipcRenderer.invoke('export-report-pdf', payload),
    recordShiftReconciliation: (payload) => ipcRenderer.invoke('record-shift-reconciliation', payload),
    exportThermalReceiptPdf: (payload) => ipcRenderer.invoke('export-thermal-receipt-pdf', payload),
    generateThermalReceiptPdfAuto: (payload) => ipcRenderer.invoke('generate-thermal-receipt-pdf-auto', payload),
    printThermalReceipt: (payload) => ipcRenderer.invoke('print-thermal-receipt', payload)
});
