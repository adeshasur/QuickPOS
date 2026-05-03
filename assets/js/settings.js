(function() {
    'use strict';

    // Default settings
    const defaultSettings = {
        storeName: "QuickPOS Hardware",
        storeAddress: "No 123, Galle Road, Colombo",
        storePhone: "+94 11 234 5678",
        systemVersion: "pro", 
        currencySymbol: "LKR",
        taxPercentage: 0,
        shiftHours: "08:00 - 16:00",
        adminPassword: "admin123",
        cashierPassword: "staff"
    };

    let settings = JSON.parse(localStorage.getItem('quickpos-settings')) || defaultSettings;

    // DOM Elements
    const elements = {
        storeName: document.getElementById('storeName'),
        storeAddress: document.getElementById('storeAddress'),
        storePhone: document.getElementById('storePhone'),
        versionOptions: document.querySelectorAll('.version-option'),
        versionHint: document.getElementById('versionHint'),
        adminPass: document.getElementById('adminPassword'),
        cashierPass: document.getElementById('cashierPassword'),
        currencyToggle: document.getElementById('currencyToggle'),
        tax: document.getElementById('taxPercentage'),
        shift: document.getElementById('shiftHours'),
        saveBtn: document.getElementById('saveBtn'),
        resetBtn: document.getElementById('resetBtn'),
        clearCacheBtn: document.getElementById('clearCacheBtn'),
        hamburgerBtn: document.getElementById('hamburgerBtn'),
        logoutBtn: document.getElementById('logoutBtn')
    };

    function loadSettings() {
        if(elements.storeName) elements.storeName.value = settings.storeName || '';
        if(elements.storeAddress) elements.storeAddress.value = settings.storeAddress || '';
        if(elements.storePhone) elements.storePhone.value = settings.storePhone || '';
        if(elements.tax) elements.tax.value = settings.taxPercentage || 0;
        if(elements.shift) elements.shift.value = settings.shiftHours || '';
        
        if(elements.versionOptions) {
            elements.versionOptions.forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.version === settings.systemVersion);
            });
        }
    }

    function saveSettings() {
        if (!elements.storeName.value.trim()) { alert('Store Name is required'); return; }

        settings.storeName = elements.storeName.value.trim();
        settings.storeAddress = elements.storeAddress.value.trim();
        settings.storePhone = elements.storePhone.value.trim();
        settings.taxPercentage = parseFloat(elements.tax.value) || 0;
        settings.shiftHours = elements.shift.value.trim();
        
        const selectedVer = document.querySelector('.version-option.selected');
        settings.systemVersion = selectedVer ? selectedVer.dataset.version : 'pro';

        if (elements.adminPass && elements.adminPass.value.trim().length >= 6) settings.adminPassword = elements.adminPass.value.trim();
        if (elements.cashierPass && elements.cashierPass.value.trim().length >= 4) settings.cashierPassword = elements.cashierPass.value.trim();

        localStorage.setItem('quickpos-settings', JSON.stringify(settings));
        localStorage.setItem('quickpos-shift-time', settings.shiftHours);
        
        alert('✅ Settings saved successfully!');
        location.reload();
    }

    function resetSystem() {
        if (confirm('⚠️ WARNING: This will delete ALL business data.\nType "RESET" to confirm:')) {
            const input = prompt('Please type "RESET":');
            if (input === 'RESET') {
                localStorage.clear();
                alert('System Reset Complete.');
                window.location.href = 'login.html';
            }
        }
    }

    function setupListeners() {
        if(elements.saveBtn) elements.saveBtn.addEventListener('click', saveSettings);
        if(elements.resetBtn) elements.resetBtn.addEventListener('click', resetSystem);
        
        if(elements.hamburgerBtn) {
            elements.hamburgerBtn.addEventListener('click', () => {
                const sb = document.getElementById('sidebar');
                const hi = document.getElementById('hamburgerIcon');
                if(sb && hi) {
                    sb.classList.toggle('collapsed');
                    sb.classList.toggle('expanded');
                    hi.textContent = sb.classList.contains('collapsed') ? '→' : '☰';
                }
            });
        }

        if(elements.versionOptions) {
            elements.versionOptions.forEach(opt => {
                opt.addEventListener('click', () => {
                    elements.versionOptions.forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                });
            });
        }

        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', () => {
                if(confirm('Logout?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
        }
    }

    function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user || user.role !== 'owner') {
            alert('Access Denied: Owner Only');
            window.location.href = user ? 'owner_dashboard.html' : 'login.html';
            return;
        }
        loadSettings();
        setupListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
