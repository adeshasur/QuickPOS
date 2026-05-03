// Mock categories - should eventually come from SQLite
let categories = [
    { id: 1, name: "Groceries" },
    { id: 2, name: "Beverages" },
    { id: 3, name: "Dairy" },
    { id: 4, name: "Vegetables" },
    { id: 5, name: "Fruits" },
    { id: 6, name: "Snacks" },
    { id: 7, name: "Bakery" },
    { id: 8, name: "Meat & Seafood" },
    { id: 9, name: "Household" },
    { id: 10, name: "Personal Care" }
];

// Mock products
let products = [
    { id: 1, barcode: "4791234567890", name: "Ceylon Black Tea 250g", categoryId: 2, basePrice: 550.00, discount: 50, finalPrice: 500.00, currentStock: 28, alertLevel: 10, isWeighted: false, unitType: "pkt", costPrice: 450.00, expiryDate: "2025-12-01" },
    { id: 2, barcode: "4790000000001", name: "Nadu Raw Rice", categoryId: 1, basePrice: 240.00, discount: 0, finalPrice: 240.00, currentStock: 120, alertLevel: 50, isWeighted: true, unitType: "kg", costPrice: 210.00, expiryDate: "2025-06-15" },
    { id: 3, barcode: "4790000000002", name: "Full Cream Milk 1L", categoryId: 3, basePrice: 420.00, discount: 20, finalPrice: 400.00, currentStock: 45, alertLevel: 15, isWeighted: false, unitType: "bottle", costPrice: 380.00, expiryDate: "2024-05-20" },
    { id: 4, barcode: "4790000000003", name: "Fresh Tomatoes", categoryId: 4, basePrice: 180.00, discount: 0, finalPrice: 180.00, currentStock: 15, alertLevel: 20, isWeighted: true, unitType: "kg", costPrice: 140.00, expiryDate: "2024-05-10" }
];

// DOM elements
const addProductBtn = document.getElementById('addProductBtn');
const productsTableBody = document.getElementById('productsTableBody');

// Add Product Modal
const addProductModal = document.getElementById('addProductModal');
const closeAddModalBtn = document.getElementById('closeAddModalBtn');
const cancelAddBtn = document.getElementById('cancelAddBtn');
const addProductForm = document.getElementById('addProductForm');
const productBarcode = document.getElementById('productBarcode');
const productName = document.getElementById('productName');
const productCategory = document.getElementById('productCategory');
const sellByWeight = document.getElementById('sellByWeight');
const unitType = document.getElementById('unitType');
const unitField = document.getElementById('unitField');
const initialStock = document.getElementById('initialStock');
const alertLevel = document.getElementById('alertLevel');
const expiryDate = document.getElementById('expiryDate');
const basePrice = document.getElementById('basePrice');
const discountAmount = document.getElementById('discountAmount');
const displayBasePrice = document.getElementById('displayBasePrice');
const displayDiscount = document.getElementById('displayDiscount');
const displayFinalPrice = document.getElementById('displayFinalPrice');

// Edit Product Modal
const editProductModal = document.getElementById('editProductModal');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editProductForm = document.getElementById('editProductForm');
const editProductId = document.getElementById('editProductId');
const editProductBarcode = document.getElementById('editProductBarcode');
const editProductName = document.getElementById('editProductName');
const editProductCategory = document.getElementById('editProductCategory');
const editSellByWeight = document.getElementById('editSellByWeight');
const editUnitType = document.getElementById('editUnitType');
const editUnitField = document.getElementById('editUnitField');
const editCurrentStock = document.getElementById('editCurrentStock');
const editAlertLevel = document.getElementById('editAlertLevel');
const editExpiryDate = document.getElementById('editExpiryDate');
const editBasePrice = document.getElementById('editBasePrice');
const editDiscountAmount = document.getElementById('editDiscountAmount');
const editDisplayBasePrice = document.getElementById('editDisplayBasePrice');
const editDisplayDiscount = document.getElementById('editDisplayDiscount');
const editDisplayFinalPrice = document.getElementById('editDisplayFinalPrice');

