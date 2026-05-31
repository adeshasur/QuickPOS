(function () {
  'use strict';

  const state = {
    categories: [],
    products: [],
    customers: [],
    cart: [],
    selectedCustomer: null,
    currentCat: 'all',
    currentSearch: '',
    filteredProducts: [],
    suggestList: [],
    suggestActive: -1,
    heldBills: [],
    discounts: [],
    promotions: [],
    taxCategories: [],
    productToCustomize: null,
    priceEdited: false,
    lastSale: null,
    overrideResolver: null
  };

  const fmt = window.fmtLKR || ((n) => `LKR ${Number(n || 0).toFixed(2)}`);

  function notify(message, type = 'info') {
    if (window.Notifications && typeof window.Notifications.showToast === 'function') {
      window.Notifications.showToast(message, type);
      return;
    }
    console.log(`[${type}] ${message}`);
  }

  function normalize(v) {
    return String(v || '').toLowerCase().trim();
  }

  function hasSinhala(text) {
    return /[\u0D80-\u0DFF]/.test(String(text || ''));
  }

  function toSinhalaFallback(text) {
    if (!text) return '';
    if (hasSinhala(text)) return String(text);
    if (window.Singlish && typeof window.Singlish.convertProductName === 'function') {
      return window.Singlish.convertProductName(String(text));
    }
    if (window.Singlish && typeof window.Singlish.convert === 'function') {
      return window.Singlish.convert(String(text));
    }
    return String(text);
  }

  function displayName(entity) {
    if (!entity) return '';
    const preferred = entity.name_si || entity.name || entity.product_name || '';
    return toSinhalaFallback(preferred);
  }

  function categoryKey(name) {
    return normalize(name).replace(/\s+/g, '-');
  }

  function cartTotal() {
    return state.cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  }

  function cartDiscountTotal() {
    return state.cart.reduce((sum, item) => sum + (Number(item.discount || 0) * Number(item.quantity)), 0);
  }

  function cartTaxTotal() {
    return state.cart.reduce((sum, item) => sum + (Number(item.taxAmount || 0) * Number(item.quantity)), 0);
  }

  function persistCart() {
    localStorage.setItem('quickpos-current-cart', JSON.stringify(state.cart));
  }

  function hydrateCart() {
    try {
      const saved = JSON.parse(localStorage.getItem('quickpos-current-cart') || '[]');
      state.cart = Array.isArray(saved) ? saved.map((it) => ({
        id: it.id,
        name: it.name,
        quantity: Number(it.quantity || it.qty || 0),
        price: Number(it.price || 0),
        originalPrice: Number(it.originalPrice || it.price || 0),
        discount: Number(it.discount || 0),
        taxRate: Number(it.taxRate || 0),
        taxAmount: Number(it.taxAmount || 0),
        unit: it.unit || 'pc'
      })) : [];
    } catch (_err) {
      state.cart = [];
    }
  }

  function persistHeldBills() {
    localStorage.setItem('quickpos-held-bills', JSON.stringify(state.heldBills));
  }

  function hydrateHeldBills() {
    try {
      const held = JSON.parse(localStorage.getItem('quickpos-held-bills') || '[]');
      state.heldBills = Array.isArray(held) ? held : [];
    } catch (_err) {
      state.heldBills = [];
    }
  }

  async function loadHeldBills() {
    if (!window.api.getHeldBills) {
      hydrateHeldBills();
      return;
    }
    const rows = await window.api.getHeldBills();
    state.heldBills = (rows || []).map((bill) => {
      let cart = [];
      try {
        cart = JSON.parse(bill.cart_json || '[]');
      } catch (_err) {
        cart = [];
      }
      const customer = bill.customer_id ? {
        id: bill.customer_id,
        name: bill.customer_name || 'Customer',
        phone: bill.customer_phone || '',
        balance: Number(bill.customer_balance || 0),
        credit_limit: Number(bill.customer_credit_limit || 0),
        loyalty_points: Number(bill.customer_loyalty_points || 0)
      } : null;
      return {
        id: String(bill.id),
        holdCode: bill.hold_code,
        cart,
        customer,
        at: bill.created_at ? new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
      };
    });
    persistHeldBills();
  }

  function updateSearchMeta() {
    const meta = document.getElementById('searchMetaLabel');
    if (!meta) return;
    const catLabel = state.currentCat === 'all' ? 'all categories' : state.currentCat.replace(/-/g, ' ');
    if (!state.currentSearch) {
      meta.textContent = `${state.filteredProducts.length} products in ${catLabel}`;
      return;
    }
    meta.textContent = `${state.filteredProducts.length} matches for "${state.currentSearch}"`;
  }

  function stockClass(stock) {
    if (stock <= 0) return 'out';
    if (stock < 10) return 'low';
    return 'ok';
  }

  function stockText(stock) {
    if (stock <= 0) return 'OUT';
    if (stock < 10) return `Low: ${stock}`;
    return String(stock);
  }

  function productSearchText(product) {
    return [
      product.name,
      product.barcode,
      product.category_name,
      product.description,
      product.name_si,
      product.name_ta
    ].map(normalize).join(' ');
  }

  function decorateProduct(product) {
    const category = state.categories.find((c) => c.id === product.category_id);
    const categoryName = category?.name || product.category_name || 'General';
    const priceInfo = effectiveProductPrice(product);
    const tax = state.taxCategories.find((t) => Number(t.id) === Number(product.tax_category_id) && Number(t.active ?? 1) !== 0);
    return {
      ...product,
      original_selling_price: Number(product.selling_price || 0),
      selling_price: priceInfo.price,
      discount_amount: priceInfo.discount,
      discount_label: priceInfo.label,
      tax_rate: Number(tax?.rate || 0),
      category_name: categoryName,
      categoryKey: categoryKey(categoryName)
    };
  }

  function taxIncludedPerUnit(price, rate) {
    const value = Number(price || 0);
    const pct = Number(rate || 0);
    if (value <= 0 || pct <= 0) return 0;
    return value * (pct / (100 + pct));
  }

  function effectiveProductPrice(product) {
    const basePrice = Number(product.selling_price || 0);
    const today = new Date().toISOString().slice(0, 10);
    const activeDiscounts = (state.discounts || []).filter((discount) => {
      if (Number(discount.product_id) !== Number(product.id)) return false;
      if (Number(discount.active ?? 1) === 0) return false;
      if (discount.starts_at && discount.starts_at > today) return false;
      if (discount.ends_at && discount.ends_at < today) return false;
      return true;
    });
    const activePromotions = (state.promotions || []).filter((promo) => {
      if (Number(promo.active ?? 1) === 0) return false;
      if (promo.starts_at && promo.starts_at > today) return false;
      if (promo.ends_at && promo.ends_at < today) return false;
      if (promo.promo_type === 'bogo') return false;
      if (promo.target_type === 'product' && Number(promo.target_id || 0) !== Number(product.id)) return false;
      if (promo.target_type === 'category' && Number(promo.target_id || 0) !== Number(product.category_id || 0)) return false;
      return true;
    }).map((promo) => ({
      discount_type: promo.discount_type || 'amount',
      discount_value: promo.discount_value || 0,
      promo_name: promo.name
    }));
    const active = [...activeDiscounts, ...activePromotions];
    if (!active.length) return { price: basePrice, discount: 0, label: '' };

    const best = active.reduce((winner, discount) => {
      const value = discount.discount_type === 'percent'
        ? basePrice * (Number(discount.discount_value || 0) / 100)
        : Number(discount.discount_value || 0);
      return value > winner.value ? { discount, value } : winner;
    }, { discount: null, value: 0 });

    const discountAmount = Math.min(basePrice, Math.max(0, best.value));
    const label = best.discount?.discount_type === 'percent'
      ? `${Number(best.discount.discount_value || 0)}% off`
      : (best.discount?.promo_name || `${fmt(discountAmount)} off`);
    return { price: Math.max(0, basePrice - discountAmount), discount: discountAmount, label };
  }

  function upsertProduct(product) {
    const decorated = decorateProduct(product);
    const existingIndex = state.products.findIndex((p) => p.id === decorated.id);
    if (existingIndex >= 0) state.products[existingIndex] = decorated;
    else state.products.unshift(decorated);
    return decorated;
  }

  function getFilteredProducts() {
    let list = state.products;
    if (state.currentCat !== 'all') list = list.filter((p) => p.categoryKey === state.currentCat);
    if (state.currentSearch) list = list.filter((p) => productSearchText(p).includes(state.currentSearch));
    return list;
  }

  function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    state.filteredProducts = getFilteredProducts();
    updateSearchMeta();

    if (!state.filteredProducts.length) {
      grid.innerHTML = '<div style="color:var(--text3);font-size:15px;padding:30px;grid-column:1/-1;text-align:center;">No products found. Try barcode, category, or description.</div>';
      return;
    }

    grid.innerHTML = state.filteredProducts.map((p) => {
      const out = Number(p.current_stock || 0) <= 0;
      return `
        <div class="product-card${out ? ' out-of-stock' : ''}" data-product-id="${p.id}">
          ${out ? '<div class="out-label">OUT</div>' : ''}
          <div class="pc-cat">${escapeHtml((p.category_name || 'General').toLowerCase())}</div>
          <div class="pc-name">${escapeHtml(displayName(p))}${p.unit_type ? ` / ${escapeHtml(p.unit_type)}` : ''}</div>
          <div class="pc-price">${fmt(p.selling_price || 0)}</div>
          ${Number(p.discount_amount || 0) > 0 ? `<div class="pc-discount"><span>${escapeHtml(p.discount_label || 'Discount')}</span><small>${fmt(p.original_selling_price || 0)}</small></div>` : ''}
          <div class="pc-footer"><span></span><span class="stock-badge ${stockClass(Number(p.current_stock || 0))}">${stockText(Number(p.current_stock || 0))}</span></div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.product-card').forEach((card) => {
      card.addEventListener('click', () => {
        const productId = Number(card.dataset.productId);
        const product = state.products.find((p) => p.id === productId);
        if (!product || Number(product.current_stock || 0) <= 0) return;
        if (Number(product.is_weighted || 0) === 1) {
          openCustomize(product.id);
        } else {
          addToCart(product.id, 1, Number(product.selling_price || 0), 'manual');
        }
      });
    });
  }

  function pulseCartFeedback() {
    const cart = document.querySelector('.cart-section');
    if (!cart) return;
    cart.classList.remove('scan-pulse');
    void cart.offsetWidth;
    cart.classList.add('scan-pulse');
  }

  function addToCart(productId, qty, price, source = 'manual') {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;

    const currentQtyInCart = state.cart.filter((i) => i.id === productId).reduce((sum, i) => sum + Number(i.quantity), 0);
    if (currentQtyInCart + qty > Number(product.current_stock || 0)) {
      notify(`Max stock reached for ${displayName(product)}`, 'warning');
      return;
    }

    const existing = state.cart.find((item) => item.id === productId && Number(item.price) === Number(price));
    if (existing) {
      existing.quantity = Number((existing.quantity + qty).toFixed(3));
    } else {
      state.cart.push({
        id: product.id,
        name: displayName(product),
        quantity: Number(qty),
        price: Number(price),
        originalPrice: Number(product.original_selling_price || product.selling_price || price),
        discount: Math.max(0, Number(product.original_selling_price || product.selling_price || price) - Number(price)),
        taxRate: Number(product.tax_rate || 0),
        taxAmount: taxIncludedPerUnit(price, product.tax_rate || 0),
        unit: product.unit_type || 'pc'
      });
    }

    persistCart();
    renderCart();
    pulseCartFeedback();

    if (source === 'scan') {
      notify(`${displayName(product)} scanned`, 'info');
    }
  }

  function removeCartItem(index) {
    const row = document.querySelector(`.cart-item[data-index="${index}"]`);
    if (row) {
      row.classList.add('row-removing');
      setTimeout(() => {
        state.cart.splice(index, 1);
        persistCart();
        renderCart();
      }, 180);
      return;
    }
    state.cart.splice(index, 1);
    persistCart();
    renderCart();
  }

  function changeQty(index, delta) {
    const item = state.cart[index];
    if (!item) return;

    const product = state.products.find((p) => p.id === item.id);
    const next = Number((item.quantity + delta).toFixed(3));
    const others = state.cart.filter((_, i) => i !== index).filter((i) => i.id === item.id).reduce((sum, i) => sum + Number(i.quantity), 0);

    if (next <= 0) {
      removeCartItem(index);
      return;
    }

    if (product && next + others > Number(product.current_stock || 0)) {
      notify(`Max stock reached for ${displayName(product)}`, 'warning');
      return;
    }

    item.quantity = next;
    persistCart();
    renderCart();
  }

  function renderCart() {
    const wrap = document.getElementById('cartItems');
    if (!wrap) return;

    if (!state.cart.length) {
      wrap.innerHTML = '<div class="empty-cart"><p>Cart is empty</p><small>Tap a product to add</small></div>';
      document.getElementById('itemCount').textContent = '0';
      document.getElementById('totalAmount').textContent = fmt(0);
      return;
    }

    let total = 0;
    let count = 0;
    wrap.innerHTML = state.cart.map((item, i) => {
      const sub = Number(item.price) * Number(item.quantity);
      total += sub;
      count += Number(item.quantity);
      return `
        <div class="cart-item" data-index="${i}">
          <div class="ci-info">
            <div class="ci-name">${escapeHtml(item.name)}</div>
            <div class="ci-unit">${formatQty(item.quantity)} ${escapeHtml(item.unit)} x ${fmt(item.price)}${Number(item.discount || 0) > 0 ? ` <span class="ci-discount">saved ${fmt(Number(item.discount) * Number(item.quantity))}</span>` : ''}</div>
          </div>
          <div class="ci-total">${fmt(sub)}</div>
          <div class="ci-controls">
            <button class="qty-btn" data-action="dec" data-index="${i}">-</button>
            <span class="qty-num">${formatQty(item.quantity)}</span>
            <button class="qty-btn" data-action="inc" data-index="${i}">+</button>
            <button class="remove-btn" data-index="${i}" title="Remove"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');

    wrap.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = Number(btn.dataset.index);
        changeQty(index, btn.dataset.action === 'inc' ? 1 : -1);
      });
    });

    wrap.querySelectorAll('.remove-btn').forEach((btn) => {
      btn.addEventListener('click', () => removeCartItem(Number(btn.dataset.index)));
    });

    document.getElementById('itemCount').textContent = formatQty(count);
    document.getElementById('totalAmount').textContent = fmt(total);
  }

  function renderCustomer() {
    const display = document.getElementById('custDisplay');
    const creditBtn = document.getElementById('creditBtn');

    if (!display || !creditBtn) return;

    if (!state.selectedCustomer) {
      display.innerHTML = '<div class="walkin-tag">Walk-in customer - credit unavailable</div>';
      creditBtn.disabled = true;
      renderCustomerLedger();
      return;
    }

    const balance = Number(state.selectedCustomer.balance || 0);
    const creditLimit = Number(state.selectedCustomer.credit_limit || 0);
    const creditMeta = creditLimit > 0 ? ` | Limit: ${fmt(creditLimit)}` : '';
    display.innerHTML = `
      <div class="selected-cust">
        <div class="sc-avatar">${escapeHtml(String(state.selectedCustomer.name || 'C').slice(0, 1).toUpperCase())}</div>
        <div class="sc-info">
          <div class="sc-name">${escapeHtml(state.selectedCustomer.name)}</div>
          <div class="sc-bal">Balance: ${fmt(balance)}${creditMeta} | Loyalty: ${Number(state.selectedCustomer.loyalty_points || 0)}</div>
        </div>
        <button class="sc-clear" id="clearCustomerBtn">x</button>
      </div>
    `;
    creditBtn.disabled = false;

    const clearBtn = document.getElementById('clearCustomerBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.selectedCustomer = null;
        renderCustomer();
      });
    }

    renderCustomerLedger();
  }

  function renderCustomerLedger() {
    const ledger = document.getElementById('customerLedgerSummary');
    if (!ledger) return;

    if (!state.selectedCustomer) {
      ledger.innerHTML = '<span class="ledger-name">Customer: Walk-in</span><span class="ledger-points">Loyalty: -</span>';
      return;
    }

    ledger.innerHTML = `
      <span class="ledger-name">Customer: ${escapeHtml(state.selectedCustomer.name)}</span>
      <span class="ledger-points">Loyalty: ${Number(state.selectedCustomer.loyalty_points || 0)} pts</span>
    `;
  }

  function renderHoldTray() {
    const list = document.getElementById('holdList');
    const count = document.getElementById('holdCount');
    if (!list || !count) return;

    count.textContent = String(state.heldBills.length);
    if (!state.heldBills.length) {
      list.innerHTML = '<div class="hold-empty">No held bills</div>';
      return;
    }

    list.innerHTML = state.heldBills.map((bill) => {
      const itemCount = (bill.cart || []).reduce((sum, i) => sum + Number(i.quantity || i.qty || 0), 0);
      const label = bill.customer?.name || 'Walk-in';
      return `<button class="hold-chip" data-hold-id="${bill.id}">${escapeHtml(label)} · ${formatQty(itemCount)} items · ${escapeHtml(bill.at || '')}</button>`;
    }).join('');

    list.querySelectorAll('.hold-chip').forEach((chip) => {
      chip.addEventListener('click', async () => {
        const billId = chip.dataset.holdId;
        if (state.cart.length && !(await confirmAction('Replace current cart with held bill?'))) return;
        await resumeHeldBill(billId);
      });
    });
  }

  async function holdCurrentBill() {
    if (!state.cart.length) {
      notify('Cart is empty. Nothing to hold.', 'warning');
      return;
    }
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    const heldBill = {
      id: `H${Date.now()}`,
      cart: state.cart.map((i) => ({ ...i })),
      customer: state.selectedCustomer ? { ...state.selectedCustomer } : null,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    if (window.api.holdBill) {
      await window.api.holdBill({
        customerId: state.selectedCustomer ? state.selectedCustomer.id : null,
        cart: heldBill.cart,
        cashierName: user.name || 'Cashier'
      });
      await loadHeldBills();
    } else {
      state.heldBills.push(heldBill);
      persistHeldBills();
    }
    if (window.quickposDataChanged) window.quickposDataChanged();

    state.cart = [];
    state.selectedCustomer = null;
    persistCart();
    renderCart();
    renderCustomer();
    renderHoldTray();
    notify('Bill held successfully', 'info');
  }

  async function resumeHeldBill(holdId) {
    const index = state.heldBills.findIndex((b) => b.id === holdId);
    if (index < 0) return;
    const bill = state.heldBills.splice(index, 1)[0];
    state.cart = (bill.cart || []).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity || item.qty || 0),
      price: Number(item.price || 0),
      originalPrice: Number(item.originalPrice || item.price || 0),
      discount: Number(item.discount || 0),
      taxRate: Number(item.taxRate || 0),
      taxAmount: Number(item.taxAmount || 0),
      unit: item.unit || 'pc'
    }));
    state.selectedCustomer = bill.customer
      ? (state.customers.find((customer) => Number(customer.id) === Number(bill.customer.id)) || { ...bill.customer })
      : null;

    if (window.api.deleteHeldBill && !String(holdId).startsWith('H')) {
      await window.api.deleteHeldBill(Number(holdId));
      if (window.quickposDataChanged) window.quickposDataChanged();
    }

    persistCart();
    persistHeldBills();
    renderCart();
    renderCustomer();
    renderHoldTray();
    notify('Held bill resumed', 'info');
  }

  async function tryResumeHeldBill() {
    const resumeId = localStorage.getItem('quickpos-resume-hold-id');
    if (!resumeId) return;
    localStorage.removeItem('quickpos-resume-hold-id');
    await resumeHeldBill(resumeId);
  }

  function openCustomize(productId) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;
    state.productToCustomize = product;
    state.priceEdited = false;

    document.getElementById('custModalTitle').textContent = displayName(product);
    document.getElementById('unitPriceShow').textContent = fmt(product.selling_price || 0);
    document.getElementById('custQty').value = '1.00';
    document.getElementById('custPrice').value = Number(product.selling_price || 0).toFixed(2);
    openModal('custModal');
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
  }

  function renderCategories() {
    const el = document.getElementById('catPills');
    if (!el) return;

    el.innerHTML = `
      <button class="cat-pill ${state.currentCat === 'all' ? 'active' : ''}" data-cat="all" style="--hue:225">
        <div class="cat-icon-badge"><i class="fa-solid fa-border-all"></i></div>
        <span class="cat-name">All</span>
      </button>
    `;

    state.categories.forEach((category) => {
      const key = categoryKey(category.name);
      const btn = document.createElement('button');
      btn.className = `cat-pill ${state.currentCat === key ? 'active' : ''}`;
      btn.dataset.cat = key;
      btn.style.setProperty('--hue', String(Math.abs(hashCode(category.name) % 360)));
      btn.innerHTML = `<div class="cat-icon-badge"><i class="fa-solid fa-tag"></i></div><span class="cat-name">${escapeHtml(category.name)}</span>`;
      el.appendChild(btn);
    });
  }

  async function buildSearchSuggestions(query) {
    const suggest = document.getElementById('stockSuggest');
    if (!suggest) return;

    const q = normalize(query);
    if (!q) {
      state.suggestList = [];
      state.suggestActive = -1;
      suggest.innerHTML = '';
      suggest.classList.remove('open');
      return;
    }

    const category = state.currentCat === 'all'
      ? null
      : state.categories.find((c) => categoryKey(c.name) === state.currentCat);
    const rows = await window.api.searchProducts({
      query,
      categoryId: category?.id || 0,
      limit: 8
    });
    state.suggestList = (rows || []).map(upsertProduct);

    state.suggestActive = state.suggestList.length ? 0 : -1;

    if (!state.suggestList.length) {
      suggest.innerHTML = '<div class="search-suggest-item"><div><div class="ssi-name">No matches</div><div class="ssi-meta">Try another term</div></div></div>';
      suggest.classList.add('open');
      return;
    }

    suggest.innerHTML = state.suggestList.map((p, index) => `
      <div class="search-suggest-item${index === state.suggestActive ? ' active' : ''}" data-index="${index}">
        <div>
          <div class="ssi-name">${escapeHtml(displayName(p))}</div>
          <div class="ssi-meta">${escapeHtml(p.category_name || 'General')} | Stock: ${Number(p.current_stock || 0)} | ${escapeHtml(p.barcode || '-')}</div>
        </div>
        <div class="ssi-price">${fmt(p.selling_price || 0)}</div>
      </div>
    `).join('');

    suggest.classList.add('open');

    suggest.querySelectorAll('.search-suggest-item[data-index]').forEach((item) => {
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        const index = Number(item.dataset.index);
        const product = state.suggestList[index];
        if (!product) return;
        addToCart(product.id, 1, Number(product.selling_price || 0), 'manual');
        notify(`${displayName(product)} added`, 'info');
        const search = document.getElementById('stockSearch');
        if (search) {
          search.value = '';
          state.currentSearch = '';
        }
        renderProducts();
        buildSearchSuggestions('');
        document.getElementById('barcodeInput')?.focus();
      });
    });
  }

  function updateChangeDue() {
    const total = cartTotal();
    const received = Number(parseFloat(document.getElementById('amtReceived').value) || 0);
    document.getElementById('changeAmt').textContent = fmt(Math.max(0, received - total));
  }

  function updateSplitBalance() {
    const total = cartTotal();
    const cash = Number(parseFloat(document.getElementById('splitCashAmount')?.value) || 0);
    const card = Number(parseFloat(document.getElementById('splitCardAmount')?.value) || 0);
    const balance = Math.max(0, total - cash - card);
    const el = document.getElementById('splitBalance');
    if (el) el.textContent = fmt(balance);
  }

  function setReceivedAmount(amount) {
    document.getElementById('amtReceived').value = Number(amount || 0).toFixed(2);
    updateChangeDue();
  }

  function applyNumpadKey(key) {
    const input = document.getElementById('amtReceived');
    if (!input) return;
    const current = String(input.value || '');

    if (key === 'clear') {
      input.value = '';
      updateChangeDue();
      return;
    }

    if (key === 'bksp') {
      input.value = current.slice(0, -1);
      updateChangeDue();
      return;
    }

    if (key === '.') {
      if (current.includes('.')) return;
      input.value = current ? `${current}.` : '0.';
      updateChangeDue();
      return;
    }

    input.value = `${current}${key}`;
    updateChangeDue();
  }

  async function saveSaleWithOverride(payload) {
    try {
      return await window.api.saveSale(payload);
    } catch (error) {
      const message = String(error?.message || error || 'Sale failed');
      if (message.startsWith('INSUFFICIENT_STOCK') && !payload.allowStockOverride) {
        notify(message.replace('INSUFFICIENT_STOCK:', 'Stock warning:'), 'warning');
        const allowed = await showOverridePrompt(message.replace('INSUFFICIENT_STOCK:', '').trim());
        if (!allowed) throw new Error('Sale cancelled by cashier.');
        payload.allowStockOverride = true;
        payload.overrideReason = 'Cashier override from POS terminal';
        return await window.api.saveSale(payload);
      }
      throw error;
    }
  }

  function showOverridePrompt(message) {
    document.getElementById('overrideMessage').textContent = message || 'Low stock detected';
    openModal('overrideModal');
    return new Promise((resolve) => {
      state.overrideResolver = resolve;
    });
  }

  function closeOverridePrompt(result) {
    closeModal('overrideModal');
    if (state.overrideResolver) {
      state.overrideResolver(result);
      state.overrideResolver = null;
    }
  }

  async function completeSale(method, receivedAmount, refNo, payments = null) {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    const total = cartTotal();
    const balanceDue = method === 'Credit' ? total : 0;

    if (method === 'Credit') {
      if (!state.selectedCustomer) {
        notify('Attach a customer for credit sale', 'warning');
        return;
      }
      const creditLimit = Number(state.selectedCustomer.credit_limit || 0);
      const currentBalance = Number(state.selectedCustomer.balance || 0);
      if (creditLimit > 0 && currentBalance + balanceDue > creditLimit) {
        notify(`Credit limit exceeded. Available: ${fmt(Math.max(0, creditLimit - currentBalance))}`, 'warning');
        return;
      }
    }

    const payload = {
      billId: null,
      customerId: state.selectedCustomer ? state.selectedCustomer.id : null,
      total,
      method,
      received: Number(receivedAmount || 0),
      balanceDue,
      refNo: refNo || null,
      discountTotal: cartDiscountTotal(),
      taxTotal: cartTaxTotal(),
      payments,
      cashier: user.name || 'Unknown',
      allowStockOverride: false,
      items: state.cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: Number(item.quantity),
        price: Number(item.price),
        discount: Number(item.discount || 0)
      }))
    };

    const saved = await saveSaleWithOverride(payload);

    payload.billId = saved.billId;
    payload.timestamp = new Date().toISOString();
    state.lastSale = payload;
    if (saved.stockOverrideUsed) {
      notify('Stock override applied and audit logged for this sale', 'warning');
    }
    if (window.quickposDataChanged) window.quickposDataChanged();

    state.cart = [];
    state.selectedCustomer = null;
    persistCart();
    renderCustomer();
    renderCart();

    closeModal('cashModal');
    closeModal('cardModal');
    closeModal('splitModal');

    await triggerPrint(state.lastSale);

    if (window.api.generateThermalReceiptPdfAuto) {
      try {
        await window.api.generateThermalReceiptPdfAuto(state.lastSale);
      } catch (err) {
        console.warn('Auto PDF generation failed:', err.message);
      }
    }

    await loadData();
    renderProducts();
    renderCart();

    document.getElementById('scAmount').textContent = fmt(total);
    document.getElementById('scMsg').textContent = `Invoice ${saved.billId} saved successfully`;
    openModal('saleCompleteModal');
  }

  async function triggerPrint(saleData) {
    if (!saleData) return;

    const itemsHtml = (saleData.items || []).map((item) => {
      const qty = Number(item.qty || item.quantity || 0);
      const sub = qty * Number(item.price || 0);
      return `
        <tr class="rt-item-row">
          <td colspan="2">${escapeHtml(item.name)}</td>
          <td class="rt-price">${sub.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
        <tr class="rt-detail-row">
          <td colspan="3">${formatQty(qty)} x ${Number(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    const change = saleData.received ? Math.max(0, Number(saleData.received) - Number(saleData.total)) : 0;
    const html = `
      <div class="receipt">
        <div class="receipt-header">
          <div class="receipt-logo">QuickPOS Supermarket</div>
          <div class="receipt-info">No. 45/A, Galle Road, Colombo 03<br>Tel: 011 234 5678</div>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-meta">
          <div><strong>${saleData.isDraft ? 'ESTIMATE' : 'TAX INVOICE'}</strong></div>
          <div>Date: ${new Date(saleData.timestamp).toLocaleDateString()} | Time: ${new Date(saleData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div>No: <strong>${escapeHtml(saleData.billId || '-')}</strong> | Staff: ${escapeHtml(saleData.cashier || 'Cashier')}</div>
        </div>
        <div class="receipt-divider"></div>
        <table class="receipt-table"><tbody>${itemsHtml}</tbody></table>
        <div class="receipt-divider double"></div>
        <div class="receipt-totals">
          ${Number(saleData.discountTotal || 0) > 0 ? `<div class="total-row"><span>Discount</span><span>-LKR ${Number(saleData.discountTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>` : ''}
          ${Number(saleData.taxTotal || 0) > 0 ? `<div class="total-row"><span>Tax included</span><span>LKR ${Number(saleData.taxTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>` : ''}
          <div class="total-row grand-total"><span>NET TOTAL</span><span>LKR ${Number(saleData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
        </div>
        ${!saleData.isDraft ? `<div class="payment-info"><div class="total-row"><span>Paid via ${escapeHtml(saleData.method || '-')}</span><span>${Number(saleData.received || saleData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>${saleData.method === 'Cash' ? `<div class="total-row"><span>Change</span><span>${change.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>` : ''}</div>` : ''}
        <div class="receipt-footer">
          <div class="footer-msg">Thank You! Come Again.</div>
          <div class="footer-sub">${saleData.isDraft ? 'Draft Receipt - Not a Tax Invoice' : 'Software by Antigravity Pro'}</div>
          <div class="barcode-placeholder">${saleData.billId === 'DRAFT' ? 'DRAFT' : '*' + saleData.billId + '*'}</div>
        </div>
      </div>
    `;

    try {
      const dbSettings = await window.api.getSettings();
      const printerName = dbSettings.thermalPrinterName || '';
      const options = printerName ? { deviceName: printerName, html } : { html };
      await window.api.printReceiptSilent(options);
    } catch (err) {
      console.error('Print error:', err.message);
    }
  }

  async function loadData() {
    const [categoryRows, productRows, customerRows, discountRows, promotionRows, taxRows] = await Promise.all([
      window.api.getCategories(),
      window.api.getProducts(),
      window.api.getCustomers(),
      window.api.getProductDiscounts ? window.api.getProductDiscounts() : Promise.resolve([]),
      window.api.getPromotions ? window.api.getPromotions() : Promise.resolve([]),
      window.api.getTaxCategories ? window.api.getTaxCategories() : Promise.resolve([])
    ]);

    const categoryMap = new Map((categoryRows || []).map((c) => [c.id, c]));

    state.categories = categoryRows || [];
    state.discounts = discountRows || [];
    state.promotions = promotionRows || [];
    state.taxCategories = taxRows || [];
    state.products = (productRows || []).map(decorateProduct);
    state.customers = customerRows || [];
  }

  async function confirmAction(message) {
    return Promise.resolve(window.confirm(message));
  }

  function bindEvents() {
    const catPills = document.getElementById('catPills');
    const barcodeInput = document.getElementById('barcodeInput');
    const stockSearch = document.getElementById('stockSearch');
    const custSearch = document.getElementById('custSearch');
    const custDropdown = document.getElementById('custDropdown');

    catPills.addEventListener('click', (event) => {
      const btn = event.target.closest('.cat-pill');
      if (!btn) return;
      state.currentCat = btn.dataset.cat || 'all';
      renderCategories();
      renderProducts();
      buildSearchSuggestions(stockSearch.value);
    });

    document.getElementById('toggleDensityBtn').addEventListener('click', () => {
      const active = document.body.classList.toggle('sales-dense');
      localStorage.setItem('quickpos-sales-dense', active ? '1' : '0');
    });

    document.getElementById('focusScanBtn').addEventListener('click', () => {
      barcodeInput.focus();
      barcodeInput.select();
    });

    document.getElementById('clearSearchBtn').addEventListener('click', () => {
      stockSearch.value = '';
      state.currentSearch = '';
      renderProducts();
      buildSearchSuggestions('');
      stockSearch.focus();
    });

    document.querySelectorAll('[data-sales-link]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.salesLink;
        if (target) window.location.href = target;
      });
    });

    barcodeInput.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const code = barcodeInput.value.trim();
      if (!code) return;

      try {
        const product = await window.api.searchProductByBarcode(code);
        if (product) {
          const cached = upsertProduct(product);
          if (product.isScale) {
            addToCart(cached.id, product.parsedQuantity, Number(cached.selling_price || 0), 'scan');
          } else if (Number(cached.is_weighted || 0) === 1) {
            openCustomize(cached.id);
          } else {
            addToCart(cached.id, 1, Number(cached.selling_price || 0), 'scan');
          }
        } else {
          const matches = await window.api.searchProducts({ query: code, limit: 1 });
          const fallback = matches?.length ? upsertProduct(matches[0]) : null;
          if (fallback) {
            if (Number(fallback.is_weighted || 0) === 1) {
              openCustomize(fallback.id);
            } else {
              addToCart(fallback.id, 1, Number(fallback.selling_price || 0), 'scan');
            }
          } else {
            notify(`Barcode "${code}" not found`, 'warning');
          }
        }
      } catch (err) {
        notify(`Scan failed: ${err.message}`, 'warning');
      }

      barcodeInput.value = '';
    });

    stockSearch.addEventListener('input', (event) => {
      state.currentSearch = normalize(event.target.value);
      renderProducts();
      buildSearchSuggestions(event.target.value);
    });

    stockSearch.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!state.suggestList.length) return;
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        state.suggestActive = (state.suggestActive + step + state.suggestList.length) % state.suggestList.length;
        buildSearchSuggestions(stockSearch.value);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const product = state.suggestList[state.suggestActive] || state.filteredProducts[0];
        if (product) {
          addToCart(product.id, 1, Number(product.selling_price || 0), 'manual');
          notify(`${displayName(product)} added`, 'info');
          stockSearch.value = '';
          state.currentSearch = '';
          renderProducts();
          buildSearchSuggestions('');
          barcodeInput.focus();
        } else {
          notify('No matching product', 'warning');
        }
      }

      if (event.key === 'Escape') {
        buildSearchSuggestions('');
        barcodeInput.focus();
      }
    });

    stockSearch.addEventListener('blur', () => {
      setTimeout(() => buildSearchSuggestions(''), 120);
    });

    custSearch.addEventListener('input', (event) => {
      const q = normalize(event.target.value);
      if (!q) {
        custDropdown.classList.remove('open');
        return;
      }

      const results = state.customers
        .filter((c) => normalize(c.name).includes(q) || normalize(c.phone).includes(q))
        .slice(0, 6);

      if (!results.length) {
        custDropdown.innerHTML = '<div class="cust-result" style="justify-content:center;color:var(--text3)">No customers found</div>';
        custDropdown.classList.add('open');
        return;
      }

      custDropdown.innerHTML = results.map((c) => `
        <div class="cust-result" data-id="${c.id}">
          <div>
            <div class="cust-result-name">${escapeHtml(c.name)}</div>
            <div class="cust-result-phone">${escapeHtml(c.phone || '')}</div>
          </div>
          <div class="cust-result-bal">${fmt(c.balance || 0)}</div>
        </div>
      `).join('');
      custDropdown.classList.add('open');

      custDropdown.querySelectorAll('.cust-result[data-id]').forEach((row) => {
        row.addEventListener('click', () => {
          state.selectedCustomer = state.customers.find((c) => c.id === Number(row.dataset.id)) || null;
          custDropdown.classList.remove('open');
          custSearch.value = '';
          renderCustomer();
        });
      });
    });

    document.getElementById('closeCustModal').addEventListener('click', () => closeModal('custModal'));
    document.getElementById('cancelCustModal').addEventListener('click', () => closeModal('custModal'));
    document.getElementById('custQty').addEventListener('input', () => {
      if (state.priceEdited || !state.productToCustomize) return;
      const qty = Number(parseFloat(document.getElementById('custQty').value) || 0);
      document.getElementById('custPrice').value = (qty * Number(state.productToCustomize.selling_price || 0)).toFixed(2);
    });
    document.getElementById('custPrice').addEventListener('input', () => {
      state.priceEdited = true;
    });
    document.getElementById('addCustToCart').addEventListener('click', () => {
      if (!state.productToCustomize) return;
      const qty = Number(parseFloat(document.getElementById('custQty').value) || 0);
      const totalPrice = Number(parseFloat(document.getElementById('custPrice').value) || 0);
      if (qty <= 0 || totalPrice <= 0) {
        notify('Enter a valid quantity/price', 'warning');
        return;
      }
      const unitPrice = totalPrice / qty;
      addToCart(state.productToCustomize.id, qty, unitPrice, 'manual');
      closeModal('custModal');
    });

    document.getElementById('cashBtn').addEventListener('click', () => {
      if (!state.cart.length) {
        notify('Cart is empty. Add products first.', 'warning');
        return;
      }
      document.getElementById('cashModalTotal').textContent = fmt(cartTotal());
      document.getElementById('amtReceived').value = '';
      document.getElementById('changeAmt').textContent = fmt(0);
      openModal('cashModal');
    });

    document.getElementById('cardBtn').addEventListener('click', () => {
      if (!state.cart.length) {
        notify('Cart is empty. Add products first.', 'warning');
        return;
      }
      document.getElementById('cardModalTotal').textContent = fmt(cartTotal());
      document.getElementById('cardRefNo').value = '';
      openModal('cardModal');
      setTimeout(() => document.getElementById('cardRefNo').focus(), 150);
    });

    document.getElementById('splitBtn').addEventListener('click', () => {
      if (!state.cart.length) {
        notify('Cart is empty. Add products first.', 'warning');
        return;
      }
      const total = cartTotal();
      document.getElementById('splitModalTotal').textContent = fmt(total);
      document.getElementById('splitCashAmount').value = '';
      document.getElementById('splitCardAmount').value = Number(total || 0).toFixed(2);
      document.getElementById('splitCardRef').value = '';
      updateSplitBalance();
      openModal('splitModal');
    });

    document.getElementById('holdSaleBtn').addEventListener('click', holdCurrentBill);

    document.getElementById('closeCashModal').addEventListener('click', () => closeModal('cashModal'));
    document.getElementById('cancelCashModal').addEventListener('click', () => closeModal('cashModal'));
    document.getElementById('closeCardModal').addEventListener('click', () => closeModal('cardModal'));
    document.getElementById('cancelCardModal').addEventListener('click', () => closeModal('cardModal'));
    document.getElementById('closeSplitModal').addEventListener('click', () => closeModal('splitModal'));
    document.getElementById('cancelSplitModal').addEventListener('click', () => closeModal('splitModal'));

    document.getElementById('amtReceived').addEventListener('input', updateChangeDue);
    document.getElementById('splitCashAmount').addEventListener('input', updateSplitBalance);
    document.getElementById('splitCardAmount').addEventListener('input', updateSplitBalance);

    document.querySelectorAll('.quick-btn[data-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const setVal = btn.dataset.set;
        if (setVal === 'exact') {
          setReceivedAmount(cartTotal());
          return;
        }
        setReceivedAmount(Number(setVal || 0));
      });
    });

    document.querySelectorAll('#cashNumpad .np-btn').forEach((btn) => {
      btn.addEventListener('click', () => applyNumpadKey(btn.dataset.key));
    });

    document.getElementById('finalizeCash').addEventListener('click', async () => {
      const total = cartTotal();
      const received = Number(parseFloat(document.getElementById('amtReceived').value) || 0);
      if (received < total) {
        notify('Received amount is less than total', 'warning');
        return;
      }
      try {
        await completeSale('Cash', received);
      } catch (err) {
        notify(`Failed to save sale: ${err.message}`, 'warning');
      }
    });

    document.getElementById('finalizeCard').addEventListener('click', async () => {
      const ref = document.getElementById('cardRefNo').value.trim();
      try {
        await completeSale('Card', cartTotal(), ref);
      } catch (err) {
        notify(`Failed to save card sale: ${err.message}`, 'warning');
      }
    });

    document.getElementById('finalizeSplit').addEventListener('click', async () => {
      const total = cartTotal();
      const cash = Number(parseFloat(document.getElementById('splitCashAmount').value) || 0);
      const card = Number(parseFloat(document.getElementById('splitCardAmount').value) || 0);
      const ref = document.getElementById('splitCardRef').value.trim();
      if (cash < 0 || card < 0 || Math.abs((cash + card) - total) > 0.01) {
        notify('Split amounts must match the bill total', 'warning');
        return;
      }
      const payments = [];
      if (cash > 0) payments.push({ method: 'Cash', amount: cash, refNo: '' });
      if (card > 0) payments.push({ method: 'Card', amount: card, refNo: ref });
      try {
        await completeSale('Split', total, ref, payments);
      } catch (err) {
        notify(`Failed to save split sale: ${err.message}`, 'warning');
      }
    });

    document.getElementById('creditBtn').addEventListener('click', async () => {
      if (!state.selectedCustomer) {
        notify('Attach a customer for credit sale', 'warning');
        return;
      }
      try {
        await completeSale('Credit', 0);
      } catch (err) {
        notify(`Failed to save credit sale: ${err.message}`, 'warning');
      }
    });

    document.getElementById('printDraftBtn').addEventListener('click', async () => {
      if (!state.cart.length) {
        notify('Cart is empty. Add products first.', 'warning');
        return;
      }
      const draftData = {
        billId: 'DRAFT',
        timestamp: new Date().toISOString(),
        method: 'DRAFT',
        total: cartTotal(),
        items: state.cart.map((i) => ({ name: i.name, qty: i.quantity, price: i.price })),
        isDraft: true
      };
      await triggerPrint(draftData);
    });

    document.getElementById('scDone').addEventListener('click', () => closeModal('saleCompleteModal'));
    document.getElementById('printReceiptBtn').addEventListener('click', () => triggerPrint(state.lastSale));

    document.getElementById('closeOverrideModal').addEventListener('click', () => closeOverridePrompt(false));
    document.getElementById('cancelOverrideBtn').addEventListener('click', () => closeOverridePrompt(false));
    document.getElementById('confirmOverrideBtn').addEventListener('click', () => closeOverridePrompt(true));

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.cust-search-wrap')) {
        custDropdown.classList.remove('open');
      }
    });

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        stockSearch.focus();
        stockSearch.select();
        return;
      }

      if (event.key === 'F2') {
        event.preventDefault();
        barcodeInput.focus();
        barcodeInput.select();
        return;
      }

      if (event.key === 'F8') {
        event.preventDefault();
        document.getElementById('cashBtn').click();
        return;
      }

      if (event.key === 'F9') {
        event.preventDefault();
        document.getElementById('cardBtn').click();
        return;
      }

      if (event.key === 'F10') {
        event.preventDefault();
        document.getElementById('creditBtn').click();
        return;
      }

      if (event.key === 'F11') {
        event.preventDefault();
        holdCurrentBill();
      }
    });

    if (localStorage.getItem('quickpos-sales-dense') === '1') {
      document.body.classList.add('sales-dense');
    }

    barcodeInput.focus();
  }

  function formatQty(value) {
    return Number(value) % 1 === 0 ? String(Number(value)) : Number(value).toFixed(2);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => {
      if (char === '&') return '&amp;';
      if (char === '<') return '&lt;';
      if (char === '>') return '&gt;';
      if (char === '"') return '&quot;';
      return '&#39;';
    });
  }

  function hashCode(value) {
    const str = String(value || '');
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function getQuickActionsMarkup() {
    return `
      <div class="sales-quick-tabs" aria-label="Quick operations">
        <button class="sales-quick-tab danger" type="button" data-sales-link="supermarket.html#returns"><i class="fa-solid fa-rotate-left"></i> Return / Void</button>
        <button class="sales-quick-tab warn" type="button" data-sales-link="inventory.html#expiring"><i class="fa-solid fa-calendar-xmark"></i> Expiry</button>
        <button class="sales-quick-tab warn" type="button" data-sales-link="supermarket.html#reorder"><i class="fa-solid fa-triangle-exclamation"></i> Reorder</button>
        <button class="sales-quick-tab" type="button" data-sales-link="supermarket.html#held"><i class="fa-solid fa-receipt"></i> Held Bills</button>
        <button class="sales-quick-tab" type="button" data-sales-link="ledger.html"><i class="fa-solid fa-book"></i> Credit Ledger</button>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (window.Components && typeof window.Components.init === 'function') {
      window.Components.init({ title: 'Make a Sale', actions: getQuickActionsMarkup() });
    }

    hydrateCart();
    hydrateHeldBills();
    bindEvents();

    document.addEventListener('quickpos:refresh', async () => {
      await loadData();
      await loadHeldBills();
      renderCategories();
      renderProducts();
      renderCustomer();
      renderHoldTray();
    });

    try {
      await loadData();
      await loadHeldBills();
      await tryResumeHeldBill();
      renderCategories();
      renderProducts();
      renderCustomer();
      renderCart();
      renderHoldTray();
    } catch (err) {
      notify(`Failed to load POS data: ${err.message}`, 'warning');
    }
  });
})();
