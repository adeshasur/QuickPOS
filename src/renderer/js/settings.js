
        // Default settings
        const defaultSettings = {
            storeName: "My QuickPOS Store",
            storeAddress: "",
            storePhone: "",
            systemVersion: "lite", // lite or pro
            currencySymbol: "LKR",
            taxPercentage: 0,
            shiftHours: "08:00 - 16:00",
            adminPassword: "admin123",
            cashierPassword: "cashier"
        };

        // Current settings
        let settings = JSON.parse(localStorage.getItem('quickpos-settings')) || defaultSettings;

        // DOM elements
        const sidebar = document.getElementById('sidebar');
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const hamburgerIcon = document.getElementById('hamburgerIcon');
        const logo = document.getElementById('logo');
        const logoutBtn = document.getElementById('logoutBtn');
        const saveBtn = document.getElementById('saveBtn');
        const resetBtn = document.getElementById('resetBtn');
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        
        // Store Information
        const storeName = document.getElementById('storeName');
        const storeAddress = document.getElementById('storeAddress');
        const storePhone = document.getElementById('storePhone');
        
        // System Version
        const versionSelector = document.getElementById('versionSelector');
        const versionOptions = document.querySelectorAll('.version-option');
        const versionHint = document.getElementById('versionHint');
        
        // Security
        const adminPassword = document.getElementById('adminPassword');
        const cashierPassword = document.getElementById('cashierPassword');
        const passwordToggles = document.querySelectorAll('.password-toggle');
        
        // Localization
        const currencyToggle = document.getElementById('currencyToggle');
        const taxPercentage = document.getElementById('taxPercentage');
        const shiftHours = document.getElementById('shiftHours');

        // Initialize the app
        function init() {
            loadSettings();
            setupEventListeners();
            
            // Set initial sidebar state from localStorage
            const sidebarState = localStorage.getItem('quickpos-sidebar');
            if (sidebarState === 'collapsed') {
                toggleSidebar();
            }
            
            // Log current settings
            console.log('=== Current Settings ===');
            console.log(JSON.stringify(settings, null, 2));
        }

        // Toggle sidebar between expanded and collapsed
        function toggleSidebar() {
            sidebar.classList.toggle('expanded');
            sidebar.classList.toggle('collapsed');
            logo.classList.toggle('collapsed');
            
            // Update hamburger icon
            if (sidebar.classList.contains('collapsed')) {
                hamburgerIcon.textContent = 'â†’';
                localStorage.setItem('quickpos-sidebar', 'collapsed');
            } else {
                hamburgerIcon.textContent = 'â˜°';
                localStorage.setItem('quickpos-sidebar', 'expanded');
            }
        }

        // Load settings into form
        function loadSettings() {
            // Store Information
            storeName.value = settings.storeName || '';
            storeAddress.value = settings.storeAddress || '';
            storePhone.value = settings.storePhone || '';
            
            // System Version
            const currentVersion = settings.systemVersion || 'lite';
            versionOptions.forEach(option => {
                if (option.dataset.version === currentVersion) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
            
            // Security (don't load passwords for security)
            adminPassword.value = '';
            cashierPassword.value = '';
            
            // Localization
            currencyToggle.checked = (settings.currencySymbol === 'LKR');
            taxPercentage.value = settings.taxPercentage || 0;
            shiftHours.value = settings.shiftHours || '08:00 - 16:00';
        }

        // Save settings
        function saveSettings() {
            // Validate required fields
            if (!storeName.value.trim()) {
                alert('Store Name is required');
                storeName.focus();
                return;
            }
            
            // Store Information
            settings.storeName = storeName.value.trim();
            settings.storeAddress = storeAddress.value.trim();
            settings.storePhone = storePhone.value.trim();
            
            // System Version
            const selectedVersion = document.querySelector('.version-option.selected');
            settings.systemVersion = selectedVersion ? selectedVersion.dataset.version : 'lite';
            
            // Security (only update if changed)
            if (adminPassword.value.trim() && adminPassword.value.trim().length >= 6) {
                settings.adminPassword = adminPassword.value.trim();
            }
            
            if (cashierPassword.value.trim() && cashierPassword.value.trim().length >= 4) {
                settings.cashierPassword = cashierPassword.value.trim();
            }
            
            // Localization
            settings.currencySymbol = currencyToggle.checked ? 'LKR' : 'LKR'; // Currently only LKR
            settings.taxPercentage = parseFloat(taxPercentage.value) || 0;
            settings.shiftHours = shiftHours.value.trim() || '08:00 - 16:00';
            
            // Save to localStorage
            localStorage.setItem('quickpos-settings', JSON.stringify(settings));
            localStorage.setItem('quickpos-shift-time', settings.shiftHours);
            
            // Update UI
            document.getElementById('userRole').textContent = 'Administrator';
            
            // Log to console for backend
            console.log('=== Settings Saved (Ready for MySQL) ===');
            console.log(JSON.stringify(settings, null, 2));
            console.log('========================================');
            
            // Show success message
            alert('Settings saved successfully!');
            
            // Reload settings to confirm
            loadSettings();
        }

        // Reset system (with confirmation)
        function resetSystem() {
            const confirmation = confirm('âš ï¸ WARNING: This will delete ALL sales data, products, and categories.\n\nThis action cannot be undone!\n\nAre you absolutely sure you want to reset the system?');
            
            if (!confirmation) return;
            
            const finalConfirmation = confirm('âš ï¸ FINAL WARNING: All your business data will be permanently deleted.\n\nType "RESET" to confirm:');
            
            if (finalConfirmation) {
                const userInput = prompt('Please type "RESET" (in uppercase) to confirm:');
                
                if (userInput === 'RESET') {
                    // Clear all localStorage data
                    localStorage.clear();
                    
                    // Restore default settings
                    settings = {...defaultSettings};
                    localStorage.setItem('quickpos-settings', JSON.stringify(settings));
                    
                    // Reload the page
                    alert('System has been reset to factory defaults. The page will now reload.');
                    location.reload();
                } else {
                    alert('Reset cancelled. Data was not deleted.');
                }
            }
        }

        // Clear cache only (keep data)
        function clearCache() {
            if (confirm('Clear application cache? This will not delete your sales or product data, but may improve performance.')) {
                // Clear only cache-related items
                const settingsCopy = {...settings};
                const shiftTime = localStorage.getItem('quickpos-shift-time');
                const sidebarState = localStorage.getItem('quickpos-sidebar');
                
                // Clear all localStorage
                localStorage.clear();
                
                // Restore important data
                localStorage.setItem('quickpos-settings', JSON.stringify(settingsCopy));
                if (shiftTime) localStorage.setItem('quickpos-shift-time', shiftTime);
                if (sidebarState) localStorage.setItem('quickpos-sidebar', sidebarState);
                
                alert('Cache cleared successfully!');
                location.reload();
            }
        }

        // Toggle password visibility
        function togglePasswordVisibility(targetId) {
            const input = document.getElementById(targetId);
            const toggle = document.querySelector(`[data-target="${targetId}"]`);
            
            if (input.type === 'password') {
                input.type = 'text';
                toggle.textContent = 'ðŸ™ˆ';
            } else {
                input.type = 'password';
                toggle.textContent = 'ðŸ‘ï¸';
            }
        }

        // Set up event listeners
        function setupEventListeners() {
            // Hamburger menu toggle
            hamburgerBtn.addEventListener('click', toggleSidebar);
            
            // Logout button
            logoutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
            
            // Save button
            saveBtn.addEventListener('click', saveSettings);
            
            // Reset button
            resetBtn.addEventListener('click', resetSystem);
            
            // Clear cache button
            clearCacheBtn.addEventListener('click', clearCache);
            
            // System version selection
            versionOptions.forEach(option => {
                option.addEventListener('click', () => {
                    versionOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    
                    // Update hint based on selection
                    if (option.dataset.version === 'pro') {
                        versionHint.innerHTML = '<strong>Note:</strong> Pro version enables stock management. Existing data will be preserved.';
                        versionHint.classList.remove('warning');
                        versionHint.classList.add('error');
                    } else {
                        versionHint.innerHTML = '<strong>Note:</strong> Lite version is fast and lightweight. Stock management features are hidden.';
                        versionHint.classList.remove('error');
                        versionHint.classList.add('warning');
                    }
                });
            });
            
            // Password visibility toggles
            passwordToggles.forEach(toggle => {
                toggle.addEventListener('click', () => {
                    togglePasswordVisibility(toggle.dataset.target);
                });
            });
            
            // Tax percentage validation
            taxPercentage.addEventListener('change', () => {
                const value = parseFloat(taxPercentage.value);
                if (value < 0) taxPercentage.value = 0;
                if (value > 50) taxPercentage.value = 50;
            });
            
            // Store phone formatting
            storePhone.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 0) {
                    value = '+94 ' + value;
                    if (value.length > 7) {
                        value = value.substring(0, 7) + ' ' + value.substring(7);
                    }
                    if (value.length > 12) {
                        value = value.substring(0, 12) + ' ' + value.substring(12);
                    }
                }
                e.target.value = value;
            });
            
            // Auto-save on some inputs
            storeName.addEventListener('blur', () => {
                if (storeName.value.trim()) {
                    localStorage.setItem('quickpos-store-name', storeName.value.trim());
                }
            });
            
            shiftHours.addEventListener('blur', () => {
                if (shiftHours.value.trim()) {
                    localStorage.setItem('quickpos-shift-time', shiftHours.value.trim());
                }
            });
            
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    saveSettings();
                }
            });
        }

        // Initialize app when DOM is loaded
        document.addEventListener('DOMContentLoaded', init);


        document.addEventListener('DOMContentLoaded', () => {
    // 1. Get the user data from storage
    const user = JSON.parse(localStorage.getItem('quickpos-user'));

    // 2. Security Check: If someone tries to open the file without logging in
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // 3. Role Check: If user is a Cashier, hide the Owner-only buttons
    if (user.role === 'cashier') {
        const ownerLinks = document.querySelectorAll('.owner-only');
        ownerLinks.forEach(link => {
            link.style.display = 'none'; 
        });
    }

    // 4. Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Do you want to logout?')) {
                localStorage.removeItem('quickpos-user');
                window.location.href = 'login.html';
            }
        });
    }
});
    
