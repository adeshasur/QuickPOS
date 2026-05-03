// ===== DEMO DATA =====
const demoProducts = [
    { id: 1, name: "Tokyo Super Cement", price: 2350, category: "cement", stock: 50, isWeighted: false },
    { id: 2, name: "S-Lon PVC Pipe 1/2 inch", price: 180, category: "plumbing", stock: 100, isWeighted: true, unitType: "ft" },
    { id: 3, name: "Steel Rod 12mm", price: 2100, category: "steel", stock: 30, isWeighted: false },
    { id: 4, name: "Rileem Cement", price: 2380, category: "cement", stock: 45, isWeighted: false },
    { id: 5, name: "PVC Elbow 1/2\"", price: 95, category: "plumbing", stock: 200, isWeighted: false },
    { id: 6, name: "Steel Rod 10mm", price: 1850, category: "steel", stock: 40, isWeighted: false },
    { id: 7, name: "Anchor Bolts 1/2\"", price: 320, category: "steel", stock: 150, isWeighted: false },
    { id: 8, name: "Paint Brush 4\"", price: 450, category: "plumbing", stock: 75, isWeighted: false }
];

const demoCustomers = [
    { id: 1, name: 'Kamal Perera', phone: '0771234567', balance: 5000.00 },
    { id: 2, name: 'Sunimal Silva', phone: '0719876543', balance: 0.00 },
    { id: 3, name: 'Hardware Contractor Ltd', phone: '0112233445', balance: 25000.00 },
    { id: 4, name: 'Nimal Fernando', phone: '0765558888', balance: 1250.50 }
];

// App State
let products = [...demoProducts];
let customers = [...demoCustomers];
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
const getStockBadgeText = (stock) => stock === 0 ? 'OUT' : (stock < 10 ? `Low: ${stock}` : `${stock} avail`);

function renderProducts() {
    productsGrid.innerHTML = '';
    const filtered = currentCategory === "all" ? products : products.filter(p => p.category === currentCategory);

    if (!filtered.length) {
        productsGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px;">No products found</div>`;
        return;
    }

    filtered.forEach(product => {
        const out = product.stock === 0;
        const card = document.createElement('div');
        card.className = `product-card ${out ? 'out-of-stock' : ''}`;
        
        const unitDisplay = product.unitType ? ` (per ${product.unitType})` : '';
        const stockClass = product.stock === 0 ? 'out' : product.stock < 10 ? 'low' : 'normal';

        card.innerHTML = `
            ${out ? '<div class="out-of-stock-label">OUT</div>' : ''}
            <button class="customize-trigger" onclick="event.stopPropagation(); openCustomizeModal(${product.id})">
                <span>⚖️</span> 
            </button>
            <div>
                <div class="product-name">${product.name}${unitDisplay}</div>
                <div class="product-price">${formatCurrency(product.price)}</div>
            </div>
            <div class="product-stock">
                <span style="text-transform:uppercase;font-size:11px;">${product.category}</span>
                <span class="stock-badge ${stockClass}">${getStockBadgeText(product.stock)}</span>
            </div>
        `;

        if (!out) {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.customize-trigger')) addToCart(product.id, 1, product.price);
            });
        }
        productsGrid.appendChild(card);
    });
}

window.openCustomizeModal = function(productId) {
    productToCustomize = products.find(p => p.id === productId);
    if (!productToCustomize) return;

    customizeProductName.textContent = productToCustomize.name;
    unitPriceDisplay.textContent = formatCurrency(productToCustomize.price);
    customQty.value = '1.00';
    customPrice.value = productToCustomize.price.toFixed(2);
    priceManuallyEdited = false;
    customizeModal.classList.add('active');
}

function addToCart(productId, quantity, price) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(i => i.id === productId && i.price === price);
    
    if (existing) {
        if (existing.quantity + quantity > product.stock) {
            alert(`Cannot add more. Stock available: ${product.stock}`);
            return;
        }
        existing.quantity += quantity;
    } else {
        if (quantity > product.stock) {
            alert(`Cannot add. Stock available: ${product.stock}`);
            return;
        }
        cart.push({ id: product.id, name: product.name, price: price, quantity: quantity, unit: product.unitType || 'pc' });
    }
    renderCart();
}

function renderCart() {
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
    else if (newQty > product.stock) { alert(`Maximum stock available: ${product.stock}`); return; }
    else item.quantity = newQty;
    
    renderCart();
}

