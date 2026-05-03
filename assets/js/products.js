(function() {
    'use strict';

    let categories = [];
    let products = [];

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
    const displayBasePrice = document.getElementById('displayBasePrice');
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
    const editDisplayBasePrice = document.getElementById('editDisplayBasePrice');
    const editDisplayFinalPrice = document.getElementById('editDisplayFinalPrice');

    function formatCurrency(amount) {
        return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    async function loadData() {
        try {
            categories = await window.api.getCategories();
            products = await window.api.getProducts();
            renderCategoryDropdowns();
            renderProductsTable();
        } catch (err) {
            console.error('Error loading data:', err);
        }
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
            const category = categories.find(cat => cat.id === product.category_id);
            const categoryName = category ? category.name : 'Uncategorized';
            const isLow = product.current_stock <= product.alert_level;
            const isExpired = product.expiry_date && new Date(product.expiry_date) < new Date();
            
            let measurementCell = product.is_weighted 
                ? `<td class="measurement-cell"><span class="measurement-badge"><span class="material-symbols-rounded s18" style="vertical-align:middle; margin-right:4px;">scale</span>By Weight</span><span class="unit-badge">${product.unit_type}</span></td>`
                : `<td class="measurement-cell"><span class="measurement-badge"><span class="material-symbols-rounded s18" style="vertical-align:middle; margin-right:4px;">package_2</span>Unit</span><span class="unit-badge">${product.unit_type || 'pcs'}</span></td>`;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="barcode-cell" style="font-family: monospace; font-size: 13px; color: var(--text-light);">${product.barcode || 'N/A'}</td>
                <td class="product-name-cell">${product.name}</td>
                <td class="category-cell">${categoryName}</td>
                ${measurementCell}
                <td class="stock-cell ${isLow ? 'low-stock' : 'normal'}">${product.current_stock} ${isLow ? '<span class="material-symbols-rounded warning s18" style="vertical-align:middle; margin-left:4px;">warning</span>' : ''}</td>
                <td class="expiry-cell ${isExpired ? 'low-stock' : ''}">${product.expiry_date || 'N/A'} ${isExpired ? '<span class="material-symbols-rounded danger s18" style="vertical-align:middle; margin-left:4px;">event_busy</span>' : ''}</td>
                <td class="price-cell">
                    <span class="final-price">${formatCurrency(product.selling_price)}</span>
                </td>
                <td class="actions-cell">
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
        
        // Hide actions if cashier
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (user && user.role === 'cashier') {
            document.querySelectorAll('.actions-cell').forEach(cell => cell.style.display = 'none');
            const lastHeader = document.querySelector('thead th:last-child');
            if(lastHeader) lastHeader.style.display = 'none';
        }
    }

    async function handleAddProduct(e) {
        e.preventDefault();
        const p = {
            barcode: productBarcode.value.trim(),
            name: productName.value.trim(),
            categoryId: parseInt(productCategory.value),
            stock: parseFloat(initialStock.value) || 0,
            alert: parseFloat(alertLevel.value) || 10,
            expiry: expiryDate.value,
            price: parseFloat(basePrice.value),
            cost: parseFloat(basePrice.value) * 0.8,
            unit: unitType.value || 'pcs'
        };

        if (!p.barcode || !p.name || !p.categoryId || !p.price) {
            alert('Please fill all required fields');
            return;
        }

        try {
            await window.api.addProduct(p);
            addProductModal.classList.remove('active');
            loadData();
        } catch (err) {
            alert('Error adding product: ' + err.message);
        }
    }

    function openEditProductModal(id) {
        const p = products.find(prod => prod.id === id);
        if (!p) return;
        editProductId.value = p.id;
        editProductBarcode.value = p.barcode;
        editProductName.value = p.name;
        editProductCategory.value = p.category_id;
        editCurrentStock.value = p.current_stock;
        editAlertLevel.value = p.alert_level;
        editExpiryDate.value = p.expiry_date || '';
        editBasePrice.value = p.selling_price;
        editProductModal.classList.add('active');
    }

    async function deleteProduct(id) {
        if (confirm('Are you sure you want to delete this product?')) {
            // Need delete handler in main.js
            alert('Delete functionality coming soon or update products.js to use update-product with status: deleted');
        }
    }

    async function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user) { window.location.href = 'login.html'; return; }

        Components.init({ title: 'Products Management' });
        
        if (user.role === 'cashier') {
            if(addProductBtn) addProductBtn.style.display = 'none';
        }

        await loadData();

        if(addProductBtn) addProductBtn.addEventListener('click', () => {
            addProductForm.reset();
            addProductModal.classList.add('active');
        });

        closeAddModalBtn.addEventListener('click', () => addProductModal.classList.remove('active'));
        cancelAddBtn.addEventListener('click', () => addProductModal.classList.remove('active'));
        closeEditModalBtn.addEventListener('click', () => editProductModal.classList.remove('active'));
        cancelEditBtn.addEventListener('click', () => editProductModal.classList.remove('active'));

        addProductForm.addEventListener('submit', handleAddProduct);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
