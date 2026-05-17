(function () {
  'use strict';

  const fmt = (n) => `LKR ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtK = (n) => fmt(n);
  const fmtRu = (n) => `රු. ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    const m = { revenue: 0, profit: 0, items: 0, tx: list.length, cash: 0, card: 0, hourSales: new Array(24).fill(0), catSales: {} };
    list.forEach((s) => {
      m.revenue += Number(s.total_amount || 0);
      if ((s.payment_method || '').toLowerCase() === 'cash') m.cash += Number(s.total_amount || 0);
      else m.card += Number(s.total_amount || 0);
      const hour = new Date(s.timestamp).getHours();
      m.hourSales[hour] += Number(s.total_amount || 0);
  
      const items = saleItemsMap.get(s.id) || [];
      items.forEach((i) => {
        m.items += Number(i.quantity || 0);
        const p = products.find(x => x.id === i.product_id);
        
        if (p) {
          const cost = Number(p.cost_price || 0);
          const salePrice = Number(i.unit_price || 0);
          m.profit += (salePrice - cost) * Number(i.quantity || 0);
        }

        const catName = p ? categoryMap.get(p.category_id) : 'General';
        m.catSales[catName] = (m.catSales[catName] || 0) + Number(i.subtotal || 0);
      });
    });
    m.avg = m.tx > 0 ? m.revenue / m.tx : 0;
    return m;
  }


  function renderHourChart(m) {
    const el = document.getElementById('hourChart');
    const labelsEl = document.getElementById('hourLabels');
    if (!el || !labelsEl) return;

    const businessHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const hourSales = businessHours.map(h => m.hourSales[h] || 0);
    const max = Math.max(...hourSales, 1);
    const hoursToRender = [8, 11, 14, 17, 20];
    
    el.innerHTML = `
      <div class="chart-grid">
        <div class="grid-line"></div>
        <div class="grid-line"></div>
        <div class="grid-line"></div>
      </div>
      <div class="chart-bars">
        ${businessHours.map((h, idx) => {
          const val = m.hourSales[h] || 0;
          const pct = (val / max) * 100;
          const isPeak = val === max && val > 0;
          const visualPct = Math.max(pct, 8); 
          return `
            <div class="hbar ${isPeak ? 'peak' : ''} ${val === 0 ? 'low-activity' : ''}" style="height:${visualPct}%">
              <div class="hbar-tip">${h}:00 - ${fmt(val)}</div>
            </div>`;
        }).join('')}
      </div>
    `;

    labelsEl.innerHTML = hoursToRender.map(h => `<div class="hl">${h}h</div>`).join('<div style="flex:1"></div>');
  }

  function renderCatChart(m) {
    const el = document.getElementById('catChart');
    if (!el) return;

    const cats = Object.entries(m.catSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = Math.max(...cats.map(c => c[1]), 1);

    if (cats.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text3);font-size:12px">No category data</div>';
      return;
    }

    el.innerHTML = cats.map(([name, val], i) => {
      const pct = (val / max) * 100;
      const colors = ['#1D2DBF', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
      return `
        <div class="cat-row">
          <div class="cat-name">${name}</div>
          <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${pct}%;background:${colors[i % colors.length]}"></div></div>
          <div class="cat-val">${fmt(val)}</div>
        </div>
      `;
    }).join('');
  }

  function updateDashboard(range) {
    const filtered = sales.filter((s) => inRange(s.timestamp, range));
    const today = sales.filter((s) => inRange(s.timestamp, 'today'));
    const yesterday = sales.filter((s) => inRange(s.timestamp, 'yesterday'));
    const week = sales.filter((s) => inRange(s.timestamp, 'last7'));

    const m = getMetrics(filtered);
    const t = getMetrics(today);
    const y = getMetrics(yesterday);
    const w = getMetrics(week);

    document.getElementById('kpiRevenue').textContent = fmtK(m.revenue);
    document.getElementById('kpiItems').textContent = m.items;
    document.getElementById('kpiAvg').textContent = fmtK(m.avg);
    document.getElementById('kpiTxCount').textContent = `${m.tx} transactions`;

    document.getElementById('kpiProfit').textContent = fmtK(m.profit);
    const margin = m.revenue > 0 ? Math.round((m.profit / m.revenue) * 100) : 0;
    document.getElementById('kpiProfitMargin').textContent = `${margin}% profit margin`;

    // Dynamic Today vs Yesterday Profit comparison rendering
    const todayProfit = t.profit;
    const yesterdayProfit = y.profit;
    const diff = todayProfit - yesterdayProfit;
    let pctChangeText = '0.0%';
    if (yesterdayProfit > 0) {
      const pct = (diff / yesterdayProfit) * 100;
      pctChangeText = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
    } else if (todayProfit > 0) {
      pctChangeText = '+100.0%';
    } else if (todayProfit === 0 && yesterdayProfit === 0) {
      pctChangeText = '0.0%';
    } else {
      const pct = (diff / (Math.abs(yesterdayProfit) || 1)) * 100;
      pctChangeText = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
    }

    const profitCompareEl = document.getElementById('kpiProfitCompare');
    if (profitCompareEl) {
      profitCompareEl.innerHTML = `
        <div class="kpi-compare">
          <span class="compare-vals">Today: <strong>${fmtRu(todayProfit)}</strong> | Yest: <span>${fmtRu(yesterdayProfit)}</span></span>
          <span class="compare-indicator ${diff >= 0 ? 'up' : 'down'}">
            <i class="fa-solid ${diff >= 0 ? 'fa-caret-up' : 'fa-caret-down'}"></i> ${pctChangeText}
          </span>
        </div>
      `;
    }

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
    
    // Update payment progress bars
    const cashFill = document.getElementById('cashFill');
    const cardFill = document.getElementById('cardFill');
    if (cashFill && cardFill) {
      const total = m.revenue || 1;
      cashFill.style.width = `${(m.cash / total) * 100}%`;
      cardFill.style.width = `${(m.card / total) * 100}%`;
    }

    renderHourChart(m);
    renderCatChart(m);
    renderSlowItems();

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
    const top = [...productQty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('topItemsList').innerHTML = top.length
      ? top.map(([name, qty], i) => `
          <div class="top-item">
            <span class="rank r${i < 3 ? i + 1 : ''}">${i + 1}</span>
            <div class="item-info">
              <div class="item-name">${name}</div>
            </div>
            <div class="item-qty">${qty} <span style="font-size:10px;color:var(--text3)">sold</span></div>
          </div>
        `).join('')
      : '<div style="text-align:center;padding:30px 0;color:var(--text3);font-size:13px">No sales found for this period</div>';
  }


  function renderSlowItems() {
    const el = document.getElementById('slowList');
    if (!el) return;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Find products that haven't appeared in any sale in the last 3 days
    const recentSales = sales.filter(s => new Date(s.timestamp) > threeDaysAgo);
    const recentProductIds = new Set();
    recentSales.forEach(s => {
      (saleItemsMap.get(s.id) || []).forEach(i => recentProductIds.add(Number(i.product_id)));
    });

    const slow = products.filter(p => !recentProductIds.has(Number(p.id))).slice(0, 8);
    
    el.innerHTML = slow.length
      ? slow.map(p => `
          <div class="slow-item">
            <span class="slow-badge">3+ Days</span>
            <div class="slow-name">${p.name}</div>
            <div style="font-size:12px;color:var(--text3)">Stock: ${p.current_stock}</div>
          </div>
        `).join('')
      : '<div style="text-align:center;width:100%;padding:20px;color:var(--text3)">All items are moving well</div>';
  }



  let categories = [];
  let categoryMap = new Map();

  async function loadData() {
    [sales, products, categories] = await Promise.all([
      window.api.getSalesHistory(),
      window.api.getProducts(),
      window.api.getCategories()
    ]);
    categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const details = await Promise.all(sales.map((s) => window.api.getSaleDetails(s.id)));
    saleItemsMap = new Map(sales.map((s, idx) => [s.id, details[idx] || []]));
  }


  document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    if (user.role !== 'owner') {
      alert('Access Denied: Owner Only');
      window.location.href = 'sales.html';
      return;
    }

    // Dashboard-only topbar actions
    Components.init({
      title: 'Executive Dashboard',
      actions: `
        <div class="tb-filters" id="topbarFilters">
          <button class="filter-btn active" data-range="today">Today</button>
          <button class="filter-btn" data-range="yesterday">Yesterday</button>
          <button class="filter-btn" data-range="last7">7 Days</button>
          <button class="filter-btn" data-range="thisMonth">This Month</button>
          <button class="filter-btn" data-range="lastMonth">Last Month</button>
        </div>
      `
    });


    document.querySelectorAll('.filter-btn').forEach((btn) => {

      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        updateDashboard(btn.dataset.range);
      });
    });

    document.addEventListener('quickpos:refresh', async () => {
      console.log('Dashboard refreshing data...');
      await loadData();
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
