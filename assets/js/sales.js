// App State
let products = [];
let customers = [];
let cart = [];
let currentCategory = "all";
let productToCustomize = null;
let priceManuallyEdited = false;
let selectedCustomer = null;

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const cartItemsDiv = document.getElementById('cartItems');
const itemCountSpan = document.getElementById('itemCount');
const totalAmountSpan = document.getElementById('totalAmount');
const categoryButtons = document.querySelectorAll('.category-btn');
const customerSearch = document.getElementById('customerSearch');
const customerSearchResults = document.getElementById('customerSearchResults');
const selectedCustomerDisplay = document.getElementById('selectedCustomerDisplay');
const creditPaymentBtn = document.getElementById('creditPaymentBtn');
const stockSearch = document.getElementById('stockSearch');
const stockResult = document.getElementById('stockResult');

// Modals
const customizeModal = document.getElementById('customizeModal');
const customizeProductName = document.getElementById('customizeProductName');
const unitPriceDisplay = document.getElementById('unitPriceDisplay');
const customQty = document.getElementById('customQty');
const customPrice = document.getElementById('customPrice');
const paymentModal = document.getElementById('paymentModal');
const saleCompleteOverlay = document.getElementById('saleCompleteOverlay');

const formatCurrency = (amt) => `LKR ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const calculateCartTotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
const getStockBadgeText = (stock) => stock <= 0 ? 'OUT' : (stock < 10 ? `Low: ${stock}` : `${stock} avail`);

async function loadData() {
    try {
        products = await window.api.getProducts();
        customers = await window.api.getCustomers();
        renderProducts(); 
        renderCart();
    } catch (err) {
        console.error('Error loading data:', err);
    }
}

function renderProducts() {
    if (!productsGrid) return;
    productsGrid.innerHTML = '';
    const filtered = currentCategory === "all" ? products : products.filter(p => p.category_id == currentCategory);

    if (!filtered.length) {
        productsGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-light);">No products found in this category</div>`;
        return;
    }

    filtered.forEach(product => {
        const out = product.current_stock <= 0;
        const card = document.createElement('div');
        card.className = `product-card ${out ? 'out-of-stock' : ''}`;
        
        const unitDisplay = product.unit_type ? ` (per ${product.unit_type})` : '';
        const stockClass = product.current_stock <= 0 ? 'out' : product.current_stock < 10 ? 'low' : 'normal';

        card.innerHTML = `
            ${out ? '<div class="out-of-stock-label">OUT</div>' : ''}
            <button class="customize-trigger" onclick="event.stopPropagation(); openCustomizeModal(${product.id})">
                <span class="material-symbols-rounded s20">edit_note</span> 
            </button>
            <div>
                <div class="product-name">${product.name}${unitDisplay}</div>
                <div class="product-price">${formatCurrency(product.selling_price)}</div>
            </div>
            <div class="product-stock">
                <span class="stock-badge ${stockClass}">${getStockBadgeText(product.current_stock)} ${product.unit_type || 'pcs'}</span>
            </div>
        `;

        if (!out) {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.customize-trigger')) addToCart(product.id, 1, product.selling_price);
            });
        }
        productsGrid.appendChild(card);
    });
}

window.openCustomizeModal = function(productId) {
    productToCustomize = products.find(p => p.id === productId);
    if (!productToCustomize) return;

    customizeProductName.textContent = productToCustomize.name;
    unitPriceDisplay.textContent = formatCurrency(productToCustomize.selling_price);
    customQty.value = '1.00';
    customPrice.value = productToCustomize.selling_price.toFixed(2);
    priceManuallyEdited = false;
    customizeModal.classList.add('active');
}

function addToCart(productId, quantity, price) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(i => i.id === productId && i.price === price);
    
    if (existing) {
        if (existing.quantity + quantity > product.current_stock) {
            alert(`Cannot add more. Stock available: ${product.current_stock}`);
            return;
        }
        existing.quantity += quantity;
    } else {
        if (quantity > product.current_stock) {
            alert(`Cannot add. Stock available: ${product.current_stock}`);
            return;
        }
        cart.push({ id: product.id, name: product.name, price: price, quantity: quantity, unit: product.unit_type || 'pcs' });
    }
    renderCart();
}

