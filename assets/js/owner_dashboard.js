(function () {
  'use strict';

  const fmt = (n) => `LKR ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtK = (n) => (Number(n) >= 1000 ? `LKR ${(Number(n) / 1000).toFixed(1)}k` : fmt(n));

  let sales = [];
  let saleItemsMap = new Map();
  let products = [];

  function inRange(date, range) {
    const d = new Date(date);
    const now = new Date();
    const start = new Date(now);

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
      return d >= start;
    }
    if (range === 'yesterday') {
      const y0 = new Date(now); y0.setDate(now.getDate() - 1); y0.setHours(0, 0, 0, 0);
      const y1 = new Date(now); y1.setDate(now.getDate() - 1); y1.setHours(23, 59, 59, 999);
      return d >= y0 && d <= y1;
    }
    if (range === 'last7') {
      start.setDate(now.getDate() - 7);
      return d >= start;
    }
    if (range === 'thisMonth') {
      start.setDate(1); start.setHours(0, 0, 0, 0);
      return d >= start;
    }
    if (range === 'lastMonth') {
      const m0 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const m1 = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return d >= m0 && d <= m1;
    }
    return true;
  }

  function getMetrics(list) {
    const m = { revenue: 0, items: 0, tx: list.length, cash: 0, card: 0, hourSales: new Array(24).fill(0), catSales: {} };
    list.forEach((s) => {
      m.revenue += Number(s.total_amount || 0);
      if ((s.payment_method || '').toLowerCase() === 'cash') m.cash += Number(s.total_amount || 0);
      else m.card += Number(s.total_amount || 0);
      const hour = new Date(s.timestamp).getHours();
      m.hourSales[hour] += Number(s.total_amount || 0);

      const items = saleItemsMap.get(s.id) || [];
      items.forEach((i) => {
        m.items += Number(i.quantity || 0);
        m.catSales.General = (m.catSales.General || 0) + Number(i.subtotal || 0);
      });
    });
    m.avg = m.tx > 0 ? m.revenue / m.tx : 0;
    return m;
  }

  function updateDashboard(range) {
    const filtered = sales.filter((s) => inRange(s.timestamp, range));
    const today = sales.filter((s) => inRange(s.timestamp, 'today'));
    const week = sales.filter((s) => inRange(s.timestamp, 'last7'));

    const m = getMetrics(filtered);
    const t = getMetrics(today);
    const w = getMetrics(week);

    document.getElementById('kpiRevenue').textContent = fmtK(m.revenue);
    document.getElementById('kpiItems').textContent = m.items;
    document.getElementById('kpiAvg').textContent = fmtK(m.avg);
    document.getElementById('kpiTxCount').textContent = `${m.tx} transactions`;

    const totalStock = products.reduce((s, p) => s + Number(p.current_stock || 0), 0);
    const low = products.filter((p) => Number(p.current_stock || 0) > 0 && Number(p.current_stock || 0) <= Number(p.alert_level || 0)).length;
    document.getElementById('kpiStock').innerHTML = `${totalStock.toLocaleString()} <span style="font-size:14px;color:var(--text3)">units</span>`;
    document.getElementById('kpiStockLow').textContent = low > 0 ? `${low} products low stock` : 'All stock levels OK';

    document.getElementById('ovToday0').textContent = t.tx;
    document.getElementById('ovWeek0').textContent = w.tx;
    document.getElementById('ovToday1').textContent = fmtK(t.revenue);
    document.getElementById('ovWeek1').textContent = fmtK(w.revenue);
    document.getElementById('ovToday2').textContent = t.items;
    document.getElementById('ovWeek2').textContent = w.items;

    document.getElementById('cashPct').textContent = m.revenue ? `${Math.round((m.cash / m.revenue) * 100)}%` : '0%';
    document.getElementById('cardPct').textContent = m.revenue ? `${Math.round((m.card / m.revenue) * 100)}%` : '0%';
    document.getElementById('cashRev').textContent = fmtK(m.cash);
    document.getElementById('cardRev').textContent = fmtK(m.card);

    const lowItems = products.filter((p) => Number(p.current_stock || 0) <= Number(p.alert_level || 0));
    document.getElementById('reorderBadge').textContent = `${lowItems.length} items`;
    document.getElementById('reorderList').innerHTML = lowItems.length
      ? lowItems.map((p) => `<div class="alert-item"><div class="alert-info"><div class="alert-name">${p.name}</div><div class="alert-meta">Stock low</div></div><span class="alert-qty warn">${p.current_stock} left</span></div>`).join('')
      : '<div style="text-align:center;padding:30px 0;color:var(--green)">All stock levels are healthy</div>';

    const productQty = new Map();
    filtered.forEach((s) => {
      (saleItemsMap.get(s.id) || []).forEach((i) => {
        productQty.set(i.product_name || `Item ${i.product_id}`, (productQty.get(i.product_name || `Item ${i.product_id}`) || 0) + Number(i.quantity || 0));
      });
    });
    const top = [...productQty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    document.getElementById('topItemsList').innerHTML = top.length
      ? top.map(([name, qty], i) => `<div class="top-item"><span class="rank">${i + 1}</span><div class="item-info"><div class="item-name">${name}</div></div><div class="item-qty">${qty} qty</div></div>`).join('')
      : '<div style="text-align:center;padding:30px 0;color:var(--text3)">No sales data</div>';
  }

  async function loadData() {
    sales = await window.api.getSalesHistory();
    products = await window.api.getProducts();
    const details = await Promise.all(sales.map((s) => window.api.getSaleDetails(s.id)));
    saleItemsMap = new Map(sales.map((s, idx) => [s.id, details[idx] || []]));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        updateDashboard(btn.dataset.range);
      });
    });

    document.getElementById('refreshBtn')?.addEventListener('click', () => {
      const active = document.querySelector('.filter-btn.active');
      updateDashboard(active ? active.dataset.range : 'today');
    });

    try {
      await loadData();
      updateDashboard('today');
    } catch (err) {
      alert(`Failed to load dashboard data: ${err.message}`);
    }
  });
})();
