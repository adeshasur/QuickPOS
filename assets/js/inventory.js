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

    function populateProductDropdown(categoryId) {
        const productSelect = document.getElementById('stockProduct');
        if (!productSelect) return;
        if (!categoryId) {
            productSelect.innerHTML = '<option value="">Select Category First</option>';
            return;
        }
        
        const filteredProducts = products.filter(p => p.category_id == categoryId);
        productSelect.innerHTML = '<option value="">Select Product</option>';
        filteredProducts.forEach(product => {
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
                          ? `<button class="update-btn" onclick="location.href='products.html'">
                               <span class="material-symbols-rounded" style="font-size:16px;">edit</span>
                             </button>`
                          : '<span style="color: var(--text3); font-size:12px; font-weight:600;">View Only</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user) { window.location.href = 'login.html'; return; }

        Components.init({ title: 'Inventory Management' });

        await loadData();

        const categorySelect = document.getElementById('stockCategory');
        if(categorySelect) {
            categorySelect.addEventListener('change', function() {
                populateProductDropdown(this.value);
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