function renderCart() {
    if (!cartItemsDiv) return;
    if (!cart.length) {
        cartItemsDiv.innerHTML = `<div class="empty-cart"><div class="empty-cart-icon">🛒</div><p>Your cart is empty</p><p style="font-size:13px;margin-top:8px;">Click products to add</p></div>`;
        itemCountSpan.textContent = '0';
        totalAmountSpan.textContent = formatCurrency(0);
        return;
    }

    let total = 0; let itemCount = 0; let html = '';

    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal; itemCount += item.quantity;

        html += `
            <div class="cart-item">
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price-note">${item.quantity.toFixed(2)} ${item.unit} × ${formatCurrency(item.price)}</div>
                </div>
                <div class="item-controls">
                    <button class="quantity-btn" onclick="updateQuantity(${index}, -1)">−</button>
                    <div class="item-quantity">${item.quantity.toFixed(2)}</div>
                    <button class="quantity-btn" onclick="updateQuantity(${index}, 1)">+</button>
                </div>
                <div class="item-total">${formatCurrency(subtotal)}</div>
            </div>
        `;
    });

    cartItemsDiv.innerHTML = html;
    itemCountSpan.textContent = itemCount.toFixed(2);
    totalAmountSpan.textContent = formatCurrency(total);
}

window.updateQuantity = function(index, change) {
    const item = cart[index];
    const product = products.find(p => p.id === item.id);
    const newQty = item.quantity + change;
    
    if (newQty <= 0) cart.splice(index, 1);
    else if (newQty > product.current_stock) { alert(`Maximum stock available: ${product.current_stock}`); return; }
    else item.quantity = newQty;
    
    renderCart();
}

function searchCustomers(query) {
    if (!query.trim()) { customerSearchResults.classList.remove('active'); return; }
    const searchTerm = query.toLowerCase();
    const results = customers.filter(c => (c.name && c.name.toLowerCase().includes(searchTerm)) || (c.phone && c.phone.includes(searchTerm))).slice(0, 5);

    if (results.length > 0) {
        customerSearchResults.innerHTML = results.map(c => `
            <div class="customer-result-item" onclick="selectCustomer(${c.id})">
                <div><span class="customer-result-name">${c.name}</span><span class="customer-result-phone">${c.phone}</span></div>
                <div class="customer-result-balance">${formatCurrency(c.balance || 0)}</div>
            </div>
        `).join('');
        customerSearchResults.classList.add('active');
    } else {
        customerSearchResults.innerHTML = '<div class="customer-result-item" style="justify-content:center;color:var(--text-light);padding:20px;">No customers found</div>';
        customerSearchResults.classList.add('active');
    }
}

window.selectCustomer = function(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        selectedCustomer = customer;
        renderSelectedCustomer();
        customerSearch.value = '';
        customerSearchResults.classList.remove('active');
    }
}

function renderSelectedCustomer() {
    if (!selectedCustomerDisplay) return;
    if (selectedCustomer) {
        selectedCustomerDisplay.innerHTML = `
            <div class="selected-customer-info">
                <div class="selected-customer-details">
                    <div class="selected-customer-name">${selectedCustomer.name}</div>
                    <div class="selected-customer-balance">Current Balance: <span>${formatCurrency(selectedCustomer.balance || 0)}</span></div>
                </div>
                <button class="clear-customer-btn" onclick="clearCustomer()" title="Clear selection">✕</button>
            </div>
        `;
        if (creditPaymentBtn) creditPaymentBtn.disabled = false;
    } else {
        selectedCustomerDisplay.innerHTML = `<div class="walkin-indicator"><span>👤</span> Walk-in Customer (credit not available)</div>`;
        if (creditPaymentBtn) creditPaymentBtn.disabled = true;
    }
}

window.clearCustomer = function() { selectedCustomer = null; renderSelectedCustomer(); }

