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
        shiftHours: "08:00 - 16:00"
    };

    let settings = { ...defaultSettings };

    // DOM Elements
    const elements = {
        storeName: document.getElementById('storeName'),
        storeAddress: document.getElementById('storeAddress'),
        storePhone: document.getElementById('storePhone'),
        versionOptions: document.querySelectorAll('.version-option'),
        versionHint: document.getElementById('versionHint'),
        tax: document.getElementById('taxPercentage'),
        shift: document.getElementById('shiftHours'),
        saveBtn: document.getElementById('saveBtn'),
        resetBtn: document.getElementById('resetBtn')
    };

    async function loadSettings() {
        try {
            const dbSettings = await window.api.getSettings();
            if (Object.keys(dbSettings).length > 0) {
                settings = { ...settings, ...dbSettings };
            }
            
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
        } catch (err) {
            console.error('Error loading settings:', err);
        }
    }

    async function saveSettings() {
        if (!elements.storeName.value.trim()) { alert('Store Name is required'); return; }

        try {
            const newSettings = {
                storeName: elements.storeName.value.trim(),
                storeAddress: elements.storeAddress.value.trim(),
                storePhone: elements.storePhone.value.trim(),
                taxPercentage: parseFloat(elements.tax.value) || 0,
                shiftHours: elements.shift.value.trim()
            };
            
            const selectedVer = document.querySelector('.version-option.selected');
            newSettings.systemVersion = selectedVer ? selectedVer.dataset.version : 'pro';

            for (const [key, value] of Object.entries(newSettings)) {
                await window.api.saveSetting(key, value);
            }
            
            alert('✅ Settings saved successfully!');
            location.reload();
        } catch (err) {
            alert('Error saving settings: ' + err.message);
        }
    }

    function setupListeners() {
        if(elements.saveBtn) elements.saveBtn.addEventListener('click', saveSettings);

        if(elements.versionOptions) {
            elements.versionOptions.forEach(opt => {
                opt.addEventListener('click', () => {
                    elements.versionOptions.forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                });
            });
        }
    }

    async function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user || user.role !== 'owner') {
            alert('Access Denied: Owner Only');
            window.location.href = user ? 'owner_dashboard.html' : 'login.html';
            return;
        }

        await loadSettings();
        setupListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
