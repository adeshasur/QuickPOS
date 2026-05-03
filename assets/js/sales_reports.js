(function() {
    'use strict';

    const $ = id => document.getElementById(id);
    const fmtLKR = n => 'LKR ' + (+n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Hardware Sales Data
    const SALES = [
        { id: 'INV-5001', date: '2026-05-03', time: '10:15 AM', method: 'Cash', 
          items: [{ name: 'S-Lon PVC Pipe 1/2"', qty: 10, price: 180 }, { name: 'PVC Elbow 1/2"', qty: 5, price: 95 }], 
          cashReceived: 3000 },
        { id: 'INV-5002', date: '2026-05-03', time: '11:30 AM', method: 'Bank', 
          items: [{ name: 'Tokyo Super Cement', qty: 2, price: 2350 }], 
          cashReceived: null },
        { id: 'INV-5003', date: '2026-05-02', time: '02:45 PM', method: 'Cash', 
          items: [{ name: 'Steel Rod 12mm', qty: 15, price: 2100 }], 
          cashReceived: 32000 }
    ];

    // Compute Totals
    SALES.forEach(s => { s.total = s.items.reduce((sum, i) => sum + i.price * i.qty, 0); });

    let currentDate = 'all';

    // Sidebar Toggle
    const hamburgerBtn = $('hamburgerBtn');
    if(hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            const sidebar = $('sidebar');
            const logo = $('logo');
            const icon = $('hamburgerIcon');
            if(sidebar && logo && icon) {
                sidebar.classList.toggle('expanded'); sidebar.classList.toggle('collapsed');
                logo.classList.toggle('collapsed');
                icon.textContent = sidebar.classList.contains('collapsed') ? '→' : '☰';
            }
        });
    }

    window.setDateTab = function(btn) {
        document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDate = btn.dataset.d;
        renderTable();
    };

    function filterByDate(sale) {
        const today = new Date().toISOString().split('T')[0];
        if (currentDate === 'today') return sale.date === today;
        if (currentDate === 'week') {
            const w = new Date(); w.setDate(w.getDate() - 7);
            return sale.date >= w.toISOString().split('T')[0];
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

        const list = SALES.filter(s => {
            if (!filterByDate(s)) return false;
            if (pay && s.method !== pay) return false;
            if (q && !(s.id.toLowerCase().includes(q) || s.items.some(i => i.name.toLowerCase().includes(q)))) return false;
            return true;
        });

        const totalAmt = list.reduce((s, x) => s + x.total, 0);
        summaryRow.innerHTML = `
            <div class="sum-pill">Bills: <span class="val">${list.length}</span></div>
            <div class="sum-pill">Total Revenue: <span class="val green">${fmtLKR(totalAmt)}</span></div>
        `;

        if (!list.length) {
            salesBody.innerHTML = ''; emptyState.style.display = 'flex'; return;
        }
        emptyState.style.display = 'none';

        salesBody.innerHTML = list.map(s => `
            <tr onclick="openReceipt('${s.id}')">
                <td><span class="inv-id">${s.id}</span></td>
                <td>${s.date} · ${s.time}</td>
                <td>${s.items[0].name}${s.items.length > 1 ? ' + ' + (s.items.length - 1) + ' more' : ''}</td>
                <td><span class="pay-badge ${s.method.toLowerCase()}">${s.method}</span></td>
                <td class="amount-cell">${fmtLKR(s.total)}</td>
                <td style="text-align:right;">
                    <button class="row-btn" onclick="event.stopPropagation(); openReceipt('${s.id}')">🖨️</button>
                </td>
            </tr>
        `).join('');
    }

    window.openReceipt = function(id) {
        const s = SALES.find(x => x.id === id); if (!s) return;
        const receiptBody = $('receiptBody');
        const receiptModal = $('receiptModal');
        if(receiptBody && receiptModal) {
            receiptBody.innerHTML = `
                <div class="receipt-shop">
                    <div class="receipt-shop-name">QuickPOS Hardware</div>
                    <div class="receipt-shop-sub">No. 123, Hardware St, City</div>
                </div>
                <div class="receipt-meta">
                    <div>Invoice: ${s.id}</div>
                    <div>Date: ${s.date} ${s.time}</div>
                    <div>Payment: ${s.method}</div>
                </div>
                <div class="receipt-items">
                    ${s.items.map(i => `<div class="receipt-item"><span>${i.qty} x ${i.name}</span><span>${fmtLKR(i.price * i.qty)}</span></div>`).join('')}
                </div>
                <div class="receipt-total-box"><span>TOTAL</span><span>${fmtLKR(s.total)}</span></div>
                <div style="text-align:center; margin-top:20px; font-size:12px;">Thank you for your business!</div>
            `;
            receiptModal.classList.add('active');
        }
    };

    window.closeReceipt = function() { 
        const receiptModal = $('receiptModal');
        if(receiptModal) receiptModal.classList.remove('active'); 
    };

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

    // Security Check
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    if (!user) { 
        window.location.href = 'login.html'; 
    }
    else {
        const cashierName = $('cashierName');
        if(cashierName) cashierName.textContent = `${user.role === 'owner' ? 'Owner' : 'Cashier'}: ${user.name}`;
        if (user.role === 'cashier') document.querySelectorAll('.owner-only').forEach(el => el.style.display = 'none');
    }

    renderTable();
})();
