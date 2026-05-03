
        // Hardcoded categories
        let categories = [
            { id: 1, name: "Food" },
            { id: 2, name: "Drinks" },
            { id: 3, name: "Snacks" },
            { id: 4, name: "Bakery" },
            { id: 5, name: "Groceries" },
            { id: 6, name: "Dairy" },
            { id: 7, name: "Vegetables" },
            { id: 8, name: "Fruits" },
            { id: 9, name: "Meat" },
            { id: 10, name: "Seafood" }
        ];
        
        // Hardcoded products with rich data
        let products = [
            { 
                id: 1, 
                name: "Ceylon Black Tea", 
                categoryId: 2, 
                basePrice: 550.00, 
                discount: 50, 
                finalPrice: 500.00,
                currentStock: 28,
                alertLevel: 10,
                isWeighted: false,
                unitType: null,
                costPrice: 0
            },
            { 
                id: 2, 
                name: "Nadu Raw Rice", 
                categoryId: 5, 
                basePrice: 240.00, 
                discount: 0, 
                finalPrice: 240.00,
                currentStock: 120,
                alertLevel: 25,
                isWeighted: true,
                unitType: "kg",
                costPrice: 0
            },
            { 
                id: 3, 
                name: "Coconut Oil (Pure)", 
                categoryId: 5, 
                basePrice: 420.00, 
                discount: 30, 
                finalPrice: 390.00,
                currentStock: 45,
                alertLevel: 12,
                isWeighted: true,
                unitType: "L",
                costPrice: 0
            },
            { 
                id: 4, 
                name: "Wood Apple Juice", 
                categoryId: 2, 
                basePrice: 180.00, 
                discount: 0, 
                finalPrice: 180.00,
                currentStock: 65,
                alertLevel: 15,
                isWeighted: false,
                unitType: null,
                costPrice: 0
            },
            { 
                id: 5, 
                name: "Red Onions", 
                categoryId: 7, 
                basePrice: 160.00, 
                discount: 10, 
                finalPrice: 150.00,
                currentStock: 8,
                alertLevel: 10,
                isWeighted: true,
                unitType: "kg",
                costPrice: 0
            },
            { 
                id: 6, 
                name: "Dhal (Red Lentils)", 
                categoryId: 5, 
                basePrice: 320.00, 
                discount: 20, 
                finalPrice: 300.00,
                currentStock: 15,
                alertLevel: 18,
                isWeighted: true,
                unitType: "kg",
                costPrice: 0
            },
            { 
                id: 7, 
                name: "Fresh Milk", 
                categoryId: 6, 
                basePrice: 130.00, 
                discount: 0, 
                finalPrice: 130.00,
                currentStock: 40,
                alertLevel: 8,
                isWeighted: false,
                unitType: null,
                costPrice: 0
            },
            { 
                id: 8, 
                name: "Chicken Breast", 
                categoryId: 9, 
                basePrice: 980.00, 
                discount: 80, 
                finalPrice: 900.00,
                currentStock: 6,
                alertLevel: 7,
                isWeighted: true,
                unitType: "kg",
                costPrice: 0
            },
            { 
                id: 9, 
                name: "Organic Bananas", 
                categoryId: 8, 
                basePrice: 120.00, 
                discount: 0, 
                finalPrice: 120.00,
                currentStock: 50,
                alertLevel: 12,
                isWeighted: true,
                unitType: "kg",
                costPrice: 0
            },
            { 
                id: 10, 
                name: "Tuna Fish", 
                categoryId: 10, 
                basePrice: 850.00, 
                discount: 50, 
                finalPrice: 800.00,
                currentStock: 12,
                alertLevel: 5,
                isWeighted: true,
                unitType: "kg",
                costPrice: 0
            }
        ];

        // DOM elements
        const sidebar = document.getElementById('sidebar');
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const hamburgerIcon = document.getElementById('hamburgerIcon');
        const logo = document.getElementById('logo');
        const logoutBtn = document.getElementById('logoutBtn');
        const addProductBtn = document.getElementById('addProductBtn');
        const productsTableBody = document.getElementById('productsTableBody');
        
        // Add Product Modal
        const addProductModal = document.getElementById('addProductModal');
        const closeAddModalBtn = document.getElementById('closeAddModalBtn');
        const cancelAddBtn = document.getElementById('cancelAddBtn');
        const addProductForm = document.getElementById('addProductForm');
        const productName = document.getElementById('productName');
        const productCategory = document.getElementById('productCategory');
        const sellByWeight = document.getElementById('sellByWeight');
        const unitType = document.getElementById('unitType');
        const unitField = document.getElementById('unitField');
        const initialStock = document.getElementById('initialStock');
        const alertLevel = document.getElementById('alertLevel');
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
        const editProductName = document.getElementById('editProductName');
        const editProductCategory = document.getElementById('editProductCategory');
        const editSellByWeight = document.getElementById('editSellByWeight');
        const editUnitType = document.getElementById('editUnitType');
        const editUnitField = document.getElementById('editUnitField');
        const editCurrentStock = document.getElementById('editCurrentStock');
        const editAlertLevel = document.getElementById('editAlertLevel');
        const editBasePrice = document.getElementById('editBasePrice');
        const editDiscountAmount = document.getElementById('editDiscountAmount');
        const editDisplayBasePrice = document.getElementById('editDisplayBasePrice');
        const editDisplayDiscount = document.getElementById('editDisplayDiscount');
        const editDisplayFinalPrice = document.getElementById('editDisplayFinalPrice');

        // Helper functions
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
            // Clear and populate add modal dropdown
            while (productCategory.options.length > 1) {
                productCategory.remove(1);
            }
            while (editProductCategory.options.length > 1) {
                editProductCategory.remove(1);
            }
            
            categories.forEach(category => {
                const option1 = document.createElement('option');
                option1.value = category.id;
                option1.textContent = category.name;
                productCategory.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = category.id;
                option2.textContent = category.name;
                editProductCategory.appendChild(option2);
            });
        }

        function renderProductsTable() {
            if (products.length === 0) {
                productsTableBody.innerHTML = `
                    <tr>
                        <td colspan="7">
                            <div class="empty-state">
                                <div class="empty-icon">ðŸ“¦</div>
                                <p>No products found</p>
                                <p>Click "Add Product" to create your first product</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            productsTableBody.innerHTML = '';
            
            products.forEach(product => {
                const category = categories.find(cat => cat.id === product.categoryId);
                const categoryName = category ? category.name : 'Uncategorized';
                const hasDiscount = product.discount > 0;
                const isLow = isLowStock(product.currentStock, product.alertLevel);
                
                let measurementCell = '';
                if (product.isWeighted) {
                    measurementCell = `
                        <td class="measurement-cell">
                            <span class="measurement-badge">âš–ï¸ By Weight</span>
                            <span class="unit-badge">${product.unitType}</span>
                        </td>
                    `;
                } else {
                    measurementCell = `
                        <td class="measurement-cell">
                            <span class="measurement-badge">ðŸ“¦ Unit</span>
                        </td>
                    `;
                }
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="product-name-cell">${product.name}</td>
                    <td class="category-cell">${categoryName}</td>
                    ${measurementCell}
                    <td class="stock-cell ${isLow ? 'low-stock' : 'normal'}">
                        ${product.currentStock} ${isLow ? 'âš ï¸' : ''}
                    </td>
                    <td class="alert-level-cell">${product.alertLevel}</td>
                    <td class="price-cell">
                        ${hasDiscount ? `
                            <span class="base-price">${formatCurrency(product.basePrice)}</span>
                            <span class="final-price">${formatCurrency(product.finalPrice)}</span>
                            <span class="discount-badge">-${formatCurrency(product.discount)}</span>
                        ` : `
                            <span class="final-price">${formatCurrency(product.finalPrice)}</span>
                        `}
                    </td>
                    <td class="actions-cell">
                        <button class="action-btn edit-btn" data-id="${product.id}">
                            <span>âœï¸</span> Edit
                        </button>
                        <button class="action-btn delete-btn" data-id="${product.id}">
                            <span>ðŸ—‘ï¸</span> Delete
                        </button>
                    </td>
                `;
                productsTableBody.appendChild(row);
            });
            
            // Attach event listeners to buttons
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => openEditProductModal(parseInt(btn.dataset.id)));
            });
            
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteProduct(parseInt(btn.dataset.id)));
            });
        }

        function updatePriceDisplay() {
            const base = parseFloat(basePrice.value) || 0;
            const discount = parseFloat(discountAmount.value) || 0;
            const final = calculateFinalPrice(base, discount);
            
            displayBasePrice.textContent = formatCurrency(base);
            displayDiscount.textContent = formatCurrency(discount);
            displayFinalPrice.textContent = formatCurrency(final);
        }

        function updateEditPriceDisplay() {
            const base = parseFloat(editBasePrice.value) || 0;
            const discount = parseFloat(editDiscountAmount.value) || 0;
            const final = calculateFinalPrice(base, discount);
            
            editDisplayBasePrice.textContent = formatCurrency(base);
            editDisplayDiscount.textContent = formatCurrency(discount);
            editDisplayFinalPrice.textContent = formatCurrency(final);
        }

        function openAddProductModal() {
            addProductForm.reset();
            discountAmount.value = 0;
            initialStock.value = 0;
            alertLevel.value = 5;
            sellByWeight.checked = false;
            unitType.disabled = true;
            unitField.classList.add('disabled');
            updatePriceDisplay();
            addProductModal.classList.add('active');
            setTimeout(() => productName.focus(), 300);
        }

        function addProduct(event) {
            event.preventDefault();
            
            const name = productName.value.trim();
            const categoryId = parseInt(productCategory.value);
            const stock = parseInt(initialStock.value) || 0;
            const alert = parseInt(alertLevel.value) || 5;
            const base = parseFloat(basePrice.value);
            const discount = parseFloat(discountAmount.value) || 0;
            const isWeighted = sellByWeight.checked;
            const unit = isWeighted ? unitType.value.trim() : null;
            
            if (!name) {
                alert('Please enter a product name');
                productName.focus();
                return;
            }
            
            if (!categoryId) {
                alert('Please select a category');
                productCategory.focus();
                return;
            }
            
            if (isWeighted && !unit) {
                alert('Please enter the unit type (e.g., kg, L, ft)');
                unitType.focus();
                return;
            }
            
            if (!base || base <= 0) {
                alert('Please enter a valid price');
                basePrice.focus();
                return;
            }
            
            if (discount > base) {
                alert('Discount cannot be greater than base price');
                discountAmount.focus();
                return;
            }
            
            const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
            const finalPrice = calculateFinalPrice(base, discount);
            
            const newProduct = {
                id: newId,
                name: name,
                categoryId: categoryId,
                basePrice: base,
                discount: discount,
                finalPrice: finalPrice,
                currentStock: stock,
                alertLevel: alert,
                isWeighted: isWeighted,
                unitType: unit,
                costPrice: 0
            };
            
            products.push(newProduct);
            saveProducts();
            renderProductsTable();
            addProductModal.classList.remove('active');
            alert('Product added successfully!');
        }

        function openEditProductModal(productId) {
            const product = products.find(p => p.id === productId);
            if (!product) return;
            
            editProductId.value = product.id;
            editProductName.value = product.name;
            editProductCategory.value = product.categoryId;
            editCurrentStock.value = product.currentStock;
            editAlertLevel.value = product.alertLevel;
            editBasePrice.value = product.basePrice;
            editDiscountAmount.value = product.discount;
            
            editSellByWeight.checked = product.isWeighted;
            if (product.isWeighted) {
                editUnitType.disabled = false;
                editUnitField.classList.remove('disabled');
                editUnitType.value = product.unitType || '';
            } else {
                editUnitType.disabled = true;
                editUnitField.classList.add('disabled');
                editUnitType.value = '';
            }
            
            updateEditPriceDisplay();
            editProductModal.classList.add('active');
            setTimeout(() => editProductName.focus(), 300);
        }

        function updateProduct(event) {
            event.preventDefault();
            
            const productId = parseInt(editProductId.value);
            const name = editProductName.value.trim();
            const categoryId = parseInt(editProductCategory.value);
            const alert = parseInt(editAlertLevel.value) || 0;
            const base = parseFloat(editBasePrice.value);
            const discount = parseFloat(editDiscountAmount.value) || 0;
            const isWeighted = editSellByWeight.checked;
            const unit = isWeighted ? editUnitType.value.trim() : null;
            
            if (!name || !categoryId || !base || base <= 0 || alert < 0) {
                alert('Please fill all required fields with valid values');
                return;
            }
            
            if (isWeighted && !unit) {
                alert('Please enter the unit type (e.g., kg, L, ft)');
                editUnitType.focus();
                return;
            }
            
            if (discount > base) {
                alert('Discount cannot be greater than base price');
                editDiscountAmount.focus();
                return;
            }
            
            const productIndex = products.findIndex(p => p.id === productId);
            if (productIndex !== -1) {
                const finalPrice = calculateFinalPrice(base, discount);
                
                products[productIndex] = {
                    ...products[productIndex],
                    name: name,
                    categoryId: categoryId,
                    basePrice: base,
                    discount: discount,
                    finalPrice: finalPrice,
                    alertLevel: alert,
                    isWeighted: isWeighted,
                    unitType: unit
                };
                
                saveProducts();
                renderProductsTable();
                editProductModal.classList.remove('active');
                alert('Product updated successfully!');
            }
        }

        function deleteProduct(productId) {
            if (!confirm('Are you sure you want to delete this product?')) {
                return;
            }
            
            products = products.filter(p => p.id !== productId);
            saveProducts();
            renderProductsTable();
            alert('Product deleted successfully!');
        }

        function toggleSidebar() {
            sidebar.classList.toggle('expanded');
            sidebar.classList.toggle('collapsed');
            logo.classList.toggle('collapsed');
            
            if (sidebar.classList.contains('collapsed')) {
                hamburgerIcon.textContent = 'â†’';
                localStorage.setItem('quickpos-sidebar', 'collapsed');
            } else {
                hamburgerIcon.textContent = 'â˜°';
                localStorage.setItem('quickpos-sidebar', 'expanded');
            }
        }

        function setupEventListeners() {
            hamburgerBtn.addEventListener('click', toggleSidebar);
            
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
            
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
                if (this.checked) {
                    unitField.classList.remove('disabled');
                } else {
                    unitField.classList.add('disabled');
                    unitType.value = '';
                }
            });
            
            editSellByWeight.addEventListener('change', function() {
                editUnitType.disabled = !this.checked;
                if (this.checked) {
                    editUnitField.classList.remove('disabled');
                } else {
                    editUnitField.classList.add('disabled');
                    editUnitType.value = '';
                }
            });
            
            addProductModal.addEventListener('click', (e) => {
                if (e.target === addProductModal) {
                    addProductModal.classList.remove('active');
                }
            });
            
            editProductModal.addEventListener('click', (e) => {
                if (e.target === editProductModal) {
                    editProductModal.classList.remove('active');
                }
            });
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    addProductModal.classList.remove('active');
                    editProductModal.classList.remove('active');
                }
            });
        }

        // Initialize
        function init() {
            const savedProducts = localStorage.getItem('quickpos-products');
            if (savedProducts) {
                const parsed = JSON.parse(savedProducts);
                if (parsed && parsed.length > 0) {
                    products = parsed;
                }
            } else {
                saveProducts();
            }
            
            renderCategoryDropdowns();
            renderProductsTable();
            setupEventListeners();
            
            const sidebarState = localStorage.getItem('quickpos-sidebar');
            if (sidebarState === 'collapsed') {
                toggleSidebar();
            }
            
            // Security: Check user role
            const user = JSON.parse(localStorage.getItem('quickpos-user'));
            if (!user) {
                // For demo, set a default user to see owner items
                // In real scenario, redirect to login
                console.log('Demo mode - showing all features');
            } else if (user.role === 'cashier') {
                const ownerLinks = document.querySelectorAll('.owner-only');
                ownerLinks.forEach(link => {
                    link.style.display = 'none';
                });
            }
        }
        
        document.addEventListener('DOMContentLoaded', init);
    
