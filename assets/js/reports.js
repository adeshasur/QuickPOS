(function() {
    'use strict';

    let salesData = [];
    let saleDetailsMap = new Map();
    let currentReportSales = [];
    let productsData = [];
    let categoriesData = [];
    let activeDateRange = 'today';
    let showAllTopItems = false;
    let showAllStockInsights = false;

    // DOM elements
    const generateReportBtn = document.getElementById('generateReportBtn');
    const printReportBtn = document.getElementById('printReportBtn');
    const viewReportPdfBtn = document.getElementById('viewReportPdfBtn');
    const downloadReportPdfBtn = document.getElementById('downloadReportPdfBtn');
    const downloadCategoryReportPdfBtn = document.getElementById('downloadCategoryReportPdfBtn');
    
    // Summary cards
    const totalSalesAmount = document.getElementById('totalSalesAmount');
    const totalSalesDetails = document.getElementById('totalSalesDetails');
    const cashCollectedAmount = document.getElementById('cashCollectedAmount');
    const cashCollectedDetails = document.getElementById('cashCollectedDetails');
    const cardPaymentsAmount = document.getElementById('cardPaymentsAmount');
    const cardPaymentsDetails = document.getElementById('cardPaymentsDetails');
    const netProfitAmount = document.getElementById('netProfitAmount');
    const netProfitDetails = document.getElementById('netProfitDetails');
    const itemsSoldAmount = document.getElementById('itemsSoldAmount');
    const itemsSoldDetails = document.getElementById('itemsSoldDetails');
    const invoiceCountAmount = document.getElementById('invoiceCountAmount');
    const invoiceCountDetails = document.getElementById('invoiceCountDetails');
    const reportCashierFilter = document.getElementById('reportCashierFilter');
    const reportShiftFilter = document.getElementById('reportShiftFilter');
    const reportStartDate = document.getElementById('reportStartDate');
    const reportEndDate = document.getElementById('reportEndDate');
    const salesTrendChart = document.getElementById('salesTrendChart');
    const paymentDonutChart = document.getElementById('paymentDonutChart');
    const stockInsightList = document.getElementById('stockInsightList');
    const topItemsSeeMoreBtn = document.getElementById('topItemsSeeMoreBtn');
    const stockInsightsSeeMoreBtn = document.getElementById('stockInsightsSeeMoreBtn');
    
    // Tables
    const salesTableBody = document.getElementById('salesTableBody');
    const emptySalesRow = document.getElementById('emptySalesRow');
    const topItemsTableBody = document.getElementById('topItemsTableBody');
    const emptyItemsRow = document.getElementById('emptyItemsRow');
    const categoryReportTableBody = document.getElementById('categoryReportTableBody');
    const emptyCategoryRow = document.getElementById('emptyCategoryRow');

    const formatCurrency = window.fmtLKR;

    function formatDisplayDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + 
               date.toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' });
    }

    function isToday(timestamp) {
        const d = new Date(timestamp);
        const now = new Date();
        return d.getFullYear() === now.getFullYear()
            && d.getMonth() === now.getMonth()
            && d.getDate() === now.getDate();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function loadData() {
        try {
            salesData = await window.api.getSalesHistory();
            [productsData, categoriesData] = await Promise.all([
                window.api.getProducts(),
                window.api.getCategories()
            ]);
            const detailEntries = await Promise.all(
                salesData.map(async (sale) => {
                    const details = await window.api.getSaleDetails(sale.id);
                    return [sale.id, Array.isArray(details) ? details : []];
                })
            );
            saleDetailsMap = new Map(detailEntries);
            populateCashierFilter();
            generateReport();
        } catch (err) {
            console.error('Error loading report data:', err);
        }
    }

    function calculateTotals(sales) {
        const totals = { totalSales: 0, netProfit: 0, cashCollected: 0, cardPayments: 0, creditSales: 0, itemsSold: 0, transactionCount: sales.length, cashTransactionCount: 0, cardTransactionCount: 0 };
        sales.forEach(sale => {
            const items = saleDetailsMap.get(sale.id) || [];
            totals.totalSales += Number(sale.total_amount || 0);
            totals.netProfit += Number(sale.gross_profit || 0) || items.reduce((sum, item) => sum + Number(item.profit_total || 0), 0);
            totals.itemsSold += items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            if (sale.payment_method === 'Cash') { 
                totals.cashCollected += Number(sale.total_amount || 0);
                totals.cashTransactionCount++; 
            } else if (sale.payment_method === 'Credit') {
                totals.creditSales += Number(sale.total_amount || 0);
            } else {
                totals.cardPayments += Number(sale.total_amount || 0);
                totals.cardTransactionCount++; 
            }
        });
        return totals;
    }

    function updateSummaryCards(totals) {
        if(totalSalesAmount) totalSalesAmount.textContent = formatCurrency(totals.totalSales);
        if(totalSalesDetails) totalSalesDetails.textContent = `${totals.transactionCount} transaction${totals.transactionCount !== 1 ? 's' : ''}`;
        if(cashCollectedAmount) cashCollectedAmount.textContent = formatCurrency(totals.cashCollected);
        if(cashCollectedDetails) cashCollectedDetails.textContent = `${totals.cashTransactionCount} cash transaction${totals.cashTransactionCount !== 1 ? 's' : ''}`;
        if(cardPaymentsAmount) cardPaymentsAmount.textContent = formatCurrency(totals.cardPayments);
        if(cardPaymentsDetails) cardPaymentsDetails.textContent = `${totals.cardTransactionCount} card transaction${totals.cardTransactionCount !== 1 ? 's' : ''}`;
        if(netProfitAmount) netProfitAmount.textContent = formatCurrency(totals.netProfit);
        if(netProfitDetails) netProfitDetails.textContent = totals.totalSales ? `${((totals.netProfit / totals.totalSales) * 100).toFixed(1)}% estimated margin` : 'No profit data available';
        if(itemsSoldAmount) itemsSoldAmount.textContent = Math.round(totals.itemsSold).toLocaleString();
        if(itemsSoldDetails) itemsSoldDetails.textContent = `${totals.itemsSold ? 'Filtered period quantity' : 'No item sales'}`;
        if(invoiceCountAmount) invoiceCountAmount.textContent = totals.transactionCount.toLocaleString();
        if(invoiceCountDetails) invoiceCountDetails.textContent = `${totals.transactionCount} completed bill${totals.transactionCount !== 1 ? 's' : ''}`;
    }

    function renderSalesHistory(sales) {
        if(!salesTableBody) return;
        if (sales.length === 0) {
            salesTableBody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>No sales data available for this filter</p></div></td></tr>';
            return;
        }
        salesTableBody.innerHTML = '';
        
        sales.slice(0, 8).forEach(sale => {
            const items = saleDetailsMap.get(sale.id) || [];
            const itemCount = items.length;
            const itemsText = `${itemCount} Item${itemCount !== 1 ? 's' : ''}`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="time-cell">${formatDisplayDate(sale.timestamp)}</td>
                <td>${sale.bill_id}</td>
                <td>${escapeHtml(sale.cashier_name || '-')}</td>
                <td class="items-cell"><div class="items-list">${itemsText}</div></td>
                <td class="amount-cell">${formatCurrency(sale.total_amount)}</td>
            `;
            salesTableBody.appendChild(row);
        });
    }

    function renderTopItems(sales) {
        if (!topItemsTableBody) return;
        const allItems = getTopItems(sales, Infinity);
        const top = showAllTopItems ? allItems : allItems.slice(0, 5);

        if (!top.length) {
            topItemsTableBody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><p>No top items data for this filter</p></div></td></tr>';
            updateSeeMoreButton(topItemsSeeMoreBtn, false, false);
            return;
        }

        topItemsTableBody.innerHTML = top.map(([name, s]) => `
            <tr>
                <td class="product-name-cell">${escapeHtml(name)}</td>
                <td class="quantity-cell">${Math.round(s.qty)}</td>
                <td class="revenue-cell">${formatCurrency(s.revenue)}</td>
            </tr>
        `).join('');
        updateSeeMoreButton(topItemsSeeMoreBtn, allItems.length > 5, showAllTopItems);
    }

    function startOfDay(date) {
        const value = new Date(date);
        value.setHours(0, 0, 0, 0);
        return value;
    }

    function endOfDay(date) {
        const value = new Date(date);
        value.setHours(23, 59, 59, 999);
        return value;
    }

    function getDateBounds() {
        const now = new Date();
        if (activeDateRange === 'yesterday') {
            const day = new Date(now);
            day.setDate(day.getDate() - 1);
            return [startOfDay(day), endOfDay(day)];
        }
        if (activeDateRange === 'week') {
            const start = startOfDay(now);
            start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
            return [start, endOfDay(now)];
        }
        if (activeDateRange === 'month') {
            return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(now)];
        }
        if (activeDateRange === 'custom') {
            const start = reportStartDate?.value ? startOfDay(reportStartDate.value) : null;
            const end = reportEndDate?.value ? endOfDay(reportEndDate.value) : null;
            return [start, end];
        }
        return [startOfDay(now), endOfDay(now)];
    }

    function populateCashierFilter() {
        if (!reportCashierFilter) return;
        const selected = reportCashierFilter.value;
        const cashiers = Array.from(new Set(salesData.map((sale) => sale.cashier_name).filter(Boolean))).sort();
        reportCashierFilter.innerHTML = '<option value="">All Cashiers</option>' + cashiers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
        reportCashierFilter.value = cashiers.includes(selected) ? selected : '';
    }

    function getFilteredSales() {
        const [start, end] = getDateBounds();
        const cashier = reportCashierFilter?.value || '';
        const shift = reportShiftFilter?.value || '';
        return salesData.filter((sale) => {
            const timestamp = new Date(sale.timestamp);
            if (start && timestamp < start) return false;
            if (end && timestamp > end) return false;
            if (cashier && sale.cashier_name !== cashier) return false;
            const hour = timestamp.getHours();
            if (shift === 'morning' && (hour < 6 || hour >= 14)) return false;
            if (shift === 'evening' && (hour < 14 || hour >= 22)) return false;
            return Number(sale.voided || 0) === 0;
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    function renderSalesTrend(sales) {
        if (!salesTrendChart) return;
        const hourly = Array.from({ length: 16 }, (_, index) => ({ hour: index + 6, total: 0 }));
        sales.forEach((sale) => {
            const hour = new Date(sale.timestamp).getHours();
            const slot = hourly.find((item) => item.hour === hour);
            if (slot) slot.total += Number(sale.total_amount || 0);
        });
        const max = Math.max(...hourly.map((item) => item.total), 1);
        salesTrendChart.innerHTML = `
            <div class="trend-chart">
                ${hourly.map((item) => `
                    <div class="trend-slot" title="${String(item.hour).padStart(2, '0')}:00 - ${formatCurrency(item.total)}">
                        <div class="trend-value">${item.total ? formatCurrency(item.total).replace('LKR ', '') : ''}</div>
                        <div class="trend-track"><div class="trend-bar" style="height:${Math.max(item.total ? 8 : 2, (item.total / max) * 100)}%"></div></div>
                        <div class="trend-label">${String(item.hour).padStart(2, '0')}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderPaymentDonut(totals) {
        if (!paymentDonutChart) return;
        const total = totals.cashCollected + totals.cardPayments + totals.creditSales;
        const rows = [
            ['Cash', totals.cashCollected, '#10b981'],
            ['Card / Bank', totals.cardPayments, '#2563eb'],
            ['Credit', totals.creditSales, '#f59e0b']
        ];
        let cursor = 0;
        const gradient = rows.map(([, value, color]) => {
            const start = cursor;
            cursor += total ? (value / total) * 100 : 0;
            return `${color} ${start}% ${cursor}%`;
        }).join(', ');
        paymentDonutChart.innerHTML = `
            <div class="donut-layout">
                <div class="donut-chart" style="background:${total ? `conic-gradient(${gradient})` : '#e2e8f0'}">
                    <div class="donut-center"><strong>${total ? '100%' : '0%'}</strong><span>Payments</span></div>
                </div>
                <div class="donut-legend">
                    ${rows.map(([label, value, color]) => `
                        <div class="legend-row"><i style="background:${color}"></i><span>${label}</span><strong>${formatCurrency(value)}</strong></div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function renderStockInsights(sales) {
        if (!stockInsightList) return;
        const allRows = getStockInsightRows(sales);
        const rows = showAllStockInsights ? allRows : allRows.slice(0, 5);
        stockInsightList.innerHTML = rows.length ? rows.map((product) => {
            const low = Number(product.current_stock || 0) <= Number(product.alert_level || 0);
            return `<div class="stock-insight-row">
                <div><strong>${escapeHtml(product.name)}</strong><span>${low ? 'Low stock alert' : 'Fast moving item'}</span></div>
                <b class="${low ? 'low' : 'fast'}">${low ? `${Number(product.current_stock || 0)} left` : `${Math.round(product.velocity)} sold`}</b>
            </div>`;
        }).join('') : '<div class="empty-state"><p>No stock insights for this filter</p></div>';
        updateSeeMoreButton(stockInsightsSeeMoreBtn, allRows.length > 5, showAllStockInsights);
    }

    function updateSeeMoreButton(button, hasMore, expanded) {
        if (!button) return;
        button.hidden = !hasMore;
        button.textContent = expanded ? 'See Less' : 'See More';
        button.closest('.analysis-card')?.classList.toggle('insight-expanded', hasMore && expanded);
    }

    function generateReport() {
        const baseSales = getFilteredSales();
        currentReportSales = baseSales;

        const totals = calculateTotals(baseSales);
        updateSummaryCards(totals);
        renderSalesHistory(baseSales);
        renderTopItems(baseSales);
        renderCategoryReport(baseSales);
        renderSalesTrend(baseSales);
        renderPaymentDonut(totals);
        renderStockInsights(baseSales);
    }

    function getTopItems(sales, limit = 10) {
        const stats = new Map();
        sales.forEach((sale) => {
            const items = saleDetailsMap.get(sale.id) || [];
            items.forEach((it) => {
                const key = it.product_name || `Item #${it.product_id}`;
                const prev = stats.get(key) || { qty: 0, revenue: 0 };
                prev.qty += Number(it.quantity || 0);
                prev.revenue += Number(it.subtotal || 0);
                stats.set(key, prev);
            });
        });

        return Array.from(stats.entries())
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, limit);
    }

    function getCategoryReport(sales) {
        const productMap = new Map(productsData.map((p) => [Number(p.id), p]));
        const categoryMap = new Map(categoriesData.map((c) => [Number(c.id), c.name]));
        const productCounts = new Map();

        productsData.forEach((p) => {
            const key = Number(p.category_id || 0);
            productCounts.set(key, (productCounts.get(key) || 0) + 1);
        });

        const stats = new Map();
        sales.forEach((sale) => {
            const items = saleDetailsMap.get(sale.id) || [];
            items.forEach((it) => {
                const product = productMap.get(Number(it.product_id));
                const categoryId = Number(product?.category_id || 0);
                const name = categoryMap.get(categoryId) || 'Uncategorized';
                const prev = stats.get(categoryId) || {
                    name,
                    productCount: productCounts.get(categoryId) || 0,
                    qty: 0,
                    revenue: 0,
                    profit: 0
                };
                const qty = Number(it.quantity || 0);
                const revenue = Number(it.subtotal || 0);
                const cost = Number(it.cost_total ?? 0) || (Number(product?.cost_price || 0) * qty);
                prev.qty += qty;
                prev.revenue += revenue;
                prev.profit += revenue - cost;
                stats.set(categoryId, prev);
            });
        });

        return Array.from(stats.values())
            .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
    }

    function renderCategoryReport(sales) {
        if (!categoryReportTableBody) return;
        const rows = getCategoryReport(sales);

        if (!rows.length) {
            categoryReportTableBody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>No category report data for this filter</p></div></td></tr>';
            return;
        }

        categoryReportTableBody.innerHTML = rows.map((row) => `
            <tr>
                <td class="product-name-cell">${escapeHtml(row.name)}</td>
                <td class="quantity-cell">${row.productCount}</td>
                <td class="quantity-cell">${Math.round(row.qty)}</td>
                <td class="revenue-cell">${escapeHtml(formatCurrency(row.revenue))}</td>
                <td class="amount-cell">${escapeHtml(formatCurrency(row.profit))}</td>
            </tr>
        `).join('');
    }

    function buildReportPdfHtml() {
        const sales = currentReportSales;
        const totals = calculateTotals(sales);
        const topItems = getTopItems(sales);
        const categoryRows = getCategoryReport(sales);
        const generatedAt = new Date();
        const reportDate = generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const reportTime = generatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const reportId = `RPT-${generatedAt.getFullYear()}${String(generatedAt.getMonth() + 1).padStart(2, '0')}${String(generatedAt.getDate()).padStart(2, '0')}-${String(generatedAt.getTime()).slice(-5)}`;

        const salesRows = sales.length
            ? sales.map((sale) => {
                const items = saleDetailsMap.get(sale.id) || [];
                return `
                    <tr>
                        <td>${escapeHtml(formatDisplayDate(sale.timestamp))}</td>
                        <td>${escapeHtml(sale.bill_id || '-')}</td>
                        <td>${escapeHtml(sale.cashier_name || '-')}</td>
                        <td class="num">${items.length}</td>
                        <td class="num">${escapeHtml(formatCurrency(sale.total_amount))}</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="5" class="empty">No sales data available</td></tr>';

        const topRows = topItems.length
            ? topItems.map(([name, stat]) => `
                <tr>
                    <td>${escapeHtml(name)}</td>
                    <td class="num">${Math.round(stat.qty)}</td>
                    <td class="num">${escapeHtml(formatCurrency(stat.revenue))}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="3" class="empty">No top item data available</td></tr>';

        const categoryReportRows = categoryRows.length
            ? categoryRows.map((row) => `
                <tr>
                    <td>${escapeHtml(row.name)}</td>
                    <td class="num">${row.productCount}</td>
                    <td class="num">${Math.round(row.qty)}</td>
                    <td class="num">${escapeHtml(formatCurrency(row.revenue))}</td>
                    <td class="num">${escapeHtml(formatCurrency(row.profit))}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="5" class="empty">No category report data available</td></tr>';

        return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>QuickPOS Reports & Analytics</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #fff; font-size: 12px; }
    .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    .muted { color: #64748b; }
    .meta { text-align: right; line-height: 1.6; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
    .card { border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; }
    .label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .value { margin-top: 6px; font-size: 18px; font-weight: 800; }
    h2 { margin: 18px 0 8px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { background: #f1f5f9; color: #334155; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
    th, td { border: 1px solid #d8dee8; padding: 8px; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .empty { text-align: center; color: #64748b; padding: 18px; }
    .footer { margin-top: 20px; border-top: 1px dashed #cbd5e1; padding-top: 10px; color: #64748b; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Reports & Analytics</h1>
      <div class="muted">QuickPOS Pro supermarket performance report</div>
    </div>
    <div class="meta">
      <div><strong>Date:</strong> ${escapeHtml(reportDate)}</div>
      <div><strong>Generated:</strong> ${escapeHtml(reportTime)}</div>
      <div><strong>Report ID:</strong> ${escapeHtml(reportId)}</div>
    </div>
  </div>
  <div class="cards">
    <div class="card"><div class="label">Total Sales</div><div class="value">${escapeHtml(formatCurrency(totals.totalSales))}</div><div class="muted">${totals.transactionCount} transactions</div></div>
    <div class="card"><div class="label">Cash Collected</div><div class="value">${escapeHtml(formatCurrency(totals.cashCollected))}</div><div class="muted">${totals.cashTransactionCount} cash transactions</div></div>
    <div class="card"><div class="label">Card/Bank Payments</div><div class="value">${escapeHtml(formatCurrency(totals.cardPayments))}</div><div class="muted">${totals.cardTransactionCount} card/bank transactions</div></div>
  </div>
  <h2>Top Selling Items</h2>
  <table>
    <thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Revenue</th></tr></thead>
    <tbody>${topRows}</tbody>
  </table>
  <h2>Category Report</h2>
  <table>
    <thead><tr><th>Category</th><th class="num">Products</th><th class="num">Qty Sold</th><th class="num">Revenue</th><th class="num">Profit</th></tr></thead>
    <tbody>${categoryReportRows}</tbody>
  </table>
  <h2>Sales Report</h2>
  <table>
    <thead><tr><th>Date</th><th>Bill ID</th><th>Cashier</th><th class="num">Items</th><th class="num">Total Amount</th></tr></thead>
    <tbody>${salesRows}</tbody>
  </table>
  <div class="footer">Generated by QuickPOS Pro</div>
</body>
</html>`;
    }

    function buildCategoryReportPdfHtml() {
        const sales = currentReportSales;
        const categoryRows = getCategoryReport(sales);
        const totals = categoryRows.reduce((acc, row) => {
            acc.products += Number(row.productCount || 0);
            acc.qty += Number(row.qty || 0);
            acc.revenue += Number(row.revenue || 0);
            acc.profit += Number(row.profit || 0);
            return acc;
        }, { products: 0, qty: 0, revenue: 0, profit: 0 });
        const topCategory = categoryRows[0];
        const generatedAt = new Date();
        const reportDate = generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const reportTime = generatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const reportId = `CAT-${generatedAt.getFullYear()}${String(generatedAt.getMonth() + 1).padStart(2, '0')}${String(generatedAt.getDate()).padStart(2, '0')}-${String(generatedAt.getTime()).slice(-5)}`;

        const categoryReportRows = categoryRows.length
            ? categoryRows.map((row, index) => {
                const revenueShare = totals.revenue ? (Number(row.revenue || 0) / totals.revenue) * 100 : 0;
                return `
                    <tr>
                        <td class="rank">${index + 1}</td>
                        <td>${escapeHtml(row.name)}</td>
                        <td class="num">${row.productCount}</td>
                        <td class="num">${Math.round(row.qty)}</td>
                        <td class="num">${escapeHtml(formatCurrency(row.revenue))}</td>
                        <td class="num">${escapeHtml(formatCurrency(row.profit))}</td>
                        <td class="num">${revenueShare.toFixed(1)}%</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="7" class="empty">No category sales data available for this report period</td></tr>';

        return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>QuickPOS Category Report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #fff; font-size: 12px; }
    .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    .muted { color: #64748b; }
    .meta { text-align: right; line-height: 1.6; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .card { border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; background: #fbfdff; }
    .label { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .value { margin-top: 6px; font-size: 17px; font-weight: 800; }
    .insight { border: 1px solid #d8dee8; border-left: 4px solid #2563eb; border-radius: 8px; padding: 12px; margin-bottom: 16px; background: #f8fbff; }
    h2 { margin: 16px 0 8px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { background: #f1f5f9; color: #334155; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
    th, td { border: 1px solid #d8dee8; padding: 8px; vertical-align: top; }
    .num, .rank { text-align: right; white-space: nowrap; }
    .rank { color: #64748b; font-weight: 700; }
    .empty { text-align: center; color: #64748b; padding: 18px; }
    .footer { margin-top: 20px; border-top: 1px dashed #cbd5e1; padding-top: 10px; color: #64748b; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Category Performance Report</h1>
      <div class="muted">QuickPOS Pro supermarket category analysis</div>
    </div>
    <div class="meta">
      <div><strong>Date:</strong> ${escapeHtml(reportDate)}</div>
      <div><strong>Generated:</strong> ${escapeHtml(reportTime)}</div>
      <div><strong>Report ID:</strong> ${escapeHtml(reportId)}</div>
    </div>
  </div>
  <div class="cards">
    <div class="card"><div class="label">Categories Sold</div><div class="value">${categoryRows.length}</div></div>
    <div class="card"><div class="label">Products</div><div class="value">${totals.products}</div></div>
    <div class="card"><div class="label">Qty Sold</div><div class="value">${Math.round(totals.qty)}</div></div>
    <div class="card"><div class="label">Revenue</div><div class="value">${escapeHtml(formatCurrency(totals.revenue))}</div></div>
  </div>
  <div class="insight">
    <strong>Top Category:</strong> ${topCategory ? escapeHtml(topCategory.name) : 'No category sales yet'}
    ${topCategory ? ` generated ${escapeHtml(formatCurrency(topCategory.revenue))} revenue with ${Math.round(topCategory.qty)} units sold.` : ''}
  </div>
  <h2>Category Breakdown</h2>
  <table>
    <thead><tr><th class="rank">#</th><th>Category</th><th class="num">Products</th><th class="num">Qty Sold</th><th class="num">Revenue</th><th class="num">Profit</th><th class="num">Revenue Share</th></tr></thead>
    <tbody>${categoryReportRows}</tbody>
  </table>
  <div class="footer">Generated by QuickPOS Pro</div>
</body>
</html>`;
    }

    function reportFilterLabel() {
        const cashier = reportCashierFilter?.selectedOptions?.[0]?.textContent || 'All Cashiers';
        const shift = reportShiftFilter?.selectedOptions?.[0]?.textContent || 'All Shifts';
        const [start, end] = getDateBounds();
        const dates = start || end
            ? `${start ? start.toLocaleDateString() : 'Start'} - ${end ? end.toLocaleDateString() : 'Today'}`
            : 'All Dates';
        return `${dates} | ${cashier} | ${shift}`;
    }

    function focusedPdfShell({ title, subtitle, cards = [], tableTitle, headers = [], rows = '', footerNote = '' }) {
        const generatedAt = new Date();
        const reportId = `RPT-${String(generatedAt.getTime()).slice(-8)}`;
        const cardHtml = cards.length ? `<div class="cards">${cards.map(([label, value]) => `
            <div class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>
        `).join('')}</div>` : '';
        const tableHtml = tableTitle ? `
            <h2>${escapeHtml(tableTitle)}</h2>
            <table>
                <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
                <tbody>${rows || `<tr><td colspan="${headers.length}" class="empty">No data available for the selected filters</td></tr>`}</tbody>
            </table>
        ` : '';
        return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; background: #fff; font-size: 12px; }
    .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 16px; }
    h1 { margin: 0 0 5px; font-size: 23px; }
    .muted { color: #64748b; line-height: 1.5; }
    .meta { text-align: right; line-height: 1.55; white-space: nowrap; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin: 15px 0; }
    .card { border: 1px solid #d8dee8; border-radius: 8px; padding: 11px; background: #fbfdff; }
    .label { color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .value { margin-top: 5px; font-size: 17px; font-weight: 800; }
    h2 { margin: 18px 0 8px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; color: #334155; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
    th, td { border: 1px solid #d8dee8; padding: 8px; vertical-align: top; }
    td:not(:first-child), th:not(:first-child) { text-align: right; }
    .empty { text-align: center !important; color: #64748b; padding: 18px; }
    .footer { margin-top: 18px; border-top: 1px dashed #cbd5e1; padding-top: 9px; color: #64748b; text-align: center; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div><h1>${escapeHtml(title)}</h1><div class="muted">${escapeHtml(subtitle)}</div><div class="muted">${escapeHtml(reportFilterLabel())}</div></div>
    <div class="meta"><div><strong>Generated:</strong> ${escapeHtml(generatedAt.toLocaleString())}</div><div><strong>Report ID:</strong> ${escapeHtml(reportId)}</div></div>
  </div>
  ${cardHtml}
  ${tableHtml}
  <div class="footer">${escapeHtml(footerNote || 'Generated by QuickPOS Pro')}</div>
</body>
</html>`;
    }

    function getStockInsightRows(sales) {
        const velocity = new Map();
        sales.forEach((sale) => (saleDetailsMap.get(sale.id) || []).forEach((item) => {
            velocity.set(Number(item.product_id), (velocity.get(Number(item.product_id)) || 0) + Number(item.quantity || 0));
        }));
        return productsData
            .map((product) => ({ ...product, velocity: velocity.get(Number(product.id)) || 0 }))
            .filter((product) => Number(product.current_stock || 0) <= Number(product.alert_level || 0) || product.velocity > 0)
            .sort((a, b) => {
                const aLow = Number(a.current_stock || 0) <= Number(a.alert_level || 0) ? 1 : 0;
                const bLow = Number(b.current_stock || 0) <= Number(b.alert_level || 0) ? 1 : 0;
                return bLow - aLow || b.velocity - a.velocity;
            });
    }

    function buildFocusedReportPdfHtml(type) {
        const sales = currentReportSales;
        const totals = calculateTotals(sales);
        if (type === 'summary') {
            return focusedPdfShell({
                title: 'Sales Summary Report',
                subtitle: 'Revenue, profit and payment overview',
                cards: [
                    ['Total Sales', formatCurrency(totals.totalSales)],
                    ['Net Profit', formatCurrency(totals.netProfit)],
                    ['Cash', formatCurrency(totals.cashCollected)],
                    ['Card / Bank', formatCurrency(totals.cardPayments)],
                    ['Credit Sales', formatCurrency(totals.creditSales)],
                    ['Invoices', String(totals.transactionCount)],
                    ['Items Sold', String(Math.round(totals.itemsSold))]
                ]
            });
        }
        if (type === 'cashier') {
            const cashierStats = new Map();
            sales.forEach((sale) => {
                const name = sale.cashier_name || 'Unknown Cashier';
                const stat = cashierStats.get(name) || { invoices: 0, items: 0, sales: 0, profit: 0 };
                stat.invoices += 1;
                stat.sales += Number(sale.total_amount || 0);
                stat.profit += Number(sale.gross_profit || 0);
                stat.items += (saleDetailsMap.get(sale.id) || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                cashierStats.set(name, stat);
            });
            const rows = Array.from(cashierStats.entries()).map(([name, stat]) => `
                <tr><td>${escapeHtml(name)}</td><td>${stat.invoices}</td><td>${Math.round(stat.items)}</td><td>${escapeHtml(formatCurrency(stat.sales))}</td><td>${escapeHtml(formatCurrency(stat.profit))}</td></tr>
            `).join('');
            return focusedPdfShell({ title: 'Cashier / Shift Report', subtitle: 'Filtered cashier performance summary', cards: [['Total Sales', formatCurrency(totals.totalSales)], ['Invoices', String(totals.transactionCount)], ['Items Sold', String(Math.round(totals.itemsSold))]], tableTitle: 'Cashier Performance', headers: ['Cashier', 'Invoices', 'Items', 'Sales', 'Profit'], rows });
        }
        if (type === 'products') {
            const rows = getTopItems(sales).map(([name, stat], index) => `<tr><td>${index + 1}. ${escapeHtml(name)}</td><td>${Math.round(stat.qty)}</td><td>${escapeHtml(formatCurrency(stat.revenue))}</td></tr>`).join('');
            return focusedPdfShell({ title: 'Top Products Report', subtitle: 'Best selling products for the selected period', cards: [['Items Sold', String(Math.round(totals.itemsSold))], ['Revenue', formatCurrency(totals.totalSales)]], tableTitle: 'Top Selling Products', headers: ['Product', 'Qty Sold', 'Revenue'], rows });
        }
        if (type === 'stock') {
            const rows = getStockInsightRows(sales).map((product) => {
                const low = Number(product.current_stock || 0) <= Number(product.alert_level || 0);
                return `<tr><td>${escapeHtml(product.name)}</td><td>${low ? 'Low Stock' : 'Fast Moving'}</td><td>${Number(product.current_stock || 0)}</td><td>${Number(product.alert_level || 0)}</td><td>${Math.round(product.velocity)}</td></tr>`;
            }).join('');
            return focusedPdfShell({ title: 'Stock Insights Report', subtitle: 'Low stock alerts and fast-moving items', tableTitle: 'Stock Insights', headers: ['Product', 'Insight', 'Stock', 'Alert Level', 'Qty Sold'], rows });
        }
        if (type === 'invoices') {
            const rows = sales.map((sale) => `<tr><td>${escapeHtml(formatDisplayDate(sale.timestamp))}</td><td>${escapeHtml(sale.bill_id || '-')}</td><td>${escapeHtml(sale.cashier_name || '-')}</td><td>${escapeHtml(sale.payment_method || '-')}</td><td>${escapeHtml(formatCurrency(sale.total_amount))}</td></tr>`).join('');
            return focusedPdfShell({ title: 'Invoice Report', subtitle: 'Filtered invoice register', cards: [['Invoices', String(totals.transactionCount)], ['Total Sales', formatCurrency(totals.totalSales)]], tableTitle: 'Invoices', headers: ['Date', 'Bill ID', 'Cashier', 'Payment', 'Total'], rows });
        }
        return buildCategoryReportPdfHtml();
    }

    async function exportFocusedReportPdf(type, button) {
        const originalText = button?.innerHTML || '';
        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="material-symbols-rounded s18">hourglass_empty</span> Saving...';
            }
            const now = new Date();
            const result = await window.api.exportReportPdf({
                mode: 'download',
                fileName: `quickpos-${type}-report-${now.toISOString().slice(0, 10)}`,
                html: buildFocusedReportPdfHtml(type)
            });
            if (!result.success && !result.cancelled) alert('Could not create report PDF.');
        } catch (err) {
            console.error('Focused report PDF export failed:', err);
            alert('Report PDF export failed: ' + err.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
            }
            document.querySelector('.export-menu')?.removeAttribute('open');
        }
    }

    async function exportReportPdf(mode) {
        const button = mode === 'view' ? viewReportPdfBtn : downloadReportPdfBtn;
        const originalText = button ? button.innerHTML : '';
        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = `<span class="material-symbols-rounded s18">hourglass_empty</span> ${mode === 'view' ? 'Opening...' : 'Saving...'}`;
            }

            const now = new Date();
            const fileName = `quickpos-reports-${now.toISOString().slice(0, 10)}`;
            const result = await window.api.exportReportPdf({
                mode,
                fileName,
                html: buildReportPdfHtml()
            });

            if (!result.success && !result.cancelled) {
                alert('Could not create report PDF.');
            }
        } catch (err) {
            console.error('Report PDF export failed:', err);
            alert('Report PDF export failed: ' + err.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
            }
        }
    }

    async function exportCategoryReportPdf() {
        const originalText = downloadCategoryReportPdfBtn ? downloadCategoryReportPdfBtn.innerHTML : '';
        try {
            if (downloadCategoryReportPdfBtn) {
                downloadCategoryReportPdfBtn.disabled = true;
                downloadCategoryReportPdfBtn.innerHTML = `<span class="material-symbols-rounded s18">hourglass_empty</span> Saving...`;
            }

            const now = new Date();
            const result = await window.api.exportReportPdf({
                mode: 'download',
                fileName: `quickpos-category-report-${now.toISOString().slice(0, 10)}`,
                html: buildCategoryReportPdfHtml()
            });

            if (!result.success && !result.cancelled) {
                alert('Could not create category report PDF.');
            }
        } catch (err) {
            console.error('Category report PDF export failed:', err);
            alert('Category report PDF export failed: ' + err.message);
        } finally {
            if (downloadCategoryReportPdfBtn) {
                downloadCategoryReportPdfBtn.disabled = false;
                downloadCategoryReportPdfBtn.innerHTML = originalText;
            }
        }
    }

    function setActiveDateRange(range) {
        activeDateRange = range;
        document.querySelectorAll('.range-btn').forEach((button) => {
            button.classList.toggle('active', button.dataset.range === range);
        });
        document.querySelectorAll('.custom-date-field').forEach((field) => {
            field.classList.toggle('show', range === 'custom');
        });
        generateReport();
    }

    async function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        if (user.role !== 'owner' && !user.canViewReports) {
            alert('Access Denied: Reports permission required');
            window.location.href = user.role === 'owner' ? 'owner_dashboard.html' : 'sales.html';
            return;
        }

        Components.init({ title: 'Reports & Analytics' });
        
        await loadData();
        
        if(generateReportBtn) generateReportBtn.addEventListener('click', loadData);
        if(viewReportPdfBtn) viewReportPdfBtn.addEventListener('click', () => exportReportPdf('view'));
        if(downloadReportPdfBtn) downloadReportPdfBtn.addEventListener('click', () => exportReportPdf('download'));
        if(downloadCategoryReportPdfBtn) downloadCategoryReportPdfBtn.addEventListener('click', exportCategoryReportPdf);
        if(printReportBtn) printReportBtn.addEventListener('click', () => window.print());
        document.querySelectorAll('[data-focused-report]').forEach((button) => {
            button.addEventListener('click', () => exportFocusedReportPdf(button.dataset.focusedReport, button));
        });
        if(topItemsSeeMoreBtn) topItemsSeeMoreBtn.addEventListener('click', () => {
            showAllTopItems = !showAllTopItems;
            renderTopItems(currentReportSales);
        });
        if(stockInsightsSeeMoreBtn) stockInsightsSeeMoreBtn.addEventListener('click', () => {
            showAllStockInsights = !showAllStockInsights;
            renderStockInsights(currentReportSales);
        });
        document.querySelectorAll('.range-btn').forEach((button) => {
            button.addEventListener('click', () => setActiveDateRange(button.dataset.range || 'today'));
        });
        [reportStartDate, reportEndDate, reportCashierFilter, reportShiftFilter].forEach((field) => {
            field?.addEventListener('change', generateReport);
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
