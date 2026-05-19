'use strict';
(function () {

  // ── STATE ──────────────────────────────────────────────
  let cart = [];           // { id, name, price, qty, unit }
  let allProducts = [];
  let allCustomers = [];
  let allCategories = [];  // { id, name }
  let attachedCustomer = null;
  let activePayMethod = 'Cash';
  let shiftStartTime = null;
  let shiftInterval = null;
  let settings = {};

  // ── INIT ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user || user.role !== 'cashier') {
      alert('Access Denied: Cashier Only');
      window.location.href = 'login.html';
      return;
    }

    // Populate header
    document.getElementById('cashierName').textContent = user.name || 'Cashier';
    document.getElementById('cashierAvatar').textContent = (user.name || 'C')[0].toUpperCase();

    // Shift timer
    const savedStart = localStorage.getItem('quickpos-shift-start');
    shiftStartTime = savedStart ? new Date(savedStart) : new Date();
    if (!savedStart) localStorage.setItem('quickpos-shift-start', shiftStartTime.toISOString());
    startShiftTimer();

    // Load settings + data
    try {
      settings = await window.api.getSettings();
      document.getElementById('navStoreName').textContent = settings.storeName || 'QuickPOS';
    } catch (_) {}

    await loadCategories();
    await loadProducts();
    await loadCustomers();
    bindEvents();
    focusBarcode();
  });

  // ── SHIFT TIMER ────────────────────────────────────────
  function startShiftTimer() {
    function tick() {
      const diff = Math.floor((Date.now() - shiftStartTime) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      document.getElementById('shiftTimer').textContent = `${h}:${m}:${s}`;
    }
    tick();
    shiftInterval = setInterval(tick, 1000);
  }

  // ── FOCUS HELPER ────────────────────────────────────────
  function focusBarcode() {
    requestAnimationFrame(() => document.getElementById('barcodeInput').focus());
  }

  // ── DATA LOADING ────────────────────────────────────────
  async function loadCategories() {
    try {
      allCategories = await window.api.getCategories();
    } catch (_) {}
  }

  async function loadProducts() {
    try {
      allProducts = await window.api.getProducts();
      renderQuickGrid(allProducts);
      buildCategoryTabs();
    } catch (e) { toast('Failed to load products', 'error'); }
  }

  async function loadCustomers() {
    try {
      allCustomers = await window.api.getCustomers();
    } catch (_) {}
  }

  // ── QUICK GRID ──────────────────────────────────────────
  const ICON_COLORS = [
    { bg: 'rgba(29,45,191,0.09)', color: '#1D2DBF' },
    { bg: 'rgba(16,185,129,0.09)', color: '#059669' },
    { bg: 'rgba(245,158,11,0.09)', color: '#b45309' },
    { bg: 'rgba(239,68,68,0.09)', color: '#dc2626' },
    { bg: 'rgba(139,92,246,0.09)', color: '#7c3aed' },
    { bg: 'rgba(236,72,153,0.09)', color: '#be185d' },
  ];

  function renderQuickGrid(products) {
    const grid = document.getElementById('quickGrid');
    const empty = document.getElementById('quickEmpty');
    if (!products.length) {
      grid.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = products.map((p, i) => {
      const col = ICON_COLORS[i % ICON_COLORS.length];
      const outOfStock = Number(p.current_stock) <= 0;
      return `<div class="quick-card${outOfStock ? ' out-of-stock' : ''}" data-id="${p.id}" title="${p.name}">
        <div class="quick-card-icon" style="background:${col.bg};color:${col.color}">
          <i class="fa-solid fa-${categoryIcon(p.category_id)}"></i>
        </div>
        <span class="quick-card-name">${p.name}</span>
        <span class="quick-card-price">LKR ${fmt(p.selling_price)}</span>
        <span class="quick-card-stock">${outOfStock ? 'Out of stock' : `Stock: ${p.current_stock}`}</span>
      </div>`;
    }).join('');

    grid.querySelectorAll('.quick-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.id);
        const p = allProducts.find(x => x.id === id);
        if (p) addToCart(p);
      });
    });
  }

  function categoryIcon(catId) {
    if (!allCategories || !allCategories.length) return 'box';
    const cat = allCategories.find(c => c.id === catId);
    if (!cat || !cat.name) return 'box';
    const name = cat.name.toLowerCase();

    if (name.includes('grocer') || name.includes('spice') || name.includes('food')) return 'basket-shopping';
    if (name.includes('beverage') || name.includes('drink') || name.includes('juice') || name.includes('water')) return 'bottle-water';
    if (name.includes('bakery') || name.includes('bread') || name.includes('cake') || name.includes('biscuit')) return 'bread-slice';
    if (name.includes('personal') || name.includes('care') || name.includes('cosmetic') || name.includes('soap') || name.includes('shampoo')) return 'soap';
    if (name.includes('vegetable') || name.includes('fruit') || name.includes('veg') || name.includes('farm')) return 'apple-whole';
    if (name.includes('fish') || name.includes('meat') || name.includes('seafood') || name.includes('chicken')) return 'fish';
    if (name.includes('household') || name.includes('clean') || name.includes('detergent')) return 'hand-sparkles';
    if (name.includes('pharmacy') || name.includes('medicine') || name.includes('health')) return 'briefcase-medical';
    
    return 'box';
  }

  function buildCategoryTabs() {
    const tabsEl = document.getElementById('quickFilterTabs');

    // Build a map: category_id → display name from allCategories
    const catNameMap = new Map();
    allCategories.forEach(c => {
      catNameMap.set(String(c.id), c.name);
    });

    // Collect unique category IDs actually used by products
    const usedCatIds = [...new Set(allProducts.map(p => String(p.category_id)))];

    const extra = usedCatIds.map(id => {
      const label = catNameMap.get(id) || ('Cat' + id);
      return `<button class="q-tab" data-cat="${id}">${label}</button>`;
    }).join('');

    tabsEl.innerHTML = `<button class="q-tab active" data-cat="all">All</button>${extra}`;
    tabsEl.querySelectorAll('.q-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('.q-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        const filtered = cat === 'all' ? allProducts : allProducts.filter(p => String(p.category_id) === cat);
        renderQuickGrid(filtered);
        focusBarcode();
      });
    });
  }

  // ── CART ─────────────────────────────────────────────────
  function addToCart(product) {
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      if (existing.qty >= Number(product.current_stock)) { toast('Max stock reached', 'warn'); return; }
      existing.qty++;
    } else {
      cart.push({ id: product.id, name: product.name, price: Number(product.selling_price), qty: 1, unit: product.unit_type || 'pcs' });
    }
    renderCart();
    toast(`${product.name} added`);
  }

  function renderCart() {
    const tbody = document.getElementById('cartBody');
    const empty = document.getElementById('cartEmpty');

    if (!cart.length) {
      tbody.innerHTML = '';
      empty.style.display = 'flex';
    } else {
      empty.style.display = 'none';
      tbody.innerHTML = cart.map((item, idx) => `
        <tr data-idx="${idx}">
          <td class="col-num">${idx + 1}</td>
          <td class="col-name">${item.name}</td>
          <td class="col-qty">
            <div class="qty-wrap">
              <button class="qty-btn" data-action="dec" data-idx="${idx}">−</button>
              <span class="qty-display">${item.qty}</span>
              <button class="qty-btn" data-action="inc" data-idx="${idx}">+</button>
            </div>
          </td>
          <td class="col-price">LKR ${fmt(item.price)}</td>
          <td class="col-sub">LKR ${fmt(item.price * item.qty)}</td>
          <td class="col-del"><button class="del-btn" data-idx="${idx}"><i class="fa-solid fa-xmark"></i></button></td>
        </tr>`).join('');

      tbody.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          if (btn.dataset.action === 'inc') {
            const prod = allProducts.find(p => p.id === cart[idx].id);
            if (prod && cart[idx].qty >= Number(prod.current_stock)) { toast('Max stock reached', 'warn'); return; }
            cart[idx].qty++;
          } else {
            cart[idx].qty--;
            if (cart[idx].qty <= 0) cart.splice(idx, 1);
          }
          renderCart();
        });
      });

      tbody.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          cart.splice(Number(btn.dataset.idx), 1);
          renderCart();
        });
      });
    }
    updateSummary();
  }

  function updateSummary() {
    const itemCount = cart.reduce((s, i) => s + i.qty, 0);
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const taxRate = parseFloat(settings.taxPercentage || '0') / 100;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    document.getElementById('summaryItems').textContent = itemCount;
    document.getElementById('summarySubtotal').textContent = `LKR ${fmt(subtotal)}`;
    document.getElementById('summaryTax').textContent = `LKR ${fmt(tax)}`;
    document.getElementById('summaryTotal').textContent = `LKR ${fmt(total)}`;
  }

  function getTotal() {
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const taxRate = parseFloat(settings.taxPercentage || '0') / 100;
    return subtotal + subtotal * taxRate;
  }

  // ── BARCODE ──────────────────────────────────────────────
  async function handleBarcode(raw) {
    const barcode = raw.trim();
    if (!barcode) return;
    document.getElementById('barcodeInput').value = '';
    try {
      const product = await window.api.searchProductByBarcode(barcode);
      if (!product) { toast(`Barcode not found: ${barcode}`, 'error'); return; }
      addToCart(product);
    } catch (e) { toast('Barcode lookup failed', 'error'); }
  }

  // ── PAYMENT MODAL ──────────────────────────────────────
  function openPayModal(method) {
    if (!cart.length) { toast('Cart is empty', 'warn'); return; }
    activePayMethod = method;
    const total = getTotal();

    document.getElementById('payModalTitle').textContent = `Pay by ${method}`;
    document.getElementById('payAmountDue').textContent = `LKR ${fmt(total)}`;
    document.getElementById('payMethodTag').textContent = method;

    const receivedGroup = document.getElementById('receivedGroup');
    const refGroup = document.getElementById('refGroup');
    const changeRow = document.getElementById('changeRow');

    receivedGroup.style.display = method === 'Credit' ? 'none' : 'flex';
    refGroup.style.display = method === 'Card' ? 'flex' : 'none';
    changeRow.style.display = method === 'Credit' ? 'none' : 'flex';

    if (method === 'Cash') {
      buildQuickAmounts(total);
      document.getElementById('receivedInput').value = '';
      document.getElementById('changeValue').textContent = 'LKR 0.00';
    }
    if (method === 'Card') {
      document.getElementById('receivedInput').value = fmt(total);
    }

    document.getElementById('payModalOverlay').classList.add('open');
    if (method !== 'Credit') setTimeout(() => document.getElementById('receivedInput').focus(), 100);
  }

  function buildQuickAmounts(total) {
    const denominations = [100, 200, 500, 1000, 2000, 5000];
    const suggestions = denominations.filter(d => d >= total).slice(0, 4);
    if (!suggestions.includes(Math.ceil(total / 100) * 100)) suggestions.unshift(Math.ceil(total));
    document.getElementById('quickAmounts').innerHTML = suggestions.slice(0, 5).map(
      d => `<button class="quick-amt-btn" data-amt="${d}">LKR ${fmt(d)}</button>`
    ).join('');
    document.getElementById('quickAmounts').querySelectorAll('.quick-amt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('receivedInput').value = btn.dataset.amt;
        updateChange();
      });
    });
  }

  function updateChange() {
    const total = getTotal();
    const received = parseFloat(document.getElementById('receivedInput').value) || 0;
    const change = Math.max(0, received - total);
    document.getElementById('changeValue').textContent = `LKR ${fmt(change)}`;
    document.getElementById('changeValue').style.color = received >= total ? 'var(--success)' : 'var(--danger)';
  }

  function closePayModal() {
    document.getElementById('payModalOverlay').classList.remove('open');
    focusBarcode();
  }

  // ── CUSTOMER MODAL ─────────────────────────────────────
  function openCustModal() {
    document.getElementById('custSearch').value = '';
    renderCustResults(allCustomers.slice(0, 10));
    document.getElementById('custModalOverlay').classList.add('open');
    setTimeout(() => document.getElementById('custSearch').focus(), 100);
  }

  function closeCustModal() {
    document.getElementById('custModalOverlay').classList.remove('open');
    focusBarcode();
  }

  function renderCustResults(list) {
    const el = document.getElementById('custResultList');
    if (!list.length) { el.innerHTML = '<p style="text-align:center;color:var(--text3);padding:20px;font-size:13px">No customers found</p>'; return; }
    el.innerHTML = list.map(c => `
      <div class="cust-result-item" data-id="${c.id}">
        <div class="cust-result-avatar">${(c.name || '?')[0].toUpperCase()}</div>
        <div>
          <div class="cust-result-name">${c.name}</div>
          <div class="cust-result-phone">${c.phone || '—'}</div>
        </div>
        ${Number(c.balance) > 0 ? `<span class="cust-result-balance">LKR ${fmt(c.balance)}</span>` : ''}
      </div>`).join('');
    el.querySelectorAll('.cust-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = Number(item.dataset.id);
        attachedCustomer = allCustomers.find(c => c.id === id);
        document.getElementById('customerLabel').textContent = attachedCustomer.name;
        document.getElementById('detachCustomerBtn').style.display = '';
        closeCustModal();
        toast(`Customer: ${attachedCustomer.name}`);
      });
    });
  }

  // ── EVENT BINDINGS ──────────────────────────────────────
  function bindEvents() {
    // Barcode input
    const barcodeIn = document.getElementById('barcodeInput');
    barcodeIn.addEventListener('keydown', e => { if (e.key === 'Enter') handleBarcode(barcodeIn.value); });
    document.getElementById('barcodeSearchBtn').addEventListener('click', () => handleBarcode(barcodeIn.value));

    // Quick search
    document.getElementById('quickSearch').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      const filtered = q ? allProducts.filter(p => p.name.toLowerCase().includes(q) || String(p.barcode).includes(q)) : allProducts;
      renderQuickGrid(filtered);
    });

    // Payment buttons
    document.getElementById('payCashBtn').addEventListener('click', () => openPayModal('Cash'));
    document.getElementById('payCardBtn').addEventListener('click', () => openPayModal('Card'));
    document.getElementById('payCreditBtn').addEventListener('click', () => openPayModal('Credit'));
    document.getElementById('clearCartBtn').addEventListener('click', () => {
      if (cart.length && confirm('Clear cart?')) {
        cart = [];
        attachedCustomer = null;
        document.getElementById('customerLabel').textContent = 'Walk-in Customer';
        document.getElementById('detachCustomerBtn').style.display = 'none';
        renderCart();
        focusBarcode();
      }
    });

    // Pay modal
    document.getElementById('payModalClose').addEventListener('click', closePayModal);
    document.getElementById('payModalCancelBtn').addEventListener('click', closePayModal);
    document.getElementById('receivedInput').addEventListener('input', updateChange);
    document.getElementById('payConfirmBtn').addEventListener('click', processPayment);

    // Customer
    document.getElementById('attachCustomerBtn').addEventListener('click', openCustModal);
    document.getElementById('detachCustomerBtn').addEventListener('click', () => {
      attachedCustomer = null;
      document.getElementById('customerLabel').textContent = 'Walk-in Customer';
      document.getElementById('detachCustomerBtn').style.display = 'none';
    });
    document.getElementById('custModalClose').addEventListener('click', closeCustModal);
    document.getElementById('custSearch').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      renderCustResults(q ? allCustomers.filter(c => c.name.toLowerCase().includes(q) || String(c.phone).includes(q)) : allCustomers.slice(0, 10));
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (cart.length && !confirm('Cart has items. Logout anyway?')) return;
      clearInterval(shiftInterval);
      localStorage.removeItem('quickpos-user');
      localStorage.removeItem('quickpos-shift-start');
      window.location.href = 'login.html';
    });

    // Overlay click to close modals
    document.getElementById('payModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closePayModal(); });
    document.getElementById('custModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeCustModal(); });

    // Global hotkeys
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' && e.target.id !== 'barcodeInput') return;
      if (e.key === 'F8') { e.preventDefault(); openPayModal('Cash'); }
      if (e.key === 'F9') { e.preventDefault(); openPayModal('Card'); }
      if (e.key === 'F10') { e.preventDefault(); openPayModal('Credit'); }
      if (e.key === 'Escape') {
        closePayModal();
        closeCustModal();
        focusBarcode();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); openCustModal(); }
    });
  }

  // ── PROCESS PAYMENT ─────────────────────────────────────
  async function processPayment() {
    const total = getTotal();
    const method = activePayMethod;
    let received = method === 'Credit' ? 0 : parseFloat(document.getElementById('receivedInput').value) || 0;
    const refNo = document.getElementById('refInput')?.value?.trim() || '';

    if (method === 'Cash' && received < total) { toast('Amount received is less than total', 'error'); return; }
    if (method === 'Credit' && !attachedCustomer) { toast('Attach a customer for credit sales', 'error'); return; }

    const balanceDue = method === 'Credit' ? total : Math.max(0, total - received);
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');

    const saleData = {
      items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
      total,
      method,
      received: method === 'Credit' ? 0 : received,
      balanceDue,
      refNo,
      cashier: user.name || 'Cashier',
      customerId: attachedCustomer?.id || null
    };

    try {
      document.getElementById('payConfirmBtn').disabled = true;
      const result = await window.api.saveSale(saleData);
      if (result.success) {
        toast(`Sale saved — ${result.billId}`);
        closePayModal();
        cart = [];
        attachedCustomer = null;
        document.getElementById('customerLabel').textContent = 'Walk-in Customer';
        document.getElementById('detachCustomerBtn').style.display = 'none';
        renderCart();
        await loadProducts(); // refresh stock counts on quick-grid
        focusBarcode();       // return focus immediately after transaction
      }
    } catch (err) {
      toast(err.message || 'Sale failed', 'error');
    } finally {
      document.getElementById('payConfirmBtn').disabled = false;
    }
  }

  // ── HELPERS ──────────────────────────────────────────────
  function fmt(n) {
    return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  let toastTimer;
  function toast(msg, type = 'success') {
    const el = document.getElementById('posToast');
    const msgEl = document.getElementById('posToastMsg');
    el.className = `pos-toast ${type}`;
    msgEl.textContent = msg;
    clearTimeout(toastTimer);
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

})();
