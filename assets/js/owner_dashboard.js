(function () {
  'use strict';

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const fmt = window.fmtLKR;
  const fmtK = window.fmtLKR;
  const fmtCurrency = (n) => window.fmtLKR(Number(n || 0));

  let sales = [];
  let saleItemsMap = new Map();
  let products = [];
  let customers = [];
  let expiredItems = [];
  let opsData = {
    suppliers: [],
    purchases: [],
    till: [],
    held: [],
    voids: [],
    returnsRows: [],
    audit: [],
    deadStock: [],
    backup: {}
  };

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
    const m = { revenue: 0, profit: 0, items: 0, tx: list.length, cash: 0, card: 0, credit: 0, hourSales: new Array(24).fill(0), catSales: new Map() };
    list.forEach((s) => {
      m.revenue += Number(s.total_amount || 0);
      const method = (s.payment_method || '').toLowerCase();
      if (method === 'cash') m.cash += Number(s.total_amount || 0);
      else if (method === 'credit') m.credit += Number(s.total_amount || 0);
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
        m.catSales.set(catName, (m.catSales.get(catName) || 0) + Number(i.subtotal || 0));
      });
    });
    m.avg = m.tx > 0 ? m.revenue / m.tx : 0;
    return m;
  }


  function renderHourChart(t, y) {
    const el = document.getElementById('hourChart');
    const labelsEl = document.getElementById('hourLabels');
    if (!el || !labelsEl) return;

    const businessHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const todayHourSales = businessHours.map(h => t.hourSales.at(h) || 0);
    const yesterdayHourSales = businessHours.map(h => y.hourSales.at(h) || 0);
    const max = Math.max(...todayHourSales, ...yesterdayHourSales, 1);
    const hoursToRender = [8, 11, 14, 17, 20];
    
    el.innerHTML = `
      <div class="chart-grid">
        <div class="grid-line"></div>
        <div class="grid-line"></div>
        <div class="grid-line"></div>
      </div>
      <div class="chart-bars">
        ${businessHours.map((h, idx) => {
          const tVal = t.hourSales.at(h) || 0;
          const yVal = y.hourSales.at(h) || 0;
          const tPct = (tVal / max) * 100;
          const yPct = (yVal / max) * 100;
          
          // Ensure a minimum visible height (e.g. 5% if there's any value, or 1% if zero)
          const tVisualPct = tVal > 0 ? Math.max(tPct, 5) : 1;
          const yVisualPct = yVal > 0 ? Math.max(yPct, 5) : 1;
          
          return `
            <div class="hbar-group">
              <div class="hbar yesterday" style="height:${escapeHTML(String(yVisualPct))}%"></div>
              <div class="hbar today" style="height:${escapeHTML(String(tVisualPct))}%"></div>
              <div class="hbar-tip">
                <strong style="display:block;margin-bottom:4px;border-bottom:1px solid var(--border);padding-bottom:4px;font-size:12px;">${escapeHTML(String(h))}:00 Interval</strong>
                <span style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:2px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--primary);display:inline-block;"></span>Today: ${escapeHTML(fmt(tVal))}</span>
                <span style="display:flex;align-items:center;gap:6px;font-weight:600;color:var(--text-light);"><span style="width:8px;height:8px;border-radius:50%;background:#cbd5e1;display:inline-block;"></span>Yest: ${escapeHTML(fmt(yVal))}</span>
              </div>
            </div>`;
        }).join('')}
      </div>
    `;

    labelsEl.innerHTML = hoursToRender.map(h => `<div class="hl">${escapeHTML(String(h))}h</div>`).join('<div style="flex:1"></div>');
  }

  function renderCatChart(m) {
    const el = document.getElementById('catChart');
    if (!el) return;

    const cats = Array.from(m.catSales.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
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
          <div class="cat-name">${escapeHTML(name)}</div>
          <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${escapeHTML(String(pct))}%;background:${escapeHTML(colors.at(i % colors.length))}"></div></div>
          <div class="cat-val">${escapeHTML(fmt(val))}</div>
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
    
    const avgEl = document.getElementById('kpiAvg');
    if (avgEl) avgEl.textContent = fmtK(m.avg);
    const txCountEl = document.getElementById('kpiTxCount');
    if (txCountEl) txCountEl.textContent = `${m.tx} transactions`;

    document.getElementById('kpiProfit').textContent = fmtK(m.profit);
    const margin = m.revenue > 0 ? Math.round((m.profit / m.revenue) * 100) : 0;
    document.getElementById('kpiProfitMargin').textContent = `${margin}% margin`;

    // Calculate system-wide Credit Receivable outstanding balance
    const totalCredit = customers.reduce((sum, c) => sum + Number(c.balance || 0), 0);
    const creditEl = document.getElementById('kpiCredit');
    if (creditEl) creditEl.textContent = fmtCurrency(totalCredit);

    // Calculate system-wide Stock Asset Valuation (stock * cost_price)
    const totalStockValue = products.reduce((sum, p) => sum + (Number(p.current_stock || 0) * Number(p.cost_price || 0)), 0);
    const stockValEl = document.getElementById('kpiStockValue');
    if (stockValEl) stockValEl.textContent = fmtCurrency(totalStockValue);

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

    // Floating absolute trend badge
    const profitTrendBadgeEl = document.getElementById('kpiProfitTrendBadge');
    if (profitTrendBadgeEl) {
      profitTrendBadgeEl.innerHTML = `
        <span class="kpi-trend-badge ${escapeHTML(diff >= 0 ? 'up' : 'down')}" title="Today: ${escapeHTML(fmtCurrency(todayProfit))} | Yesterday: ${escapeHTML(fmtCurrency(yesterdayProfit))}">
          <i class="fa-solid ${escapeHTML(diff >= 0 ? 'fa-caret-up' : 'fa-caret-down')}"></i> ${escapeHTML(pctChangeText)}
        </span>
      `;
    }

    // Symmetrical sub-text yesterday comparison
    const profitCompareTextEl = document.getElementById('kpiProfitCompareText');
    if (profitCompareTextEl) {
      profitCompareTextEl.textContent = `Yest: ${fmtCurrency(yesterdayProfit)}`;
    }

    document.getElementById('ovToday0').textContent = t.tx;
    document.getElementById('ovWeek0').textContent = w.tx;
    document.getElementById('ovToday1').textContent = fmtK(t.revenue);
    document.getElementById('ovWeek1').textContent = fmtK(w.revenue);
    document.getElementById('ovToday2').textContent = t.items;
    document.getElementById('ovWeek2').textContent = w.items;

    document.getElementById('cashPct').textContent = m.revenue ? `${Math.round((m.cash / m.revenue) * 100)}%` : '0%';
    document.getElementById('cardPct').textContent = m.revenue ? `${Math.round((m.card / m.revenue) * 100)}%` : '0%';
    const creditPctEl = document.getElementById('creditPct');
    if (creditPctEl) creditPctEl.textContent = m.revenue ? `${Math.round((m.credit / m.revenue) * 100)}%` : '0%';
    document.getElementById('cashRev').textContent = fmtK(m.cash);
    document.getElementById('cardRev').textContent = fmtK(m.card);
    const creditRevEl = document.getElementById('creditRev');
    if (creditRevEl) creditRevEl.textContent = fmtK(m.credit);
    renderControlRoom(t);
    
    // Update payment progress bars
    const cashFill = document.getElementById('cashFill');
    const cardFill = document.getElementById('cardFill');
    if (cashFill && cardFill) {
      const total = m.revenue || 1;
      cashFill.style.width = `${(m.cash / total) * 100}%`;
      cardFill.style.width = `${(m.card / total) * 100}%`;
    }

    renderHourChart(t, y);
    renderCatChart(m);
    renderSlowItems();

    const lowItems = products.filter((p) => Number(p.current_stock || 0) <= Number(p.alert_level || 0));
    document.getElementById('reorderBadge').textContent = `${lowItems.length} items`;
    document.getElementById('reorderList').innerHTML = lowItems.length
      ? lowItems.map((p) => `<div class="alert-item"><div class="alert-info"><div class="alert-name">${escapeHTML(p.name)}</div><div class="alert-meta">Stock low</div></div><span class="alert-qty warn">${escapeHTML(String(p.current_stock))} left</span></div>`).join('')
      : '<div style="text-align:center;padding:30px 0;color:var(--green)">All stock levels are healthy</div>';

    // Expired / Expiring Items Alerts populating
    const expiryBadgeEl = document.getElementById('expiryBadge');
    const expiryListEl = document.getElementById('expiryList');
    const expiryAlertCardEl = document.getElementById('expiryAlertCard');
    const expiryAlertCountEl = document.getElementById('expiryAlertCount');

    if (expiryBadgeEl) expiryBadgeEl.textContent = `${expiredItems.length} items`;
    if (expiryAlertCountEl) expiryAlertCountEl.textContent = expiredItems.length;

    if (expiredItems.length > 0) {
      if (expiryAlertCardEl) expiryAlertCardEl.style.display = 'block';
      if (expiryListEl) {
        expiryListEl.innerHTML = expiredItems.map((p) => {
          let daysLeft = 0;
          if (p.expiry_date) {
            const exp = new Date(p.expiry_date);
            const todayDate = new Date();
            todayDate.setHours(0,0,0,0);
            daysLeft = Math.ceil((exp - todayDate) / (1000 * 60 * 60 * 24));
          }
          let statusClass = daysLeft <= 0 ? 'critical' : 'warn';
          let metaText = daysLeft <= 0 ? 'Expired' : `${daysLeft} days left`;
          return `
            <div class="alert-item ${escapeHTML(statusClass)}">
              <div class="alert-info">
                <div class="alert-name">${escapeHTML(p.name)}</div>
                <div class="alert-meta">Expiry: ${escapeHTML(p.expiry_date || 'N/A')} (${escapeHTML(metaText)})</div>
              </div>
              <span class="alert-qty ${escapeHTML(statusClass)}">${escapeHTML(String(p.current_stock))} left</span>
            </div>
          `;
        }).join('');
      }
    } else {
      if (expiryAlertCardEl) expiryAlertCardEl.style.display = 'none';
      if (expiryListEl) {
        expiryListEl.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--success);font-size:13px">No expiring products in the next 30 days</div>';
      }
    }

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
            <span class="rank r${escapeHTML(i < 3 ? String(i + 1) : '')}">${escapeHTML(String(i + 1))}</span>
            <div class="item-info">
              <div class="item-name">${escapeHTML(name)}</div>
            </div>
            <div class="item-qty">${escapeHTML(String(qty))} <span style="font-size:10px;color:var(--text3)">sold</span></div>
          </div>
        `).join('')
      : '<div style="text-align:center;padding:30px 0;color:var(--text3);font-size:13px">No sales found for this period</div>';

    // Today's Cashier Performance Table Rendering
    const cashierContainer = document.getElementById('cashierPerformanceList');
    if (cashierContainer) {
      const todaySales = sales.filter((s) => inRange(s.timestamp, 'today'));
      const cashierMap = new Map();
      
      todaySales.forEach((s) => {
        const cashier = s.cashier_name || 'System';
        if (!cashierMap.has(cashier)) {
          cashierMap.set(cashier, { count: 0, revenue: 0 });
        }
        const data = cashierMap.get(cashier);
        data.count += 1;
        data.revenue += Number(s.total_amount || 0);
      });
      
      const cashierList = Array.from(cashierMap.entries()).map(([name, data]) => {
        return {
          name,
          count: data.count,
          revenue: data.revenue,
          avg: data.count > 0 ? data.revenue / data.count : 0
        };
      }).sort((a, b) => b.revenue - a.revenue);
      
      if (cashierList.length > 0) {
        cashierContainer.innerHTML = `
          <table class="cashier-performance-table">
            <thead>
              <tr>
                <th>Cashier</th>
                <th style="text-align:right">Transactions</th>
                <th style="text-align:right">Total Revenue</th>
                <th style="text-align:right">Avg Transaction</th>
              </tr>
            </thead>
            <tbody>
              ${cashierList.map((c) => {
                const initials = c.name.split(' ').map(n => n.at(0)).join('').toUpperCase().slice(0, 2);
                return `
                  <tr>
                    <td>
                      <div class="cashier-avatar-badge">
                        <div class="cashier-avatar-circle">${escapeHTML(initials)}</div>
                        <span>${escapeHTML(c.name)}</span>
                      </div>
                    </td>
                    <td style="text-align:right" class="cashier-metrics-val">${escapeHTML(String(c.count))}</td>
                    <td style="text-align:right" class="cashier-metrics-val">${escapeHTML(fmt(c.revenue))}</td>
                    <td style="text-align:right" class="cashier-metrics-val">${escapeHTML(fmt(c.avg))}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      } else {
        cashierContainer.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text3);font-size:13px">No sales recorded today.</div>';
      }
    }
  }

  function renderControlRoom(todayMetrics) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const isToday = (value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date >= todayStart;
    };

    const tillToday = (opsData.till || []).filter((row) => isToday(row.created_at));
    const tillIn = tillToday
      .filter((row) => row.movement_type === 'cash_in')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const tillOut = tillToday
      .filter((row) => row.movement_type === 'cash_out' || row.movement_type === 'petty_cash')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const expectedCash = Number(todayMetrics.cash || 0) + tillIn - tillOut;

    const todayVoids = (opsData.voids || []).filter((row) => isToday(row.created_at)).length;
    const todayReturns = (opsData.returnsRows || []).filter((row) => isToday(row.created_at)).length;
    const todayOverrides = (opsData.audit || [])
      .filter((row) => isToday(row.created_at) && /override|void|return|price_change/i.test(`${row.action || ''} ${row.entity_type || ''}`))
      .length;
    const supplierDue = (opsData.suppliers || []).reduce((sum, supplier) => sum + Number(supplier.balance || 0), 0);
    const todayGrns = (opsData.purchases || []).filter((row) => isToday(row.created_at)).length;
    const lowStockCount = products.filter((p) => Number(p.current_stock || 0) <= Number(p.alert_level || 0)).length;
    const expiryCount = expiredItems.length;
    const deadStockCount = (opsData.deadStock || []).length;
    const totalRisk = lowStockCount + expiryCount + todayVoids + todayReturns + todayOverrides;
    const healthScore = Math.max(0, Math.min(100, 100 - (expiryCount * 8) - (lowStockCount * 4) - (todayVoids * 5) - (todayReturns * 3) - (todayOverrides * 4) - (supplierDue > 0 ? 5 : 0)));

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('dashBills', Number(todayMetrics.tx || 0).toLocaleString());
    setText('dashAvgBill', fmtCurrency(todayMetrics.avg || 0));
    setText('dashCreditSales', fmtCurrency(todayMetrics.credit || 0));
    setText('dashCashSales', fmtCurrency(todayMetrics.cash || 0));
    setText('dashTillMove', `${fmtCurrency(tillIn)} / ${fmtCurrency(tillOut)}`);
    setText('dashExpectedCash', fmtCurrency(expectedCash));
    setText('dashHeldBills', String((opsData.held || []).length));
    setText('dashVoidReturns', `${todayVoids} / ${todayReturns}`);
    setText('dashOverrides', String(todayOverrides));
    setText('dashSupplierDue', fmtCurrency(supplierDue));
    setText('dashGrns', String(todayGrns));
    setText('dashBackup', opsData.backup?.lastAt ? new Date(opsData.backup.lastAt).toLocaleDateString() : (opsData.backup?.lastResult || 'Not set'));
    setText('healthScore', String(healthScore));
    const healthEl = document.getElementById('healthScore');
    const healthRing = healthEl ? healthEl.closest('.health-score') : null;
    if (healthRing) {
      const score = Math.max(0, Math.min(100, healthScore));
      const color = score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : '#dc2626';
      healthRing.style.background = `conic-gradient(${color} 0 ${score}%, #e2e8f0 ${score}% 100%)`;
      healthRing.classList.toggle('is-warning', score < 80 && score >= 60);
      healthRing.classList.toggle('is-danger', score < 60);
    }
    renderExecutiveInsights(todayMetrics, {
      totalRisk,
      lowStockCount,
      expiryCount,
      supplierDue,
      expectedCash
    });
    renderActionQueue({
      lowStockCount,
      expiryCount,
      deadStockCount,
      todayVoids,
      todayReturns,
      todayOverrides,
      supplierDue,
      backupMissing: !opsData.backup?.lastAt
    });
  }

  function renderExecutiveInsights(todayMetrics, context) {
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    const bestHourIndex = (todayMetrics.hourSales || []).reduce((best, value, index, rows) => (
      Number(value || 0) > Number(rows.at(best) || 0) ? index : best
    ), 0);
    const bestHourValue = Number((todayMetrics.hourSales || []).at(bestHourIndex) || 0);
    setText('execPeakHour', bestHourValue > 0 ? `${String(bestHourIndex).padStart(2, '0')}:00` : '--');
    setText('execPeakHourMeta', bestHourValue > 0 ? fmtCurrency(bestHourValue) : 'Waiting for sales');

    const todaySales = sales.filter((sale) => inRange(sale.timestamp, 'today'));
    const cashierMap = new Map();
    const productMap = new Map();
    todaySales.forEach((sale) => {
      const cashier = sale.cashier_name || 'System';
      const existing = cashierMap.get(cashier) || { revenue: 0, bills: 0 };
      existing.revenue += Number(sale.total_amount || 0);
      existing.bills += 1;
      cashierMap.set(cashier, existing);

      (saleItemsMap.get(sale.id) || []).forEach((item) => {
        const key = item.product_name || `Item ${item.product_id}`;
        productMap.set(key, (productMap.get(key) || 0) + Number(item.quantity || 0));
      });
    });

    const bestCashier = [...cashierMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue)[0];
    setText('execBestCashier', bestCashier ? bestCashier[0] : '--');
    setText('execBestCashierMeta', bestCashier ? `${bestCashier[1].bills} bills · ${fmtCurrency(bestCashier[1].revenue)}` : 'No bills yet');

    const bestProduct = [...productMap.entries()].sort((a, b) => b[1] - a[1])[0];
    setText('execBestProduct', bestProduct ? bestProduct[0] : '--');
    setText('execBestProductMeta', bestProduct ? `${Number(bestProduct[1]).toLocaleString()} sold today` : 'No items yet');

    let focus = 'Keep selling';
    let focusMeta = 'No urgent action';
    if (context.expiryCount > 0) {
      focus = 'Expiry review';
      focusMeta = `${context.expiryCount} items need checking`;
    } else if (context.lowStockCount > 0) {
      focus = 'Reorder stock';
      focusMeta = `${context.lowStockCount} low-stock items`;
    } else if (context.supplierDue > 0) {
      focus = 'Supplier due';
      focusMeta = fmtCurrency(context.supplierDue);
    } else if (context.expectedCash > 0) {
      focus = 'Cash close ready';
      focusMeta = fmtCurrency(context.expectedCash);
    }
    setText('execOwnerFocus', focus);
    setText('execOwnerFocusMeta', focusMeta);
  }

  function renderActionQueue(metrics) {
    const queue = document.getElementById('actionQueue');
    if (!queue) return;
    const items = [];
    if (metrics.expiryCount > 0) items.push({ level: 'danger', label: `${metrics.expiryCount} products are expired or expiring soon`, hint: 'Review expiry alerts' });
    if (metrics.lowStockCount > 0) items.push({ level: 'warn', label: `${metrics.lowStockCount} products need reorder`, hint: 'Prepare purchase order' });
    if (metrics.todayOverrides > 0) items.push({ level: 'warn', label: `${metrics.todayOverrides} sensitive actions today`, hint: 'Check audit trail' });
    if (metrics.todayVoids || metrics.todayReturns) items.push({ level: 'danger', label: `${metrics.todayVoids} voids and ${metrics.todayReturns} returns today`, hint: 'Verify cashier approvals' });
    if (metrics.supplierDue > 0) items.push({ level: 'neutral', label: `${fmtCurrency(metrics.supplierDue)} supplier due`, hint: 'Plan supplier payments' });
    if (metrics.deadStockCount > 0) items.push({ level: 'neutral', label: `${metrics.deadStockCount} dead-stock items`, hint: 'Consider discount/promotion' });
    if (metrics.backupMissing) items.push({ level: 'warn', label: 'No successful backup recorded', hint: 'Run backup today' });

    queue.innerHTML = items.length
      ? items.slice(0, 6).map((item) => `
          <div class="action-item ${escapeHTML(item.level)}">
            <span>${escapeHTML(item.label)}</span>
            <small>${escapeHTML(item.hint)}</small>
          </div>
        `).join('')
      : '<div class="action-item good"><span>Everything looks controlled</span><small>No urgent owner action right now</small></div>';
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
            <div class="slow-name">${escapeHTML(p.name)}</div>
            <div style="font-size:12px;color:var(--text3)">Stock: ${escapeHTML(String(p.current_stock))}</div>
          </div>
        `).join('')
      : '<div style="text-align:center;width:100%;padding:20px;color:var(--text3)">All items are moving well</div>';
  }



  let categories = [];
  let categoryMap = new Map();

  async function loadData() {
    const [
      salesRows,
      productRows,
      categoryRows,
      customerRows,
      expiryRows,
      supplierRows,
      purchaseRows,
      tillRows,
      heldRows,
      voidRows,
      returnRows,
      auditRows,
      deadStockRows,
      backupStatus
    ] = await Promise.all([
      window.api.getSalesHistory(),
      window.api.getProducts(),
      window.api.getCategories(),
      window.api.getCustomers(),
      window.api.getExpiredItems(),
      window.api.getSuppliers ? window.api.getSuppliers() : Promise.resolve([]),
      window.api.getPurchaseInvoices ? window.api.getPurchaseInvoices() : Promise.resolve([]),
      window.api.getTillMovements ? window.api.getTillMovements() : Promise.resolve([]),
      window.api.getHeldBills ? window.api.getHeldBills() : Promise.resolve([]),
      window.api.getVoidBills ? window.api.getVoidBills() : Promise.resolve([]),
      window.api.getReturns ? window.api.getReturns() : Promise.resolve([]),
      window.api.getAuditLog ? window.api.getAuditLog() : Promise.resolve([]),
      window.api.getDeadStockReport ? window.api.getDeadStockReport() : Promise.resolve([]),
      window.api.getGoogleDriveBackupStatus ? window.api.getGoogleDriveBackupStatus() : Promise.resolve({})
    ]);
    sales = salesRows || [];
    products = productRows || [];
    categories = categoryRows || [];
    customers = customerRows || [];
    expiredItems = expiryRows || [];
    opsData = {
      suppliers: supplierRows || [],
      purchases: purchaseRows || [],
      till: tillRows || [],
      held: heldRows || [],
      voids: voidRows || [],
      returnsRows: returnRows || [],
      audit: auditRows || [],
      deadStock: deadStockRows || [],
      backup: backupStatus || {}
    };
    categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const details = await Promise.all(sales.map((s) => window.api.getSaleDetails(s.id)));
    saleItemsMap = new Map(sales.map((s, idx) => [s.id, details.at(idx) || []]));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user || !user.role) {
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
