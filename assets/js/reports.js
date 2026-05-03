(function() {
    'use strict';

    // Sample sales data
    let salesData = JSON.parse(localStorage.getItem('quickpos-sales')) || [
        {
            id: 1, billId: 'BILL-001', timestamp: new Date().setHours(9, 30, 0),
            items: [ { name: "Tokyo Super Cement", quantity: 2, price: 2350 }, { name: "Paint Brush 4\"", quantity: 1, price: 450 } ],
            paymentMethod: "Cash", total: 5150, received: 6000, balance: 850
        },
        {
            id: 2, billId: 'BILL-002', timestamp: new Date().setHours(10, 15, 0),
            items: [ { name: "Steel Rod 12mm", quantity: 10, price: 2100 }, { name: "Anchor Bolts 1/2\"", quantity: 20, price: 320 } ],
            paymentMethod: "Card/Bank", total: 27400
        },
        {
            id: 3, billId: 'BILL-003', timestamp: new Date().setHours(11, 45, 0),
            items: [ { name: "PVC Elbow 1/2\"", quantity: 5, price: 95 }, { name: "S-Lon PVC Pipe 1/2\"", quantity: 12, price: 180 } ],
            paymentMethod: "Cash", total: 2635, received: 3000, balance: 365
        }
    ];

    // Sample inventory movement data
    let inventoryData = JSON.parse(localStorage.getItem('quickpos-inventory-movement')) || [
        { id: 1, timestamp: new Date().setDate(new Date().getDate() - 2), itemName: "Tokyo Super Cement", quantityAdded: 50, addedBy: "Admin" },
        { id: 2, timestamp: new Date().setDate(new Date().getDate() - 1), itemName: "S-Lon PVC Pipe 1/2\"", quantityAdded: 100, addedBy: "Admin" },
        { id: 3, timestamp: new Date().setHours(8, 0, 0), itemName: "Steel Rod 12mm", quantityAdded: 20, addedBy: "Admin" }
    ];

    // DOM elements
    const sidebar = document.getElementById('sidebar');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const hamburgerIcon = document.getElementById('hamburgerIcon');
    const logo = document.getElementById('logo');
    const logoutBtn = document.getElementById('logoutBtn');
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
    
    // Print elements
    const printDate = document.getElementById('printDate');
    const printShift = document.getElementById('printShift');
    const printReportId = document.getElementById('printReportId');

    // Formatting utilities
    function formatCurrency(amount) {
        return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function formatDisplayDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + 
               date.toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' });
    }

    function formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    function toggleSidebar() {
        if(!sidebar) return;
        sidebar.classList.toggle('expanded');
        sidebar.classList.toggle('collapsed');
        if(logo) logo.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('collapsed')) {
            if(hamburgerIcon) hamburgerIcon.textContent = '→';
            localStorage.setItem('quickpos-sidebar', 'collapsed');
        } else {
            if(hamburgerIcon) hamburgerIcon.textContent = '☰';
            localStorage.setItem('quickpos-sidebar', 'expanded');
        }
    }

    function calculateTotals(sales) {
        const totals = { totalSales: 0, cashCollected: 0, cardPayments: 0, transactionCount: sales.length, cashTransactionCount: 0, cardTransactionCount: 0 };
        sales.forEach(sale => {
            totals.totalSales += sale.total;
            if (sale.paymentMethod === 'Cash') { totals.cashCollected += sale.total; totals.cashTransactionCount++; } 
            else { totals.cardPayments += sale.total; totals.cardTransactionCount++; }
        });
        return totals;
    }

    function calculateTopItems(sales) {
        const itemMap = new Map();
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (itemMap.has(item.name)) {
                    const existing = itemMap.get(item.name);
                    existing.quantity += item.quantity;
                    existing.revenue += item.quantity * item.price;
                } else {
                    itemMap.set(item.name, { name: item.name, quantity: item.quantity, revenue: item.quantity * item.price });
                }
            });
        });
        const itemsArray = Array.from(itemMap.values());
        itemsArray.sort((a, b) => b.revenue - a.revenue);
        return itemsArray.slice(0, 5);
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
        const sortedSales = [...sales].sort((a, b) => b.timestamp - a.timestamp);
        
        sortedSales.forEach(sale => {
            const itemsList = sale.items.map(item => `${item.name} x${item.quantity}`).join(', ');
            const displayItems = itemsList.length > 40 ? itemsList.substring(0, 40) + '...' : itemsList;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="time-cell">${formatDisplayDate(sale.timestamp)}</td>
                <td>${sale.billId || `BILL-${sale.id.toString().padStart(3, '0')}`}</td>
                <td class="items-cell"><div class="items-list" title="${itemsList}">${displayItems}</div></td>
                <td class="amount-cell">${formatCurrency(sale.total)}</td>
            `;
            salesTableBody.appendChild(row);
        });
    }

    function renderTopItems(topItems) {
        if(!topItemsTableBody) return;
        if (topItems.length === 0) { if(emptyItemsRow) emptyItemsRow.style.display = ''; return; }
        if(emptyItemsRow) emptyItemsRow.style.display = 'none';
        topItemsTableBody.innerHTML = '';
        
        topItems.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="product-name-cell">${item.name}</td>
                <td class="quantity-cell">${item.quantity}</td>
                <td class="revenue-cell">${formatCurrency(item.revenue)}</td>
            `;
            topItemsTableBody.appendChild(row);
        });
    }

    function renderInventoryHistory(inventoryMovements) {
        if(!inventoryTableBody) return;
        if (inventoryMovements.length === 0) { if(emptyInventoryRow) emptyInventoryRow.style.display = ''; return; }
        if(emptyInventoryRow) emptyInventoryRow.style.display = 'none';
        inventoryTableBody.innerHTML = '';
        const sortedMovements = [...inventoryMovements].sort((a, b) => b.timestamp - a.timestamp);
        
        sortedMovements.forEach(movement => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="inventory-date-cell">${formatDisplayDate(movement.timestamp)}</td>
                <td class="item-name-cell">${movement.itemName}</td>
                <td class="quantity-added-cell">+${movement.quantityAdded}</td>
            `;
            inventoryTableBody.appendChild(row);
        });
    }

    function generateReport() {
        const totals = calculateTotals(salesData);
        updateSummaryCards(totals);
        renderSalesHistory(salesData);
        
        const topItems = calculateTopItems(salesData);
        renderTopItems(topItems);
        renderInventoryHistory(inventoryData);
        
        const reportId = 'RPT-' + Date.now().toString().slice(-8);
        if(printReportId) printReportId.textContent = reportId;
    }

    function printReport() {
        if(printDate) printDate.textContent = formatDate(new Date());
        if(printReportId) printReportId.textContent = 'RPT-' + Date.now().toString().slice(-8);
        window.print();
    }

    function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Show Name instead of Shift Time for better UX
        const shiftInfo = document.getElementById('shiftInfo');
        if(shiftInfo) shiftInfo.textContent = `${user.role === 'owner' ? 'Owner' : 'Cashier'}: ${user.name}`;
        if(printShift) printShift.textContent = `Generated By: ${user.name}`;

        // Role check
        if (user.role === 'cashier') {
            document.querySelectorAll('.owner-only').forEach(link => link.style.display = 'none');
        }

        // Sidebar state
        const sidebarState = localStorage.getItem('quickpos-sidebar');
        if (sidebarState === 'collapsed') toggleSidebar();

        // Event Listeners
        if(hamburgerBtn) hamburgerBtn.addEventListener('click', toggleSidebar);
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
        }
        
        if(generateReportBtn) generateReportBtn.addEventListener('click', generateReport);
        if(printReportBtn) printReportBtn.addEventListener('click', printReport);

        if(printDate) printDate.textContent = formatDate(new Date());
        generateReport();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
