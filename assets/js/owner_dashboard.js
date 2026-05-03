// Sample sales data (simulating database)
let salesData = JSON.parse(localStorage.getItem('quickpos-dashboard-sales')) || generateSampleData();

// DOM Elements
const totalRevenueEl = document.getElementById('totalRevenue');
const revenueTrendEl = document.getElementById('revenueTrend');
const stockVolumeEl = document.getElementById('stockVolume');
const stockTrendEl = document.getElementById('stockTrend');
const itemsSoldTodayEl = document.getElementById('itemsSoldToday');
const itemsSoldTrendEl = document.getElementById('itemsSoldTrend');
const avgBillAmountEl = document.getElementById('avgBillAmount');
const valueTrendEl = document.getElementById('valueTrend');

const bestCategoryChart = document.getElementById('bestCategoryChart');
const todayTransactionsEl = document.getElementById('todayTransactions');
const weekTransactionsEl = document.getElementById('weekTransactions');
const todayRevenueEl = document.getElementById('todayRevenue');
const weekRevenueEl = document.getElementById('weekRevenue');
const reorderList = document.getElementById('reorderList');
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
        { id: 5, name: "Cheese Pizza", price: 1250, category: "food" }
    ];
    
    for (let i = 0; i < 120; i++) {
        const saleDate = new Date(now);
        saleDate.setDate(saleDate.getDate() - Math.floor(Math.random() * 30));
        saleDate.setHours(Math.floor(Math.random() * 14) + 8);
        
        const productCount = Math.floor(Math.random() * 3) + 1;
        const items = [];
        let total = 0;
        
        for (let j = 0; j < productCount; j++) {
            const product = products[Math.floor(Math.random() * products.length)];
            const quantity = Math.floor(Math.random() * 3) + 1;
            items.push({ productId: product.id, name: product.name, quantity: quantity, price: product.price, category: product.category });
            total += product.price * quantity;
        }
        
        data.push({
            id: i + 1, timestamp: saleDate.getTime(), items: items, total: total,
            paymentMethod: Math.random() > 0.5 ? "Cash" : "Card", customerCount: Math.floor(Math.random() * 4) + 1
        });
    }
    localStorage.setItem('quickpos-dashboard-sales', JSON.stringify(data));
    return data;
}

function formatCurrency(amount) {
    return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function filterDataByRange(range) {
    const now = new Date();
    const start = new Date();
    
    switch(range) {
        case 'today': start.setHours(0, 0, 0, 0); break;
        case 'yesterday':
            start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
            now.setDate(now.getDate() - 1); now.setHours(23, 59, 59, 999);
            break;
        case 'last7': start.setDate(start.getDate() - 7); break;
        case 'thisMonth': start.setDate(1); start.setHours(0, 0, 0, 0); break;
        case 'lastMonth':
            start.setMonth(start.getMonth() - 1, 1); start.setHours(0, 0, 0, 0);
            now.setDate(0); now.setHours(23, 59, 59, 999);
            break;
        default: return salesData;
    }
    
    return salesData.filter(sale => {
        const saleDate = new Date(sale.timestamp);
        return saleDate >= start && saleDate <= now;
    });
}

function calculateMetrics(filteredData, range) {
    const metrics = {
        totalRevenue: 0, totalItemsSold: 0, transactionCount: filteredData.length,
        customerCount: 0, timePeriodSales: [0, 0, 0], categorySales: {}
    };
    
    filteredData.forEach(sale => {
        metrics.totalRevenue += sale.total;
        metrics.customerCount += sale.customerCount || 1;
        
        sale.items.forEach(item => {
            metrics.totalItemsSold += item.quantity;
            if (item.category) {
                metrics.categorySales[item.category] = (metrics.categorySales[item.category] || 0) + (item.price * item.quantity);
            }
        });
        
        const saleHour = new Date(sale.timestamp).getHours();
        if (saleHour >= 4 && saleHour < 12) metrics.timePeriodSales[0] += sale.total;
        else if (saleHour >= 12 && saleHour < 20) metrics.timePeriodSales[1] += sale.total;
        else metrics.timePeriodSales[2] += sale.total;
    });
    
    metrics.avgBillAmount = metrics.transactionCount > 0 ? metrics.totalRevenue / metrics.transactionCount : 0;
    return metrics;
}

function calculateStockVolume() {
    const products = JSON.parse(localStorage.getItem('quickpos-products')) || [];
    let totalStock = 0;
    products.forEach(product => { totalStock += product.stock || 0; });
    return totalStock;
}

function getLowStockProducts() {
    const products = JSON.parse(localStorage.getItem('quickpos-products')) || [];
    return products.filter(product => {
        const stock = product.stock || 0;
        return stock > 0 && stock < 5;
    });
}

function updateBestCategoryChart(categorySales) {
    bestCategoryChart.innerHTML = '';
    const categories = Object.entries(categorySales)
        .map(([name, sales]) => ({ name, sales }))
        .sort((a, b) => b.sales - a.sales);
    
    const topCategories = categories.slice(0, 4);
    const maxSales = Math.max(...topCategories.map(c => c.sales), 1);
    
    if (topCategories.length === 0) {
        bestCategoryChart.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-light);"><div style="font-size: 36px; margin-bottom: 10px;">📊</div><p>No category data available</p></div>`;
        return;
    }
    
    topCategories.forEach(category => {
        const barHeight = (category.sales / maxSales) * 120;
        const barGroup = document.createElement('div');
        barGroup.style.display = 'flex'; barGroup.style.flexDirection = 'column'; barGroup.style.alignItems = 'center';
        
        barGroup.innerHTML = `
            <div class="category-chart-bar" style="height: ${barHeight}px;">
                <span class="category-chart-value">${formatCurrency(category.sales)}</span>
            </div>
            <div class="category-chart-label">${category.name}</div>
        `;
        bestCategoryChart.appendChild(barGroup);
    });
}

