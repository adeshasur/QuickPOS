// Hardcoded Categories
const categories = [
    { id: 1, name: "Beverages" },
    { id: 2, name: "Food" },
    { id: 3, name: "Snacks" },
    { id: 4, name: "Pastry" },
    { id: 5, name: "Dessert" },
    { id: 6, name: "Groceries" },
    { id: 7, name: "Dairy" }
];

// Hardcoded Products
let products = [
    { id: 1, name: "Coffee", categoryId: 1, category: "Beverages", cost_price: 150, selling_price: 450 },
    { id: 2, name: "Tea", categoryId: 1, category: "Beverages", cost_price: 120, selling_price: 350 },
    { id: 3, name: "Chocolate Cake", categoryId: 4, category: "Pastry", cost_price: 300, selling_price: 650 },
    { id: 4, name: "Chicken Sandwich", categoryId: 2, category: "Food", cost_price: 400, selling_price: 850 },
    { id: 5, name: "Mineral Water", categoryId: 1, category: "Beverages", cost_price: 80, selling_price: 200 },
    { id: 6, name: "Cheese Pizza", categoryId: 2, category: "Food", cost_price: 500, selling_price: 1200 },
    { id: 7, name: "French Fries", categoryId: 3, category: "Snacks", cost_price: 200, selling_price: 550 },
    { id: 8, name: "Fruit Juice", categoryId: 1, category: "Beverages", cost_price: 180, selling_price: 500 },
    { id: 9, name: "Ice Cream", categoryId: 5, category: "Dessert", cost_price: 250, selling_price: 600 },
    { id: 10, name: "Burger", categoryId: 2, category: "Food", cost_price: 350, selling_price: 750 },
    { id: 11, name: "Soft Drink", categoryId: 1, category: "Beverages", cost_price: 90, selling_price: 250 },
    { id: 12, name: "Fresh Milk", categoryId: 7, category: "Dairy", cost_price: 130, selling_price: 280 }
];

// Stock items with expiry dates
let stockItems = JSON.parse(localStorage.getItem('quickpos-stock-items')) || [
    { id: 1, productId: 1, productName: "Coffee", category: "Beverages", quantity: 50, costPrice: 150, sellingPrice: 450, expiryDate: "2026-05-15", addedDate: new Date().toISOString() },
    { id: 2, productId: 3, productName: "Chocolate Cake", category: "Pastry", quantity: 20, costPrice: 300, sellingPrice: 650, expiryDate: "2026-04-28", addedDate: new Date().toISOString() },
    { id: 3, productId: 5, productName: "Mineral Water", category: "Beverages", quantity: 100, costPrice: 80, sellingPrice: 200, expiryDate: "2026-12-20", addedDate: new Date().toISOString() },
    { id: 4, productId: 7, productName: "French Fries", category: "Snacks", quantity: 40, costPrice: 200, sellingPrice: 550, expiryDate: "2026-04-10", addedDate: new Date().toISOString() },
    { id: 5, productId: 9, productName: "Ice Cream", category: "Dessert", quantity: 25, costPrice: 250, sellingPrice: 600, expiryDate: "2026-05-01", addedDate: new Date().toISOString() },
    { id: 6, productId: 11, productName: "Soft Drink", category: "Beverages", quantity: 80, costPrice: 90, sellingPrice: 250, expiryDate: "2026-08-10", addedDate: new Date().toISOString() },
    { id: 7, productId: 12, productName: "Fresh Milk", category: "Dairy", quantity: 15, costPrice: 130, sellingPrice: 280, expiryDate: "2026-03-28", addedDate: new Date().toISOString() }
];

let nextStockId = stockItems.length > 0 ? Math.max(...stockItems.map(s => s.id)) + 1 : 1;
let currentFilter = "all";
let searchTerm = "";

