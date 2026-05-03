(function() {
    'use strict';

    const $ = id => document.getElementById(id);
    const fmtLKR = n => 'LKR ' + (+n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let salesData = [];
    let currentDateFilter = 'all';

    async function loadSales() {
        try {
            salesData = await window.api.getSalesHistory();
            renderTable();
        } catch (err) {
            console.error('Error loading sales history:', err);
        }
    }

    window.setDateTab = function(btn) {
        document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDateFilter = btn.dataset.d;
        renderTable();
    };

    function filterByDate(sale) {
        const today = new Date().toISOString().split('T')[0];
        const saleDate = new Date(sale.timestamp).toISOString().split('T')[0];
        
        if (currentDateFilter === 'today') return saleDate === today;
        if (currentDateFilter === 'week') {
            const w = new Date(); w.setDate(w.getDate() - 7);
            return saleDate >= w.toISOString().split('T')[0];
        }
        return true;
    }

    function renderTable() {
        const payFilter = $('payFilter');
        const searchInput = $('searchInput');
        const salesBody = $('salesBody');
        const emptyState = $('emptyState');
        const summaryRow = $('summaryRow');

        if(!salesBody || !emptyState || !summaryRow) return;

        const pay = payFilter ? payFilter.value : '';
        const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

        const list = salesData.filter(s => {
            if (!filterByDate(s)) return false;
            if (pay && s.payment_method !== pay) return false;
            if (q && !(s.bill_id.toLowerCase().includes(q))) return false;
            return true;
        });

        const totalAmt = list.reduce((s, x) => s + x.total_amount, 0);
        summaryRow.innerHTML = `
            <div class="sum-pill">Bills: <span class="val">${list.length}</span></div>
            <div class="sum-pill">Total Revenue: <span class="val green">${fmtLKR(totalAmt)}</span></div>
        `;

        if (!list.length) {
            salesBody.innerHTML = ''; emptyState.style.display = 'flex'; return;
        }
        emptyState.style.display = 'none';

        salesBody.innerHTML = list.map(s => `
            <tr onclick="openReceipt('${s.bill_id}')">
                <td><span class="inv-id">${s.bill_id}</span></td>
                <td>${new Date(s.timestamp).toLocaleDateString()} · ${new Date(s.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td>Detailed Invoice Available</td>
                <td><span class="pay-badge ${s.payment_method.toLowerCase()}">${s.payment_method}</span></td>
                <td class="amount-cell">${fmtLKR(s.total_amount)}</td>
                <td style="text-align:right;">
                    <button class="row-btn" onclick="event.stopPropagation(); openReceipt('${s.bill_id}')">🖨️</button>
                </td>
            </tr>
        `).join('');
    }

    window.openReceipt = async function(billId) {
        const s = salesData.find(x => x.bill_id === billId); 
        if (!s) return;
        
        const receiptBody = $('receiptBody');
        const receiptModal = $('receiptModal');
        if(receiptBody && receiptModal) {
            receiptBody.innerHTML = `
                <div class="receipt-shop">
                    <div class="receipt-shop-name">QuickPOS Hardware</div>
                    <div class="receipt-shop-sub">Official Sales Receipt</div>
                </div>
                <div class="receipt-meta">
                    <div>Invoice: ${s.bill_id}</div>
                    <div>Date: ${new Date(s.timestamp).toLocaleString()}</div>
                    <div>Payment: ${s.payment_method}</div>
                    <div>Cashier: ${s.cashier_name}</div>
                </div>
                <div class="receipt-items" id="receiptItemsList">
                    <div style="text-align:center; padding:10px;">Loading items...</div>
                </div>
                <div class="receipt-total-box"><span>TOTAL</span><span>${fmtLKR(s.total_amount)}</span></div>
                <div style="text-align:center; margin-top:20px; font-size:12px;">Thank you for your business!</div>
            `;
            receiptModal.classList.add('active');

            try {
                const items = await window.api.getSaleDetails(s.id);
                const itemsList = $('receiptItemsList');
                if (itemsList) {
                    itemsList.innerHTML = items.map(i => `
                        <div class="receipt-item">
                            <span>${i.quantity} x ${i.product_name || 'Item #' + i.product_id}</span>
                            <span>${fmtLKR(i.subtotal)}</span>
                        </div>
                    `).join('');
                }
            } catch (err) {
                console.error('Error loading items:', err);
                const itemsList = $('receiptItemsList');
                if (itemsList) itemsList.innerHTML = '<div style="color:red; text-align:center;">Error loading items</div>';
            }
        }
    };

    window.closeReceipt = function() { 
        const receiptModal = $('receiptModal');
        if(receiptModal) receiptModal.classList.remove('active'); 
    };

    function init() {
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!user) { 
            window.location.href = 'login.html'; 
            return;
        }

        Components.init({ title: 'Invoice History' });

        const receiptModal = $('receiptModal');
        if(receiptModal) {
            receiptModal.addEventListener('click', e => { 
                if (e.target === receiptModal) closeReceipt(); 
            });
        }

        const printReceiptBtn = $('printReceiptBtn');
        if(printReceiptBtn) {
            printReceiptBtn.addEventListener('click', () => window.print());
        }

        const searchInput = $('searchInput');
        if(searchInput) {
            searchInput.addEventListener('input', renderTable);
        }

        loadSales();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
