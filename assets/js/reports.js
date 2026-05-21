(function() {
    'use strict';

    let salesData = [];
    let saleDetailsMap = new Map();
    let currentReportSales = [];
    let productsData = [];
    let categoriesData = [];

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
            generateReport();
        } catch (err) {
            console.error('Error loading report data:', err);
        }
    }

    function calculateTotals(sales) {
        const totals = { totalSales: 0, cashCollected: 0, cardPayments: 0, transactionCount: sales.length, cashTransactionCount: 0, cardTransactionCount: 0 };
        sales.forEach(sale => {
            totals.totalSales += sale.total_amount;
            if (sale.payment_method === 'Cash') { 
                totals.cashCollected += sale.total_amount; 
                totals.cashTransactionCount++; 
            } else { 
                totals.cardPayments += sale.total_amount; 
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
    }

    function renderSalesHistory(sales) {
        if(!salesTableBody) return;
        if (sales.length === 0) { if(emptySalesRow) emptySalesRow.style.display = ''; return; }
        if(emptySalesRow) emptySalesRow.style.display = 'none';
        salesTableBody.innerHTML = '';
        
        sales.forEach(sale => {
            const items = saleDetailsMap.get(sale.id) || [];
            const itemCount = items.length;
            const itemsText = `${itemCount} Item${itemCount !== 1 ? 's' : ''}`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="time-cell">${formatDisplayDate(sale.timestamp)}</td>
                <td>${sale.bill_id}</td>
                <td class="items-cell"><div class="items-list">${itemsText}</div></td>
                <td class="amount-cell">${formatCurrency(sale.total_amount)}</td>
            `;
            salesTableBody.appendChild(row);
        });
    }

    function renderTopItems(sales) {
        if (!topItemsTableBody) return;

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

        const top = Array.from(stats.entries())
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 10);

        if (!top.length) {
            if (emptyItemsRow) emptyItemsRow.style.display = '';
            return;
        }
        if (emptyItemsRow) emptyItemsRow.style.display = 'none';

        topItemsTableBody.innerHTML = top.map(([name, s]) => `
            <tr>
                <td class="product-name-cell">${name}</td>
                <td class="quantity-cell">${Math.round(s.qty)}</td>
                <td class="revenue-cell">${formatCurrency(s.revenue)}</td>
            </tr>
        `).join('');
    }

    function generateReport() {
        const todaySales = salesData.filter(s => isToday(s.timestamp));
        const baseSales = todaySales.length ? todaySales : salesData;
        currentReportSales = baseSales;

        const totals = calculateTotals(baseSales);
        updateSummaryCards(totals);
        renderSalesHistory(baseSales);
        renderTopItems(baseSales);
        renderCategoryReport(baseSales);
    }

    function getTopItems(sales) {
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
            .slice(0, 10);
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
            if (emptyCategoryRow) emptyCategoryRow.style.display = '';
            return;
        }
        if (emptyCategoryRow) emptyCategoryRow.style.display = 'none';

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
        const sales = currentReportSales.length ? currentReportSales : salesData;
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
        const sales = currentReportSales.length ? currentReportSales : salesData;
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
    }

    document.addEventListener('DOMContentLoaded', init);
})();