function searchCustomers(query) {
    if (!query.trim()) { customerSearchResults.classList.remove('active'); return; }
    const searchTerm = query.toLowerCase();
    const results = customers.filter(c => c.name.toLowerCase().includes(searchTerm) || c.phone.includes(searchTerm)).slice(0, 5);

    if (results.length > 0) {
        customerSearchResults.innerHTML = results.map(c => `
            <div class="customer-result-item" onclick="selectCustomer(${c.id})">
                <div><span class="customer-result-name">${c.name}</span><span class="customer-result-phone">${c.phone}</span></div>
                <div class="customer-result-balance">${formatCurrency(c.balance)}</div>
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
    if (selectedCustomer) {
        selectedCustomerDisplay.innerHTML = `
            <div class="selected-customer-info">
                <div class="selected-customer-details">
                    <div class="selected-customer-name">${selectedCustomer.name}</div>
                    <div class="selected-customer-balance">Current Balance: <span>${formatCurrency(selectedCustomer.balance)}</span></div>
                </div>
                <button class="clear-customer-btn" onclick="clearCustomer()" title="Clear selection">✕</button>
            </div>
        `;
        creditPaymentBtn.disabled = false;
    } else {
        selectedCustomerDisplay.innerHTML = `<div class="walkin-indicator"><span>👤</span> Walk-in Customer (credit not available)</div>`;
        creditPaymentBtn.disabled = true;
    }
}

window.clearCustomer = function() { selectedCustomer = null; renderSelectedCustomer(); }

function processCashPayment() {
    if (!cart.length) return;
    document.getElementById('modalTotalAmount').textContent = formatCurrency(calculateCartTotal());
    document.getElementById('amountReceived').value = '';
    document.getElementById('balanceAmount').textContent = formatCurrency(0);
    paymentModal.classList.add('active');
}

function processCardPayment() { if (!cart.length) return; completeSale('Card', 'Card payment processed'); }

function processCreditPayment() {
    if (!cart.length) return;
    if (!selectedCustomer) { alert('Please select a customer for credit sale'); return; }
    selectedCustomer.balance += calculateCartTotal();
    completeSale('Credit', `Added to ${selectedCustomer.name}'s account. New balance: ${formatCurrency(selectedCustomer.balance)}`);
    renderSelectedCustomer();
}

function completeSale(method, message) {
    cart.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (product) product.stock -= item.quantity;
    });

    document.getElementById('saleCompleteTitle').textContent = `${method} Sale Complete!`;
    document.getElementById('saleCompleteAmount').textContent = formatCurrency(calculateCartTotal());
    document.getElementById('saleCompleteMessage').textContent = message;
    
    saleCompleteOverlay.classList.add('active');
    cart = []; renderCart(); renderProducts(); paymentModal.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    // SECURITY & ROLE CHECK
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Set dynamically logged in user name
    const cashierNameDisplay = document.getElementById('cashierNameDisplay');
    if(cashierNameDisplay) {
        cashierNameDisplay.textContent = `${user.role === 'owner' ? 'Owner' : 'Cashier'}: ${user.name}`;
    }

    if (user.role === 'cashier') {
        document.querySelectorAll('.owner-only').forEach(link => link.style.display = 'none');
    }

    // LOGOUT LOGIC
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Do you want to logout?')) {
                localStorage.removeItem('quickpos-user');
                window.location.href = 'login.html';
            }
        });
    }

    renderProducts(); renderCart();

    document.getElementById('hamburgerBtn').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('expanded'); sidebar.classList.toggle('collapsed');
        document.getElementById('logo').classList.toggle('collapsed');
        document.getElementById('hamburgerIcon').textContent = sidebar.classList.contains('collapsed') ? '→' : '☰';
    });

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategory = btn.dataset.category;
            categoryButtons.forEach(b => b.classList.toggle('active', b === btn));
            renderProducts();
        });
    });

    customerSearch.addEventListener('input', (e) => searchCustomers(e.target.value));
    stockSearch.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const prod = products.find(p => p.name.toLowerCase().includes(val));
        stockResult.innerHTML = prod ? `${prod.name}: ${getStockBadgeText(prod.stock)}` : (val ? 'Not found' : '');
    });

    document.addEventListener('click', (e) => {
        if (!customerSearch.contains(e.target) && !customerSearchResults.contains(e.target)) customerSearchResults.classList.remove('active');
    });

    document.getElementById('closeCustomizeBtn').addEventListener('click', () => customizeModal.classList.remove('active'));
    document.getElementById('cancelCustomizeBtn').addEventListener('click', () => customizeModal.classList.remove('active'));

    document.getElementById('addCustomToCartBtn').addEventListener('click', () => {
        if (!productToCustomize) return;
        const qty = parseFloat(customQty.value) || 0;
        const price = parseFloat(customPrice.value) || 0;
        if (qty <= 0) { alert('Please enter a valid quantity'); return; }
        addToCart(productToCustomize.id, qty, price);
        customizeModal.classList.remove('active');
    });

    customQty.addEventListener('input', () => {
        if (!productToCustomize || priceManuallyEdited) return;
        customPrice.value = ((parseFloat(customQty.value) || 0) * productToCustomize.price).toFixed(2);
    });

    customPrice.addEventListener('input', () => priceManuallyEdited = true);

    document.getElementById('cashPaymentBtn').addEventListener('click', processCashPayment);
    document.getElementById('cardPaymentBtn').addEventListener('click', processCardPayment);
    document.getElementById('creditPaymentBtn').addEventListener('click', processCreditPayment);

    document.getElementById('closePaymentModalBtn').addEventListener('click', () => paymentModal.classList.remove('active'));
    document.getElementById('cancelPaymentBtn').addEventListener('click', () => paymentModal.classList.remove('active'));

    document.querySelectorAll('.quick-cash-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const current = parseFloat(document.getElementById('amountReceived').value) || 0;
            document.getElementById('amountReceived').value = (current + parseFloat(btn.dataset.amount)).toFixed(2);
            updateBalance();
        });
    });

    document.getElementById('amountReceived').addEventListener('input', updateBalance);

    function updateBalance() {
        const balance = (parseFloat(document.getElementById('amountReceived').value) || 0) - calculateCartTotal();
        document.getElementById('balanceAmount').textContent = formatCurrency(balance);
    }

    document.getElementById('finalizePaymentBtn').addEventListener('click', () => {
        const total = calculateCartTotal();
        const received = parseFloat(document.getElementById('amountReceived').value) || 0;
        if (received < total) { alert('Insufficient amount received'); return; }
        completeSale('Cash', `Change: ${formatCurrency(received - total)}`);
    });

    document.getElementById('closeOverlayBtn').addEventListener('click', () => saleCompleteOverlay.classList.remove('active'));
});
