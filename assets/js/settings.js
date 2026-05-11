(function () {
  'use strict';

  const defaultSettings = {
    storeName: 'My QuickPOS Store',
    storeAddress: '',
    storePhone: '',
    systemVersion: 'pro',
    currencySymbol: 'LKR',
    taxPercentage: '0',
    shiftHours: '08:00 - 16:00',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    thermalPrinterName: ''
  };

  let settings = { ...defaultSettings };

  async function saveKV(key, value) {
    await window.api.saveSetting(key, String(value));
  }

  function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.className = `toast ${type}`;
    document.getElementById('toastMsg').textContent = msg;
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  function setFields() {
    document.getElementById('storeName').value = settings.storeName;
    document.getElementById('storeAddress').value = settings.storeAddress;
    document.getElementById('storePhone').value = settings.storePhone;
    document.getElementById('shiftHours').value = settings.shiftHours;
    document.getElementById('taxPercentage').value = settings.taxPercentage;
    document.getElementById('currencyToggle').checked = settings.currencySymbol === 'LKR';
    document.getElementById('dateFormat').value = settings.dateFormat;
    document.getElementById('timeFormat').value = settings.timeFormat;
    document.querySelectorAll('.ver-card').forEach((c) => c.classList.toggle('selected', c.dataset.version === settings.systemVersion));
    // Restore saved printer selection
    const sel = document.getElementById('thermalPrinterName');
    if (sel && settings.thermalPrinterName) {
      // Add saved value as option if not yet in list
      if (![...sel.options].some(o => o.value === settings.thermalPrinterName)) {
        const opt = document.createElement('option');
        opt.value = settings.thermalPrinterName;
        opt.textContent = settings.thermalPrinterName;
        sel.appendChild(opt);
      }
      sel.value = settings.thermalPrinterName;
    }
  }

  async function refreshSystemStats() {
    const [products, sales, customers] = await Promise.all([
      window.api.getProducts(),
      window.api.getSalesHistory(),
      window.api.getCustomers()
    ]);
    document.getElementById('sysProducts').textContent = products.length;
    document.getElementById('sysSales').textContent = sales.length;
    document.getElementById('sysCustomers').textContent = customers.length;
    document.getElementById('sysCache').textContent = 'SQLite';
  }

  async function loadSettings() {
    const dbSettings = await window.api.getSettings();
    settings = { ...defaultSettings, ...dbSettings };
    setFields();
    await refreshSystemStats();
  }

  async function saveSettings() {
    const next = {
      storeName: document.getElementById('storeName').value.trim(),
      storeAddress: document.getElementById('storeAddress').value.trim(),
      storePhone: document.getElementById('storePhone').value.trim(),
      shiftHours: document.getElementById('shiftHours').value.trim() || '08:00 - 16:00',
      taxPercentage: String(parseFloat(document.getElementById('taxPercentage').value || '0') || 0),
      currencySymbol: 'LKR',
      dateFormat: document.getElementById('dateFormat').value,
      timeFormat: document.getElementById('timeFormat').value,
      systemVersion: document.querySelector('.ver-card.selected')?.dataset.version || 'pro',
      thermalPrinterName: document.getElementById('thermalPrinterName').value.trim()
    };

    if (!next.storeName) return showToast('Store Name is required', 'error');

    settings = next;
    for (const [k, v] of Object.entries(next)) {
      await saveKV(k, v);
    }

    const adminPassword = document.getElementById('adminPassword').value.trim();
    const adminConfirm = document.getElementById('adminPasswordConfirm').value.trim();
    const cashierPassword = document.getElementById('cashierPassword').value.trim();
    const cashierConfirm = document.getElementById('cashierPasswordConfirm').value.trim();

    if (adminPassword || cashierPassword) {
      const users = await window.api.getUsers();

      if (adminPassword) {
        if (adminPassword.length < 6) return showToast('Admin password min 6 characters', 'error');
        if (adminPassword !== adminConfirm) return showToast('Admin passwords do not match', 'error');
        const ownerUser = users.find((u) => u.role === 'owner');
        if (ownerUser) {
          await window.api.saveUser({ ...ownerUser, password: adminPassword });
        }
      }

      if (cashierPassword) {
        if (cashierPassword.length < 4) return showToast('Cashier password min 4 characters', 'error');
        if (cashierPassword !== cashierConfirm) return showToast('Cashier passwords do not match', 'error');
        const cashierUser = users.find((u) => u.role === 'cashier');
        if (cashierUser) {
          await window.api.saveUser({ ...cashierUser, password: cashierPassword });
        }
      }
    }

    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPasswordConfirm').value = '';
    document.getElementById('cashierPassword').value = '';
    document.getElementById('cashierPasswordConfirm').value = '';

    localStorage.setItem('quickpos-shift-time', next.shiftHours);
    showToast('Settings saved successfully');
  }

  async function resetSettings() {
    settings = { ...defaultSettings };
    for (const [k, v] of Object.entries(settings)) {
      await saveKV(k, v);
    }
    setFields();
    showToast('Settings reset to defaults');
  }

  function bindEvents() {
    document.querySelectorAll('.tab-btn, .tab-danger-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn,.tab-danger-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
        document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
      });
    });

    document.querySelectorAll('.ver-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.ver-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    document.querySelectorAll('.pw-eye').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById(btn.dataset.target);
        inp.type = inp.type === 'password' ? 'text' : 'password';
      });
    });

    document.getElementById('saveBtn').addEventListener('click', saveSettings);
    document.getElementById('resetBtn').addEventListener('click', () => confirm('Reset settings to defaults?') && resetSettings());
    document.getElementById('resetSettingsBtn').addEventListener('click', () => confirm('Reset settings to defaults?') && resetSettings());

    // Detect & populate printers
    async function detectPrinters() {
      const btn = document.getElementById('detectPrintersBtn');
      const sel = document.getElementById('thermalPrinterName');
      if (btn) btn.disabled = true;
      try {
        const printers = await window.api.getPrinters();
        const current = sel.value;
        sel.innerHTML = '<option value="">— System Default Printer —</option>';
        printers.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.name;
          opt.textContent = p.isDefault ? `${p.name} (Default)` : p.name;
          sel.appendChild(opt);
        });
        // Restore saved selection
        if (settings.thermalPrinterName) sel.value = settings.thermalPrinterName;
        else if (current) sel.value = current;
        showToast(`Found ${printers.length} printer(s)`);
      } catch (err) {
        showToast('Could not detect printers: ' + err.message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    document.getElementById('detectPrintersBtn').addEventListener('click', detectPrinters);
    // Auto-detect on load
    detectPrinters();

    document.getElementById('backupBtn').addEventListener('click', async () => {
      try {
        const result = await window.api.backupDatabase();
        if (result?.cancelled) return;
        showToast('Backup created successfully');
      } catch (err) {
        showToast(`Backup failed: ${err.message}`, 'error');
      }
    });

    document.getElementById('restoreBtn').addEventListener('click', async () => {
      if (!confirm('Restore backup and restart app now? Unsaved work may be lost.')) return;
      try {
        const result = await window.api.restoreDatabase();
        if (result?.cancelled) return;
      } catch (err) {
        showToast(`Restore failed: ${err.message}`, 'error');
      }
    });

    document.getElementById('fullResetBtn').addEventListener('click', () => showToast('Full reset is disabled for data safety', 'error'));

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveSettings();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user || user.role === 'cashier') {
      alert('Access Denied: Owner Only');
      window.location.href = 'sales.html';
      return;
    }

    document.getElementById('userRoleDisplay').textContent = `Owner: ${user.name || 'Owner'}`;
    bindEvents();
    try {
      await loadSettings();
    } catch (err) {
      alert(`Failed to load settings: ${err.message}`);
    }
  });
})();