// Helper Functions
function formatCurrency(amount) {
    return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getDaysUntilExpiry(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getExpiryStatus(daysLeft) {
    if (daysLeft < 0) return { status: "Expired", class: "expired", icon: "❌" };
    if (daysLeft <= 30) return { status: "Expiring Soon", class: "expiring", icon: "⚠️" };
    return { status: "Good", class: "good", icon: "✅" };
}

// Populate Category Dropdown
function populateCategoryDropdown() {
    const categorySelect = document.getElementById('stockCategory');
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
}

// Populate Product Dropdown based on Category
function populateProductDropdown(categoryId) {
    const productSelect = document.getElementById('stockProduct');
    if (!categoryId) {
        productSelect.innerHTML = '<option value="">Select Category First</option>';
        return;
    }
    
    const filteredProducts = products.filter(p => p.categoryId == categoryId);
    productSelect.innerHTML = '<option value="">Select Product</option>';
    filteredProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        option.dataset.costPrice = product.cost_price;
        option.dataset.sellingPrice = product.selling_price;
        productSelect.appendChild(option);
    });
}

// Auto-fill prices when product is selected
function setupProductAutoFill() {
    const productSelect = document.getElementById('stockProduct');
    productSelect.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption && selectedOption.value) {
            document.getElementById('stockCostPrice').value = selectedOption.dataset.costPrice || '';
            document.getElementById('stockSellingPrice').value = selectedOption.dataset.sellingPrice || '';
        }
    });
}

// Add Stock to Inventory
function addStock() {
    const categoryId = document.getElementById('stockCategory').value;
    const productId = document.getElementById('stockProduct').value;
    const quantity = parseInt(document.getElementById('stockQuantity').value);
    const costPrice = parseFloat(document.getElementById('stockCostPrice').value);
    const sellingPrice = parseFloat(document.getElementById('stockSellingPrice').value);
    const expiryDate = document.getElementById('stockExpiryDate').value;

    if (!categoryId || !productId || !quantity || !costPrice || !sellingPrice || !expiryDate) {
        alert('Please fill all fields!');
        return;
    }

    const product = products.find(p => p.id == productId);
    if (!product) return;

    const newStock = {
        id: nextStockId++,
        productId: parseInt(productId),
        productName: product.name,
        category: product.category,
        quantity: quantity,
        costPrice: costPrice,
        sellingPrice: sellingPrice,
        expiryDate: expiryDate,
        addedDate: new Date().toISOString()
    };

    stockItems.push(newStock);
    localStorage.setItem('quickpos-stock-items', JSON.stringify(stockItems));
    
    // Reset form
    document.getElementById('stockCategory').value = '';
    document.getElementById('stockProduct').innerHTML = '<option value="">Select Category First</option>';
    document.getElementById('stockQuantity').value = '1';
    document.getElementById('stockCostPrice').value = '';
    document.getElementById('stockSellingPrice').value = '';
    document.getElementById('stockExpiryDate').value = '';
    
    renderStockTable();
    alert(`✅ Added ${quantity} × ${product.name} to inventory!`);
}

// Global function to delete item from HTML onclick
window.deleteStockItem = function(id) {
    if (confirm('Are you sure you want to remove this stock item?')) {
        stockItems = stockItems.filter(item => item.id !== id);
        localStorage.setItem('quickpos-stock-items', JSON.stringify(stockItems));
        renderStockTable();
    }
};

