(function() {
    'use strict';

    let categories = [];
    let products = [];
    let currentFilter = "all";
    let searchTerm = "";

    const formatCurrency = window.fmtLKR;
    const SINHALA_PRODUCT_UPDATES = {
        '001': { name: 'කීරි සම්බා සහල් 5kg', expiryDate: '2027-02-28' },
        '002': { name: 'නැවුම් කිරි 1L', expiryDate: '2026-05-27' },
        '003': { name: 'මන්චි ක්‍රීම් ක්‍රැකර් 190g', expiryDate: '2026-11-15' },
        '004': { name: 'කොකා කෝලා 1.5L', expiryDate: '2026-09-30' },
        '005': { name: 'රතු ලූනු 1kg', expiryDate: '2026-06-05' },
        '006': { name: 'ඇන්කර් කිරි පිටි 400g', expiryDate: '2027-01-20' },
        '007': { name: 'ඇස්ට්‍රා මාගරින් 250g', expiryDate: '2026-08-18' },
        '008': { name: 'ලයිෆ්බෝයි සබන් 100g', expiryDate: '2028-03-31' },
        '009': { name: 'සන්සිල්ක් ෂැම්පු 180ml', expiryDate: '2028-12-31' },
        '010': { name: 'සිලෝන් තේ 200g', expiryDate: '2027-04-30' }
    };

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function getDaysUntilExpiry(expiryDate) {
        if (!expiryDate) return 999;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(expiryDate);
        expiry.setHours(0, 0, 0, 0);
        const diffTime = expiry - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    function getExpiryStatus(daysLeft) {
        if (daysLeft < 0) return { status: "Expired", class: "expired", icon: "dangerous" };
        if (daysLeft <= 30) return { status: "Expiring Soon", class: "expiring", icon: "warning" };
        return { status: "Good", class: "good", icon: "check_circle" };
    }

    async function loadData() {
        try {
            categories = await window.api.getCategories();
            products = await window.api.getProducts();
            await normalizeSinhalaInventoryData();
            populateProductDropdown();
            populateCategoryDropdown();
            renderStockTable();
        } catch (err) {
            console.error('Error loading inventory data:', err);
        }
    }

    async function normalizeSinhalaInventoryData() {
        const updates = products
            .map((product) => {
                const mapped = SINHALA_PRODUCT_UPDATES[String(product.barcode || '').trim()];
                if (!mapped) return null;
                if (product.name === mapped.name && product.expiry_date === mapped.expiryDate) return null;

                return {
                    ...product,
                    mappedName: mapped.name,
                    mappedExpiryDate: mapped.expiryDate
                };
            })
            .filter(Boolean);

        if (!updates.length) return;

        await Promise.all(updates.map((product) => window.api.updateProduct({
            id: product.id,
            barcode: product.barcode,
            name: product.mappedName,
            categoryId: product.category_id,
            cost: product.cost_price,
            price: product.selling_price,
            alertLevel: product.alert_level,
            unitType: product.unit_type,
            isWeighted: Boolean(product.is_weighted),
            expiryDate: product.mappedExpiryDate
        })));

        products = products.map((product) => {
            const mapped = SINHALA_PRODUCT_UPDATES[String(product.barcode || '').trim()];
            if (!mapped) return product;
            return { ...product, name: mapped.name, expiry_date: mapped.expiryDate };
        });
    }

    function populateCategoryDropdown() {
        const categorySelect = document.getElementById('stockCategory');
        if (!categorySelect) return;
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    }

    function populateProductDropdown() {
        const productSelect = document.getElementById('stockProduct');
        if (!productSelect) return;
        productSelect.innerHTML = '<option value="">Select Product</option>';
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name;
            productSelect.appendChild(option);
        });
    }

    function renderStockTable() {
        const currentUser = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
        const canEditInventory = currentUser && ['owner', 'cashier'].includes(currentUser.role);
        const canEditProducts = currentUser && currentUser.role === 'owner';
        const canDiscardStock = currentUser && currentUser.role === 'owner';
        const showActionColumn = currentUser && currentUser.role === 'owner';
        let filteredItems = [...products];
        
        // Apply expiry filter
        if (currentFilter !== 'all') {
            filteredItems = filteredItems.filter(item => {
                const daysLeft = getDaysUntilExpiry(item.expiry_date);
                if (currentFilter === 'expired') return daysLeft < 0;
                if (currentFilter === 'expiring') return daysLeft >= 0 && daysLeft <= 30;
                if (currentFilter === 'good') return daysLeft > 30;
                return true;
            });
        }
        
        // Apply search filter
        if (searchTerm) {
            filteredItems = filteredItems.filter(item => 
                item.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        const tbody = document.getElementById('stockTableBody');
        if (!tbody) return;
        
        if (filteredItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${showActionColumn ? 9 : 8}"><div class="empty-state">No stock items found</div></td></tr>`;
            return;
        }
        
        tbody.innerHTML = filteredItems.map(item => {
            const daysLeft = getDaysUntilExpiry(item.expiry_date);
            const expiryInfo = getExpiryStatus(daysLeft);
            const isExpired = daysLeft < 0;
            const category = categories.find(c => c.id === item.category_id);
            
            return `
                <tr class="${isExpired ? 'expired-row' : ''}">
                    <td><strong>${item.name}</strong></td>
                    <td>${category ? category.name : 'N/A'}</td>
                    <td>${item.current_stock} ${item.unit_type || 'units'}</td>
                    <td>${formatCurrency(item.cost_price || 0)}</td>
                    <td>${formatCurrency(item.selling_price || 0)}</td>
                    <td>${formatDate(item.expiry_date)}</td>
                    <td><span class="expiry-badge ${expiryInfo.class}">${expiryInfo.status}</span></td>
                    <td>
                        <span class="days-badge ${daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring' : 'safe'}">
                            ${daysLeft < 0 ? 'Expired!' : daysLeft > 365 ? 'Stable' : `${daysLeft}d left`}
                        </span>
                    </td>
                    ${showActionColumn ? `<td>
                        ${canEditInventory
                          ? `<div style="display:flex;gap:6px;align-items:center;">
                               ${canEditProducts ? `<button class="tbl-btn edit" onclick="location.href='products.html'" title="Edit Product">
                                   <span class="material-symbols-rounded" style="font-size:16px;">edit</span>
                               </button>` : ''}
                               ${canDiscardStock ? `
                               <button class="tbl-btn discard-btn" onclick="window.discardStockBatch(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.current_stock})" title="Discard / Write-off Stock">
                                   <span class="material-symbols-rounded" style="font-size:16px;">delete_sweep</span>
                               </button>` : ''}
                             </div>`
                          : '<span style="color: var(--text3); font-size:12px; font-weight:600;">View Only</span>'}
                    </td>` : ''}
                </tr>
            `;
        }).join('');
    }

    // Modal Visibility Helpers
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('open');
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
        }
    }

    // Expose stock write-off globally
    window.discardStockBatch = async function(id, name, currentStock) {
        if (!currentStock || currentStock <= 0) {
            if (window.Notifications) {
                window.Notifications.showToast('This product is already out of stock.', 'warning');
            } else {
                alert('This product is already out of stock.');
            }
            return;
        }

        const input = prompt(`Enter the number of units to write off/discard for "${name}" (Current Stock: ${currentStock}):`);
        if (input === null) return; // user cancelled

        const qty = Number(input);
        if (isNaN(qty) || qty <= 0) {
            alert('Please enter a valid positive number.');
            return;
        }

        if (qty > currentStock) {
            alert(`Cannot discard ${qty} units. Only ${currentStock} units are in stock.`);
            return;
        }

        const confirmMessage = qty === currentStock 
            ? `WARNING: You are about to completely write off all ${currentStock} units of "${name}". This will archive the stock to 0.\n\nAre you absolutely sure?`
            : `Are you sure you want to write off / discard ${qty} units of "${name}"?`;

        if (!confirm(confirmMessage)) return;

        try {
            const result = await window.api.discardStock({ productId: id, quantity: qty });
            
            if (window.Notifications) {
                window.Notifications.showToast(`Successfully wrote off ${qty} units of ${name}.`, 'warning');
                await window.Notifications.refresh();
            } else {
                alert('Stock updated successfully.');
            }

            await loadData();
        } catch (err) {
            alert('Failed to discard stock: ' + err.message);
        }
    };

    async function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user) { window.location.href = 'login.html'; return; }

        Components.init({ title: 'Inventory Management' });

        await loadData();

        // 1. Premium modal toggling bindings
        const toggleBtn = document.getElementById('toggleFormBtn');
        const closeBtn = document.getElementById('closeAddStockModal');
        const cancelBtn = document.getElementById('cancelAddStockModal');
        const addStockModal = document.getElementById('addStockModal');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                openModal('addStockModal');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeModal('addStockModal');
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                closeModal('addStockModal');
            });
        }

        if (addStockModal) {
            addStockModal.addEventListener('click', (e) => {
                if (e.target === addStockModal) {
                    closeModal('addStockModal');
                }
            });
        }

        // 2. Smart Category Auto-Fill & Price Pre-population
        const productSelect = document.getElementById('stockProduct');
        if (productSelect) {
            productSelect.addEventListener('change', function() {
                const prodId = Number(this.value);
                const prod = products.find(p => p.id === prodId);
                const catSelect = document.getElementById('stockCategory');
                
                if (prod) {
                    if (catSelect) catSelect.value = prod.category_id;
                    document.getElementById('stockCostPrice').value = prod.cost_price || '';
                    document.getElementById('stockSellingPrice').value = prod.selling_price || '';
                    document.getElementById('stockExpiryDate').value = prod.expiry_date || '';
                } else {
                    if (catSelect) catSelect.value = '';
                    document.getElementById('stockCostPrice').value = '';
                    document.getElementById('stockSellingPrice').value = '';
                    document.getElementById('stockExpiryDate').value = '';
                }
            });
        }

        // 3. Add Stock Submission Handler
        const addStockBtn = document.getElementById('addStockBtn');
        if (addStockBtn) {
            addStockBtn.addEventListener('click', async () => {
                const productId = Number(document.getElementById('stockProduct').value);
                const quantity = Number(document.getElementById('stockQuantity').value);
                const costPrice = Number(document.getElementById('stockCostPrice').value);
                const sellingPrice = Number(document.getElementById('stockSellingPrice').value);
                const expiryDate = document.getElementById('stockExpiryDate').value;

                if (!productId || !quantity || quantity <= 0 || !costPrice || costPrice < 0 || !sellingPrice || sellingPrice < 0 || !expiryDate) {
                    alert('Please fill out all required fields with valid values.');
                    return;
                }

                try {
                    await window.api.addStock({
                        productId,
                        quantity,
                        costPrice,
                        sellingPrice,
                        expiryDate
                    });
                    
                    if (window.Notifications) {
                        window.Notifications.showToast(`Updated inventory by ${quantity} units successfully!`, 'success');
                        await window.Notifications.refresh();
                    } else {
                        alert('Inventory updated successfully!');
                    }

                    // Reset form and close modal
                    document.getElementById('stockProduct').value = '';
                    document.getElementById('stockCategory').value = '';
                    document.getElementById('stockQuantity').value = '1';
                    document.getElementById('stockCostPrice').value = '';
                    document.getElementById('stockSellingPrice').value = '';
                    document.getElementById('stockExpiryDate').value = '';

                    closeModal('addStockModal');

                    await loadData();
                } catch (err) {
                    alert('Failed to add stock: ' + err.message);
                }
            });
        }

        const stockSearch = document.getElementById('stockSearch');
        if(stockSearch) {
            stockSearch.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderStockTable();
            });
        }

        document.querySelectorAll('.filter-badge').forEach(badge => {
            badge.addEventListener('click', function() {
                document.querySelectorAll('.filter-badge').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                renderStockTable();
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