function updateReorderList() {
    const lowStockProducts = getLowStockProducts();
    reorderList.innerHTML = '';
    
    if (lowStockProducts.length === 0) {
        reorderList.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-light);"><div style="font-size: 32px; margin-bottom: 10px;">✅</div><p>All stock levels are good!</p></div>`;
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

function updateSalesOverview(todayData, weekData) {
    const todayMetrics = calculateMetrics(todayData, 'today');
    const weekMetrics = calculateMetrics(weekData, 'last7');
    
    todayTransactionsEl.textContent = todayMetrics.transactionCount;
    weekTransactionsEl.textContent = weekMetrics.transactionCount;
    todayRevenueEl.textContent = formatCurrency(todayMetrics.totalRevenue);
    weekRevenueEl.textContent = formatCurrency(weekMetrics.totalRevenue);
}

function updateInsights(metrics) {
    totalRevenueEl.textContent = formatCurrency(metrics.totalRevenue);
    stockVolumeEl.textContent = calculateStockVolume().toLocaleString();
    itemsSoldTodayEl.textContent = metrics.totalItemsSold;
    avgBillAmountEl.textContent = formatCurrency(metrics.avgBillAmount);
    updateBestCategoryChart(metrics.categorySales);
    updateReorderList();
}

function updateMostSoldItems(filteredData) {
    const itemMap = new Map();
    filteredData.forEach(sale => {
        sale.items.forEach(item => {
            const key = item.productId || item.name;
            if (itemMap.has(key)) {
                const existing = itemMap.get(key);
                existing.quantity += item.quantity;
            } else {
                itemMap.set(key, { name: item.name, quantity: item.quantity });
            }
        });
    });
    
    const topItems = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    mostSoldItemsBody.innerHTML = '';
    
    if (topItems.length === 0) {
        mostSoldItemsBody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">📦</div><p>No sales data available</p></div></td></tr>`;
        return;
    }
    
    topItems.forEach((item, index) => {
        mostSoldItemsBody.innerHTML += `<tr><td class="rank-cell">${index + 1}</td><td class="product-cell">${item.name}</td><td class="quantity-cell">${item.quantity}</td></tr>`;
    });
}

function updatePeakHours(timePeriodSales) {
    peakHoursChart.innerHTML = '';
    const timePeriods = [{ label: "4AM - 12PM", period: "Morning" }, { label: "12PM - 8PM", period: "Afternoon" }, { label: "8PM - 4AM", period: "Night" }];
    const maxSales = Math.max(...timePeriodSales);
    
    timePeriods.forEach((period, index) => {
        const sales = timePeriodSales[index];
        const barHeight = maxSales > 0 ? (sales / maxSales) * 180 : 10;
        
        const barGroup = document.createElement('div');
        barGroup.className = 'chart-bar-group';
        barGroup.innerHTML = `
            <div class="chart-bar" style="height: ${barHeight}px;">
                ${sales > 0 ? `<span class="chart-bar-value">${formatCurrency(sales)}</span>` : ''}
            </div>
            <div class="chart-bar-label">${period.label}<br><small style="color: var(--text-light); font-weight: normal;">${period.period}</small></div>
        `;
        peakHoursChart.appendChild(barGroup);
    });
}

function updateSlowItems() {
    const slowItems = [
        { name: "Seasonal Tea", lastSold: "5 days ago", stock: 15 },
        { name: "Special Coffee Blend", lastSold: "4 days ago", stock: 8 }
    ];
    slowItemsList.innerHTML = '';
    
    slowItems.forEach(item => {
        slowItemsList.innerHTML += `
            <div class="slow-item">
                <div class="slow-item-icon">📦</div>
                <div class="slow-item-details">
                    <div class="slow-item-name">${item.name}</div>
                    <div class="slow-item-meta">Last sold: ${item.lastSold} • Stock: ${item.stock} units</div>
                </div>
                <button class="slow-item-action">Create Promotion</button>
            </div>
        `;
    });
}

function updateDashboard(range) {
    const filteredData = filterDataByRange(range);
    const metrics = calculateMetrics(filteredData, range);
    const todayData = filterDataByRange('today');
    const weekData = filterDataByRange('last7');
    
    updateInsights(metrics);
    updateSalesOverview(todayData, weekData);
    updateMostSoldItems(filteredData);
    updatePeakHours(metrics.timePeriodSales);
    updateSlowItems();
}


document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize Components
    const filtersHtml = `
        <div class="data-filters">
            <span class="date-range-label">View Data For:</span>
            <div class="date-range-buttons">
                <button class="date-range-btn active" data-range="today">Today</button>
                <button class="date-range-btn" data-range="yesterday">Yesterday</button>
                <button class="date-range-btn" data-range="last7">Last 7 Days</button>
                <button class="date-range-btn" data-range="thisMonth">This Month</button>
                <button class="date-range-btn" data-range="lastMonth">Last Month</button>
                <button class="custom-range-btn">
                    <span>📅</span> Custom Range
                </button>
            </div>
        </div>
    `;

    Components.init({
        title: 'Executive Dashboard',
        extra: filtersHtml
    });

    // Re-select date range buttons after injection
    const dateRangeButtons = document.querySelectorAll('.date-range-btn');
    dateRangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.date-range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateDashboard(btn.dataset.range);
        });
    });

    updateDashboard('today');
});
