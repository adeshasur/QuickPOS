// Page-specific JavaScript for owner_dashboard

// Sample sales data (simulating database)
let salesData = JSON.parse(localStorage.getItem('quickpos-dashboard-sales')) || generateSampleData();

// DOM Elements
const dateRangeButtons = document.querySelectorAll('.date-range-btn');

// Insight Cards Elements
const totalRevenueEl = document.getElementById('totalRevenue');
const stockVolumeEl = document.getElementById('stockVolume');
const itemsSoldTodayEl = document.getElementById('itemsSoldToday');
const avgBillAmountEl = document.getElementById('avgBillAmount');

// Sales Overview Elements
const bestCategoryChart = document.getElementById('bestCategoryChart');
const todayTransactionsEl = document.getElementById('todayTransactions');
const weekTransactionsEl = document.getElementById('weekTransactions');
const todayRevenueEl = document.getElementById('todayRevenue');
const weekRevenueEl = document.getElementById('weekRevenue');

// Reorder List Element
const reorderList = document.getElementById('reorderList');

// Dashboard Elements
const mostSoldItemsBody = document.getElementById('mostSoldItemsBody');
const peakHoursChart = document.getElementById('peakHoursChart');
const slowItemsList = document.getElementById('slowItemsList');

// Generate sample data for demo
function generateSampleData() {
    const now = new Date();
    const data = [];
    const products = [
        { id: 1, name: "Premium Coffee", price: 650, category: "drinks" },
        { id: 2, name: "Chocolate Cake", price: 850, category: "bakery" },
        { id: 3, name: "Chicken Sandwich", price: 950, category: "food" },
        { id: 4, name: "Fruit Juice", price: 450, category: "drinks" },
        { id: 5, name: "Cheese Pizza", price: 1250, category: "food" },
        { id: 6, name: "Iced Tea", price: 350, category: "drinks" },
        { id: 7, name: "French Fries", price: 550, category: "snacks" },
        { id: 8, name: "Mineral Water", price: 200, category: "drinks" }
    ];
    
    for (let i = 0; i < 120; i++) {
        const saleDate = new Date(now);
        saleDate.setDate(saleDate.getDate() - Math.floor(Math.random() * 30));
        saleDate.setHours(Math.floor(Math.random() * 14) + 8);
        saleDate.setMinutes(Math.floor(Math.random() * 60));
        
        const productCount = Math.floor(Math.random() * 3) + 1;
        const items = [];
        let total = 0;
        
        for (let j = 0; j < productCount; j++) {
            const product = products[Math.floor(Math.random() * products.length)];
            const quantity = Math.floor(Math.random() * 3) + 1;
            items.push({
                productId: product.id,
                name: product.name,
                quantity: quantity,
                price: product.price,
                category: product.category
            });
            total += product.price * quantity;
        }
        
        data.push({
            id: i + 1,
            timestamp: saleDate.getTime(),
            items: items,
            total: total,
            paymentMethod: Math.random() > 0.5 ? "Cash" : "Card",
            customerCount: Math.floor(Math.random() * 4) + 1
        });
    }
    
    localStorage.setItem('quickpos-dashboard-sales', JSON.stringify(data));
    return data;
}

// Calculate comparison trend
function calculateTrend(current, previous) {
    if (previous === 0) return { arrow: '→', text: 'New', class: 'trend-neutral' };
    
    const change = ((current - previous) / previous) * 100;
    const absChange = Math.abs(change).toFixed(1);
    
    if (change > 5) return { arrow: '↑', text: `${absChange}% vs last period`, class: 'trend-up' };
    if (change < -5) return { arrow: '↓', text: `${absChange}% vs last period`, class: 'trend-down' };
    return { arrow: '→', text: `${absChange}% vs last period`, class: 'trend-neutral' };
}

// Filter data by date range
function filterDataByRange(range) {
    const now = new Date();
    const start = new Date();
    
    switch(range) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            break;
        case 'yesterday':
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            now.setDate(now.getDate() - 1);
            now.setHours(23, 59, 59, 999);
            break;
        case 'last7':
            start.setDate(start.getDate() - 7);
            break;
        case 'thisMonth':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
        case 'lastMonth':
            start.setMonth(start.getMonth() - 1, 1);
            start.setHours(0, 0, 0, 0);
            now.setDate(0);
            now.setHours(23, 59, 59, 999);
            break;
        default:
            return salesData;
    }
    
    return salesData.filter(sale => {
        const saleDate = new Date(sale.timestamp);
        return saleDate >= start && saleDate <= now;
    });
}

