(function() {
    'use strict';

    let categories = [];
    let products = [];
    let currentFilter = "all";
    let searchTerm = "";

    const formatCurrency = window.fmtLKR;

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
            populateProductDropdown();
            populateCategoryDropdown();
            renderStockTable();
        } catch (err) {
            console.error('Error loading inventory data:', err);
        }
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
        const canEditInventory = currentUser && currentUser.role === 'owner';
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
            tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">No stock items found</div></td></tr>`;
            return;
        }
        
        tbody.innerHTML = filteredItems.map(item => {
            const daysLeft = getDaysUntilExpiry(item.expiry_date);
            const expiryInfo = getExpiryStatus(daysLeft);
            const isExpired = daysLeft < 0;
            const category = categories.find(c => c.id === item.category_id);
            
            return `
                <tr style="${isExpired ? 'background-color: #FFF5F5;' : ''}">
                    <td><strong>${item.name}</strong></td>
                    <td>${category ? category.name : 'N/A'}</td>
                    <td>${item.current_stock} ${item.unit_type || 'units'}</td>
                    <td>${formatCurrency(item.cost_price || 0)}</td>
                    <td>${formatCurrency(item.selling_price || 0)}</td>
                    <td>${formatDate(item.expiry_date)}</td>
                    <td><span class="expiry-badge ${expiryInfo.class}">${expiryInfo.status}</span></td>
                    <td style="${daysLeft < 0 ? 'color: red;' : daysLeft <= 30 ? 'color: orange;' : 'color: green;'}">
                        ${daysLeft < 0 ? 'Expired!' : daysLeft > 365 ? 'Good' : `${daysLeft} days left`}
                    </td>
                    <td>
                        ${canEditInventory
                          ? `<div style="display:flex;gap:6px;align-items:center;">
                               <button class="tbl-btn edit" onclick="location.href='products.html'" title="Edit Product">
                                   <span class="material-symbols-rounded" style="font-size:16px;">edit</span>
                               </button>
                               <button class="tbl-btn discard-btn" onclick="window.discardStockBatch(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.current_stock})" title="Discard / Write-off Stock">
                                   <span class="material-symbols-rounded" style="font-size:16px;">delete_sweep</span>
                               </button>
                             </div>`
                          : '<span style="color: var(--text3); font-size:12px; font-weight:600;">View Only</span>'}
                    </td>
                </tr>
            `;
        }).join('');
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

        // 1. Sleek accordion expanding toggling
        const toggleBtn = document.getElementById('toggleFormBtn');
        const accordionHeader = document.getElementById('accordionHeader');
        const accordion = document.getElementById('addStockAccordion');
        
        const toggleAccordion = () => {
            if (accordion) accordion.classList.toggle('collapsed');
        };

        if (toggleBtn) toggleBtn.addEventListener('click', toggleAccordion);
        if (accordionHeader) accordionHeader.addEventListener('click', toggleAccordion);

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
                        window.Notifications.showToast(`Restocked ${quantity} units successfully!`, 'success');
                        await window.Notifications.refresh();
                    } else {
                        alert('Stock added successfully!');
                    }

                    // Reset form and collapse
                    document.getElementById('stockProduct').value = '';
                    document.getElementById('stockCategory').value = '';
                    document.getElementById('stockQuantity').value = '1';
                    document.getElementById('stockCostPrice').value = '';
                    document.getElementById('stockSellingPrice').value = '';
                    document.getElementById('stockExpiryDate').value = '';

                    if (accordion) accordion.classList.add('collapsed');

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
