(function () {
  'use strict';

  let products = [];
  let customers = [];
  let cart = [];
  let currentCat = 'all';
  let currentSearch = '';
  let selectedCustomer = null;
  let productToCustomize = null;
  let priceEdited = false;
  let lastSale = null;

  const fmt = window.fmtLKR;

  function normalizeCategory(name) {
    return String(name || '').toLowerCase().replace(/\s+/g, '-');
  }

  function stockClass(s) {
    if (s <= 0) return 'out';
    if (s < 10) return 'low';
    return 'ok';
  }

  function stockText(s) {
    if (s <= 0) return 'OUT';
    if (s < 10) return `Low: ${s}`;
    return `${s}`;
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  }

  function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    let list = products;
    if (currentCat !== 'all') {
      list = list.filter((p) => p.categoryKey === currentCat);
    }
    if (currentSearch) {
      list = list.filter((p) => p.name.toLowerCase().includes(currentSearch));
    }

    if (!list.length) {
      grid.innerHTML = '<div style="color:var(--text3);font-size:15px;padding:30px;grid-column:1/-1;text-align:center;">No products found</div>';
      return;
    }

    grid.innerHTML = '';
    list.forEach((p) => {
      const out = Number(p.current_stock) <= 0;
      const card = document.createElement('div');
      card.className = `product-card${out ? ' out-of-stock' : ''}`;
      card.innerHTML = `
        ${out ? '<div class="out-label">OUT</div>' : ''}
        <div class="pc-cat">${(p.category_name || 'General').toLowerCase()}</div>
        <div class="pc-name">${p.name}${p.unit_type ? ` / ${p.unit_type}` : ''}</div>
        <div class="pc-price">${fmt(p.selling_price || 0)}</div>
        <div class="pc-footer"><span></span><span class="stock-badge ${stockClass(Number(p.current_stock))}">${stockText(Number(p.current_stock))}</span></div>
      `;

      if (!out) {
        card.addEventListener('click', () => {
          addToCart(p.id, 1, Number(p.selling_price || 0));
        });
      }
      grid.appendChild(card);
    });
  }

  function addToCart(productId, qty, price) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;

    const existing = cart.find((i) => i.id === productId && Number(i.price) === Number(price));
    const currentQtyInCart = cart.filter((i) => i.id === productId).reduce((s, i) => s + Number(i.quantity), 0);

    if (currentQtyInCart + qty > Number(p.current_stock)) {
      alert(`Max stock: ${p.current_stock}`);
      return;
    }

    if (existing) {
      existing.quantity = Number((existing.quantity + qty).toFixed(2));
    } else {
      cart.push({ id: p.id, name: p.name, price, quantity: qty, unit: p.unit_type || 'pc' });
    }
    saveCart();
    renderCart();
  }

  function saveCart() {
    localStorage.setItem('quickpos-current-cart', JSON.stringify(cart));
  }

  function loadCart() {
    const saved = localStorage.getItem('quickpos-current-cart');
    if (saved) {
      try {
        cart = JSON.parse(saved);
      } catch (e) {
        cart = [];
      }
    }
  }

  function renderCart() {
    const el = document.getElementById('cartItems');
    if (!el) return;

    if (!cart.length) {
      el.innerHTML = '<div class="empty-cart"><p>Cart is empty</p><small>Tap a product to add</small></div>';
      document.getElementById('itemCount').textContent = '0';
      document.getElementById('totalAmount').textContent = fmt(0);
      return;
    }

    let total = 0;
    let count = 0;
    el.innerHTML = cart.map((item, i) => {
      const sub = Number(item.price) * Number(item.quantity);
      total += sub;
      count += Number(item.quantity);
      return `<div class="cart-item">
        <div class="ci-info"><div class="ci-name">${item.name}</div><div class="ci-unit">${Number(item.quantity) % 1 === 0 ? Number(item.quantity) : Number(item.quantity).toFixed(2)} ${item.unit} x ${fmt(item.price)}</div></div>
        <div class="ci-controls"><button class="qty-btn" onclick="changeQty(${i},-1)">-</button><span class="qty-num">${Number(item.quantity) % 1 === 0 ? Number(item.quantity) : Number(item.quantity).toFixed(2)}</span><button class="qty-btn" onclick="changeQty(${i},1)">+</button></div>
        <div class="ci-total">${fmt(sub)}</div>
      </div>`;
    }).join('');

    document.getElementById('itemCount').textContent = count % 1 === 0 ? count : count.toFixed(2);
    document.getElementById('totalAmount').textContent = fmt(total);
  }

  window.changeQty = function changeQty(index, delta) {
    const item = cart[index];
    if (!item) return;

    const p = products.find((x) => x.id === item.id);
    const newQty = Number((item.quantity + delta).toFixed(2));
    const currentQtyOthers = cart
      .filter((_, i) => i !== index)
      .filter((i) => i.id === item.id)
      .reduce((s, i) => s + Number(i.quantity), 0);

    if (newQty <= 0) {
      cart.splice(index, 1);
    } else if (newQty + currentQtyOthers > Number(p.current_stock)) {
      alert(`Max stock: ${p.current_stock}`);
      return;
    } else {
      item.quantity = newQty;
    }

    saveCart();
    renderCart();
  };

  function renderCustomer() {
    const el = document.getElementById('custDisplay');
    const btn = document.getElementById('creditBtn');
    if (!el || !btn) return;

    if (selectedCustomer) {
      el.innerHTML = `<div class="selected-cust"><div class="sc-info"><div class="sc-name">${selectedCustomer.name}</div><div class="sc-bal">Balance: ${fmt(selectedCustomer.balance || 0)}</div></div><button class="sc-clear" onclick="clearCustomer()">x</button></div>`;
      btn.disabled = false;
    } else {
      el.innerHTML = '<div class="walkin-tag">Walk-in customer - credit unavailable</div>';
      btn.disabled = true;
    }
  }

  window.clearCustomer = function clearCustomer() {
    selectedCustomer = null;
    renderCustomer();
  };

  function openCustomize(pid) {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    productToCustomize = p;
    priceEdited = false;
    document.getElementById('custModalTitle').textContent = p.name;
    document.getElementById('unitPriceShow').textContent = fmt(p.selling_price || 0);
    document.getElementById('custQty').value = '1.00';
    document.getElementById('custPrice').value = Number(p.selling_price || 0).toFixed(2);
    document.getElementById('custModal').classList.add('open');
  }

  async function completeSale(method, receivedAmount, refNo) {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    const total = cartTotal();
    const balanceDue = method === 'Credit' ? total : 0;

    const payload = {
      billId: null,
      customerId: selectedCustomer ? selectedCustomer.id : null,
      total,
      method,
      received: Number(receivedAmount || 0),
      balanceDue,
      refNo: refNo || null,
      cashier: user.name || 'Unknown',
      items: cart.map((item) => ({ id: item.id, name: item.name, qty: item.quantity, price: item.price }))
    };

    const saved = await window.api.saveSale(payload);

    payload.billId = saved.billId;
    payload.timestamp = new Date().toISOString();
    lastSale = payload;

    // Close payment modals immediately — no popup window
    cart = [];
    saveCart();
    
    // Close payment modals immediately
    document.getElementById('cashModal').classList.remove('open');
    document.getElementById('cardModal').classList.remove('open');

    // Print bill directly and silently
    console.log('[PRINT] Auto-printing invoice:', lastSale.billId);
    triggerPrint(lastSale);

    await loadData();
    renderCart();
  }

  const categoryThemeMap = {
    'all': { icon: 'fa-solid fa-border-all', hue: '225' }, // Brand blue
    'rice': { icon: 'fa-solid fa-wheat-awn', hue: '38' }, // Warm amber
    'grain': { icon: 'fa-solid fa-wheat-awn', hue: '38' },
    'beverages': { icon: 'fa-solid fa-bottle-water', hue: '198' }, // Cool blue
    'dairy': { icon: 'fa-solid fa-egg', hue: '48' }, // Warm yellow
    'egg': { icon: 'fa-solid fa-egg', hue: '48' },
    'bakery': { icon: 'fa-solid fa-bread-slice', hue: '28' }, // Warm orange/brown
    'bread': { icon: 'fa-solid fa-bread-slice', hue: '28' },
    'snacks': { icon: 'fa-solid fa-cookie-bite', hue: '335' }, // Pinkish rose
    'sweet': { icon: 'fa-solid fa-cookie-bite', hue: '335' },
    'frozen': { icon: 'fa-solid fa-snowflake', hue: '175' }, // Cool cyan
    'spices': { icon: 'fa-solid fa-pepper-hot', hue: '0' }, // Spicy red
    'condiments': { icon: 'fa-solid fa-pepper-hot', hue: '0' },
    'canned': { icon: 'fa-solid fa-box-open', hue: '15' }, // Brown
    'packaged': { icon: 'fa-solid fa-box-open', hue: '15' },
    'personal': { icon: 'fa-solid fa-soap', hue: '265' }, // Lavender purple
    'care': { icon: 'fa-solid fa-soap', hue: '265' },
    'cleaning': { icon: 'fa-solid fa-broom', hue: '155' }, // Clean teal/green
    'baby': { icon: 'fa-solid fa-baby', hue: '310' }, // Soft pink
    'pet': { icon: 'fa-solid fa-dog', hue: '125' }, // Greenish
    'fruits': { icon: 'fa-solid fa-apple-whole', hue: '5' }, // Bright fruit red
    'vegetables': { icon: 'fa-solid fa-carrot', hue: '135' }, // Fresh vegetable green
    'meat': { icon: 'fa-solid fa-drumstick-bite', hue: '350' }, // Red-salmon
    'seafood': { icon: 'fa-solid fa-fish', hue: '210' }, // Oceanic blue
    'breakfast': { icon: 'fa-solid fa-bowl-food', hue: '33' }, // Golden
    'health': { icon: 'fa-solid fa-heart-pulse', hue: '345' }, // Pink-red
    'wellness': { icon: 'fa-solid fa-heart-pulse', hue: '345' },
    'household': { icon: 'fa-solid fa-plug', hue: '220' } // Grey-blue
  };

  function getCategoryMeta(name) {
    const key = normalizeCategory(name);
    if (categoryThemeMap[key]) return categoryThemeMap[key];
    
    // Check keys as substrings
    for (const [k, v] of Object.entries(categoryThemeMap)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
    
    // Deterministic hue hashing for any custom category
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return { icon: 'fa-solid fa-tag', hue: String(hue) };
  }

  function renderCategories(rows) {
    const el = document.getElementById('catPills');
    if (!el) return;
    
    const allMeta = getCategoryMeta('all');
    el.innerHTML = `
      <button class="cat-pill active" data-cat="all" style="--hue: ${allMeta.hue}">
        <div class="cat-icon-badge"><i class="${allMeta.icon}"></i></div>
        <span class="cat-name">All</span>
      </button>
    `;
    
    rows.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'cat-pill';
      btn.dataset.cat = normalizeCategory(c.name);
      const meta = getCategoryMeta(c.name);
      btn.style.setProperty('--hue', meta.hue);
      btn.innerHTML = `
        <div class="cat-icon-badge"><i class="${meta.icon}"></i></div>
        <span class="cat-name">${c.name}</span>
      `;
      el.appendChild(btn);
    });
  }

  async function loadData() {
    const [categoryRows, productRows, customerRows] = await Promise.all([
      window.api.getCategories(),
      window.api.getProducts(),
      window.api.getCustomers()
    ]);

    const categoryById = new Map(categoryRows.map((c) => [c.id, c]));
    products = productRows.map((p) => ({
      ...p,
      category_name: categoryById.get(p.category_id)?.name || 'General',
      categoryKey: normalizeCategory(categoryById.get(p.category_id)?.name || 'general')
    }));
    customers = customerRows;
    renderCategories(categoryRows);
    renderProducts();
    renderCustomer();
  }


  function wireEvents() {
    console.log('[SALES DEBUG] wireEvents() started');
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    const nameEl = document.getElementById('cashierNameDisplay');
    if (nameEl) nameEl.textContent = `${user.role === 'owner' ? 'Owner' : 'Cashier'}: ${user.name || 'User'}`;

    document.getElementById('catPills').addEventListener('click', (e) => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;
      document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentCat = pill.dataset.cat;
      renderProducts();
    });

    const barcodeInput = document.getElementById('barcodeInput');
    const search = document.getElementById('stockSearch');

    if (barcodeInput) {
      barcodeInput.focus(); // On page load, automatically focus the barcode input field
    }

    // 1. Persistent Focus Management with Smart Exclusions
    function keepFocus() {
      if (!barcodeInput) return;
      const activeEl = document.activeElement;
      // Exclude customer search, cash received, customize modal fields, card ref, and standard search bar
      const exemptIds = ['custSearch', 'amtReceived', 'custQty', 'custPrice', 'cardRefNo', 'stockSearch'];
      if (activeEl && exemptIds.includes(activeEl.id)) {
        return; // Cashier is actively typing in a valid exempt input field
      }
      barcodeInput.focus();
    }

    document.addEventListener('click', () => {
      setTimeout(keepFocus, 50);
    });
    document.addEventListener('focusin', () => {
      setTimeout(keepFocus, 50);
    });

    // 2. Enter Key Event Listener with hardware scanner keyboard emulation
    if (barcodeInput) {
      barcodeInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); // Prevent default form submission or page action
          const val = barcodeInput.value.trim();
          if (!val) return;

          try {
            // Trigger searchProductByBarcode API call
            const product = await window.api.searchProductByBarcode(val);
            if (product) {
              // Smart Cart Logic: addToCart increments by 1 if product is already in cart
              addToCart(product.id, 1, product.selling_price);
              // Instantly clear the barcode text input
              barcodeInput.value = '';
            } else {
              console.warn('Barcode not found:', val);
              alert(`Barcode "${val}" not found in database.`);
              barcodeInput.value = '';
            }
          } catch (err) {
            console.error('Barcode search error:', err);
            alert(`Error processing scan: ${err.message}`);
            barcodeInput.value = '';
          }
        }
      });
    }

    // 3. Name-based Quick Stock Search Event Listeners
    if (search) {
      search.addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase().trim();
        renderProducts();
      });

      search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = search.value.toLowerCase().trim();
          if (!val) return;

          // 1. Try exact barcode match
          let p = products.find(x => String(x.barcode || '').toLowerCase() === val);
          
          // 2. Try exact name match
          if (!p) p = products.find(x => x.name.toLowerCase() === val);

          // 3. Try first match in current grid
          if (!p) {
            const list = products.filter(x => x.name.toLowerCase().includes(val));
            if (list.length > 0) p = list[0];
          }

          if (p) {
            addToCart(p.id, 1, p.selling_price);
            search.value = '';
            currentSearch = '';
            renderProducts();
            
            // Redirect focus back to barcode scanner
            setTimeout(() => {
              if (barcodeInput) barcodeInput.focus();
            }, 100);
          }
        }
      });
    }

    const custSearch = document.getElementById('custSearch');
    const custDrop = document.getElementById('custDropdown');
    custSearch.addEventListener('input', (e) => {
      const v = e.target.value.toLowerCase().trim();
      if (!v) {
        custDrop.classList.remove('open');
        return;
      }
      const results = customers.filter((c) => c.name.toLowerCase().includes(v) || String(c.phone || '').includes(v)).slice(0, 5);
      if (!results.length) {
        custDrop.innerHTML = '<div class="cust-result" style="justify-content:center;color:var(--text3)">No customers found</div>';
        custDrop.classList.add('open');
        return;
      }
      custDrop.innerHTML = results.map((c) => `<div class="cust-result" data-id="${c.id}"><div><div class="cust-result-name">${c.name}</div><div class="cust-result-phone">${c.phone || ''}</div></div><div class="cust-result-bal">${fmt(c.balance || 0)}</div></div>`).join('');
      custDrop.classList.add('open');
      custDrop.querySelectorAll('.cust-result').forEach((row) => {
        row.addEventListener('click', () => {
          selectedCustomer = customers.find((c) => c.id === Number(row.dataset.id));
          custSearch.value = '';
          custDrop.classList.remove('open');
          renderCustomer();
        });
      });
    });

    document.getElementById('closeCustModal').addEventListener('click', () => document.getElementById('custModal').classList.remove('open'));
    document.getElementById('cancelCustModal').addEventListener('click', () => document.getElementById('custModal').classList.remove('open'));

    document.getElementById('custQty').addEventListener('input', () => {
      if (priceEdited || !productToCustomize) return;
      const q = parseFloat(document.getElementById('custQty').value) || 0;
      document.getElementById('custPrice').value = (q * Number(productToCustomize.selling_price || 0)).toFixed(2);
    });

    document.getElementById('custPrice').addEventListener('input', () => {
      priceEdited = true;
    });

    document.getElementById('addCustToCart').addEventListener('click', () => {
      if (!productToCustomize) return;
      const qty = parseFloat(document.getElementById('custQty').value) || 0;
      const price = parseFloat(document.getElementById('custPrice').value) || 0;
      if (qty <= 0) return alert('Enter valid quantity');
      addToCart(productToCustomize.id, qty, price);
      document.getElementById('custModal').classList.remove('open');
    });

    document.getElementById('cashBtn').addEventListener('click', () => {
      console.log('[SALES DEBUG] cashBtn clicked, cart.length:', cart.length);
      if (!cart.length) { alert('Cart is empty! Add a product first.'); return; }
      document.getElementById('cashModalTotal').textContent = fmt(cartTotal());
      document.getElementById('amtReceived').value = '';
      document.getElementById('changeAmt').textContent = fmt(0);
      document.getElementById('cashModal').classList.add('open');
    });

    document.getElementById('cardBtn').addEventListener('click', () => {
      console.log('[SALES DEBUG] cardBtn clicked, cart.length:', cart.length);
      if (!cart.length) { alert('Cart is empty! Add a product first.'); return; }
      document.getElementById('cardModalTotal').textContent = fmt(cartTotal());
      document.getElementById('cardRefNo').value = '';
      document.getElementById('cardModal').classList.add('open');
      setTimeout(() => document.getElementById('cardRefNo').focus(), 300);
    });

    document.getElementById('finalizeCard').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return; // Block double-click
      btn.disabled = true;
      btn.textContent = 'Processing...';
      const ref = document.getElementById('cardRefNo').value.trim();
      try {
        await completeSale('Card', cartTotal(), ref);
        setTimeout(() => { btn.disabled = false; }, 300);
      } catch (err) {
        btn.disabled = false;
        alert(`Failed to save sale: ${err.message}`);
        btn.disabled = false;
        btn.textContent = 'Complete Sale';
      }
    });

    document.getElementById('cardRefNo').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('finalizeCard').click();
    });

    document.getElementById('closeCardModal').addEventListener('click', () => document.getElementById('cardModal').classList.remove('open'));
    document.getElementById('cancelCardModal').addEventListener('click', () => document.getElementById('cardModal').classList.remove('open'));

    document.getElementById('creditBtn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled || !cart.length || !selectedCustomer) return;
      btn.disabled = true;
      btn.blur();
      try {
        await completeSale('Credit', 0);
        setTimeout(() => { btn.disabled = false; }, 300);
      } catch (err) {
        btn.disabled = false;
        alert(`Failed to save credit sale: ${err.message}`);
      }
    });



    document.getElementById('closeCashModal').addEventListener('click', () => document.getElementById('cashModal').classList.remove('open'));
    document.getElementById('cancelCashModal').addEventListener('click', () => document.getElementById('cashModal').classList.remove('open'));

    const updateChange = () => {
      const total = cartTotal();
      const rec = parseFloat(document.getElementById('amtReceived').value) || 0;
      document.getElementById('changeAmt').textContent = fmt(Math.max(0, rec - total));
    };

    document.getElementById('amtReceived').addEventListener('input', updateChange);
    document.querySelectorAll('.quick-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const cur = parseFloat(document.getElementById('amtReceived').value) || 0;
        document.getElementById('amtReceived').value = (cur + parseFloat(b.dataset.add)).toFixed(2);
        updateChange();
      });
    });

    document.getElementById('finalizeCash').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return; // Block double-click
      btn.disabled = true;
      btn.textContent = 'Processing...';
      const total = cartTotal();
      const rec = parseFloat(document.getElementById('amtReceived').value) || 0;
      if (rec < total) {
        btn.disabled = false;
        btn.textContent = 'Complete Sale';
        return alert('Insufficient amount received');
      }
      try {
        await completeSale('Cash', rec);
        // Do NOT re-enable the button here if successful. Modal is closing.
        // It prevents double-clicking while the modal is fading out.
        setTimeout(() => { btn.disabled = false; }, 300);
      } catch (err) {
        btn.disabled = false;
        alert(`Failed to save sale: ${err.message}`);
        btn.disabled = false;
        btn.textContent = 'Complete Sale';
      }
    });

    document.getElementById('scDone').addEventListener('click', () => {
      document.getElementById('saleCompleteModal').classList.remove('open');
    });

    document.getElementById('printReceiptBtn').addEventListener('click', () => {
      triggerPrint(lastSale);
    });

    document.getElementById('printDraftBtn').addEventListener('click', () => {
      console.log('[SALES DEBUG] printDraftBtn clicked, cart.length:', cart.length);
      if (!cart.length) { alert('Cart is empty! Add a product first.'); return; }
      const total = cartTotal();
      const draftData = {
        billId: 'DRAFT',
        timestamp: new Date().toISOString(),
        method: 'DRAFT',
        total: total,
        items: cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
        isDraft: true
      };
      triggerPrint(draftData);
    });
    console.log('[SALES DEBUG] wireEvents() completed — all handlers attached');
  }

  async function triggerPrint(saleData) {
    if (!saleData) return;
    const area = document.getElementById('print-area');
    if (!area) return;
    console.log('[PRINT DEBUG] triggerPrint called with:', saleData);

    // ... (rest of itemsHtml generation)
    const itemsHtml = saleData.items.map(i => {
      const qty = Number(i.qty || i.quantity);
      const formattedQty = qty % 1 === 0 ? qty : qty.toFixed(2);
      const itemTotal = (Number(i.price) * qty).toLocaleString('en-US', { minimumFractionDigits: 2 });
      
      return `
        <tr class="rt-item-row">
          <td colspan="2">${i.name}</td>
          <td class="rt-price">${itemTotal}</td>
        </tr>
        <tr class="rt-detail-row">
          <td colspan="3">${formattedQty} ${i.unit || ''} x ${Number(i.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    const changeReturned = saleData.received ? Math.max(0, saleData.received - saleData.total) : 0;

    area.innerHTML = `
      <div class="receipt">
        <div class="receipt-header">
          <div class="receipt-logo">QuickPOS Supermarket</div>
          <div class="receipt-info">
            No. 45/A, Galle Road, Colombo 03<br>
            Tel: 011 234 5678 | 077 123 4567<br>
          </div>
        </div>

        <div class="receipt-divider"></div>

        <div class="receipt-meta">
          <div>${saleData.isDraft ? '<strong>*** ESTIMATE ***</strong>' : '<strong>TAX INVOICE</strong>'}</div>
          <div>Date: ${new Date(saleData.timestamp).toLocaleDateString()} | Time: ${new Date(saleData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div>No: <strong>${saleData.billId}</strong> | Staff: ${saleData.cashier || (JSON.parse(localStorage.getItem('quickpos-user') || '{}').name) || 'Sunil Perera'}</div>
        </div>

        <div class="receipt-divider"></div>

        <table class="receipt-table">
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="receipt-divider double"></div>

        <div class="receipt-totals">
          <div class="total-row grand-total">
            <span>NET TOTAL</span>
            <span>LKR ${saleData.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        ${!saleData.isDraft ? `
          <div class="payment-info">
            <div class="total-row">
              <span>Paid via ${saleData.method}</span>
              <span>${(saleData.received || saleData.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            ${saleData.method === 'Cash' ? `
              <div class="total-row">
                <span>Change</span>
                <span>${changeReturned.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="receipt-footer">
          <div class="footer-msg">ස්තූතියි! නැවත එන්න.</div>
          <div class="footer-msg">Thank You! Come Again.</div>
          <div class="footer-sub">
            ${saleData.isDraft ? 'Draft Receipt - Not a Tax Invoice' : 'Software by Antigravity Pro'}
          </div>
          <div class="barcode-placeholder">
            ${saleData.billId === 'DRAFT' ? 'DRAFT' : '*' + saleData.billId + '*'}
          </div>
        </div>
      </div>
    `;

    console.log('[PRINT] Receipt HTML ready, sending to printer...');

    // Double RAF + 200ms: ensure receipt content is fully painted before print
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      await new Promise(r => setTimeout(r, 200));
      try {
        // Load configured printer name from settings
        const dbSettings = await window.api.getSettings();
        const printerName = dbSettings.thermalPrinterName || '';
        const options = printerName ? { deviceName: printerName } : {};
        console.log('[PRINT] Using printer:', printerName || '(system default)');

        const res = await window.api.printReceiptSilent(options);
        if (res && !res.success) {
          console.error('[PRINT ERROR] Print failed:', res.failureReason);
          // Sale is already saved — just log, do not alert
        } else {
          console.log('[PRINT] Receipt printed successfully.');
        }
      } catch (err) {
        console.error('[PRINT ERROR] Exception during print:', err.message);
      } finally {
        area.innerHTML = '';
      }
    }));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // Initialize standard components
    Components.init({ title: 'Make a Sale' });

    wireEvents();
    loadCart();

    // Listen for refresh event
    document.addEventListener('quickpos:refresh', async () => {
      console.log('Sales page refreshing data...');
      await loadData();
    });

    try {
      await loadData();
      renderCart();
    } catch (err) {
      alert(`Failed to load POS data: ${err.message}`);
    }
  });
})();