// Calculate metrics for filtered data
function calculateMetrics(filteredData, range) {
    const metrics = {
        totalRevenue: 0,
        totalItemsSold: 0,
        transactionCount: filteredData.length,
        customerCount: 0,
        timePeriodSales: [0, 0, 0],
        categorySales: {}
    };
    
    filteredData.forEach(sale => {
        metrics.totalRevenue += sale.total;
        metrics.customerCount += sale.customerCount || 1;
        
        sale.items.forEach(item => {
            metrics.totalItemsSold += item.quantity;
            
            if (item.category) {
                metrics.categorySales[item.category] = 
                    (metrics.categorySales[item.category] || 0) + (item.price * item.quantity);
            }
        });
        
        const saleHour = new Date(sale.timestamp).getHours();
        if (saleHour >= 4 && saleHour < 12) {
            metrics.timePeriodSales[0] += sale.total;
        } else if (saleHour >= 12 && saleHour < 20) {
            metrics.timePeriodSales[1] += sale.total;
        } else {
            metrics.timePeriodSales[2] += sale.total;
        }
    });
    
    metrics.avgBillAmount = metrics.transactionCount > 0 ? 
        metrics.totalRevenue / metrics.transactionCount : 0;
    metrics.avgCustomersPerDay = range === 'today' ? metrics.customerCount : 
        metrics.customerCount / (range === 'last7' ? 7 : range === 'lastMonth' ? 30 : 1);
    
    return metrics;
}

// Calculate stock volume from products data
function calculateStockVolume() {
    const products = JSON.parse(localStorage.getItem('quickpos-products')) || [];
    let totalStock = 0;
    
    products.forEach(product => {
        totalStock += product.stock || 0;
    });
    
    return totalStock;
}

// Get low stock products (<5 units)
function getLowStockProducts() {
    const products = JSON.parse(localStorage.getItem('quickpos-products')) || [];
    return products.filter(product => {
        const stock = product.stock || 0;
        return stock > 0 && stock < 5;
    });
}

// Update Best Selling Category chart
function updateBestCategoryChart(categorySales) {
    bestCategoryChart.innerHTML = '';
    
    const categories = Object.entries(categorySales)
        .map(([name, sales]) => ({ name, sales }))
        .sort((a, b) => b.sales - a.sales);
    
    const topCategories = categories.slice(0, 4);
    const maxSales = Math.max(...topCategories.map(c => c.sales), 1);
    
    if (topCategories.length === 0) {
        bestCategoryChart.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-light);">
                <div style="font-size: 36px; margin-bottom: 10px;">📊</div>
                <p>No category data available</p>
            </div>
        `;
        return;
    }
    
    topCategories.forEach(category => {
        const barHeight = (category.sales / maxSales) * 120;
        const bar = document.createElement('div');
        bar.className = 'category-chart-bar';
        bar.style.height = `${barHeight}px`;
        
        const valueSpan = document.createElement('span');
        valueSpan.className = 'category-chart-value';
        valueSpan.textContent = formatCurrency(category.sales);
        bar.appendChild(valueSpan);
        
        const label = document.createElement('div');
        label.className = 'category-chart-label';
        label.textContent = category.name;
        
        const barGroup = document.createElement('div');
        barGroup.style.display = 'flex';
        barGroup.style.flexDirection = 'column';
        barGroup.style.alignItems = 'center';
        
        barGroup.appendChild(bar);
        barGroup.appendChild(label);
        bestCategoryChart.appendChild(barGroup);
    });
}

// Update Reorder List
function updateReorderList() {
    const lowStockProducts = getLowStockProducts();
    reorderList.innerHTML = '';
    
    if (lowStockProducts.length === 0) {
        reorderList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-light);">
                <div style="font-size: 32px; margin-bottom: 10px;">✅</div>
                <p>All stock levels are good!</p>
                <p style="font-size: 11px;">No products below 5 units</p>
            </div>
        `;
        return;
    }
    
    lowStockProducts.forEach(product => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'reorder-item';
        itemDiv.innerHTML = `
            <div class="reorder-item-icon">📦</div>
            <div class="reorder-item-details">
                <div class="reorder-item-name">${product.name}</div>
                <div class="reorder-item-meta">Only ${product.stock} units left • Category: ${product.category || 'General'}</div>
            </div>
            <button class="reorder-item-action">Reorder</button>
        `;
        reorderList.appendChild(itemDiv);
    });
}

// Update Today vs This Week metrics
function updateSalesOverview(todayData, weekData) {
    const todayMetrics = calculateMetrics(todayData, 'today');
    const weekMetrics = calculateMetrics(weekData, 'last7');
    
    todayTransactionsEl.textContent = todayMetrics.transactionCount;
    weekTransactionsEl.textContent = weekMetrics.transactionCount;
    todayRevenueEl.textContent = formatCurrency(todayMetrics.totalRevenue);
    weekRevenueEl.textContent = formatCurrency(weekMetrics.totalRevenue);
}

// Update insight cards
function updateInsights(metrics, range) {
    totalRevenueEl.textContent = formatCurrency(metrics.totalRevenue);
    
    const stockVolume = calculateStockVolume();
    stockVolumeEl.textContent = stockVolume.toLocaleString();
    
    itemsSoldTodayEl.textContent = metrics.totalItemsSold;
    
    avgBillAmountEl.textContent = formatCurrency(metrics.avgBillAmount);
    
    updateBestCategoryChart(metrics.categorySales);
    updateReorderList();
}

