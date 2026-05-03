document.addEventListener('DOMContentLoaded', () => {
    // ---------- Security & Role Check ----------
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Set Header Name
    const cashierNameDisplay = document.getElementById('cashierNameDisplay');
    const userAvatar = document.getElementById('userAvatar');
    if (cashierNameDisplay) {
        cashierNameDisplay.textContent = `${user.role === 'owner' ? 'Owner' : 'Cashier'}: ${user.name}`;
    }
    if (userAvatar && user.name) {
        userAvatar.textContent = user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    if (user.role === 'cashier') {
        document.querySelectorAll('.owner-only').forEach(link => link.style.display = 'none');
    }

    // ---------- localStorage keys ----------
    const BILLS_KEY = 'quickpos-credit-bills';
    const CUSTOMERS_KEY = 'quickpos-customers';

    // ---------- Seed demo customers if needed ----------
    function seedCustomers() {
        let customers = localStorage.getItem(CUSTOMERS_KEY);
        if (!customers) {
            const demoCustomers = [
                { id: 1, name: 'Kamal Perera', phone: '0771234567', address: 'Colombo 03', balance: 50000.00 },
                { id: 2, name: 'Sunimal Silva', phone: '0719876543', address: 'Maharagama', balance: 0.00 },
                { id: 3, name: 'Hardware Contractor Ltd', phone: '0112233445', address: 'Kandy', balance: 25000.00 },
                { id: 4, name: 'Nimal Fernando', phone: '0765558888', address: 'Galle', balance: 1250.50 },
                { id: 5, name: 'City Builders', phone: '0114445555', address: 'Colombo', balance: 15000.00 }
            ];
            localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(demoCustomers));
        }
    }
    seedCustomers();

    // ---------- Seed bills ----------
    function seedBills() {
        let bills = localStorage.getItem(BILLS_KEY);
        if (!bills) {
            const today = new Date();
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
            const fmt = (d) => d.toISOString().split('T')[0];
            const demoBills = [
                { id: '101', date: fmt(today), customerId: 1, customerName: 'Kamal Perera', total: 5000.00, remaining: 5000.00, status: 'pending' },
                { id: '102', date: fmt(yesterday), customerId: 3, customerName: 'Hardware Contractor Ltd', total: 25000.00, remaining: 25000.00, status: 'pending' },
                { id: '103', date: '2026-02-15', customerId: 2, customerName: 'Sunimal Silva', total: 3200.00, remaining: 0.00, status: 'settled' },
                { id: '104', date: '2026-02-10', customerId: 5, customerName: 'City Builders', total: 8700.50, remaining: 8700.50, status: 'pending' }
            ];
            localStorage.setItem(BILLS_KEY, JSON.stringify(demoBills));
        }
    }
    seedBills();

    // ---------- Helpers ----------
    function getBills() { return JSON.parse(localStorage.getItem(BILLS_KEY)) || []; }
    function saveBills(bills) { localStorage.setItem(BILLS_KEY, JSON.stringify(bills)); }
    function getCustomers() { return JSON.parse(localStorage.getItem(CUSTOMERS_KEY)) || []; }
    function saveCustomers(customers) { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); }

    function updateCustomerBalance(customerId, additionalCredit) {
        let customers = getCustomers();
        const idx = customers.findIndex(c => c.id == customerId);
        if (idx !== -1) {
            customers[idx].balance = (customers[idx].balance || 0) + additionalCredit;
            saveCustomers(customers);
        }
    }

    const formatCurrency = (amt) => `LKR ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // State
    let currentTab = 'pending'; // 'pending' or 'settled'
    let selectedBillForPayment = null;

    // DOM Elements
    const tableBody = document.getElementById('tableBody');
    const totalOutstandingSpan = document.getElementById('totalOutstanding');
    const pendingTab = document.getElementById('pendingTab');
    const settledTab = document.getElementById('settledTab');
    const paymentModal = document.getElementById('paymentModal');
    const modalBillId = document.getElementById('modalBillId');
    const modalRemaining = document.getElementById('modalRemaining');
    const paymentAmount = document.getElementById('paymentAmount');
    const closePaymentModalBtn = document.getElementById('closePaymentModal');
    const cancelPaymentBtn = document.getElementById('cancelPayment');
    const confirmPaymentBtn = document.getElementById('confirmPayment');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

    // Render Table
    function renderLedger() {
        const bills = getBills();
        const filtered = bills.filter(b => b.status === currentTab);
        filtered.sort((a,b) => new Date(b.date) - new Date(a.date));

        let totalOutstanding = bills.filter(b => b.status === 'pending').reduce((acc, b) => acc + b.remaining, 0);
        totalOutstandingSpan.innerText = formatCurrency(totalOutstanding);

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;">No ${currentTab} bills</td></tr>`;
            return;
        }

        let html = '';
        filtered.forEach(bill => {
            const statusClass = bill.status === 'pending' ? '' : 'settled';
            const actionBtn = bill.status === 'pending' 
                ? `<button class="collect-btn" data-id="${bill.id}">💰 Collect</button>`
                : `<span style="color:var(--text-light);font-size:13px;">—</span>`;
            
            html += `<tr>
                <td>${bill.date}</td>
                <td><strong>#${bill.id}</strong></td>
                <td>${bill.customerName}</td>
                <td>${formatCurrency(bill.total)}</td>
                <td>${formatCurrency(bill.remaining)}</td>
                <td><span class="status-badge ${statusClass}">${bill.status.toUpperCase()}</span></td>
                <td>
                    <div class="action-btns">
                        ${actionBtn}
                        <button class="print-icon" title="Print receipt" data-id="${bill.id}" data-customer="${bill.customerName}" data-amount="${bill.remaining}" data-total="${bill.total}">🖨️</button>
                    </div>
                </td>
            </tr>`;
        });
        tableBody.innerHTML = html;

        // Attach collect events
        document.querySelectorAll('.collect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openPaymentModal(e.target.dataset.id);
            });
        });
        
        // Attach print events
        document.querySelectorAll('.print-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                printReceipt(icon.dataset.id, icon.dataset.customer, parseFloat(icon.dataset.total), parseFloat(icon.dataset.amount));
            });
        });
    }

    // Modal Logic
    function openPaymentModal(billId) {
        const bills = getBills();
        const bill = bills.find(b => b.id == billId);
        if (!bill) return;
        selectedBillForPayment = bill;
        modalBillId.innerText = `#${bill.id}`;
        modalRemaining.innerText = formatCurrency(bill.remaining);
        paymentAmount.value = bill.remaining.toFixed(2);
        paymentModal.classList.add('active');
    }

    function closeModal() {
        paymentModal.classList.remove('active');
        selectedBillForPayment = null;
        paymentAmount.value = '';
    }

    function handleConfirmPayment() {
        if (!selectedBillForPayment) return;
        const amountReceived = parseFloat(paymentAmount.value);
        if (isNaN(amountReceived) || amountReceived <= 0) {
            alert('Enter valid amount');
            return;
        }

        const bills = getBills();
        const billIndex = bills.findIndex(b => b.id == selectedBillForPayment.id);
        if (billIndex === -1) return;

        const bill = bills[billIndex];
        if (amountReceived > bill.remaining) {
            alert(`Amount exceeds remaining balance (${formatCurrency(bill.remaining)})`);
            return;
        }

        bill.remaining -= amountReceived;
        updateCustomerBalance(bill.customerId, -amountReceived); 

        if (bill.remaining === 0) {
            bill.status = 'settled';
        }
        
        saveBills(bills);
        renderLedger();
        closeModal();
    }

    // Print Receipt
    function printReceipt(billId, customerName, totalAmount, remaining) {
        const date = new Date().toLocaleString();
        const receiptHTML = `
            <div class="thermal-receipt" id="thermalReceipt">
                <div style="text-align:center; font-weight:bold; margin-bottom:12px;">⚡ QUICKPOS PRO</div>
                <div style="text-align:center;">123 Main Street, City</div>
                <div style="text-align:center;">Tel: 0112 123456</div>
                <div style="border-top:1px dashed #333; margin:12px 0;"></div>
                <div style="display:flex; justify-content:space-between;"><span>Bill #:</span><span>${billId}</span></div>
                <div style="display:flex; justify-content:space-between;"><span>Customer:</span><span>${customerName}</span></div>
                <div style="display:flex; justify-content:space-between;"><span>Date:</span><span>${date}</span></div>
                <div style="border-top:1px dashed #333; margin:12px 0;"></div>
                <div style="display:flex; justify-content:space-between;"><span>Total Bill:</span><span>${formatCurrency(totalAmount)}</span></div>
                <div style="display:flex; justify-content:space-between;"><span>Remaining:</span><span>${formatCurrency(remaining)}</span></div>
                <div style="border-top:1px dashed #333; margin:12px 0;"></div>
                <div style="text-align:center;">Thank you, come again!</div>
                <div style="text-align:center; font-size:12px; margin-top:8px;">** Receipt **</div>
            </div>
        `;
        const container = document.getElementById('thermalReceiptContainer');
        container.innerHTML = receiptHTML;
        const originalTitle = document.title;
        document.title = `Receipt_${billId}`;
        window.print();
        document.title = originalTitle;
    }

    // Event Listeners
    if(pendingTab) {
        pendingTab.addEventListener('click', () => {
            currentTab = 'pending';
            pendingTab.classList.add('active');
            settledTab.classList.remove('active');
            renderLedger();
        });
    }

    if(settledTab) {
        settledTab.addEventListener('click', () => {
            currentTab = 'settled';
            settledTab.classList.add('active');
            pendingTab.classList.remove('active');
            renderLedger();
        });
    }

    if(closePaymentModalBtn) closePaymentModalBtn.addEventListener('click', closeModal);
    if(cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closeModal);
    if(confirmPaymentBtn) confirmPaymentBtn.addEventListener('click', handleConfirmPayment);

    // Sidebar Toggle
    if(hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            const logo = document.getElementById('logo');
            const icon = document.getElementById('hamburgerIcon');
            sidebar.classList.toggle('expanded');
            sidebar.classList.toggle('collapsed');
            logo.classList.toggle('collapsed');
            
            if (sidebar.classList.contains('collapsed')) {
                icon.textContent = '→';
                localStorage.setItem('quickpos-sidebar', 'collapsed');
            } else {
                icon.textContent = '☰';
                localStorage.setItem('quickpos-sidebar', 'expanded');
            }
        });
    }

    // Check saved sidebar state
    if (localStorage.getItem('quickpos-sidebar') === 'collapsed') {
        const sidebar = document.getElementById('sidebar');
        const logo = document.getElementById('logo');
        const icon = document.getElementById('hamburgerIcon');
        if(sidebar && logo && icon) {
            sidebar.classList.remove('expanded');
            sidebar.classList.add('collapsed');
            logo.classList.add('collapsed');
            icon.textContent = '→';
        }
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Logout?')) {
                localStorage.removeItem('quickpos-user');
                window.location.href = 'login.html';
            }
        });
    }

    // Init Render
    renderLedger();

    window.addEventListener('click', (e) => {
        if (e.target === paymentModal) closeModal();
    });
});
