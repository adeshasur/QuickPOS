
        // Sample sales data - Updated to include bill ID
        let salesData = JSON.parse(localStorage.getItem('quickpos-sales')) || [
            {
                id: 1,
                billId: 'BILL-001',
                timestamp: new Date().setHours(9, 30, 0),
                items: [
                    { name: "Coffee", quantity: 2, price: 450 },
                    { name: "Tea", quantity: 1, price: 350 }
                ],
                paymentMethod: "Cash",
                total: 1250,
                received: 1500,
                balance: 250
            },
            {
                id: 2,
                billId: 'BILL-002',
                timestamp: new Date().setHours(10, 15, 0),
                items: [
                    { name: "Chocolate Cake", quantity: 1, price: 650 },
                    { name: "Cola", quantity: 2, price: 250 }
                ],
                paymentMethod: "Card/Bank",
                total: 1150
            },
            {
                id: 3,
                billId: 'BILL-003',
                timestamp: new Date().setHours(11, 45, 0),
                items: [
                    { name: "Chicken Sandwich", quantity: 2, price: 850 },
                    { name: "Mineral Water", quantity: 2, price: 200 }
                ],
                paymentMethod: "Cash",
                total: 2100,
                received: 2500,
                balance: 400
            },
            {
                id: 4,
                billId: 'BILL-004',
                timestamp: new Date().setHours(13, 20, 0),
                items: [
                    { name: "Cheese Pizza", quantity: 1, price: 1200 },
                    { name: "French Fries", quantity: 1, price: 550 },
                    { name: "Fruit Juice", quantity: 2, price: 500 }
                ],
                paymentMethod: "Card/Bank",
                total: 2750
            }
        ];

        // Sample inventory movement data
        let inventoryData = JSON.parse(localStorage.getItem('quickpos-inventory-movement')) || [
            {
                id: 1,
                timestamp: new Date().setDate(new Date().getDate() - 2),
                itemName: "Coffee Beans",
                quantityAdded: 50,
                addedBy: "Staff A"
            },
            {
                id: 2,
                timestamp: new Date().setDate(new Date().getDate() - 1),
                itemName: "Tea Leaves",
                quantityAdded: 30,
                addedBy: "Staff B"
            },
            {
                id: 3,
                timestamp: new Date().setHours(8, 0, 0),
                itemName: "Chocolate Syrup",
                quantityAdded: 20,
                addedBy: "Staff A"
            },
            {
                id: 4,
                timestamp: new Date().setHours(10, 30, 0),
                itemName: "Mineral Water",
                quantityAdded: 100,
                addedBy: "Staff C"
            }
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

        // Format currency as LKR
        function formatCurrency(amount) {
            return `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // Format date for display
        function formatDisplayDate(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }

        // Format date for print
        function formatDate(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Initialize the app
        function init() {
            setupEventListeners();
            
            // Set initial sidebar state from localStorage
            const sidebarState = localStorage.getItem('quickpos-sidebar');
            if (sidebarState === 'collapsed') {
                toggleSidebar();
            }
            
            // Load shift info
            const shiftTime = localStorage.getItem('quickpos-shift-time') || '08:00 - 16:00';
            document.getElementById('shiftInfo').textContent = `Shift: ${shiftTime}`;
            printShift.textContent = `Shift: ${shiftTime}`;
            
            // Set print date
            printDate.textContent = formatDate(new Date());
            
            // Generate initial report
            generateReport();
        }

        // Toggle sidebar between expanded and collapsed
        function toggleSidebar() {
            sidebar.classList.toggle('expanded');
            sidebar.classList.toggle('collapsed');
            logo.classList.toggle('collapsed');
            
            // Update hamburger icon
            if (sidebar.classList.contains('collapsed')) {
                hamburgerIcon.textContent = 'â†’';
                localStorage.setItem('quickpos-sidebar', 'collapsed');
            } else {
                hamburgerIcon.textContent = 'â˜°';
                localStorage.setItem('quickpos-sidebar', 'expanded');
            }
        }

        // Generate report from sales data
        function generateReport() {
            // Calculate totals
            const totals = calculateTotals(salesData);
            
            // Update summary cards
            updateSummaryCards(totals);
            
            // Render sales history table
            renderSalesHistory(salesData);
            
            // Calculate and render top items
            const topItems = calculateTopItems(salesData);
            renderTopItems(topItems);
            
            // Render inventory movement
            renderInventoryHistory(inventoryData);
            
            // Generate report ID
            const reportId = 'RPT-' + Date.now().toString().slice(-8);
            printReportId.textContent = reportId;
            
            console.log('=== Sales Report Generated ===');
            console.log('Totals:', totals);
            console.log('Top Items:', topItems);
            console.log('Inventory Movements:', inventoryData.length);
            console.log('Report ID:', reportId);
            console.log('=============================');
        }

        // Calculate totals from sales data
        function calculateTotals(sales) {
            const totals = {
                totalSales: 0,
                cashCollected: 0,
                cardPayments: 0,
                transactionCount: sales.length,
                cashTransactionCount: 0,
                cardTransactionCount: 0
            };
            
            sales.forEach(sale => {
                totals.totalSales += sale.total;
                
                if (sale.paymentMethod === 'Cash') {
                    totals.cashCollected += sale.total;
                    totals.cashTransactionCount++;
                } else if (sale.paymentMethod === 'Card/Bank') {
                    totals.cardPayments += sale.total;
                    totals.cardTransactionCount++;
                }
            });
            
            return totals;
        }

        // Calculate top selling items
        function calculateTopItems(sales) {
            const itemMap = new Map();
            
            sales.forEach(sale => {
                sale.items.forEach(item => {
                    if (itemMap.has(item.name)) {
                        const existing = itemMap.get(item.name);
                        existing.quantity += item.quantity;
                        existing.revenue += item.quantity * item.price;
                    } else {
                        itemMap.set(item.name, {
                            name: item.name,
                            quantity: item.quantity,
                            revenue: item.quantity * item.price
                        });
                    }
                });
            });
            
            // Convert to array and sort by revenue (descending)
            const itemsArray = Array.from(itemMap.values());
            itemsArray.sort((a, b) => b.revenue - a.revenue);
            
            // Return top 5 items
            return itemsArray.slice(0, 5);
        }

        // Update summary cards with totals
        function updateSummaryCards(totals) {
            // Total Sales
            totalSalesAmount.textContent = formatCurrency(totals.totalSales);
            totalSalesDetails.textContent = `${totals.transactionCount} transaction${totals.transactionCount !== 1 ? 's' : ''}`;
            
            // Cash Collected
            cashCollectedAmount.textContent = formatCurrency(totals.cashCollected);
            cashCollectedDetails.textContent = `${totals.cashTransactionCount} cash transaction${totals.cashTransactionCount !== 1 ? 's' : ''}`;
            
            // Card Payments
            cardPaymentsAmount.textContent = formatCurrency(totals.cardPayments);
            cardPaymentsDetails.textContent = `${totals.cardTransactionCount} card transaction${totals.cardTransactionCount !== 1 ? 's' : ''}`;
        }

        // Render sales history table
        function renderSalesHistory(sales) {
            if (sales.length === 0) {
                emptySalesRow.style.display = '';
                return;
            }
            
            emptySalesRow.style.display = 'none';
            salesTableBody.innerHTML = '';
            
            // Sort by timestamp (newest first)
            const sortedSales = [...sales].sort((a, b) => b.timestamp - a.timestamp);
            
            sortedSales.forEach(sale => {
                // Format items list
                const itemsList = sale.items.map(item => 
                    `${item.name} x${item.quantity}`
                ).join(', ');
                
                // Truncate if too long
                const displayItems = itemsList.length > 40 
                    ? itemsList.substring(0, 40) + '...' 
                    : itemsList;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="time-cell">${formatDisplayDate(sale.timestamp)}</td>
                    <td>${sale.billId || `BILL-${sale.id.toString().padStart(3, '0')}`}</td>
                    <td class="items-cell">
                        <div class="items-list" title="${itemsList}">${displayItems}</div>
                    </td>
                    <td class="amount-cell">${formatCurrency(sale.total)}</td>
                `;
                salesTableBody.appendChild(row);
            });
        }

        // Render top items table
        function renderTopItems(topItems) {
            if (topItems.length === 0) {
                emptyItemsRow.style.display = '';
                return;
            }
            
            emptyItemsRow.style.display = 'none';
            topItemsTableBody.innerHTML = '';
            
            topItems.forEach((item, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="product-name-cell">${item.name}</td>
                    <td class="quantity-cell">${item.quantity}</td>
                    <td class="revenue-cell">${formatCurrency(item.revenue)}</td>
                `;
                topItemsTableBody.appendChild(row);
            });
        }

        // Render inventory movement history
        function renderInventoryHistory(inventoryMovements) {
            if (inventoryMovements.length === 0) {
                emptyInventoryRow.style.display = '';
                return;
            }
            
            emptyInventoryRow.style.display = 'none';
            inventoryTableBody.innerHTML = '';
            
            // Sort by timestamp (newest first)
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

        // Print report function
        function printReport() {
            // Update print elements before printing
            const totals = calculateTotals(salesData);
            const now = new Date();
            
            printDate.textContent = formatDate(now);
            printReportId.textContent = 'RPT-' + Date.now().toString().slice(-8);
            
            // Trigger print
            window.print();
        }

        // Set up event listeners
        function setupEventListeners() {
            // Hamburger menu toggle
            hamburgerBtn.addEventListener('click', toggleSidebar);
            
            // Logout button
            logoutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
            
            // Generate report button
            generateReportBtn.addEventListener('click', generateReport);
            
            // Print report button
            printReportBtn.addEventListener('click', printReport);
        }

        // Initialize app when DOM is loaded
        document.addEventListener('DOMContentLoaded', init);

        // Security and role check
        document.addEventListener('DOMContentLoaded', () => {
            // 1. Get the user data from storage
            const user = JSON.parse(localStorage.getItem('quickpos-user'));

            // 2. Security Check: If someone tries to open the file without logging in
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            // 3. Role Check: If user is a Cashier, hide the Owner-only buttons
            if (user.role === 'cashier') {
                const ownerLinks = document.querySelectorAll('.owner-only');
                ownerLinks.forEach(link => {
                    link.style.display = 'none'; 
                });
            }

            // 4. Logout Logic
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (confirm('Do you want to logout?')) {
                        localStorage.removeItem('quickpos-user');
                        window.location.href = 'login.html';
                    }
                });
            }
        });
    