function formatCurrency(amount) {
    return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateFinalPrice(basePrice, discount) {
    const final = basePrice - discount;
    return final < 0 ? 0 : final;
}

function isLowStock(currentStock, alertLevel) {
    return currentStock <= alertLevel;
}

function saveProducts() {
    localStorage.setItem('quickpos-products', JSON.stringify(products));
}

function renderCategoryDropdowns() {
    while (productCategory.options.length > 1) productCategory.remove(1);
    while (editProductCategory.options.length > 1) editProductCategory.remove(1);
    
    categories.forEach(category => {
        const option1 = document.createElement('option');
        option1.value = category.id; option1.textContent = category.name;
        productCategory.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = category.id; option2.textContent = category.name;
        editProductCategory.appendChild(option2);
    });
}

function renderProductsTable() {
    if (products.length === 0) {
        productsTableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon"><span class="material-symbols-rounded s48">inventory_2</span></div><p>No products found</p><p>Click "Add Product" to create your first product</p></div></td></tr>`;
        return;
    }
    
    productsTableBody.innerHTML = '';
    
    products.forEach(product => {
        const category = categories.find(cat => cat.id === product.categoryId);
        const categoryName = category ? category.name : 'Uncategorized';
        const hasDiscount = product.discount > 0;
        const isLow = isLowStock(product.currentStock, product.alertLevel);
        const isExpired = product.expiryDate && new Date(product.expiryDate) < new Date();
        
        let measurementCell = product.isWeighted 
            ? `<td class="measurement-cell"><span class="measurement-badge"><span class="material-symbols-rounded s18" style="vertical-align:middle; margin-right:4px;">scale</span>By Weight</span><span class="unit-badge">${product.unitType}</span></td>`
            : `<td class="measurement-cell"><span class="measurement-badge"><span class="material-symbols-rounded s18" style="vertical-align:middle; margin-right:4px;">package_2</span>Unit</span><span class="unit-badge">${product.unitType || 'pcs'}</span></td>`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="barcode-cell" style="font-family: monospace; font-size: 13px; color: var(--text-light);">${product.barcode || 'N/A'}</td>
            <td class="product-name-cell">${product.name}</td>
            <td class="category-cell">${categoryName}</td>
            ${measurementCell}
            <td class="stock-cell ${isLow ? 'low-stock' : 'normal'}">${product.currentStock} ${isLow ? '<span class="material-symbols-rounded warning s18" style="vertical-align:middle; margin-left:4px;">warning</span>' : ''}</td>
            <td class="expiry-cell ${isExpired ? 'low-stock' : ''}">${product.expiryDate || 'N/A'} ${isExpired ? '<span class="material-symbols-rounded danger s18" style="vertical-align:middle; margin-left:4px;">event_busy</span>' : ''}</td>
            <td class="price-cell">
                ${hasDiscount ? `
                    <span class="base-price">${formatCurrency(product.basePrice)}</span>
                    <span class="final-price">${formatCurrency(product.finalPrice)}</span>
                ` : `<span class="final-price">${formatCurrency(product.finalPrice)}</span>`}
            </td>
            <td class="owner-only actions-cell">
                <div class="action-buttons">
                    <button class="action-btn edit-btn" data-id="${product.id}">
                        <span class="material-symbols-rounded s18">edit</span>
                    </button>
                    <button class="action-btn delete-btn" data-id="${product.id}">
                        <span class="material-symbols-rounded s18">delete</span>
                    </button>
                </div>
            </td>
        `;
        productsTableBody.appendChild(row);
    });
    
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditProductModal(parseInt(btn.dataset.id))));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteProduct(parseInt(btn.dataset.id))));
}

function updatePriceDisplay() {
    const base = parseFloat(basePrice.value) || 0;
    const discount = parseFloat(discountAmount.value) || 0;
    displayBasePrice.textContent = formatCurrency(base);
    displayDiscount.textContent = formatCurrency(discount);
    displayFinalPrice.textContent = formatCurrency(calculateFinalPrice(base, discount));
}

function updateEditPriceDisplay() {
    const base = parseFloat(editBasePrice.value) || 0;
    const discount = parseFloat(editDiscountAmount.value) || 0;
    editDisplayBasePrice.textContent = formatCurrency(base);
    editDisplayDiscount.textContent = formatCurrency(discount);
    editDisplayFinalPrice.textContent = formatCurrency(calculateFinalPrice(base, discount));
}

function openAddProductModal() {
    addProductForm.reset();
    productBarcode.value = '';
    discountAmount.value = 0; initialStock.value = 0; alertLevel.value = 10;
    sellByWeight.checked = false; unitType.disabled = false; unitField.classList.remove('disabled');
    updatePriceDisplay();
    addProductModal.classList.add('active');
    setTimeout(() => productBarcode.focus(), 300);
}

function addProduct(event) {
    event.preventDefault();
    const barcode = productBarcode.value.trim();
    const name = productName.value.trim();
    const categoryId = parseInt(productCategory.value);
    const stock = parseInt(initialStock.value) || 0;
    const alert = parseInt(alertLevel.value) || 10;
    const expiry = expiryDate.value;
    const base = parseFloat(basePrice.value);
    const discount = parseFloat(discountAmount.value) || 0;
    const isWeighted = sellByWeight.checked;
    const unit = unitType.value.trim();
    
    if (!name || !categoryId || !base || base <= 0 || !barcode) { window.alert('Please fill all required fields'); return; }
    if (products.some(p => p.barcode === barcode)) { window.alert('Barcode already exists'); return; }
    if (discount > base) { window.alert('Discount too high'); return; }
    
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({
        id: newId, barcode: barcode, name: name, categoryId: categoryId, basePrice: base, discount: discount,
        finalPrice: calculateFinalPrice(base, discount), currentStock: stock, alertLevel: alert,
        isWeighted: isWeighted, unitType: unit, costPrice: base * 0.8, expiryDate: expiry
    });
    
    saveProducts(); renderProductsTable(); addProductModal.classList.remove('active'); window.alert('Product added!');
}

function openEditProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    editProductId.value = product.id; 
    editProductBarcode.value = product.barcode || '';
    editProductName.value = product.name; 
    editProductCategory.value = product.categoryId;
    editCurrentStock.value = product.currentStock; 
    editAlertLevel.value = product.alertLevel;
    editExpiryDate.value = product.expiryDate || '';
    editBasePrice.value = product.basePrice; 
    editDiscountAmount.value = product.discount;
    
    editSellByWeight.checked = product.isWeighted;
    editUnitType.disabled = false; editUnitField.classList.remove('disabled'); editUnitType.value = product.unitType || '';
    
    updateEditPriceDisplay(); editProductModal.classList.add('active'); setTimeout(() => editProductName.focus(), 300);
}

function updateProduct(event) {
    event.preventDefault();
    const productId = parseInt(editProductId.value);
    const barcode = editProductBarcode.value.trim();
    const name = editProductName.value.trim();
    const categoryId = parseInt(editProductCategory.value);
    const alert = parseInt(editAlertLevel.value) || 0;
    const expiry = editExpiryDate.value;
    const base = parseFloat(editBasePrice.value);
    const discount = parseFloat(editDiscountAmount.value) || 0;
    const isWeighted = editSellByWeight.checked;
    const unit = editUnitType.value.trim();
    
    if (!name || !categoryId || !base || base <= 0 || alert < 0 || !barcode) { window.alert('Invalid fields'); return; }
    if (products.some(p => p.barcode === barcode && p.id !== productId)) { window.alert('Barcode already exists'); return; }
    if (discount > base) { window.alert('Discount too high'); return; }
    
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex !== -1) {
        products[productIndex] = {
            ...products[productIndex], barcode: barcode, name: name, categoryId: categoryId, basePrice: base,
            discount: discount, finalPrice: calculateFinalPrice(base, discount), alertLevel: alert,
            isWeighted: isWeighted, unitType: unit, expiryDate: expiry
        };
        saveProducts(); renderProductsTable(); editProductModal.classList.remove('active'); window.alert('Product updated!');
    }
}

function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    products = products.filter(p => p.id !== productId);
    saveProducts(); renderProductsTable(); window.alert('Product deleted!');
}


function setupEventListeners() {
    addProductBtn.addEventListener('click', openAddProductModal);
    closeAddModalBtn.addEventListener('click', () => addProductModal.classList.remove('active'));
    cancelAddBtn.addEventListener('click', () => addProductModal.classList.remove('active'));
    closeEditModalBtn.addEventListener('click', () => editProductModal.classList.remove('active'));
    cancelEditBtn.addEventListener('click', () => editProductModal.classList.remove('active'));
    
    basePrice.addEventListener('input', updatePriceDisplay);
    discountAmount.addEventListener('input', updatePriceDisplay);
    editBasePrice.addEventListener('input', updateEditPriceDisplay);
    editDiscountAmount.addEventListener('input', updateEditPriceDisplay);
    
    addProductForm.addEventListener('submit', addProduct);
    editProductForm.addEventListener('submit', updateProduct);
    
    sellByWeight.addEventListener('change', function() {
        unitType.disabled = !this.checked;
        this.checked ? unitField.classList.remove('disabled') : (unitField.classList.add('disabled'), unitType.value = '');
    });
    
    editSellByWeight.addEventListener('change', function() {
        editUnitType.disabled = !this.checked;
        this.checked ? editUnitField.classList.remove('disabled') : (editUnitField.classList.add('disabled'), editUnitType.value = '');
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === addProductModal) addProductModal.classList.remove('active');
        if (e.target === editProductModal) editProductModal.classList.remove('active');
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { addProductModal.classList.remove('active'); editProductModal.classList.remove('active'); }
    });
}

function init() {
    // Initialize Components
    Components.init({
        title: 'Products Management'
    });

    const savedProducts = localStorage.getItem('quickpos-products');
    if (savedProducts) {
        const parsed = JSON.parse(savedProducts);
        if (parsed && parsed.length > 0) products = parsed;
    } else { saveProducts(); }
    
    renderCategoryDropdowns(); renderProductsTable(); setupEventListeners();
    
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    if (!user) {
        window.location.href = 'login.html';
    } else {
        // Hide Owner Menus and Action Buttons if Cashier
        if (user.role === 'cashier') {
            // Hide add/edit/delete buttons for cashier
            if(addProductBtn) addProductBtn.style.display = 'none';
            document.querySelectorAll('.actions-cell').forEach(cell => cell.style.display = 'none');
            const lastHeader = document.querySelector('.products-table th:last-child');
            if(lastHeader) lastHeader.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', init);