// Render Stock Table
function renderStockTable() {
    let filteredItems = [...stockItems];
    
    // Apply expiry filter
    if (currentFilter !== 'all') {
        filteredItems = filteredItems.filter(item => {
            const daysLeft = getDaysUntilExpiry(item.expiryDate);
            if (currentFilter === 'expired') return daysLeft < 0;
            if (currentFilter === 'expiring') return daysLeft >= 0 && daysLeft <= 30;
            if (currentFilter === 'good') return daysLeft > 30;
            return true;
        });
    }
    
    // Apply search filter
    if (searchTerm) {
        filteredItems = filteredItems.filter(item => 
            item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    
    const tbody = document.getElementById('stockTableBody');
    
    if (filteredItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">📦 No stock items found</div></td></tr>`;
        return;
    }
    
    tbody.innerHTML = filteredItems.map(item => {
        const daysLeft = getDaysUntilExpiry(item.expiryDate);
        const expiryInfo = getExpiryStatus(daysLeft);
        const isExpired = daysLeft < 0;
        
        return `
            <tr style="${isExpired ? 'opacity: 0.7; background-color: #FEE2E2;' : ''}">
                <td><strong>${item.productName}</strong></td>
                <td>${item.category}</td>
                <td>${item.quantity} units</td>
                <td>${formatCurrency(item.costPrice)}</td>
                <td>${formatCurrency(item.sellingPrice)}</td>
                <td>${formatDate(item.expiryDate)}</td>
                <td><span class="expiry-badge ${expiryInfo.class}">${expiryInfo.icon} ${expiryInfo.status}</span></td>
                <td style="${daysLeft < 0 ? 'color: red; font-weight: bold;' : daysLeft <= 30 ? 'color: #F59E0B;' : 'color: green;'}">
                    ${daysLeft < 0 ? 'Expired!' : `${daysLeft} days left`}
                </td>
                <td>
                    <button class="update-btn" style="padding: 6px 12px; background-color: #DC2626;" onclick="deleteStockItem(${item.id})">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Setup Filter Listeners
function setupFilters() {
    document.querySelectorAll('.filter-badge').forEach(badge => {
        badge.addEventListener('click', function() {
            document.querySelectorAll('.filter-badge').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderStockTable();
        });
    });
    
    document.getElementById('stockSearch').addEventListener('input', function(e) {
        searchTerm = e.target.value;
        renderStockTable();
    });
}

// Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const logo = document.getElementById('logo');
    sidebar.classList.toggle('expanded');
    sidebar.classList.toggle('collapsed');
    logo.classList.toggle('collapsed');
    
    const icon = document.getElementById('hamburgerIcon');
    if (sidebar.classList.contains('collapsed')) {
        icon.textContent = '→';
        localStorage.setItem('quickpos-sidebar', 'collapsed');
    } else {
        icon.textContent = '☰';
        localStorage.setItem('quickpos-sidebar', 'expanded');
    }
}

// Initialize
function init() {
    // Check security & User Data
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Set User Name/Initials
    if (user && user.name) {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('userAvatar').textContent = initials.substring(0, 2);
        document.getElementById('shiftInfo').textContent = `${user.role === 'owner' ? 'Owner' : 'Cashier'}: ${user.name}`;
    }

    // Role Check
    if (user && user.role === 'cashier') {
        document.querySelectorAll('.owner-only').forEach(link => link.style.display = 'none');
        // Hide add stock section and delete buttons for cashiers
        const stockInCard = document.querySelector('.stock-in-card');
        if(stockInCard) stockInCard.style.display = 'none';
        
        // Let them only view the table (CSS can handle hiding the delete column)
        const css = document.createElement('style');
        css.innerHTML = `
            .stock-table th:last-child, .stock-table td:last-child { display: none !important; }
        `;
        document.head.appendChild(css);
    }

    // Dropdowns & Forms
    populateCategoryDropdown();
    setupProductAutoFill();
    
    const categorySelect = document.getElementById('stockCategory');
    categorySelect.addEventListener('change', function() {
        populateProductDropdown(this.value);
    });
    
    document.getElementById('addStockBtn').addEventListener('click', addStock);
    
    setupFilters();
    renderStockTable();
    
    // Sidebar
    document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
    const sidebarState = localStorage.getItem('quickpos-sidebar');
    if (sidebarState === 'collapsed') toggleSidebar();
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Logout?')) {
            localStorage.removeItem('quickpos-user');
            window.location.href = 'login.html';
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
