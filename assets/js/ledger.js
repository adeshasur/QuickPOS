(function() {
    'use strict';

    const formatCurrency = (amt) => `LKR ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let creditBills = [];
    let customers = [];
    let currentTab = 'pending';
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

    async function loadData() {
        try {
            const allSales = await window.api.getSalesHistory();
            customers = await window.api.getCustomers();
            
            // Filter only credit sales
            // Note: In our current logic, balance_amount for Credit sales stores the "Remaining Due"
            creditBills = allSales.filter(s => s.payment_method === 'Credit');
            
            renderLedger();
        } catch (err) {
            console.error('Error loading ledger data:', err);
        }
    }

    function renderLedger() {
        if (!tableBody) return;

        const filtered = creditBills.filter(b => {
            const isSettled = (b.balance_amount || 0) <= 0;
            return currentTab === 'pending' ? !isSettled : isSettled;
        });

        filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

        let totalOutstanding = creditBills.reduce((acc, b) => acc + (b.balance_amount > 0 ? b.balance_amount : 0), 0);
        if (totalOutstandingSpan) totalOutstandingSpan.innerText = formatCurrency(totalOutstanding);

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;">No ${currentTab} bills</td></tr>`;
            return;
        }

        tableBody.innerHTML = filtered.map(bill => {
            const customer = customers.find(c => c.id === bill.customer_id);
            const statusClass = (bill.balance_amount || 0) <= 0 ? 'settled' : '';
            const statusText = (bill.balance_amount || 0) <= 0 ? 'SETTLED' : 'PENDING';
            
            return `<tr>
                <td>${new Date(bill.timestamp).toLocaleDateString()}</td>
                <td><strong>#${bill.bill_id}</strong></td>
                <td>${customer ? customer.name : 'Unknown Customer'}</td>
                <td>${formatCurrency(bill.total_amount)}</td>
                <td>${formatCurrency(bill.balance_amount)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        ${bill.balance_amount > 0 ? `
                        <button class="action-btn pay-btn" data-id="${bill.id}" title="Pay Now">
                            <span class="material-symbols-rounded s18">payments</span>
                        </button>` : ''}
                        <button class="action-btn print-btn" data-id="${bill.id}" title="Print Bill">
                            <span class="material-symbols-rounded s18">print</span>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // Attach events
        document.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', () => openPaymentModal(btn.dataset.id));
        });
        document.querySelectorAll('.print-btn').forEach(btn => {
            btn.addEventListener('click', () => openReceipt(btn.dataset.id));
        });
    }

    function openPaymentModal(id) {
        const bill = creditBills.find(b => b.id == id);
        if (!bill) return;
        selectedBillForPayment = bill;
        modalBillId.innerText = `#${bill.bill_id}`;
        modalRemaining.innerText = formatCurrency(bill.balance_amount);
        paymentAmount.value = bill.balance_amount.toFixed(2);
        paymentModal.classList.add('active');
    }

    function closeModal() {
        paymentModal.classList.remove('active');
        selectedBillForPayment = null;
        if (paymentAmount) paymentAmount.value = '';
    }

    async function handleConfirmPayment() {
        if (!selectedBillForPayment) return;
        const amountReceived = parseFloat(paymentAmount.value);
        if (isNaN(amountReceived) || amountReceived <= 0) {
            alert('Enter valid amount');
            return;
        }

        if (amountReceived > selectedBillForPayment.balance_amount) {
            alert(`Amount exceeds remaining balance (${formatCurrency(selectedBillForPayment.balance_amount)})`);
            return;
        }

        try {
            // In a real app, we'd have an API like window.api.updateSaleBalance
            // For now, we'll alert that this needs backend implementation or we can try to use saveSale if it supports updates
            // But let's assume we need a new API.
            const result = await window.api.recordCreditPayment({ saleId: selectedBillForPayment.id, amount: amountReceived });
            selectedBillForPayment.balance_amount = result.remainingBalance;
            await loadData();
            closeModal();
        } catch (err) {
            alert('Error processing payment: ' + err.message);
        }
    }

    async function openReceipt(id) {
        const bill = creditBills.find(b => b.id == id);
        if (!bill) return;

        try {
            const items = await window.api.getSaleDetails(id);
            const area = document.getElementById('print-area');
            if (!area) return;

            const itemsHtml = items.map(i => {
                const qty = Number(i.quantity);
                const formattedQty = qty % 1 === 0 ? qty : qty.toFixed(2);
                const itemTotal = (Number(i.unit_price) * qty).toLocaleString('en-US', { minimumFractionDigits: 2 });
                
                return `
                    <tr class="rt-item-row">
                        <td colspan="2">${i.product_name}</td>
                        <td class="rt-price">${itemTotal}</td>
                    </tr>
                    <tr class="rt-detail-row">
                        <td colspan="3">${formattedQty} x ${Number(i.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `;
            }).join('');


            area.innerHTML = `
                <div class="receipt">
                    <div class="receipt-header">
                        <div class="receipt-logo">QuickPOS Supermarket</div>
                        <div class="receipt-info">
                            No. 45/A, Galle Road, Colombo 03<br>
                            Tel: 011 234 5678 | 077 123 4567<br>
                        </div>
                    </div>

                    <div class="receipt-divider"></div>

                    <div class="receipt-meta">
                        <div><strong>TAX INVOICE (COPY)</strong></div>
                        <div>Date: ${new Date(bill.timestamp).toLocaleDateString()} | Time: ${new Date(bill.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div>No: <strong>${bill.bill_id}</strong> | Staff: ${bill.cashier_name || 'Sunil Perera'}</div>
                    </div>

                    <div class="receipt-divider"></div>

                    <table class="receipt-table">
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <div class="receipt-divider double"></div>

                    <div class="receipt-totals">
                        <div class="total-row grand-total">
                            <span>NET TOTAL</span>
                            <span>LKR ${bill.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div class="payment-info">
                        <div class="total-row">
                            <span>Paid via ${bill.payment_method}</span>
                            <span>${(bill.received_amount || bill.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div class="total-row">
                            <span>Remaining Balance</span>
                            <span>${(bill.balance_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div class="receipt-footer">
                        <div class="footer-msg">ස්තූතියි! නැවත එන්න.</div>
                        <div class="footer-msg">Thank You! Come Again.</div>
                        <div class="footer-sub">Software by Antigravity Pro</div>
                        <div class="barcode-placeholder">*${bill.bill_id}*</div>
                    </div>
                </div>
            `;

            console.log('[PRINT DEBUG] openReceipt updating innerHTML. Size:', area.innerHTML.length);

            // Wait a frame for DOM to update
            requestAnimationFrame(async () => {
                console.log('[PRINT DEBUG] requestAnimationFrame fired in ledger. Invoking main process print...');
                
                // Also log printers for debugging
                const printers = await window.api.getPrinters();
                console.log('[PRINT DEBUG] Available printers:', printers);
                const defaultPrinter = printers.find(p => p.isDefault);
                console.log('[PRINT DEBUG] Default printer:', defaultPrinter ? defaultPrinter.name : 'NONE');

                const res = await window.api.printReceiptSilent();
                console.log('[PRINT DEBUG] Print result in ledger:', res);

                if (res && !res.success) {
                    alert('Print failed. Please check if your printer is connected and set as default.\nError: ' + (res.failureReason || 'Unknown error'));
                }
            });

        } catch (err) {
            console.error('Error printing receipt:', err);
            alert('Failed to print receipt: ' + err.message);
        }
    }

    function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user) { window.location.href = 'login.html'; return; }

        Components.init({ title: 'Credit Ledger' });

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

        window.addEventListener('click', (e) => {
            if (e.target === paymentModal) closeModal();
        });

        loadData();
    }

    document.addEventListener('DOMContentLoaded', init);
})();

