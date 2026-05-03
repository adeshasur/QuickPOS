(function() {
    'use strict';

    let salesData = [];
    let inventoryData = [];

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

    async function loadData() {
        try {
            salesData = await window.api.getSalesHistory();
            // Inventory movement tracking not fully implemented in DB yet, using empty or products
            inventoryData = []; 
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

    function generateReport() {
        const totals = calculateTotals(salesData);
        updateSummaryCards(totals);
        renderSalesHistory(salesData);
    }

    async function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user || user.role !== 'owner') {
            alert('Access Denied: Owner Only');
            window.location.href = user ? 'owner_dashboard.html' : 'login.html';
            return;
        }

        Components.init({ title: 'Reports & Analytics' });
        
        await loadData();
        
        if(generateReportBtn) generateReportBtn.addEventListener('click', loadData);
        if(printReportBtn) printReportBtn.addEventListener('click', () => window.print());
    }

    document.addEventListener('DOMContentLoaded', init);
})();
