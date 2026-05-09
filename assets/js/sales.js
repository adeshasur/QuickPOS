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

  const fmt = (n) => `LKR ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
        <button class="cust-btn" data-id="${p.id}" title="Customize qty/price"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
        <div class="pc-cat">${(p.category_name || 'General').toLowerCase()}</div>
        <div class="pc-name">${p.name}${p.unit_type ? ` / ${p.unit_type}` : ''}</div>
        <div class="pc-price">${fmt(p.selling_price || 0)}</div>
        <div class="pc-footer"><span></span><span class="stock-badge ${stockClass(Number(p.current_stock))}">${stockText(Number(p.current_stock))}</span></div>
      `;

      if (!out) {
        card.addEventListener('click', (e) => {
          if (!e.target.closest('.cust-btn')) addToCart(p.id, 1, Number(p.selling_price || 0));
        });
      }

      card.querySelector('.cust-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openCustomize(p.id);
      });
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

  async function completeSale(method, receivedAmount) {
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
      cashier: user.name || 'Unknown',
      items: cart.map((item) => ({ id: item.id, name: item.name, qty: item.quantity, price: item.price }))
    };

    const saved = await window.api.saveSale(payload);

    const title = document.getElementById('scTitle');
    const amount = document.getElementById('scAmount');
    const msg = document.getElementById('scMsg');
    title.textContent = `${method} Sale Complete!`;
    amount.textContent = fmt(total);
    msg.textContent = method === 'Cash'
      ? `Invoice ${saved.billId} - Change returned: ${fmt(Number(receivedAmount) - total)}`
      : `Invoice ${saved.billId} saved successfully`;

    cart = [];
    saveCart();
    document.getElementById('cashModal').classList.remove('open');
    document.getElementById('saleCompleteModal').classList.add('open');

    await loadData();
    renderCart();
  }

  function renderCategories(rows) {
    const el = document.getElementById('catPills');
    if (!el) return;
    el.innerHTML = '<button class="cat-pill active" data-cat="all">All</button>';
    rows.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'cat-pill';
      btn.dataset.cat = normalizeCategory(c.name);
      btn.textContent = c.name;
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

    const search = document.getElementById('stockSearch');
    search.addEventListener('input', (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      renderProducts();
    });

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
      if (!cart.length) return;
      document.getElementById('cashModalTotal').textContent = fmt(cartTotal());
      document.getElementById('amtReceived').value = '';
      document.getElementById('changeAmt').textContent = fmt(0);
      document.getElementById('cashModal').classList.add('open');
    });

    document.getElementById('cardBtn').addEventListener('click', async () => {
      if (!cart.length) return;
      try {
        await completeSale('Card', cartTotal());
      } catch (err) {
        alert(`Failed to save sale: ${err.message}`);
      }
    });

    document.getElementById('creditBtn').addEventListener('click', async () => {
      if (!cart.length || !selectedCustomer) return;
      try {
        await completeSale('Credit', 0);
      } catch (err) {
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

    document.getElementById('finalizeCash').addEventListener('click', async () => {
      const total = cartTotal();
      const rec = parseFloat(document.getElementById('amtReceived').value) || 0;
      if (rec < total) return alert('Insufficient amount received');
      try {
        await completeSale('Cash', rec);
      } catch (err) {
        alert(`Failed to save sale: ${err.message}`);
      }
    });

    document.getElementById('scDone').addEventListener('click', () => {
      document.getElementById('saleCompleteModal').classList.remove('open');
    });
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
