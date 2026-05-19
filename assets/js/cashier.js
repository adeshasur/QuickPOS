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
  let heldBills = [];
  let pendingShiftSummary = null;
  let scanCount = 0;
  let checkoutFocusMode = false;
  let saleLockBusy = false;

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
    renderHeldBills();
    updateAttachedCustomerView();
    applyDensityMode(localStorage.getItem('quickpos-dense-mode') === '1');
    applyUiPreset(localStorage.getItem('quickpos-ui-preset') || 'minimal');
    updateLaneStatus('Ready to Scan');
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

  function renderQuickGrid(products) {
    const grid = document.getElementById('quickGrid');
    const empty = document.getElementById('quickEmpty');
    if (!products.length) {
      grid.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = products.map((p) => {
      const outOfStock = Number(p.current_stock) <= 0;
      return `<div class="quick-card${outOfStock ? ' out-of-stock' : ''}" data-id="${p.id}" title="${p.name}">
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
    pulseCartFeedback();
    scanCount += 1;
    updateLastScan(product);
    updateLaneStatus(`${product.name} scanned`);
    toast(`${product.name} added`);
  }

  function pulseCartFeedback() {
    const panel = document.querySelector('.cart-panel');
    panel.classList.add('scan-pulse');
    setTimeout(() => panel.classList.remove('scan-pulse'), 240);
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
            if (cart[idx].qty <= 0) return removeCartRowAnimated(idx);
          }
          renderCart();
        });
      });

      tbody.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', () => removeCartRowAnimated(Number(btn.dataset.idx)));
      });
    }
    updateSummary();
  }

  function removeCartRowAnimated(idx) {
    const row = document.querySelector(`#cartBody tr[data-idx="${idx}"]`);
    if (!row) {
      cart.splice(idx, 1);
      renderCart();
      return;
    }
    row.classList.add('row-removing');
    setTimeout(() => {
      cart.splice(idx, 1);
      renderCart();
    }, 190);
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
    const lines = cart.length;
    const meta = `${itemCount} qty • ${lines} lines`;
    document.getElementById('laneStatusMeta').textContent = meta;
    const progress = document.getElementById('cartProgressBar');
    if (progress) {
      const pct = Math.min(100, (itemCount / 40) * 100);
      progress.style.width = `${pct}%`;
    }
  }

  function updateLastScan(product) {
    const item = cart.find(c => c.id === product.id);
    document.getElementById('lastScannedName').textContent = product.name || 'Scanned item';
    document.getElementById('lastScannedQty').textContent = `Qty ${item ? item.qty : 1}`;
    document.getElementById('lastScannedAt').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function updateLaneStatus(message) {
    const pill = document.getElementById('laneStatusPill');
    if (!pill) return;
    pill.innerHTML = `<i class="fa-solid fa-circle"></i> ${message}`;
    pill.style.transform = 'scale(1.03)';
    setTimeout(() => { pill.style.transform = 'scale(1)'; }, 130);
    updateShortcutHud();
  }

  function applyDensityMode(enabled) {
    document.body.classList.toggle('dense-mode', !!enabled);
    const btn = document.getElementById('densityModeBtn');
    if (btn) btn.querySelector('span').textContent = enabled ? 'Comfort' : 'Dense';
  }

  function applyUiPreset(preset) {
    const valid = ['minimal', 'contrast', 'compact'];
    const next = valid.includes(preset) ? preset : 'minimal';
    document.body.classList.remove('ui-minimal', 'ui-contrast', 'ui-compact');
    document.body.classList.add(`ui-${next}`);
    document.querySelectorAll('.ui-preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.uiPreset === next);
    });
    localStorage.setItem('quickpos-ui-preset', next);
  }

  function setCheckoutFocusMode(enabled) {
    checkoutFocusMode = !!enabled;
    document.body.classList.toggle('checkout-focus', checkoutFocusMode);
    updateShortcutHud();
  }

  function updateShortcutHud() {
    const hud = document.getElementById('shortcutHud');
    if (!hud) return;
    hud.style.opacity = saleLockBusy ? '0.4' : '1';
  }

  function showSaleLock(billId) {
    const overlay = document.getElementById('saleLockOverlay');
    const text = document.getElementById('saleLockBill');
    text.textContent = `Bill ${billId} completed`;
    saleLockBusy = true;
    overlay.classList.add('show');
    updateShortcutHud();
    setTimeout(() => {
      overlay.classList.remove('show');
      saleLockBusy = false;
      updateShortcutHud();
    }, 1200);
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
    bindNumpad(total);
    updateChange();
    if (method !== 'Credit') setTimeout(() => document.getElementById('receivedInput').focus(), 100);
  }

  function buildQuickAmounts(total) {
    const suggestions = [100, 500, 1000, 5000, Math.ceil(total)];
    document.getElementById('quickAmounts').innerHTML = suggestions.map(
      d => `<button class="quick-amt-btn" data-amt="${d}">${d === Math.ceil(total) ? 'Exact Amount' : `LKR ${fmt(d)}`}</button>`
    ).join('');
    document.getElementById('quickAmounts').querySelectorAll('.quick-amt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const exact = btn.textContent.includes('Exact');
        document.getElementById('receivedInput').value = exact ? total.toFixed(2) : btn.dataset.amt;
        updateChange();
      });
    });
  }

  function bindNumpad(total) {
    document.querySelectorAll('.pad-key').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        const input = document.getElementById('receivedInput');
        if (activePayMethod === 'Credit') return;
        if (key === 'clear') input.value = '';
        else if (key === 'backspace') input.value = String(input.value).slice(0, -1);
        else if (key === 'exact') input.value = total.toFixed(2);
        else if (key === 'enter') return processPayment();
        else input.value = `${input.value || ''}${key}`;
        updateChange();
      };
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
        updateAttachedCustomerView();
        document.getElementById('detachCustomerBtn').style.display = '';
        closeCustModal();
        toast(`Customer: ${attachedCustomer.name}`);
      });
    });
  }

  function updateAttachedCustomerView() {
    if (!attachedCustomer) {
      document.getElementById('customerLabel').textContent = 'Walk-in Customer';
      document.getElementById('customerPoints').textContent = 'Loyalty: -';
      return;
    }
    const points = Number(attachedCustomer.loyalty_points || attachedCustomer.loyaltyPoints || 0);
    document.getElementById('customerLabel').textContent = attachedCustomer.name;
    document.getElementById('customerPoints').textContent = `Loyalty: ${points.toLocaleString('en-US')} pts`;
  }

  // ── EVENT BINDINGS ──────────────────────────────────────
  function bindEvents() {
    // Barcode input
    const barcodeIn = document.getElementById('barcodeInput');
    barcodeIn.addEventListener('keydown', e => { if (e.key === 'Enter') handleBarcode(barcodeIn.value); });
    document.getElementById('barcodeSearchBtn').addEventListener('click', () => handleBarcode(barcodeIn.value));
    document.getElementById('densityModeBtn').addEventListener('click', () => {
      const next = !document.body.classList.contains('dense-mode');
      applyDensityMode(next);
      localStorage.setItem('quickpos-dense-mode', next ? '1' : '0');
      toast(next ? 'Dense mode enabled' : 'Comfort mode enabled');
    });
    document.querySelectorAll('.ui-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyUiPreset(btn.dataset.uiPreset);
        toast(`UI: ${btn.dataset.uiPreset}`);
      });
    });
    document.getElementById('laneStatusPill').addEventListener('click', () => setCheckoutFocusMode(!checkoutFocusMode));

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
    document.getElementById('holdBtn').addEventListener('click', holdCurrentBill);
    document.getElementById('clearCartBtn').addEventListener('click', async () => {
      if (!cart.length) return;
      const confirmClear = await showConfirm('Clear Cart', 'Are you sure you want to remove all items from the cart?', { isDanger: true });
      if (confirmClear) {
        cart = [];
        attachedCustomer = null;
        updateAttachedCustomerView();
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
      updateAttachedCustomerView();
      document.getElementById('detachCustomerBtn').style.display = 'none';
    });
    document.getElementById('custModalClose').addEventListener('click', closeCustModal);
    document.getElementById('custSearch').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      renderCustResults(q ? allCustomers.filter(c => c.name.toLowerCase().includes(q) || String(c.phone).includes(q)) : allCustomers.slice(0, 10));
    });

    // Custom dialog button binds
    document.getElementById('customDialogConfirmBtn').addEventListener('click', () => closeConfirm(true));
    document.getElementById('customDialogCancelBtn').addEventListener('click', () => closeConfirm(false));

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      if (cart.length) {
        const confirmLogout = await showConfirm('Active Cart Warning', 'The cart has items. Are you sure you want to log out and discard them?', { isWarning: true });
        if (!confirmLogout) return;
      }
      clearInterval(shiftInterval);
      localStorage.removeItem('quickpos-user');
      localStorage.removeItem('quickpos-shift-start');
      window.location.href = 'login.html';
    });

    // Overlay click to close modals
    document.getElementById('payModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closePayModal(); });
    document.getElementById('custModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeCustModal(); });
    document.getElementById('customDialogOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeConfirm(false); });

    // Global hotkeys
    document.addEventListener('keydown', e => {
      // Check if dialog is open
      const dialogOverlay = document.getElementById('customDialogOverlay');
      if (dialogOverlay.classList.contains('open')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          closeConfirm(true);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeConfirm(false);
        }
        return;
      }

      if (e.target.tagName === 'INPUT' && e.target.id !== 'barcodeInput') return;
      if (e.key === 'F8') { e.preventDefault(); openPayModal('Cash'); }
      if (e.key === 'F9') { e.preventDefault(); openPayModal('Card'); }
      if (e.key === 'F10') { e.preventDefault(); openPayModal('Credit'); }
      if (e.key === 'F11') { e.preventDefault(); holdCurrentBill(); }
      if (e.key === 'Escape') {
        closePayModal();
        closeCustModal();
        focusBarcode();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); openCustModal(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setCheckoutFocusMode(!checkoutFocusMode);
        toast(checkoutFocusMode ? 'Checkout focus mode ON' : 'Checkout focus mode OFF');
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const next = !document.body.classList.contains('dense-mode');
        applyDensityMode(next);
        localStorage.setItem('quickpos-dense-mode', next ? '1' : '0');
      }
    });
  }

  // ── PROCESS PAYMENT ─────────────────────────────────────
  async function processPayment() {
    if (saleLockBusy) return;
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
      customerId: attachedCustomer?.id || null,
      allowStockOverride: false
    };

    try {
      document.getElementById('payConfirmBtn').disabled = true;
      const result = await window.api.saveSale(saleData);
      if (result.success) {
        toast(`Sale saved — ${result.billId}`);
        await window.api.exportThermalReceiptPdf({ ...saleData, billId: result.billId, timestamp: new Date().toISOString(), preview: true });
        showSaleLock(result.billId);
        closePayModal();
        cart = [];
        attachedCustomer = null;
        updateAttachedCustomerView();
        document.getElementById('detachCustomerBtn').style.display = 'none';
        renderCart();
        await loadProducts(); // refresh stock counts on quick-grid
        updateLaneStatus(`Bill ${result.billId} completed`);
        focusBarcode();       // return focus immediately after transaction
      }
    } catch (err) {
      if (String(err.message || '').includes('INSUFFICIENT_STOCK')) {
        const doOverride = await showConfirm('Low Stock Warning', 'Some items are out of stock in system. Override and continue sale?', { isWarning: true });
        if (doOverride) {
          saleData.allowStockOverride = true;
          const result = await window.api.saveSale(saleData);
          if (result.success) {
            toast(`Sale saved with override — ${result.billId}`, 'warn');
            showSaleLock(result.billId);
            closePayModal();
            cart = [];
            attachedCustomer = null;
            updateAttachedCustomerView();
            document.getElementById('detachCustomerBtn').style.display = 'none';
            renderCart();
            await loadProducts();
            updateLaneStatus(`Bill ${result.billId} completed with override`);
            focusBarcode();
            return;
          }
        }
      }
      toast(err.message || 'Sale failed', 'error');
    } finally {
      document.getElementById('payConfirmBtn').disabled = false;
    }
  }

  // ── CUSTOM DIALOG ──────────────────────────────────────
  let activeDialogResolver = null;

  function showConfirm(title, message, options = {}) {
    const { isDanger = false, isWarning = false } = options;
    return new Promise((resolve) => {
      activeDialogResolver = resolve;

      const overlay = document.getElementById('customDialogOverlay');
      const titleEl = document.getElementById('customDialogTitle');
      const msgEl = document.getElementById('customDialogMessage');
      const iconWrap = document.getElementById('customDialogIconWrap');
      const icon = document.getElementById('customDialogIcon');
      const confirmBtn = document.getElementById('customDialogConfirmBtn');

      titleEl.textContent = title;
      msgEl.textContent = message;

      iconWrap.className = 'custom-dialog-icon-wrap';
      confirmBtn.className = 'custom-dialog-btn confirm-btn';

      if (isDanger) {
        iconWrap.classList.add('danger-theme');
        icon.className = 'fa-solid fa-trash-can';
        confirmBtn.classList.add('danger-theme');
      } else if (isWarning) {
        iconWrap.classList.add('warning-theme');
        icon.className = 'fa-solid fa-triangle-exclamation';
      } else {
        iconWrap.classList.add('primary-theme');
        icon.className = 'fa-solid fa-circle-question';
      }

      overlay.classList.add('open');
    });
  }

  function closeConfirm(result) {
    const overlay = document.getElementById('customDialogOverlay');
    if (overlay.classList.contains('open')) {
      overlay.classList.remove('open');
      if (activeDialogResolver) {
        activeDialogResolver(result);
        activeDialogResolver = null;
      }
      focusBarcode();
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

  function holdCurrentBill() {
    if (!cart.length) {
      toast('No items to hold', 'warn');
      return;
    }
    heldBills.push({
      id: `H${Date.now()}`,
      cart: cart.map(i => ({ ...i })),
      customer: attachedCustomer ? { ...attachedCustomer } : null,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    cart = [];
    attachedCustomer = null;
    updateAttachedCustomerView();
    document.getElementById('detachCustomerBtn').style.display = 'none';
    renderCart();
    renderHeldBills();
    updateLaneStatus('Bill moved to Hold');
    toast('Bill held successfully');
  }

  function renderHeldBills() {
    const list = document.getElementById('holdList');
    const count = document.getElementById('holdCount');
    count.textContent = String(heldBills.length);
    if (!heldBills.length) {
      list.innerHTML = '<p class="hold-empty">No held bills</p>';
      return;
    }
    list.innerHTML = heldBills.map(h => `<button class="hold-chip" data-hold-id="${h.id}"><strong>${h.customer?.name || 'Walk-in'}</strong><br>${h.cart.length} items · ${h.at}</button>`).join('');
    list.querySelectorAll('.hold-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        if (cart.length) {
          const okay = await showConfirm('Replace Active Cart?', 'Resuming this held bill will replace the current cart.', { isWarning: true });
          if (!okay) return;
        }
        const idx = heldBills.findIndex(h => h.id === chip.dataset.holdId);
        if (idx < 0) return;
        const resumed = heldBills.splice(idx, 1)[0];
        cart = resumed.cart.map(i => ({ ...i }));
        attachedCustomer = resumed.customer ? { ...resumed.customer } : null;
        updateAttachedCustomerView();
        document.getElementById('detachCustomerBtn').style.display = attachedCustomer ? '' : 'none';
        renderHeldBills();
        renderCart();
        updateLaneStatus('Held bill resumed');
        toast('Held bill resumed');
      });
    });
  }

  // ── QUICK ACTIONS DROPDOWN & MODALS SYSTEM ─────────────────────────
  const actionsDropdownBtn = document.getElementById('actionsDropdownBtn');
  const actionsDropdownMenu = document.getElementById('actionsDropdownMenu');

  // Toggle Dropdown
  actionsDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    actionsDropdownMenu.classList.toggle('open');
  });

  // Close Dropdown on click-away
  document.addEventListener('click', () => {
    if (actionsDropdownMenu) actionsDropdownMenu.classList.remove('open');
  });

  // Modal selectors
  const addCustOverlay = document.getElementById('actAddCustomerModalOverlay');
  const recentSalesOverlay = document.getElementById('actRecentSalesModalOverlay');
  const returnRefundOverlay = document.getElementById('actReturnRefundModalOverlay');
  const adminPinOverlay = document.getElementById('adminPinModalOverlay');
  const shiftSummaryOverlay = document.getElementById('actShiftSummaryModalOverlay');

  // Close actions helper
  function closeAllActionModals() {
    [addCustOverlay, recentSalesOverlay, returnRefundOverlay, adminPinOverlay, shiftSummaryOverlay].forEach(o => {
      if (o) o.classList.remove('open');
    });
    focusBarcode();
  }

  // 1. ADD NEW CUSTOMER CONTROLLER
  document.getElementById('actAddCustomerBtn').addEventListener('click', () => {
    document.getElementById('newCustName').value = '';
    document.getElementById('newCustPhone').value = '';
    addCustOverlay.classList.add('open');
    document.getElementById('newCustName').focus();
  });
  document.getElementById('actAddCustomerClose').addEventListener('click', closeAllActionModals);
  document.getElementById('actAddCustomerCancel').addEventListener('click', closeAllActionModals);
  document.getElementById('actAddCustomerConfirm').addEventListener('click', async () => {
    const name = document.getElementById('newCustName').value.trim();
    const phone = document.getElementById('newCustPhone').value.trim();
    if (!name) {
      toast('Please enter a customer name.', 'error');
      return;
    }
    try {
      const res = await window.api.saveCustomer({ name, phone, address: '', balance: 0, loyaltyPoints: 0 });
      if (res.success) {
        toast(`Customer ${name} registered!`);
        closeAllActionModals();
        // Trigger customer list refresh if any search is active, or we can immediately attach this customer!
        attachedCustomer = { id: res.id, name, phone, balance: 0, loyaltyPoints: 0 };
        updateAttachedCustomerView();
        document.getElementById('detachCustomerBtn').style.display = 'inline-block';
      }
    } catch (err) {
      toast(err.message || 'Failed to save customer', 'error');
    }
  });

  // 2. RECENT TRANSACTIONS CONTROLLER
  document.getElementById('actRecentSalesBtn').addEventListener('click', async () => {
    recentSalesOverlay.classList.add('open');
    await loadRecentTransactions();
  });
  document.getElementById('actRecentSalesClose').addEventListener('click', closeAllActionModals);

  async function loadRecentTransactions() {
    const tbody = document.getElementById('recentSalesBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text3)"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';
    try {
      const sales = await window.api.getSalesHistory();
      // Filter for today's transactions
      const today = new Date().toISOString().slice(0, 10);
      const todaySales = sales.filter(s => s.timestamp.startsWith(today));
      
      if (todaySales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text3)"><i class="fa-solid fa-receipt" style="font-size:24px; margin-bottom:8px; opacity:0.5"></i><br>No transactions processed today.</td></tr>';
        return;
      }
      
      tbody.innerHTML = todaySales.map(s => {
        const timeStr = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <tr>
            <td class="mono font-bold" style="color:var(--primary)">${s.bill_id}</td>
            <td class="mono font-bold">LKR ${fmt(s.total_amount)}</td>
            <td><span class="status-badge" style="background:rgba(29,45,191,0.08); color:var(--primary); padding: 4px 8px; border-radius: 4px; font-size: 11px;">${s.payment_method}</span></td>
            <td>${s.cashier_name || 'Cashier'}</td>
            <td>${timeStr}</td>
            <td style="text-align:center">
              <button class="tbl-btn" onclick="window.printReceipt('${s.bill_id}')" title="Reprint Receipt" style="padding:6px 12px; font-size:12px; display:inline-flex; align-items:center; gap:6px; cursor:pointer">
                <i class="fa-solid fa-print"></i> Reprint
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--danger)">Failed to load: ${err.message}</td></tr>`;
    }
  }

  // Wires up global print receipt window printer bridge if clicked
  window.printReceipt = async function(billId) {
    try {
      toast(`Reprinting receipt for ${billId}...`);
      const sales = await window.api.getSalesHistory();
      const sale = sales.find(s => s.bill_id === billId);
      if (!sale) throw new Error('Transaction not found');
      // Render simple receipt HTML similar to sales history prints
      const timestamp = new Date(sale.timestamp).toLocaleString();
      let itemsHtml = sale.items.map(item => `
        <tr>
          <td>${item.product_name}</td>
          <td>${item.quantity}</td>
          <td style="text-align:right">${item.subtotal.toFixed(2)}</td>
        </tr>
      `).join('');
      
      const html = `
        <div style="font-family: monospace; width: 300px; padding: 10px; font-size: 12px;">
          <h3 style="text-align:center; margin: 0 0 5px 0;">QuickPOS</h3>
          <p style="text-align:center; margin: 0 0 10px 0;">DUPLICATE RECEIPT</p>
          <hr/>
          <p>Bill ID: ${sale.bill_id}</p>
          <p>Date: ${timestamp}</p>
          <p>Cashier: ${sale.cashier_name || 'POS Operator'}</p>
          <hr/>
          <table style="width:100%; font-size:12px;">
            <thead>
              <tr style="border-bottom: 1px dashed #000;">
                <th style="text-align:left;">Item</th>
                <th style="text-align:left;">Qty</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <hr/>
          <p style="text-align:right; font-weight:bold; font-size:14px;">TOTAL: LKR ${sale.total_amount.toFixed(2)}</p>
          <p style="text-align:center; margin-top:20px;">Thank you for shopping with us!</p>
        </div>
      `;
      await window.api.printReceiptSilent({ html });
      toast('Receipt reprinted successfully!');
    } catch (err) {
      toast(err.message || 'Reprint failed', 'error');
    }
  };

  // 3. PROCESS RETURN/REFUND & ADMIN PIN CONTROLLER
  let refundSale = null;
  let adminPinSuccessCallback = null;

  document.getElementById('actReturnRefundBtn').addEventListener('click', () => {
    document.getElementById('refundInvoiceSearch').value = '';
    document.getElementById('refundInvoiceDetailsWrap').style.display = 'none';
    document.getElementById('refundEmptyState').style.display = 'block';
    returnRefundOverlay.classList.add('open');
    document.getElementById('refundInvoiceSearch').focus();
  });
  document.getElementById('actReturnRefundClose').addEventListener('click', closeAllActionModals);
  document.getElementById('actReturnRefundCancel').addEventListener('click', closeAllActionModals);

  document.getElementById('refundInvoiceSearchBtn').addEventListener('click', async () => {
    const billId = document.getElementById('refundInvoiceSearch').value.trim();
    if (!billId) {
      toast('Please enter an Invoice/Bill ID.', 'error');
      return;
    }
    try {
      const sales = await window.api.getSalesHistory();
      const sale = sales.find(s => s.bill_id === billId);
      if (!sale) {
        toast('Invoice not found.', 'error');
        document.getElementById('refundInvoiceDetailsWrap').style.display = 'none';
        document.getElementById('refundEmptyState').style.display = 'block';
        return;
      }
      refundSale = sale;
      document.getElementById('refundCustLabel').textContent = sale.customer_id ? `Customer ID: ${sale.customer_id}` : 'Walk-in Customer';
      document.getElementById('refundTotalLabel').textContent = `LKR ${fmt(sale.total_amount)}`;
      document.getElementById('refundDateLabel').textContent = new Date(sale.timestamp).toLocaleString();
      
      const tbody = document.getElementById('refundItemsBody');
      tbody.innerHTML = sale.items.map((item, index) => `
        <tr>
          <td>${item.product_name}</td>
          <td class="mono">LKR ${fmt(item.subtotal / item.quantity)}</td>
          <td class="mono">${item.quantity}</td>
          <td style="text-align:center">
            <input type="number" class="refund-qty-input" data-index="${index}" data-product-id="${item.product_id}" data-max="${item.quantity}" min="0" max="${item.quantity}" value="0">
          </td>
        </tr>
      `).join('');

      document.getElementById('refundEmptyState').style.display = 'none';
      document.getElementById('refundInvoiceDetailsWrap').style.display = 'block';
    } catch (err) {
      toast(err.message || 'Failed to search invoice', 'error');
    }
  });

  // Admin PIN overlay handlers
  document.getElementById('adminPinClose').addEventListener('click', () => adminPinOverlay.classList.remove('open'));
  document.getElementById('adminPinCancel').addEventListener('click', () => adminPinOverlay.classList.remove('open'));
  document.getElementById('adminPinSubmit').addEventListener('click', async () => {
    const pin = document.getElementById('adminPinInput').value.trim();
    if (!pin) {
      toast('Please enter admin PIN.', 'error');
      return;
    }
    const res = await window.api.verifyAdminPin(pin);
    if (res.success) {
      adminPinOverlay.classList.remove('open');
      document.getElementById('adminPinInput').value = '';
      document.getElementById('adminPinError').style.display = 'none';
      if (adminPinSuccessCallback) {
        adminPinSuccessCallback();
        adminPinSuccessCallback = null;
      }
    } else {
      document.getElementById('adminPinError').style.display = 'block';
      toast(res.message || 'Invalid PIN', 'error');
    }
  });

  document.getElementById('actReturnRefundSubmit').addEventListener('click', () => {
    const qtyInputs = document.querySelectorAll('.refund-qty-input');
    const returns = [];
    qtyInputs.forEach(input => {
      const qty = parseFloat(input.value) || 0;
      if (qty > 0) {
        const index = parseInt(input.getAttribute('data-index'));
        const productId = parseInt(input.getAttribute('data-product-id'));
        const maxQty = parseFloat(input.getAttribute('data-max'));
        returns.push({ qty, productId, index, maxQty });
      }
    });

    if (returns.length === 0) {
      toast('Please select at least 1 item and quantity to return.', 'error');
      return;
    }

    // Admin PIN flow authorization
    adminPinSuccessCallback = async () => {
      try {
        // Process each returned item to restore stock counts
        for (const ret of returns) {
          await window.api.addStock({
            productId: ret.productId,
            quantity: ret.qty,
            costPrice: refundSale.items[ret.index].unit_price * 0.7, // auto recovery of cost estimates
            sellingPrice: refundSale.items[ret.index].unit_price,
            expiryDate: ''
          });
        }
        
        toast(`Refund for ${refundSale.bill_id} processed successfully! Stock restored.`);
        closeAllActionModals();
        await loadProducts(); // Refresh products stock display
      } catch (err) {
        toast(err.message || 'Failed to process refund', 'error');
      }
    };

    // Open Admin PIN verification overlay
    document.getElementById('adminPinInput').value = '';
    document.getElementById('adminPinError').style.display = 'none';
    adminPinOverlay.classList.add('open');
    document.getElementById('adminPinInput').focus();
  });

  // 4. END SHIFT SUMMARY CONTROLLER
  document.getElementById('actShiftSummaryBtn').addEventListener('click', async () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    document.getElementById('shiftCashierName').textContent = user.name || 'POS Operator';
    document.getElementById('shiftStartedTime').textContent = shiftStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Duration
    const diff = Math.floor((new Date() - shiftStartTime) / 1000);
    const hrs = String(Math.floor(diff / 3600)).padStart(2, '0');
    const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    document.getElementById('shiftDurationLabel').textContent = `${hrs}h ${mins}m`;

    // Fetch shift totals
    try {
      const sales = await window.api.getSalesHistory();
      const today = new Date().toISOString().slice(0, 10);
      const todaySales = sales.filter(s => s.timestamp.startsWith(today) && (s.cashier_name === user.name || !s.cashier_name));
      
      let cashTotal = 0;
      let cardTotal = 0;
      let creditTotal = 0;
      let revenueTotal = 0;
      let itemsSold = 0;

      todaySales.forEach(s => {
        revenueTotal += s.total_amount;
        itemsSold += (s.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        if (s.payment_method === 'Cash') cashTotal += s.total_amount;
        else if (s.payment_method === 'Card') cardTotal += s.total_amount;
        else if (s.payment_method === 'Credit') creditTotal += s.total_amount;
      });

      document.getElementById('shiftCashSales').textContent = `LKR ${fmt(cashTotal)}`;
      document.getElementById('shiftCardSales').textContent = `LKR ${fmt(cardTotal)}`;
      document.getElementById('shiftCreditSales').textContent = `LKR ${fmt(creditTotal)}`;
      document.getElementById('shiftTotalRevenue').textContent = `LKR ${fmt(revenueTotal)}`;
      pendingShiftSummary = {
        cashierName: user.name || 'POS Operator',
        startedTime: shiftStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: document.getElementById('shiftDurationLabel').textContent,
        cashTotal,
        cardTotal,
        creditTotal,
        revenueTotal,
        itemsSold
      };
      
      shiftSummaryOverlay.classList.add('open');
    } catch (err) {
      toast(err.message || 'Failed to aggregate shift totals', 'error');
    }
  });

  document.getElementById('actShiftSummaryClose').addEventListener('click', closeAllActionModals);
  document.getElementById('actShiftSummaryCancel').addEventListener('click', closeAllActionModals);
  document.getElementById('actShiftSummaryExportPdf').addEventListener('click', async () => {
    if (!pendingShiftSummary) return toast('Open shift summary first', 'warn');
    await window.api.exportShiftSummaryPdf(pendingShiftSummary);
    toast('Shift summary PDF exported');
  });
  document.getElementById('actShiftSummaryCloseShift').addEventListener('click', async () => {
    const confirm = await showConfirm('End Shift?', 'Are you absolutely sure you want to end your shift and close the cash drawer? This will log you out of the POS system.', { isDanger: true });
    if (confirm) {
      closeAllActionModals();
      localStorage.removeItem('quickpos-user');
      window.location.href = 'login.html';
    }
  });

})();
