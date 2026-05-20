'use strict';
(function () {
  const DEFAULT_BILL_TARGET = 50;

  const state = {
    user: null,
    sales: [],
    products: [],
    customers: [],
    settings: {},
    heldBills: [],
    mySales: [],
    shiftTargetBills: DEFAULT_BILL_TARGET,
    shiftStart: null,
    modalResolver: null,
    toastTimer: null
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (window.Components && typeof window.Components.init === 'function') {
      window.Components.init({
        title: 'Cashier Hub',
        actions: `
          <div class="shift-control topbar-shift-control">
            <div class="shift-control-copy">
              <span class="shift-eyebrow">Shift</span>
              <strong id="shiftStatusText">Off</strong>
            </div>
            <button class="shift-toggle-btn" id="shiftToggleBtn" type="button" aria-pressed="false">
              <span class="shift-toggle-track"><span class="shift-toggle-knob"></span></span>
              <span class="shift-toggle-label">Start</span>
            </button>
          </div>
        `
      });
    }

    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user || user.role !== 'cashier') {
      window.location.href = 'login.html';
      return;
    }

    state.user = user;
    state.shiftStart = localStorage.getItem('quickpos-shift-start');

    const hubCashierName = document.getElementById('hubCashierName');
    const hubAvatar = document.getElementById('hubAvatar');
    if (hubCashierName) hubCashierName.textContent = user.name || 'Cashier';
    if (hubAvatar) hubAvatar.textContent = (user.name || 'C')[0].toUpperCase();

    bind();
    hydrateHoldBadge();
    updateSubtitle();
    await refreshData();

    setInterval(updateShiftDuration, 1000);
    setInterval(refreshData, 30000);
  }

  function bind() {
    const bindIfPresent = (id, eventName, handler) => {
      const element = document.getElementById(id);
      if (!element) return null;
      element.addEventListener(eventName, handler);
      return element;
    };

    bindIfPresent('hubNewSaleBtn', 'click', startSaleFlow);
    bindIfPresent('hubReprintBtn', 'click', openReprintModal);
    bindIfPresent('hubProductLookupBtn', 'click', openProductLookupModal);
    bindIfPresent('hubCustomerLookupBtn', 'click', openCustomerLookupModal);
    bindIfPresent('hubEndShiftBtn', 'click', openEndShiftFlow);
    bindIfPresent('hubLogoutBtn', 'click', logout);
    bindIfPresent('shiftToggleBtn', 'click', toggleShift);
    bindIfPresent('resumeHeldBtn', 'click', resumeFirstHeld);

    bindIfPresent('asyncModalClose', 'click', () => closeModal(false));
    bindIfPresent('asyncModal', 'click', (e) => {
      if (e.target.id === 'asyncModal') closeModal(false);
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'quickpos-held-bills') {
        hydrateHoldBadge();
        updateSubtitle();
        updateKpis(state.mySales);
      }
    });

    bindIfPresent('recentHoldList', 'click', (event) => {
      const row = event.target.closest('[data-hold-id]');
      if (!row) return;
      resumeHeldById(row.dataset.holdId);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'F11') {
        e.preventDefault();
        resumeFirstHeld();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        startSaleFlow();
      }
    });
  }

  async function refreshData() {
    hydrateHoldBadge();

    const [sales, products, customers, settings] = await Promise.all([
      window.api.getSalesHistory(),
      window.api.getProducts(),
      window.api.getCustomers(),
      window.api.getSettings ? window.api.getSettings() : Promise.resolve({})
    ]);

    state.sales = Array.isArray(sales) ? sales : [];
    state.products = Array.isArray(products) ? products : [];
    state.customers = Array.isArray(customers) ? customers : [];
    state.settings = settings && typeof settings === 'object' ? settings : {};
    state.shiftTargetBills = resolveShiftTarget();

    state.mySales = getCashierSalesForToday();
    syncShiftState();
    updateKpis(state.mySales);
    renderHourlyTrend();
    renderPaymentMix(state.mySales);
    renderTargetProgress(state.mySales.length);
    renderRecentHoldBills();
    renderTerminalRows(state.mySales);
    renderCashierGlance(state.mySales);
  }

  function getCashierSalesForToday() {
    const today = localDateKey(new Date());
    const cashierName = normalizeText(state.user.name);

    return state.sales.filter((sale) => {
      const saleDate = localDateKey(sale.timestamp || sale.date || Date.now());
      if (saleDate !== today) return false;
      return normalizeText(sale.cashier_name) === cashierName;
    });
  }

  function updateKpis(mySales) {
    const total = mySales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    const cashSales = mySales.reduce((sum, sale) => {
      return sum + (normalizePaymentMethod(sale.payment_method) === 'Cash' ? Number(sale.total_amount || 0) : 0);
    }, 0);
    const openingFloat = Number(localStorage.getItem('quickpos-shift-float') || 0);
    const expectedDrawer = openingFloat + cashSales;
    const actualDrawer = Number(localStorage.getItem('quickpos-drawer-actual') || expectedDrawer);
    const variance = actualDrawer - expectedDrawer;
    const pendingHolds = Array.isArray(state.heldBills) ? state.heldBills.length : 0;

    document.getElementById('kpiSales').textContent = `LKR ${fmt(total)}`;
    document.getElementById('kpiBills').textContent = String(mySales.length);
    document.getElementById('kpiDrawerCash').textContent = `LKR ${fmt(actualDrawer)}`;
    document.getElementById('kpiExpectedVsActual').textContent = `LKR ${fmt(Math.abs(variance))}`;
    document.getElementById('kpiPendingHolds').textContent = String(pendingHolds);

    updateShiftDuration();
  }

  function syncShiftState() {
    state.shiftStart = localStorage.getItem('quickpos-shift-start');
    updateShiftToggle();
  }

  function updateShiftToggle() {
    const toggle = document.getElementById('shiftToggleBtn');
    const statusText = document.getElementById('shiftStatusText');
    const label = toggle ? toggle.querySelector('.shift-toggle-label') : null;
    const isActive = Boolean(state.shiftStart);

    if (toggle) {
      toggle.classList.toggle('is-active', isActive);
      toggle.setAttribute('aria-pressed', String(isActive));
    }
    if (statusText) statusText.textContent = isActive ? 'On' : 'Off';
    if (label) label.textContent = isActive ? 'End' : 'Start';
  }

  function updateShiftDuration() {
    if (!state.shiftStart) {
      document.getElementById('kpiDuration').textContent = '00:00:00';
      updateShiftToggle();
      return;
    }

    const start = new Date(state.shiftStart);
    if (Number.isNaN(start.getTime())) {
      document.getElementById('kpiDuration').textContent = '00:00:00';
      updateShiftToggle();
      return;
    }

    const diff = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    document.getElementById('kpiDuration').textContent = `${h}:${m}:${s}`;
    updateShiftToggle();
  }

  function renderHourlyTrend() {
    const chart = document.getElementById('hourlyChart');
    const axis = document.getElementById('hourlyAxis');
    const empty = document.getElementById('hourlyChartEmpty');
    const peakBadge = document.getElementById('hourlyPeakBadge');
    const legend = document.getElementById('hourlyLegend');

    if (!chart || !axis || !empty || !peakBadge || !legend) return;

    const now = new Date();
    const today = localDateKey(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = localDateKey(yesterdayDate);
    const cashierName = normalizeText(state.user.name);

    const todayValues = Array(24).fill(0);
    const yesterdayValues = Array(24).fill(0);

    state.sales.forEach((sale) => {
      if (normalizeText(sale.cashier_name) !== cashierName) return;

      const stamp = new Date(sale.timestamp || sale.date || Date.now());
      if (Number.isNaN(stamp.getTime())) return;

      const dateKey = localDateKey(stamp);
      const hour = stamp.getHours();
      const amount = Number(sale.total_amount || 0);

      if (dateKey === today) todayValues[hour] += amount;
      if (dateKey === yesterday) yesterdayValues[hour] += amount;
    });

    const allValues = [...todayValues, ...yesterdayValues];
    const maxValue = Math.max(...allValues, 1);
    const todayTotal = todayValues.reduce((sum, value) => sum + value, 0);
    const yesterdayTotal = yesterdayValues.reduce((sum, value) => sum + value, 0);
    const hasSales = allValues.some((value) => value > 0);
    empty.classList.toggle('show', !hasSales);

    let peak = { label: '--', value: 0, day: 'Today' };
    todayValues.forEach((value, hour) => {
      if (value > peak.value) {
        peak = { label: `${String(hour).padStart(2, '0')}:00`, value, day: 'Today' };
      }
    });
    yesterdayValues.forEach((value, hour) => {
      if (value > peak.value) {
        peak = { label: `${String(hour).padStart(2, '0')}:00`, value, day: 'Yesterday' };
      }
    });
    peakBadge.textContent = peak.value > 0
      ? `${peak.day} peak: ${peak.label} | LKR ${fmt(peak.value)}`
      : `Today: LKR ${fmt(todayTotal)}`;

    const width = 700;
    const height = 240;
    const left = 44;
    const right = 20;
    const top = 18;
    const bottom = 34;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const stepX = chartWidth / 23;

    const buildPoints = (values) => values.map((value, index) => {
      const x = left + (stepX * index);
      const y = top + (chartHeight - ((value / maxValue) * chartHeight));
      return { x, y, value, label: `${String(index).padStart(2, '0')}:00` };
    });

    const todayPoints = buildPoints(todayValues);
    const yesterdayPoints = buildPoints(yesterdayValues);
    const pathFromPoints = (points) => points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const todayPath = pathFromPoints(todayPoints);
    const yesterdayPath = pathFromPoints(yesterdayPoints);
    const areaPath = `${todayPath} L ${todayPoints[todayPoints.length - 1].x.toFixed(2)} ${(top + chartHeight).toFixed(2)} L ${todayPoints[0].x.toFixed(2)} ${(top + chartHeight).toFixed(2)} Z`;

    const gridLines = [0, 1, 2, 3].map((idx) => {
      const y = top + ((chartHeight / 3) * idx);
      return `<line x1="${left}" y1="${y.toFixed(2)}" x2="${(left + chartWidth).toFixed(2)}" y2="${y.toFixed(2)}" stroke="rgba(148,163,184,0.35)" stroke-dasharray="4 4" />`;
    }).join('');

    const todayCircles = todayPoints.map((point) => `
      <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4" fill="#ffffff" stroke="var(--primary)" stroke-width="2">
        <title>Today ${point.label} - LKR ${fmt(point.value)}</title>
      </circle>
    `).join('');
    const yesterdayCircles = yesterdayPoints
      .filter((_, index) => index % 2 === 0)
      .map((point) => `
        <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3" fill="#ffffff" stroke="#10b981" stroke-width="2">
          <title>Yesterday ${point.label} - LKR ${fmt(point.value)}</title>
        </circle>
      `).join('');

    chart.innerHTML = `
      <defs>
        <linearGradient id="hourAreaGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(29,45,191,0.26)"></stop>
          <stop offset="100%" stop-color="rgba(29,45,191,0.02)"></stop>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPath}" fill="url(#hourAreaGrad)"></path>
      <path d="${yesterdayPath}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8 7"></path>
      <path d="${todayPath}" fill="none" stroke="var(--primary)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path>
      ${yesterdayCircles}
      ${todayCircles}
    `;

    legend.innerHTML = `
      <span><i class="legend-line today"></i>Today: LKR ${fmt(todayTotal)}</span>
      <span><i class="legend-line yesterday"></i>Yesterday: LKR ${fmt(yesterdayTotal)}</span>
    `;

    axis.style.setProperty('--axis-count', '24');
    axis.innerHTML = Array.from({ length: 24 }, (_, hour) => {
      const showLabel = hour % 3 === 0 || hour === 23;
      return `<span class="hour-label">${showLabel ? `${String(hour).padStart(2, '0')}:00` : ''}</span>`;
    }).join('');
  }

  function renderPaymentMix(mySales) {
    const donut = document.getElementById('paymentDonut');
    const totalEl = document.getElementById('payMixTotal');
    const legend = document.getElementById('paymentLegend');

    if (!donut || !totalEl || !legend) return;

    const totals = {
      Cash: 0,
      Card: 0,
      Credit: 0
    };

    mySales.forEach((sale) => {
      const amount = Number(sale.total_amount || 0);
      const method = normalizePaymentMethod(sale.payment_method);
      totals[method] += amount;
    });

    const total = totals.Cash + totals.Card + totals.Credit;
    totalEl.textContent = `LKR ${fmt(total)}`;

    const segments = [
      { key: 'Cash', color: 'var(--primary)', amount: totals.Cash },
      { key: 'Card', color: '#10b981', amount: totals.Card },
      { key: 'Credit', color: '#f59e0b', amount: totals.Credit }
    ];

    if (total <= 0) {
      donut.style.background = 'conic-gradient(#e2e8f0 0deg 360deg)';
    } else {
      let degree = 0;
      const gradientParts = segments.map((segment) => {
        const start = degree;
        degree += (segment.amount / total) * 360;
        return `${segment.color} ${start.toFixed(2)}deg ${degree.toFixed(2)}deg`;
      });
      donut.style.background = `conic-gradient(${gradientParts.join(', ')})`;
    }

    legend.innerHTML = segments.map((segment) => {
      const pct = total > 0 ? Math.round((segment.amount / total) * 100) : 0;
      return `
        <div class="legend-row">
          <div class="legend-left">
            <span class="legend-dot" style="background:${segment.color}"></span>
            <span class="legend-name">${segment.key}</span>
          </div>
          <div class="legend-right">
            <span class="legend-amount">LKR ${fmt(segment.amount)}</span>
            <span class="legend-pct">${pct}%</span>
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('shiftCashTotal').textContent = `LKR ${fmt(totals.Cash)}`;
    document.getElementById('shiftCardTotal').textContent = `LKR ${fmt(totals.Card)}`;
    document.getElementById('shiftCreditTotal').textContent = `LKR ${fmt(totals.Credit)}`;
  }

  function renderTargetProgress(processedBills) {
    const target = Math.max(1, Number(state.shiftTargetBills || DEFAULT_BILL_TARGET));
    const percentRaw = (processedBills / target) * 100;
    const percentText = `${Math.round(percentRaw)}%`;

    const processedEl = document.getElementById('targetProcessed');
    const totalEl = document.getElementById('targetTotal');
    const percentEl = document.getElementById('targetPercent');
    const hintEl = document.getElementById('targetHint');
    const fillEl = document.getElementById('targetProgressFill');

    if (!processedEl || !totalEl || !percentEl || !hintEl || !fillEl) return;

    processedEl.textContent = String(processedBills);
    totalEl.textContent = String(target);
    percentEl.textContent = percentText;

    const fillWidth = Math.min(100, Math.max(0, percentRaw));
    fillEl.style.width = `${fillWidth}%`;
    fillEl.classList.toggle('over', percentRaw >= 100);

    if (processedBills >= target) {
      hintEl.textContent = `Target passed by ${processedBills - target} bill(s)`;
    } else {
      hintEl.textContent = `${target - processedBills} bill(s) remaining`;
    }
  }

  function resolveShiftTarget() {
    const settingKeys = ['cashierTargetBills', 'shiftTargetBills', 'dailyBillsTarget', 'cashierBillsTarget'];
    for (const key of settingKeys) {
      const val = Number(state.settings[key] || 0);
      if (val > 0) {
        return Math.round(val);
      }
    }

    return DEFAULT_BILL_TARGET;
  }

  function hydrateHoldBadge() {
    state.heldBills = JSON.parse(localStorage.getItem('quickpos-held-bills') || '[]');

    const badge = document.getElementById('holdFloatingBadge');
    const text = document.getElementById('holdBadgeText');

    if (!state.heldBills.length) {
      badge.style.display = 'none';
      renderRecentHoldBills();
      return;
    }

    badge.style.display = 'flex';
    text.textContent = `${state.heldBills.length} held bill(s)`;
    renderRecentHoldBills();
  }

  function renderRecentHoldBills() {
    const list = document.getElementById('recentHoldList');
    if (!list) return;

    if (!state.heldBills.length) {
      list.innerHTML = '<div class="hold-empty">No held bills waiting right now.</div>';
      return;
    }

    const recent = [...state.heldBills].slice(-3).reverse();
    list.innerHTML = recent.map((bill) => {
      const label = bill.customer?.name || 'Walk-in';
      const itemCount = (bill.cart || []).reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0);
      return `
        <button class="hold-item" data-hold-id="${escapeAttr(bill.id)}">
          <div class="hold-meta">
            <div class="hold-name">${escapeHtml(label)}</div>
            <div class="hold-desc">${formatQty(itemCount)} item(s) | ${escapeHtml(bill.at || 'Held')}</div>
          </div>
          <span class="hold-resume">Resume</span>
        </button>
      `;
    }).join('');
  }

  function renderTerminalRows(mySales) {
    const body = document.getElementById('terminalTableBody');
    if (!body) return;

    const rows = [];
    for (const sale of mySales) {
      const items = Array.isArray(sale.items) ? sale.items : [];
      for (const item of items) {
        rows.push({
          name: item.product_name || item.name || 'භාණ්ඩය',
          qty: Number(item.quantity || item.qty || 0),
          subtotal: Number(item.subtotal || 0),
          billId: sale.bill_id || `#${sale.id || ''}`
        });
      }
    }

    const latest = rows.slice(-8).reverse();
    if (!latest.length) {
      body.innerHTML = `
        <tr>
          <td colspan="4" class="terminal-sub" style="padding:14px 10px;text-align:center;">No terminal items yet for this shift.</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = latest.map((row) => {
      return `
        <tr>
          <td>
            <span class="terminal-name" title="${escapeAttr(row.name)}">${escapeHtml(row.name)}</span>
            <div class="terminal-sub">${escapeHtml(row.billId)}</div>
          </td>
          <td><span class="terminal-qty">${formatQty(row.qty)}</span></td>
          <td><span class="terminal-price">LKR ${fmt(row.subtotal)}</span></td>
          <td><button class="terminal-action" type="button">ADD</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderCashierGlance(mySales) {
    const lastBillEl = document.getElementById('glanceLastBill');
    const avgBillEl = document.getElementById('glanceAvgBill');
    const itemsSoldEl = document.getElementById('glanceItemsSold');
    const lowStockEl = document.getElementById('glanceLowStock');
    if (!lastBillEl || !avgBillEl || !itemsSoldEl || !lowStockEl) return;

    const total = mySales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    const itemsSold = mySales.reduce((sum, sale) => {
      return sum + (Array.isArray(sale.items)
        ? sale.items.reduce((itemSum, item) => itemSum + Number(item.quantity || item.qty || 0), 0)
        : 0);
    }, 0);
    const lastSale = [...mySales].sort((a, b) => {
      return new Date(b.timestamp || b.date || 0) - new Date(a.timestamp || a.date || 0);
    })[0];
    const lowStockCount = state.products.filter((product) => {
      return Number(product.current_stock || 0) <= Number(product.alert_level || 0);
    }).length;

    lastBillEl.textContent = lastSale ? (lastSale.bill_id || `#${lastSale.id || ''}`) : '--';
    avgBillEl.textContent = `LKR ${fmt(mySales.length ? total / mySales.length : 0)}`;
    itemsSoldEl.textContent = formatQty(itemsSold);
    lowStockEl.textContent = String(lowStockCount);
  }

  function updateSubtitle() {
    const subtitle = document.getElementById('hubSubtitle');
    if (!subtitle) return;

    if (state.heldBills.length > 0) {
      subtitle.textContent = `${state.heldBills.length} held bill(s) waiting | Press F11 to resume`;
      return;
    }

    subtitle.textContent = 'Ready for fast retail flow';
  }

  async function toggleShift() {
    syncShiftState();
    if (state.shiftStart) {
      await openEndShiftFlow();
      return;
    }

    const started = await ensureShiftStarted();
    if (!started) return;

    showToast('Shift started');
    await refreshData();
  }

  async function ensureShiftStarted() {
    if (!localStorage.getItem('quickpos-shift-start')) {
      if (!Object.keys(state.settings || {}).length && window.api.getSettings) {
        try {
          const liveSettings = await window.api.getSettings();
          state.settings = liveSettings && typeof liveSettings === 'object' ? liveSettings : {};
        } catch (_err) {
          state.settings = state.settings || {};
        }
      }

      const autoShiftEnabled = String(state.settings.cashierAutoShiftStart || 'false') === 'true';
      if (autoShiftEnabled) {
        const openingFloat = Math.max(0, Number(state.settings.autoShiftOpeningFloat || 0));
        localStorage.setItem('quickpos-shift-start', new Date().toISOString());
        localStorage.setItem('quickpos-shift-float', String(openingFloat));
        localStorage.setItem('quickpos-drawer-actual', String(openingFloat));
        state.shiftStart = localStorage.getItem('quickpos-shift-start');
        showToast(`Auto shift started (Float: LKR ${fmt(openingFloat)})`);
      } else {
        const amount = await promptNumber('Start New Shift', 'Enter starting cash float (LKR)', '0.00', 'Start Shift');
        if (amount === null) return false;
        localStorage.setItem('quickpos-shift-start', new Date().toISOString());
        localStorage.setItem('quickpos-shift-float', String(Number(amount || 0)));
        localStorage.setItem('quickpos-drawer-actual', String(Number(amount || 0)));
        state.shiftStart = localStorage.getItem('quickpos-shift-start');
      }
    }

    syncShiftState();
    updateShiftDuration();
    return true;
  }

  async function startSaleFlow() {
    const started = await ensureShiftStarted();
    if (!started) return;

    window.location.href = 'sales.html';
  }

  async function openReprintModal() {
    const userName = normalizeText(state.user.name);
    const mySales = state.sales
      .filter((sale) => normalizeText(sale.cashier_name) === userName)
      .slice(0, 80);

    const html = `
      <div class="modal-list">
        ${mySales.length ? mySales.map((sale) => `
          <div class="modal-row">
            <div>
              <strong>${sale.bill_id || ('#' + sale.id)}</strong><br>
              <small>${new Date(sale.timestamp).toLocaleString()} | ${sale.payment_method}</small>
            </div>
            <div>
              <strong>LKR ${fmt(sale.total_amount)}</strong>
              <button class="async-btn" data-reprint-id="${sale.id}">Reprint</button>
            </div>
          </div>
        `).join('') : '<div class="modal-row"><small>No past sales found for your user.</small></div>'}
      </div>`;

    const modalPromise = openModal('Past Sales & Reprint', html, [{ label: 'Close', value: false }]);

    document.querySelectorAll('[data-reprint-id]').forEach((btn) => {
      btn.addEventListener('click', () => handleReprint(Number(btn.dataset.reprintId)));
    });

    await modalPromise;
  }

  async function handleReprint(saleId) {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return;

    const items = (sale.items || []).map((item) => ({
      name: item.product_name,
      qty: Number(item.quantity || 0),
      price: Number(item.subtotal || 0) / Math.max(1, Number(item.quantity || 1))
    }));

    await window.api.printThermalReceipt({
      billId: sale.bill_id,
      cashier: sale.cashier_name,
      timestamp: sale.timestamp,
      total: sale.total_amount,
      items
    });

    showToast('Receipt sent to printer');
  }

  async function openProductLookupModal() {
    const html = `
      <input id="prodSearch" class="modal-search" placeholder="Search product name, barcode, description">
      <div id="prodTableWrap"></div>`;

    const modalPromise = openModal('Product Directory (Read-Only)', html, [{ label: 'Close', value: false }]);

    const search = document.getElementById('prodSearch');
    const draw = () => {
      const q = normalizeText(search.value);
      const rows = state.products
        .filter((product) => !q || normalizeText(product.name).includes(q) || normalizeText(product.barcode).includes(q) || normalizeText(product.description).includes(q))
        .slice(0, 120);

      document.getElementById('prodTableWrap').innerHTML = `
        <table class="hub-table">
          <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Barcode</th></tr></thead>
          <tbody>
            ${rows.map((product) => `
              <tr>
                <td>${escapeHtml(product.name)}</td>
                <td>LKR ${fmt(product.selling_price)}</td>
                <td>${Number(product.current_stock || 0)}</td>
                <td>${escapeHtml(product.barcode || '-')}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    };

    search.addEventListener('input', draw);
    draw();
    await modalPromise;
  }

  async function openCustomerLookupModal() {
    const html = `
      <input id="custSearch" class="modal-search" placeholder="Search customer name or phone">
      <div id="custTableWrap"></div>`;

    const modalPromise = openModal('Customer & Credit Lookup', html, [{ label: 'Close', value: false }]);

    const search = document.getElementById('custSearch');
    const draw = () => {
      const q = normalizeText(search.value);
      const rows = state.customers
        .filter((customer) => !q || normalizeText(customer.name).includes(q) || normalizeText(customer.phone).includes(q))
        .slice(0, 120);

      document.getElementById('custTableWrap').innerHTML = `
        <table class="hub-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Loyalty</th><th>Credit</th></tr></thead>
          <tbody>
            ${rows.map((customer) => `
              <tr>
                <td>${escapeHtml(customer.name)}</td>
                <td>${escapeHtml(customer.phone || '-')}</td>
                <td>${Number(customer.loyalty_points || 0)}</td>
                <td>LKR ${fmt(customer.balance || 0)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    };

    search.addEventListener('input', draw);
    draw();
    await modalPromise;
  }

  async function openEndShiftFlow() {
    syncShiftState();
    if (!state.shiftStart) {
      showToast('Start shift first');
      return;
    }

    const mySales = getCashierSalesForToday();

    let cashTotal = 0;
    let cardTotal = 0;
    let creditTotal = 0;
    let revenueTotal = 0;
    let itemsSold = 0;

    mySales.forEach((sale) => {
      const total = Number(sale.total_amount || 0);
      revenueTotal += total;

      const method = normalizePaymentMethod(sale.payment_method);
      if (method === 'Cash') cashTotal += total;
      if (method === 'Card') cardTotal += total;
      if (method === 'Credit') creditTotal += total;

      (sale.items || []).forEach((item) => {
        itemsSold += Number(item.quantity || 0);
      });
    });

    const drawerCount = await promptNumber('Blind Cash Drop', 'Enter final drawer count (LKR)', String(cashTotal.toFixed(2)), 'Close Shift');
    if (drawerCount === null) return;

    const floatAmount = Number(localStorage.getItem('quickpos-shift-float') || 0);
    const expectedDrawer = floatAmount + cashTotal;
    const variance = Number(drawerCount) - expectedDrawer;
    localStorage.setItem('quickpos-drawer-actual', String(Number(drawerCount)));

    const summary = {
      cashierName: state.user.name,
      shiftStart: state.shiftStart || null,
      startedTime: state.shiftStart ? new Date(state.shiftStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
      duration: document.getElementById('kpiDuration').textContent,
      openingFloat: floatAmount,
      cashTotal,
      cardTotal,
      creditTotal,
      itemsSold,
      revenueTotal,
      expectedDrawer,
      actualDrawer: Number(drawerCount),
      variance
    };

    await window.api.exportShiftSummaryPdf(summary);
    if (window.api.recordShiftReconciliation) {
      await window.api.recordShiftReconciliation(summary);
    }

    localStorage.removeItem('quickpos-shift-start');
    localStorage.removeItem('quickpos-shift-float');
    localStorage.removeItem('quickpos-drawer-actual');
    state.shiftStart = null;

    updateShiftToggle();
    updateShiftDuration();
    showToast(`Shift closed. Drawer variance: LKR ${fmt(variance)}`);
    await refreshData();
  }

  function resumeFirstHeld() {
    if (!state.heldBills.length) {
      showToast('No held bills available');
      return;
    }

    const latest = state.heldBills[state.heldBills.length - 1];
    resumeHeldById(latest.id);
  }

  function resumeHeldById(holdId) {
    const found = state.heldBills.find((bill) => String(bill.id) === String(holdId));
    if (!found) {
      showToast('Hold bill not found');
      return;
    }

    localStorage.setItem('quickpos-resume-hold-id', String(found.id));
    window.location.href = 'sales.html';
  }

  function logout() {
    localStorage.removeItem('quickpos-user');
    window.location.href = 'login.html';
  }

  function openModal(title, bodyHtml, buttons) {
    const overlay = document.getElementById('asyncModal');
    document.getElementById('asyncModalTitle').textContent = title;
    document.getElementById('asyncModalBody').innerHTML = bodyHtml;

    const actions = document.getElementById('asyncModalActions');
    actions.innerHTML = '';

    (buttons || []).forEach((button, index) => {
      const btn = document.createElement('button');
      btn.className = `async-btn${button.primary ? ' primary' : ''}${button.danger ? ' danger' : ''}`;
      btn.textContent = button.label;
      btn.addEventListener('click', () => closeModal(button.value));
      actions.appendChild(btn);
      if (index === 0) requestAnimationFrame(() => btn.focus());
    });

    overlay.classList.add('open');
    return new Promise((resolve) => {
      state.modalResolver = resolve;
    });
  }

  function closeModal(value) {
    const overlay = document.getElementById('asyncModal');
    overlay.classList.remove('open');

    if (state.modalResolver) {
      state.modalResolver(value);
      state.modalResolver = null;
    }
  }

  async function promptNumber(title, label, initial, confirmLabel) {
    const html = `<label>${label}</label><input id="modalNumberInput" class="modal-input" type="number" step="0.01" min="0" value="${escapeAttr(initial)}">`;
    const promise = openModal(title, html, [
      { label: 'Cancel', value: null },
      { label: confirmLabel, value: 'ok', primary: true }
    ]);

    const input = document.getElementById('modalNumberInput');
    if (input) setTimeout(() => input.focus(), 20);

    const result = await promise;
    if (result !== 'ok') return null;

    const value = Number((document.getElementById('modalNumberInput') || {}).value || 0);
    if (Number.isNaN(value) || value < 0) {
      showToast('Enter a valid amount');
      return null;
    }

    return value;
  }

  async function promptInteger(title, label, initial, confirmLabel) {
    const html = `<label>${label}</label><input id="modalIntegerInput" class="modal-input" type="number" step="1" min="1" value="${escapeAttr(initial)}">`;
    const promise = openModal(title, html, [
      { label: 'Cancel', value: null },
      { label: confirmLabel, value: 'ok', primary: true }
    ]);

    const input = document.getElementById('modalIntegerInput');
    if (input) setTimeout(() => input.focus(), 20);

    const result = await promise;
    if (result !== 'ok') return null;

    const value = Number((document.getElementById('modalIntegerInput') || {}).value || 0);
    const parsed = Math.round(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      showToast('Enter a valid target number');
      return null;
    }

    return parsed;
  }

  function showToast(message) {
    const toast = document.getElementById('hubToast');
    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function normalizePaymentMethod(method) {
    const val = normalizeText(method);
    if (val === 'card') return 'Card';
    if (val === 'credit') return 'Credit';
    return 'Cash';
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
  }

  function localDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatQty(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return '0';
    if (Number.isInteger(num)) return String(num);
    return num.toFixed(2).replace(/\.00$/, '');
  }

  function fmt(value) {
    return Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})();