async function completeSale(method, message) {
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    const total = calculateCartTotal();
    const billId = 'BILL-' + Date.now();
    
    const saleData = {
        billId: billId,
        customerId: selectedCustomer ? selectedCustomer.id : null,
        total: total,
        method: method,
        received: method === 'Cash' ? parseFloat(document.getElementById('amountReceived').value) || total : total,
        change: method === 'Cash' ? (parseFloat(document.getElementById('amountReceived').value) || total) - total : 0,
        cashier: user ? user.name : 'Unknown',
        items: cart.map(item => ({
            id: item.id,
            qty: item.quantity,
            price: item.price
        }))
    };

    try {
        const result = await window.api.saveSale(saleData);
        if (result.success) {
            document.getElementById('saleCompleteTitle').textContent = `${method} Sale Complete!`;
            document.getElementById('saleCompleteAmount').textContent = formatCurrency(total);
            document.getElementById('saleCompleteMessage').textContent = message;
            
            saleCompleteOverlay.classList.add('active');
            cart = []; 
            renderCart(); 
            
            // Refresh products
            products = await window.api.getProducts();
            renderProducts(); 
            if (paymentModal) paymentModal.classList.remove('active');
        }
    } catch (err) {
        console.error('Sale Error:', err);
        alert('Error saving sale: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    if (!user) { window.location.href = 'login.html'; return; }

    loadData();

    if (categoryButtons) {
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                currentCategory = btn.dataset.category;
                categoryButtons.forEach(b => b.classList.toggle('active', b === btn));
                renderProducts();
            });
        });
    }

    if (customerSearch) customerSearch.addEventListener('input', (e) => searchCustomers(e.target.value));
    
    if (stockSearch) {
        stockSearch.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();
            if (!val) { stockResult.innerHTML = ''; return; }
            const barcodeMatch = products.find(p => p.barcode === val);
            if (barcodeMatch) {
                addToCart(barcodeMatch.id, 1, barcodeMatch.selling_price);
                e.target.value = '';
                stockResult.innerHTML = `<span class="material-symbols-rounded success s18">check_circle</span> Added ${barcodeMatch.name}`;
                setTimeout(() => stockResult.innerHTML = '', 2000);
                return;
            }
            const prod = products.find(p => p.name.toLowerCase().includes(val));
            stockResult.innerHTML = prod ? `${prod.name}: ${getStockBadgeText(prod.current_stock)}` : 'Not found';
        });
    }

    const finalizePaymentBtn = document.getElementById('finalizePaymentBtn');
    if (finalizePaymentBtn) {
        finalizePaymentBtn.addEventListener('click', () => {
            const total = calculateCartTotal();
            const received = parseFloat(document.getElementById('amountReceived').value) || 0;
            if (received < total) { alert('Insufficient amount received'); return; }
            completeSale('Cash', `Change: ${formatCurrency(received - total)}`);
        });
    }

    const cashPaymentBtn = document.getElementById('cashPaymentBtn');
    if (cashPaymentBtn) cashPaymentBtn.addEventListener('click', () => {
        if (!cart.length) return;
        document.getElementById('modalTotalAmount').textContent = formatCurrency(calculateCartTotal());
        document.getElementById('amountReceived').value = '';
        document.getElementById('balanceAmount').textContent = formatCurrency(0);
        paymentModal.classList.add('active');
    });

    const cardPaymentBtn = document.getElementById('cardPaymentBtn');
    if (cardPaymentBtn) cardPaymentBtn.addEventListener('click', () => {
        if (!cart.length) return;
        completeSale('Card', 'Card payment processed');
    });

    if (creditPaymentBtn) creditPaymentBtn.addEventListener('click', () => {
        if (!cart.length) return;
        if (!selectedCustomer) { alert('Please select a customer for credit sale'); return; }
        completeSale('Credit', `Added to ${selectedCustomer.name}'s account.`);
    });

    const closeOverlayBtn = document.getElementById('closeOverlayBtn');
    if (closeOverlayBtn) closeOverlayBtn.addEventListener('click', () => saleCompleteOverlay.classList.remove('active'));
});