// Update most sold items table
function updateMostSoldItems(filteredData) {
    const itemMap = new Map();
    
    filteredData.forEach(sale => {
        sale.items.forEach(item => {
            const key = item.productId || item.name;
            if (itemMap.has(key)) {
                const existing = itemMap.get(key);
                existing.quantity += item.quantity;
                existing.revenue += item.quantity * item.price;
            } else {
                itemMap.set(key, {
                    name: item.name,
                    quantity: item.quantity,
                    revenue: item.quantity * item.price
                });
            }
        });
    });
    
    const itemsArray = Array.from(itemMap.values());
    itemsArray.sort((a, b) => b.quantity - a.quantity);
    const topItems = itemsArray.slice(0, 5);
    
    mostSoldItemsBody.innerHTML = '';
    
    if (topItems.length === 0) {
        mostSoldItemsBody.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <p>No sales data available</p>
                        <p>What should you buy next?</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    topItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="rank-cell">${index + 1}</td>
            <td class="product-cell">${item.name}</td>
            <td class="quantity-cell">${item.quantity}</td>
        `;
        mostSoldItemsBody.appendChild(row);
    });
}

// Update peak hours chart
function updatePeakHours(timePeriodSales) {
    peakHoursChart.innerHTML = '';
    
    const timePeriods = [
        { label: "4AM - 12PM", period: "Morning" },
        { label: "12PM - 8PM", period: "Afternoon" },
        { label: "8PM - 4AM", period: "Night" }
    ];
    
    const maxSales = Math.max(...timePeriodSales);
    
    timePeriods.forEach((period, index) => {
        const sales = timePeriodSales[index];
        const barHeight = maxSales > 0 ? (sales / maxSales) * 180 : 10;
        
        const barGroup = document.createElement('div');
        barGroup.className = 'chart-bar-group';
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${barHeight}px`;
        
        if (sales > 0) {
            const valueSpan = document.createElement('span');
            valueSpan.className = 'chart-bar-value';
            valueSpan.textContent = formatCurrency(sales);
            bar.appendChild(valueSpan);
        }
        
        const label = document.createElement('div');
        label.className = 'chart-bar-label';
        label.innerHTML = `${period.label}<br><small style="color: var(--text-light); font-weight: normal;">${period.period}</small>`;
        
        barGroup.appendChild(bar);
        barGroup.appendChild(label);
        peakHoursChart.appendChild(barGroup);
    });
}

// Update slow moving items
function updateSlowItems() {
    const slowItems = [
        { name: "Seasonal Tea", lastSold: "5 days ago", stock: 15 },
        { name: "Special Coffee Blend", lastSold: "4 days ago", stock: 8 },
        { name: "Premium Cookies", lastSold: "6 days ago", stock: 12 }
    ];
    
    slowItemsList.innerHTML = '';
    
    slowItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'slow-item';
        itemDiv.innerHTML = `
            <div class="slow-item-icon">📦</div>
            <div class="slow-item-details">
                <div class="slow-item-name">${item.name}</div>
                <div class="slow-item-meta">Last sold: ${item.lastSold} • Stock: ${item.stock} units</div>
            </div>
            <button class="slow-item-action">Create Promotion</button>
        `;
        slowItemsList.appendChild(itemDiv);
    });
}

// Update dashboard with selected range
function updateDashboard(range) {
    const filteredData = filterDataByRange(range);
    const metrics = calculateMetrics(filteredData, range);
    
    const todayData = filterDataByRange('today');
    const weekData = filterDataByRange('last7');
    
    updateInsights(metrics, range);
    updateSalesOverview(todayData, weekData);
    updateMostSoldItems(filteredData);
    updatePeakHours(metrics.timePeriodSales);
    updateSlowItems();
}

// Initialize the dashboard (called after common.js initCommon)
function initDashboard() {
    // Date range button listeners
    dateRangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            dateRangeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateDashboard(btn.dataset.range);
        });
    });
    
    // Reorder item action buttons
    reorderList.addEventListener('click', (e) => {
        if (e.target.classList.contains('reorder-item-action')) {
            const itemName = e.target.closest('.reorder-item').querySelector('.reorder-item-name').textContent;
            alert(`Reorder action for "${itemName}" would open inventory management.`);
        }
    });
    
    // Slow item action buttons
    slowItemsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('slow-item-action')) {
            const itemName = e.target.closest('.slow-item').querySelector('.slow-item-name').textContent;
            alert(`Promotion creation for "${itemName}" would open promotion setup.`);
        }
    });
    
    // Initial dashboard update
    updateDashboard('today');
}

// Initialize when DOM is loaded (after common.js)
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for common.js to finish
    setTimeout(initDashboard, 100);
});
