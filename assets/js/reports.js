(function() {
    'use strict';

    let salesData = [];
    let saleDetailsMap = new Map();

    // DOM elements
    const generateReportBtn = document.getElementById('generateReportBtn');
    const printReportBtn = document.getElementById('printReportBtn');
    
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
    const inventoryTableBody = document.getElementById('inventoryTableBody');
    const emptyInventoryRow = document.getElementById('emptyInventoryRow');

    function formatCurrency(amount) {
        return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

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

    async function loadData() {
        try {
            salesData = await window.api.getSalesHistory();
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
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="time-cell">${formatDisplayDate(sale.timestamp)}</td>
                <td>${sale.bill_id}</td>
                <td class="items-cell"><div class="items-list">Check detailed invoice</div></td>
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
                <td class="quantity-cell">${Number(s.qty).toFixed(2)}</td>
                <td class="revenue-cell">${formatCurrency(s.revenue)}</td>
            </tr>
        `).join('');
    }

    function renderProductActivity(sales) {
        if (!inventoryTableBody) return;

        const activity = new Map();
        sales.forEach((sale) => {
            const items = saleDetailsMap.get(sale.id) || [];
            items.forEach((it) => {
                const key = it.product_name || `Item #${it.product_id}`;
                const prev = activity.get(key) || { qty: 0, latest: sale.timestamp };
                prev.qty += Number(it.quantity || 0);
                if (new Date(sale.timestamp) > new Date(prev.latest)) prev.latest = sale.timestamp;
                activity.set(key, prev);
            });
        });

        const rows = Array.from(activity.entries())
            .sort((a, b) => new Date(b[1].latest) - new Date(a[1].latest))
            .slice(0, 15);

        if (!rows.length) {
            if (emptyInventoryRow) emptyInventoryRow.style.display = '';
            return;
        }
        if (emptyInventoryRow) emptyInventoryRow.style.display = 'none';

        inventoryTableBody.innerHTML = rows.map(([name, a]) => `
            <tr>
                <td class="inventory-date-cell">${formatDisplayDate(a.latest)}</td>
                <td class="item-name-cell">${name}</td>
                <td class="quantity-added-cell">${Number(a.qty).toFixed(2)}</td>
            </tr>
        `).join('');
    }

    function generateReport() {
        const todaySales = salesData.filter(s => isToday(s.timestamp));
        const baseSales = todaySales.length ? todaySales : salesData;

        const totals = calculateTotals(baseSales);
        updateSummaryCards(totals);
        renderSalesHistory(baseSales);
        renderTopItems(baseSales);
        renderProductActivity(baseSales);
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
        if(printReportBtn) printReportBtn.addEventListener('click', () => window.print());
    }

    document.addEventListener('DOMContentLoaded', init);
})();
