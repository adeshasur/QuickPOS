
(function(){
  const $ = id => document.getElementById(id);
  const fmtLKR = n => 'LKR '+(+n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  /* â”€â”€ SIDEBAR â”€â”€ */
  function isMob(){ return window.innerWidth < 768; }
  $('menuBtn').addEventListener('click',()=>{
    const sb=$('sidebar');
    if(isMob()){ sb.classList.toggle('open'); $('sidebarOverlay').classList.toggle('open',sb.classList.contains('open')); }
    else if(window.innerWidth<1024) sb.classList.toggle('open-desk');
    else sb.classList.toggle('collapsed');
  });
  $('sidebarOverlay').addEventListener('click',()=>{ $('sidebar').classList.remove('open'); $('sidebarOverlay').classList.remove('open'); });
  $('logoutBtn').addEventListener('click',()=>{ if(confirm('Logout?')) window.location.href='login.html'; });

  /* â”€â”€ SALES DATA â”€â”€ */
  const SALES = [
    { id:'INV-1043', date:'2026-04-16', time:'3:12 PM', method:'Cash',
      items:[{name:'Chicken Rice',qty:2,price:1200},{name:'Iced Coffee',qty:1,price:600}],
      cashReceived:3500 },
    { id:'INV-1042', date:'2026-04-16', time:'3:08 PM', method:'Bank',
      items:[{name:'Cheese Pizza',qty:1,price:1200},{name:'French Fries',qty:2,price:550},{name:'Fruit Juice',qty:1,price:500}],
      cashReceived:null },
    { id:'INV-1041', date:'2026-04-16', time:'2:40 PM', method:'Cash',
      items:[{name:'Ice Cream',qty:2,price:400},{name:'Cookies',qty:1,price:300}],
      cashReceived:1200 },
    { id:'INV-1040', date:'2026-04-16', time:'2:20 PM', method:'Bank',
      items:[{name:'Bread Roll',qty:3,price:150},{name:'Tea',qty:2,price:200}],
      cashReceived:null },
    { id:'INV-1039', date:'2026-04-16', time:'1:55 PM', method:'Cash',
      items:[{name:'Chicken Rice',qty:1,price:1200},{name:'Fruit Juice',qty:2,price:500}],
      cashReceived:2500 },
    { id:'INV-1038', date:'2026-04-16', time:'1:30 PM', method:'Cash',
      items:[{name:'Iced Coffee',qty:3,price:600},{name:'Cookies',qty:2,price:300}],
      cashReceived:2500 },
    { id:'INV-1037', date:'2026-04-15', time:'4:45 PM', method:'Bank',
      items:[{name:'Cheese Pizza',qty:2,price:1200},{name:'French Fries',qty:1,price:550}],
      cashReceived:null },
    { id:'INV-1036', date:'2026-04-15', time:'4:10 PM', method:'Cash',
      items:[{name:'Tea',qty:4,price:200},{name:'Bread Roll',qty:5,price:150}],
      cashReceived:2000 },
    { id:'INV-1035', date:'2026-04-15', time:'3:22 PM', method:'Bank',
      items:[{name:'Chicken Rice',qty:3,price:1200},{name:'Iced Coffee',qty:2,price:600}],
      cashReceived:null },
    { id:'INV-1034', date:'2026-04-14', time:'2:10 PM', method:'Cash',
      items:[{name:'Ice Cream',qty:3,price:400},{name:'Fruit Juice',qty:1,price:500}],
      cashReceived:2000 },
    { id:'INV-1033', date:'2026-04-14', time:'1:05 PM', method:'Bank',
      items:[{name:'Cheese Pizza',qty:1,price:1200},{name:'Tea',qty:2,price:200}],
      cashReceived:null },
    { id:'INV-1032', date:'2026-04-13', time:'5:00 PM', method:'Cash',
      items:[{name:'Chicken Rice',qty:2,price:1200},{name:'French Fries',qty:2,price:550},{name:'Iced Coffee',qty:2,price:600}],
      cashReceived:5000 },
  ];

  // add computed total
  SALES.forEach(s=>{ s.total=s.items.reduce((sum,i)=>sum+i.price*i.qty,0); });

  const total = s => s.total;
  let currentDate = 'today';
  let searchQ = '';

  /* â”€â”€ DATE FILTER â”€â”€ */
  window.setDateTab = function(btn){
    document.querySelectorAll('.dtab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentDate = btn.dataset.d;
    renderTable();
  };

  function filterByDate(sale){
    const today = new Date().toISOString().split('T')[0];
    const d = new Date(today);
    if(currentDate==='today') return sale.date===today;
    if(currentDate==='week'){
      const w = new Date(d); w.setDate(d.getDate()-6);
      return sale.date>=w.toISOString().split('T')[0];
    }
    if(currentDate==='month'){
      return sale.date.slice(0,7)===today.slice(0,7);
    }
    return true;
  }

  /* â”€â”€ RENDER TABLE â”€â”€ */
  function renderTable(){
    const pay = $('payFilter').value;
    searchQ = $('searchInput').value.trim().toLowerCase();

    let list = SALES.filter(s=>{
      if(!filterByDate(s)) return false;
      if(pay && s.method!==pay) return false;
      if(searchQ){
        const hit = s.id.toLowerCase().includes(searchQ)
          || s.items.some(i=>i.name.toLowerCase().includes(searchQ));
        if(!hit) return false;
      }
      return true;
    });

    // summary
    const totalAmt = list.reduce((s,x)=>s+x.total,0);
    const cashAmt  = list.filter(x=>x.method==='Cash').reduce((s,x)=>s+x.total,0);
    const bankAmt  = list.filter(x=>x.method==='Bank').reduce((s,x)=>s+x.total,0);
    $('summaryRow').innerHTML = `
      <div class="sum-pill">${list.length} sale${list.length!==1?'s':''}</div>
      <div class="sum-pill">Total <span class="val green">${fmtLKR(totalAmt)}</span></div>
      <div class="sum-pill">Cash <span class="val">${fmtLKR(cashAmt)}</span></div>
      <div class="sum-pill">Bank <span class="val">${fmtLKR(bankAmt)}</span></div>
    `;

    if(!list.length){
      $('salesBody').innerHTML='';
      $('emptyState').style.display='flex';
      return;
    }
    $('emptyState').style.display='none';

    $('salesBody').innerHTML = list.map(s=>{
      const itemSummary = s.items.length===1
        ? s.items[0].name
        : s.items[0].name+' + '+(s.items.length-1)+' more';
      return `<tr onclick="openReceipt('${s.id}')">
        <td><span class="inv-id">${s.id}</span></td>
        <td class="muted hide-mob">${s.date} Â· ${s.time}</td>
        <td class="muted hide-mob">${itemSummary}</td>
        <td>
          <span class="pay-badge ${s.method==='Cash'?'cash':'bank'}">
            ${s.method==='Cash'
              ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>`
              : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`}
            ${s.method}
          </span>
        </td>
        <td class="r amount-cell">${fmtLKR(s.total)}</td>
        <td class="r">
          <button class="row-btn" onclick="event.stopPropagation();openReceipt('${s.id}')" title="View & Print">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  /* â”€â”€ RECEIPT MODAL â”€â”€ */
  window.openReceipt = function(id){
    const s = SALES.find(x=>x.id===id); if(!s) return;
    $('receiptTitle').textContent = id;

    const change = s.method==='Cash' && s.cashReceived ? s.cashReceived - s.total : null;

    $('receiptBody').innerHTML = `
      <div class="receipt-shop">
        <div class="receipt-shop-name">Sithara's CafÃ©</div>
        <div class="receipt-shop-sub">EzPOS.lk Â· Thank you for your visit!</div>
      </div>

      <div class="receipt-meta">
        <div class="receipt-meta-item">
          <div class="lbl">Invoice</div>
          <div class="val">${s.id}</div>
        </div>
        <div class="receipt-meta-item">
          <div class="lbl">Date</div>
          <div class="val">${s.date}</div>
        </div>
        <div class="receipt-meta-item">
          <div class="lbl">Time</div>
          <div class="val">${s.time}</div>
        </div>
        <div class="receipt-meta-item">
          <div class="lbl">Payment</div>
          <div class="val">${s.method}</div>
        </div>
      </div>

      <div class="receipt-items">
        ${s.items.map(i=>`
          <div class="receipt-item">
            <div class="ri-qty">${i.qty}</div>
            <div class="ri-name">
              ${i.name}
              <div class="ri-unit">${fmtLKR(i.price)} Ã— ${i.qty}</div>
            </div>
            <div class="ri-total">${fmtLKR(i.price*i.qty)}</div>
          </div>`).join('')}
      </div>

      <div class="receipt-total-box">
        <span class="rt-lbl">Total</span>
        <span class="rt-val">${fmtLKR(s.total)}</span>
      </div>

      ${s.method==='Cash' ? `
        <div class="receipt-pay-row">
          <span class="lbl">Cash Received</span>
          <span class="val">${fmtLKR(s.cashReceived||s.total)}</span>
        </div>
        <div class="receipt-pay-row">
          <span class="lbl">Change</span>
          <span class="val" style="color:var(--success);">${fmtLKR(change||0)}</span>
        </div>` : `
        <div class="receipt-pay-row">
          <span class="lbl">Bank / Card Payment</span>
          <span class="val" style="color:var(--primary);">Paid</span>
        </div>`}

      <div class="receipt-footer">Ez POS Â· Powered by Fides.M</div>
    `;

    $('receiptModal').classList.add('active');
  };

  window.closeReceipt = function(){ $('receiptModal').classList.remove('active'); };

  /* close on bg click */
  $('receiptModal').addEventListener('click',e=>{ if(e.target===$('receiptModal')) closeReceipt(); });

  /* â”€â”€ PRINT â”€â”€ */
  window.printReceipt = function(){
    $('printArea').innerHTML = $('receiptBody').innerHTML;
    $('printArea').classList.remove('receipt-print');
    $('printArea').style.display='block';
    window.print();
    setTimeout(()=>{ $('printArea').style.display='none'; },500);
  };

  /* â”€â”€ SEARCH â”€â”€ */
  $('searchInput').addEventListener('input', ()=>renderTable());

  /* â”€â”€ TOAST â”€â”€ */
  function showToast(msg){
    $('toastMsg').textContent=msg;
    $('toast').classList.add('show');
    setTimeout(()=>$('toast').classList.remove('show'),3000);
  }

  /* â”€â”€ INIT â”€â”€ */
  // default to today tab â€” but since demo data has today's date, show "All" to see everything
  document.querySelector('.dtab[data-d="all"]').click();

})();

