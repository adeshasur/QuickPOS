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
    thermalPrinterName: '',
    autoPrint: 'true',
    showLogo: 'false',
    defaultPaymentMethod: 'Cash',
    idleTimeoutMin: '0',
    cashierAutoShiftStart: 'false',
    autoShiftOpeningFloat: '0',
    cashierHourlyPaymentTarget: '0',
    cashierSalaryBasis: 'hourly',
    cashierSalaryAmount: '0',
    cashierTargetBills: '50',
    keyboardShortcuts: 'true',
    barcodeScanSound: 'false',
    lowStockAlertLevel: '10',
    requireAdminForRefund: 'true',
    receiptFooter: 'Thank you for shopping with us!',
    googleDriveBackupEmail: ''
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
    document.getElementById('autoPrint').checked = settings.autoPrint === 'true';
    document.getElementById('showLogo').checked = settings.showLogo === 'true';
    document.getElementById('defaultPaymentMethod').value = settings.defaultPaymentMethod || 'Cash';
    document.getElementById('idleTimeoutMin').value = settings.idleTimeoutMin || '0';
    document.getElementById('cashierAutoShiftStart').checked = settings.cashierAutoShiftStart === 'true';
    document.getElementById('autoShiftOpeningFloat').value = settings.autoShiftOpeningFloat || '0';
    document.getElementById('cashierHourlyPaymentTarget').value = settings.cashierHourlyPaymentTarget || '0';
    document.getElementById('cashierSalaryBasis').value = settings.cashierSalaryBasis || 'hourly';
    document.getElementById('cashierSalaryAmount').value = settings.cashierSalaryAmount || '0';
    document.getElementById('cashierTargetBills').value = settings.cashierTargetBills || '50';
    document.getElementById('keyboardShortcuts').checked = settings.keyboardShortcuts !== 'false';
    document.getElementById('barcodeScanSound').checked = settings.barcodeScanSound === 'true';
    document.getElementById('lowStockAlertLevel').value = settings.lowStockAlertLevel || '10';
    document.getElementById('requireAdminForRefund').checked = settings.requireAdminForRefund !== 'false';
    document.getElementById('receiptFooter').value = settings.receiptFooter || 'Thank you for shopping with us!';
    document.getElementById('googleDriveBackupEmail').value = settings.googleDriveBackupEmail || '';
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
    const [productStats, sales, customers] = await Promise.all([
      window.api.getProductStats(),
      window.api.getSalesHistory(),
      window.api.getCustomers()
    ]);
    document.getElementById('sysProducts').textContent = Number(productStats.total || 0).toLocaleString();
    document.getElementById('sysSales').textContent = sales.length;
    document.getElementById('sysCustomers').textContent = customers.length;
    document.getElementById('sysCache').textContent = 'SQLite';
    renderCashierHourlyInsight(sales);
    await refreshGoogleDriveBackupStatus();
  }

  async function refreshGoogleDriveBackupStatus() {
    const statusEl = document.getElementById('googleDriveBackupStatus');
    if (!statusEl || !window.api.getGoogleDriveBackupStatus) return;

    try {
      const status = await window.api.getGoogleDriveBackupStatus();
      if (!status.email) {
        statusEl.textContent = 'Daily backup is disabled until Gmail is saved.';
        return;
      }

      if (status.lastAt) {
        const when = new Date(status.lastAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        statusEl.textContent = `Last backup: ${when} (${status.storage || 'backup folder'})`;
        return;
      }

      statusEl.textContent = 'Daily backup is enabled. The next backup will run automatically.';
    } catch (err) {
      statusEl.textContent = `Backup status unavailable: ${err.message}`;
    }
  }

  function localDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatLkr(value) {
    return `LKR ${Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function renderCashierHourlyInsight(allSales) {
    const container = document.getElementById('cashierHourlyInsight');
    if (!container) return;

    const autoShiftOn = settings.cashierAutoShiftStart === 'true';
    const openingFloat = Math.max(0, Number(settings.autoShiftOpeningFloat || 0));
    const hourlyTarget = Math.max(0, Number(settings.cashierHourlyPaymentTarget || 0));
    const salaryBasis = settings.cashierSalaryBasis || 'hourly';
    const salaryAmount = Math.max(0, Number(settings.cashierSalaryAmount || 0));
    const todayKey = localDateKey(new Date());
    const todaySales = (allSales || []).filter((sale) => localDateKey(sale.timestamp || sale.date || Date.now()) === todayKey);

    const cashierMap = new Map();
    todaySales.forEach((sale) => {
      const name = String(sale.cashier_name || 'System');
      if (!cashierMap.has(name)) {
        cashierMap.set(name, { revenue: 0, bills: 0, hours: new Set() });
      }
      const row = cashierMap.get(name);
      const amount = Number(sale.total_amount || 0);
      row.revenue += amount;
      row.bills += 1;
      const hour = new Date(sale.timestamp || sale.date || Date.now()).getHours();
      if (!Number.isNaN(hour)) row.hours.add(hour);
    });

    const rows = Array.from(cashierMap.entries()).map(([name, row]) => {
      const activeHours = Math.max(1, row.hours.size);
      const avgPerHour = row.revenue / activeHours;
      const targetPct = hourlyTarget > 0 ? Math.round((avgPerHour / hourlyTarget) * 100) : 0;
      return {
        name,
        bills: row.bills,
        revenue: row.revenue,
        activeHours,
        avgPerHour,
        targetPct
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const globalHours = new Set(todaySales.map((sale) => new Date(sale.timestamp || sale.date || Date.now()).getHours()));
    const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
    const overallAvgPerHour = totalRevenue / Math.max(1, globalHours.size || 1);

    const summary = `
      <div class="sys-info-row"><span class="sys-info-label">Cashier Auto Shift</span><span class="sys-info-val">${autoShiftOn ? 'ON' : 'OFF'}</span></div>
      <div class="sys-info-row"><span class="sys-info-label">Auto Shift Opening Float</span><span class="sys-info-val">${formatLkr(openingFloat)}</span></div>
      <div class="sys-info-row"><span class="sys-info-label">Hourly Payment Target</span><span class="sys-info-val">${hourlyTarget > 0 ? formatLkr(hourlyTarget) : 'Not Set'}</span></div>
      <div class="sys-info-row"><span class="sys-info-label">Cashier Salary Basis</span><span class="sys-info-val">${escapeHtml(salaryBasis)}</span></div>
      <div class="sys-info-row"><span class="sys-info-label">Cashier Salary Amount</span><span class="sys-info-val">${salaryAmount > 0 ? formatLkr(salaryAmount) : 'Not Set'}</span></div>
      <div class="sys-info-row"><span class="sys-info-label">Overall Avg Per Hour (Today)</span><span class="sys-info-val">${todaySales.length ? formatLkr(overallAvgPerHour) : 'No sales yet'}</span></div>
    `;

    if (!rows.length) {
      container.innerHTML = `
        ${summary}
        <div class="cashier-hourly-empty">No cashier payments recorded yet for today.</div>
      `;
      return;
    }

    container.innerHTML = `
      ${summary}
      <div class="cashier-hourly-wrap">
        <table class="cashier-hourly-table">
          <thead>
            <tr>
              <th>Cashier</th>
              <th style="text-align:right">Bills</th>
              <th style="text-align:right">Active Hours</th>
              <th style="text-align:right">Total</th>
              <th style="text-align:right">Avg / Hour</th>
              <th style="text-align:right">Target</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.name)}</td>
                <td style="text-align:right">${row.bills}</td>
                <td style="text-align:right">${row.activeHours}</td>
                <td style="text-align:right">${formatLkr(row.revenue)}</td>
                <td style="text-align:right">${formatLkr(row.avgPerHour)}</td>
                <td style="text-align:right">${hourlyTarget > 0 ? `${row.targetPct}%` : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
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
      thermalPrinterName: document.getElementById('thermalPrinterName').value.trim(),
      autoPrint: String(document.getElementById('autoPrint').checked),
      showLogo: String(document.getElementById('showLogo').checked),
      defaultPaymentMethod: document.getElementById('defaultPaymentMethod').value,
      idleTimeoutMin: String(Math.max(0, parseInt(document.getElementById('idleTimeoutMin').value || '0', 10) || 0)),
      cashierAutoShiftStart: String(document.getElementById('cashierAutoShiftStart').checked),
      autoShiftOpeningFloat: String(Math.max(0, parseFloat(document.getElementById('autoShiftOpeningFloat').value || '0') || 0)),
      cashierHourlyPaymentTarget: String(Math.max(0, parseFloat(document.getElementById('cashierHourlyPaymentTarget').value || '0') || 0)),
      cashierSalaryBasis: document.getElementById('cashierSalaryBasis').value || 'hourly',
      cashierSalaryAmount: String(Math.max(0, parseFloat(document.getElementById('cashierSalaryAmount').value || '0') || 0)),
      cashierTargetBills: String(Math.max(1, parseInt(document.getElementById('cashierTargetBills').value || '50', 10) || 50)),
      keyboardShortcuts: String(document.getElementById('keyboardShortcuts').checked),
      barcodeScanSound: String(document.getElementById('barcodeScanSound').checked),
      lowStockAlertLevel: String(Math.max(0, parseInt(document.getElementById('lowStockAlertLevel').value || '10', 10) || 10)),
      requireAdminForRefund: String(document.getElementById('requireAdminForRefund').checked),
      receiptFooter: document.getElementById('receiptFooter').value.trim() || 'Thank you for shopping with us!',
      googleDriveBackupEmail: document.getElementById('googleDriveBackupEmail').value.trim()
    };

    if (!next.storeName) return showToast('Store Name is required', 'error');
    if (next.googleDriveBackupEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.googleDriveBackupEmail)) {
      return showToast('Enter a valid Gmail address for auto backup', 'error');
    }

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
    await refreshSystemStats();
    showToast('Settings saved successfully');
  }

  async function resetSettings() {
    settings = { ...defaultSettings };
    for (const [k, v] of Object.entries(settings)) {
      await saveKV(k, v);
    }
    setFields();
    await refreshSystemStats();
    showToast('Settings reset to defaults');
  }

  function bindEvents() {
    document.querySelectorAll('.settings-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab-btn').forEach((b) => b.classList.remove('active'));
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
        sel.innerHTML = '<option value="">-- System Default Printer --</option>';
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

    document.getElementById('googleDriveBackupNowBtn').addEventListener('click', async () => {
      const email = document.getElementById('googleDriveBackupEmail').value.trim();
      if (!email) return showToast('Add and save a Gmail address first', 'error');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Enter a valid Gmail address', 'error');

      try {
        await saveKV('googleDriveBackupEmail', email);
        settings.googleDriveBackupEmail = email;
        const result = await window.api.runGoogleDriveBackupNow();
        await refreshGoogleDriveBackupStatus();
        showToast(result.storage === 'Google Drive' ? 'Google Drive backup created' : 'Backup created in local fallback folder');
      } catch (err) {
        showToast(`Google Drive backup failed: ${err.message}`, 'error');
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

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '\'': '&#39;',
      '"': '&quot;'
    }[char]));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user || user.role === 'cashier') {
      alert('Access Denied: Owner Only');
      window.location.href = 'sales.html';
      return;
    }

    Components.init({
      title: 'System Settings'
    });

    bindEvents();
    try {
      await loadSettings();
    } catch (err) {
      alert(`Failed to load settings: ${err.message}`);
    }
  });
})();

