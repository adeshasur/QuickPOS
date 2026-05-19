'use strict';
(function () {
  const state = {
    user: null,
    sales: [],
    products: [],
    customers: [],
    heldBills: [],
    shiftStart: null,
    modalResolver: null,
    toastTimer: null
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user || user.role !== 'cashier') {
      window.location.href = 'login.html';
      return;
    }
    state.user = user;
    state.shiftStart = localStorage.getItem('quickpos-shift-start');

    document.getElementById('hubCashierName').textContent = user.name || 'Cashier';
    document.getElementById('hubAvatar').textContent = (user.name || 'C')[0].toUpperCase();

    bind();
    await refreshData();
    hydrateHoldBadge();
    setInterval(updateShiftDuration, 1000);
    setInterval(refreshData, 30000);
  }

  function bind() {
    document.getElementById('hubNewSaleBtn').addEventListener('click', startSaleFlow);
    document.getElementById('hubReprintBtn').addEventListener('click', openReprintModal);
    document.getElementById('hubProductLookupBtn').addEventListener('click', openProductLookupModal);
    document.getElementById('hubCustomerLookupBtn').addEventListener('click', openCustomerLookupModal);
    document.getElementById('hubEndShiftBtn').addEventListener('click', openEndShiftFlow);
    document.getElementById('hubLogoutBtn').addEventListener('click', logout);
    document.getElementById('resumeHeldBtn').addEventListener('click', resumeFirstHeld);
    document.getElementById('asyncModalClose').addEventListener('click', () => closeModal(false));
    document.getElementById('asyncModal').addEventListener('click', (e) => { if (e.target.id === 'asyncModal') closeModal(false); });
    window.addEventListener('storage', (e) => {
      if (e.key === 'quickpos-held-bills') hydrateHoldBadge();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F11') {
        e.preventDefault();
        resumeFirstHeld();
      }
    });
  }

  async function refreshData() {
    const [sales, products, customers] = await Promise.all([
      window.api.getSalesHistory(),
      window.api.getProducts(),
      window.api.getCustomers()
    ]);
    state.sales = Array.isArray(sales) ? sales : [];
    state.products = Array.isArray(products) ? products : [];
    state.customers = Array.isArray(customers) ? customers : [];
    updateKpis();
  }

  function updateKpis() {
    const today = new Date().toISOString().slice(0, 10);
    const name = (state.user.name || '').toLowerCase();
    const mySales = state.sales.filter((s) => {
      const stamp = new Date(s.timestamp || s.date || Date.now()).toISOString().slice(0, 10);
      return stamp === today && String(s.cashier_name || '').toLowerCase() === name;
    });
    const total = mySales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    document.getElementById('kpiSales').textContent = `LKR ${fmt(total)}`;
    document.getElementById('kpiBills').textContent = String(mySales.length);
    updateShiftDuration();
  }

  function updateShiftDuration() {
    if (!state.shiftStart) {
      document.getElementById('kpiDuration').textContent = '00:00:00';
      return;
    }
    const diff = Math.max(0, Math.floor((Date.now() - new Date(state.shiftStart).getTime()) / 1000));
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    document.getElementById('kpiDuration').textContent = `${h}:${m}:${s}`;
  }

  function hydrateHoldBadge() {
    state.heldBills = JSON.parse(localStorage.getItem('quickpos-held-bills') || '[]');
    const badge = document.getElementById('holdFloatingBadge');
    const text = document.getElementById('holdBadgeText');
    if (!state.heldBills.length) {
      badge.style.display = 'none';
      return;
    }
    badge.style.display = 'flex';
    text.textContent = `${state.heldBills.length} held bill(s)`;
  }

  async function startSaleFlow() {
    if (!localStorage.getItem('quickpos-shift-start')) {
      const amount = await promptNumber('Start New Shift', 'Enter starting cash float (LKR)', '0.00', 'Start Shift');
      if (amount === null) return;
      localStorage.setItem('quickpos-shift-start', new Date().toISOString());
      localStorage.setItem('quickpos-shift-float', String(Number(amount || 0)));
      state.shiftStart = localStorage.getItem('quickpos-shift-start');
    }
    window.location.href = 'sales.html';
  }

  async function openReprintModal() {
    const userName = (state.user.name || '').toLowerCase();
    const mySales = state.sales.filter((s) => String(s.cashier_name || '').toLowerCase() === userName).slice(0, 80);
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
    await openModal('Past Sales & Reprint', html, [{ label: 'Close', value: false }]);
    document.querySelectorAll('[data-reprint-id]').forEach((btn) => {
      btn.addEventListener('click', () => handleReprint(Number(btn.dataset.reprintId)));
    });
  }

  async function handleReprint(saleId) {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return;
    const items = (sale.items || []).map((it) => ({ name: it.product_name, qty: Number(it.quantity || 0), price: Number(it.subtotal || 0) / Math.max(1, Number(it.quantity || 1)) }));
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
    await openModal('Product Directory (Read-Only)', html, [{ label: 'Close', value: false }]);
    const search = document.getElementById('prodSearch');
    const draw = () => {
      const q = (search.value || '').toLowerCase().trim();
      const rows = state.products.filter((p) => !q || String(p.name).toLowerCase().includes(q) || String(p.barcode || '').toLowerCase().includes(q) || String(p.description || '').toLowerCase().includes(q)).slice(0, 120);
      document.getElementById('prodTableWrap').innerHTML = `<table class="hub-table"><thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Barcode</th></tr></thead><tbody>${rows.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>LKR ${fmt(p.selling_price)}</td><td>${Number(p.current_stock || 0)}</td><td>${escapeHtml(p.barcode || '-')}</td></tr>`).join('')}</tbody></table>`;
    };
    search.addEventListener('input', draw);
    draw();
  }

  async function openCustomerLookupModal() {
    const html = `
      <input id="custSearch" class="modal-search" placeholder="Search customer name or phone">
      <div id="custTableWrap"></div>`;
    await openModal('Customer & Credit Lookup', html, [{ label: 'Close', value: false }]);
    const search = document.getElementById('custSearch');
    const draw = () => {
      const q = (search.value || '').toLowerCase().trim();
      const rows = state.customers.filter((c) => !q || String(c.name).toLowerCase().includes(q) || String(c.phone || '').toLowerCase().includes(q)).slice(0, 120);
      document.getElementById('custTableWrap').innerHTML = `<table class="hub-table"><thead><tr><th>Name</th><th>Phone</th><th>Loyalty</th><th>Credit</th></tr></thead><tbody>${rows.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone || '-')}</td><td>${Number(c.loyalty_points || 0)}</td><td>LKR ${fmt(c.balance || 0)}</td></tr>`).join('')}</tbody></table>`;
    };
    search.addEventListener('input', draw);
    draw();
  }

  async function openEndShiftFlow() {
    const userName = (state.user.name || '').toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const mySales = state.sales.filter((s) => {
      const stamp = new Date(s.timestamp || Date.now()).toISOString().slice(0, 10);
      return stamp === today && String(s.cashier_name || '').toLowerCase() === userName;
    });
    let cashTotal = 0, cardTotal = 0, creditTotal = 0, revenueTotal = 0, itemsSold = 0;
    mySales.forEach((s) => {
      const total = Number(s.total_amount || 0);
      revenueTotal += total;
      if (s.payment_method === 'Cash') cashTotal += total;
      if (s.payment_method === 'Card') cardTotal += total;
      if (s.payment_method === 'Credit') creditTotal += total;
      (s.items || []).forEach((it) => { itemsSold += Number(it.quantity || 0); });
    });
    const drawerCount = await promptNumber('Blind Cash Drop', 'Enter final drawer count (LKR)', String(cashTotal.toFixed(2)), 'Close Shift');
    if (drawerCount === null) return;
    const floatAmount = Number(localStorage.getItem('quickpos-shift-float') || 0);
    const expectedDrawer = floatAmount + cashTotal;
    const variance = Number(drawerCount) - expectedDrawer;

    await window.api.exportShiftSummaryPdf({
      cashierName: state.user.name,
      startedTime: state.shiftStart ? new Date(state.shiftStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
      duration: document.getElementById('kpiDuration').textContent,
      cashTotal,
      cardTotal,
      creditTotal,
      itemsSold,
      revenueTotal
    });

    localStorage.removeItem('quickpos-shift-start');
    localStorage.removeItem('quickpos-shift-float');
    state.shiftStart = null;
    updateShiftDuration();
    showToast(`Shift closed. Drawer variance: LKR ${fmt(variance)}`);
  }

  function resumeFirstHeld() {
    if (!state.heldBills.length) {
      showToast('No held bills available');
      return;
    }
    localStorage.setItem('quickpos-resume-hold-id', state.heldBills[0].id);
    window.location.href = 'cashier_dashboard.html';
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
    (buttons || []).forEach((b, idx) => {
      const btn = document.createElement('button');
      btn.className = `async-btn${b.primary ? ' primary' : ''}${b.danger ? ' danger' : ''}`;
      btn.textContent = b.label;
      btn.addEventListener('click', () => closeModal(b.value));
      actions.appendChild(btn);
      if (idx === 0) requestAnimationFrame(() => btn.focus());
    });
    overlay.classList.add('open');
    return new Promise((resolve) => { state.modalResolver = resolve; });
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

  function showToast(msg) {
    const t = document.getElementById('hubToast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function escapeHtml(v) {
    return String(v || '').replace(/[&<>'"]/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[s]));
  }
  function escapeAttr(v) {
    return escapeHtml(v).replace(/`/g, '&#96;');
  }
})();
