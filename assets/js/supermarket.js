(function () {
  'use strict';

  const fmt = window.fmtLKR || ((n) => `LKR ${Number(n || 0).toFixed(2)}`);
  let products = [];
  let branches = [];
  let returnSale = null;
  let stockCountLines = [];

  function userName() {
    try {
      const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
      return user.name || user.username || 'System';
    } catch {
      return 'System';
    }
  }

  function toast(message, type = 'success') {
    if (window.Notifications?.showToast) window.Notifications.showToast(message, type);
    else alert(message);
  }

  function dataChanged() {
    if (window.quickposDataChanged) window.quickposDataChanged();
  }

  function fillProductSelect(id) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">Select product</option>' + products.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  function fillBranchSelect(id, label) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = `<option value="">${label}</option>` + branches.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');
  }

  function renderReturnItems(sale) {
    const list = document.getElementById('returnItemsList');
    if (!list) return;
    if (!sale || !sale.items || !sale.items.length) {
      list.innerHTML = '<div class="ops-list-row"><span>No bill loaded</span></div>';
      return;
    }
    list.innerHTML = sale.items.map((item, index) => `
      <label class="ops-list-row return-item-row">
        <input type="checkbox" data-return-index="${index}" checked>
        <span>${item.product_name} · ${fmt(item.subtotal || 0)}</span>
        <input type="number" min="0.01" max="${Number(item.quantity || 0)}" step="0.01" value="${Number(item.quantity || 0)}" data-return-qty="${index}">
      </label>
    `).join('');
  }

  function renderStockCountLines() {
    const list = document.getElementById('stockCountLines');
    if (!list) return;
    if (!stockCountLines.length) {
      list.innerHTML = '<div class="ops-list-row"><span>No count lines</span></div>';
      return;
    }
    list.innerHTML = stockCountLines.map((line, index) => `
      <div class="ops-list-row">
        <span>${line.name} · system ${line.systemQty} · counted ${line.countedQty}</span>
        <button class="ops-btn" data-remove-count="${index}">Remove</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-remove-count]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stockCountLines.splice(Number(btn.dataset.removeCount), 1);
        renderStockCountLines();
      });
    });
  }

  async function loadSummary() {
    const [suppliers, promotions, adjustments, heldBills, voids, taxes, branches, counts, deadStock, till] = await Promise.all([
      window.api.getSuppliers(),
      window.api.getPromotions(),
      window.api.getStockAdjustments(),
      window.api.getHeldBills(),
      window.api.getVoidBills(),
      window.api.getTaxCategories(),
      window.api.getBranches(),
      window.api.getStockCounts(),
      window.api.getDeadStockReport(),
      window.api.getTillMovements()
    ]);

    document.getElementById('heldBillsList').innerHTML = heldBills.length
      ? heldBills.slice(0, 6).map((h) => `<div class="ops-list-row"><span>${h.hold_code}</span><button class="ops-btn" data-delete-hold="${h.id}">Clear</button></div>`).join('')
      : '<div class="ops-list-row"><span>No held bills</span></div>';

    document.getElementById('opsSummary').innerHTML = [
      ['Suppliers', suppliers.length],
      ['Promotions', promotions.length],
      ['Stock Adjustments', adjustments.length],
      ['Held Bills', heldBills.length],
      ['Void Bills', voids.length],
      ['Tax Categories', taxes.length],
      ['Branches', branches.length],
      ['Stock Counts', counts.length],
      ['Dead Stock', deadStock.length],
      ['Till Movements', till.length]
    ].map(([label, value]) => `<div class="ops-summary-row"><span>${label}</span><strong>${value}</strong></div>`).join('');

    document.querySelectorAll('[data-delete-hold]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.api.deleteHeldBill(Number(btn.dataset.deleteHold));
        toast('Held bill cleared');
        await loadSummary();
      });
    });
  }

  async function findSaleByBillId(billId) {
    const rows = await window.api.getSalesHistory({ limit: 1000 });
    return (rows || []).find((sale) => String(sale.bill_id || '').toLowerCase() === String(billId || '').toLowerCase());
  }

  async function init() {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user || user.role === 'cashier') {
      alert('Access Denied: Owner Only');
      window.location.href = 'sales.html';
      return;
    }

    Components.init({ title: 'Supermarket Operations' });
    products = await window.api.getProducts();
    branches = await window.api.getBranches();
    ['promoProduct', 'adjustProduct', 'transferProduct', 'stockCountProduct'].forEach(fillProductSelect);
    fillBranchSelect('transferFromBranch', 'From branch');
    fillBranchSelect('transferToBranch', 'To branch');

    document.getElementById('saveSupplierBtn').addEventListener('click', async () => {
      await window.api.saveSupplier({ name: supplierName.value.trim(), phone: supplierPhone.value.trim(), userName: userName() });
      supplierName.value = '';
      supplierPhone.value = '';
      toast('Supplier saved');
      dataChanged();
      await loadSummary();
    });

    document.getElementById('savePromotionBtn').addEventListener('click', async () => {
      await window.api.savePromotion({
        name: promoName.value.trim(),
        promoType: promoType.value,
        targetType: 'product',
        targetId: Number(promoProduct.value || 0),
        discountValue: Number(promoValue.value || 0),
        userName: userName()
      });
      toast('Promotion saved');
      dataChanged();
      await loadSummary();
    });

    document.getElementById('recordAdjustmentBtn').addEventListener('click', async () => {
      await window.api.recordStockAdjustment({
        productId: Number(adjustProduct.value || 0),
        adjustmentType: adjustType.value,
        quantity: Number(adjustQty.value || 0),
        reason: adjustReason.value.trim(),
        userName: userName()
      });
      toast('Stock adjustment recorded', 'warning');
      dataChanged();
      await loadSummary();
    });

    document.getElementById('voidBillBtn').addEventListener('click', async () => {
      await window.api.voidBill({ billId: voidBillId.value.trim(), reason: voidReason.value.trim(), userName: userName() });
      toast('Bill void recorded', 'warning');
      dataChanged();
      await loadSummary();
    });

    document.getElementById('loadReturnBillBtn').addEventListener('click', async () => {
      const sale = await findSaleByBillId(returnBillId.value.trim());
      if (!sale) {
        toast('Bill not found', 'warning');
        return;
      }
      returnSale = sale;
      renderReturnItems(returnSale);
      toast('Bill items loaded');
    });

    document.getElementById('returnBillBtn').addEventListener('click', async () => {
      if (!returnSale) {
        toast('Load a bill first', 'warning');
        return;
      }
      const items = (returnSale.items || []).map((item, index) => {
        const checked = document.querySelector(`[data-return-index="${index}"]`)?.checked;
        const qty = Number(document.querySelector(`[data-return-qty="${index}"]`)?.value || 0);
        if (!checked || qty <= 0) return null;
        return {
        saleItemId: item.id,
        productId: item.product_id,
          quantity: Math.min(qty, Number(item.quantity || 0)),
        unitPrice: Number(item.unit_price || 0),
        restock: true
        };
      }).filter((item) => item && item.productId && item.quantity > 0);
      if (!items.length) {
        toast('Select at least one return item', 'warning');
        return;
      }
      await window.api.recordReturn({
        saleId: returnSale.id,
        billId: returnSale.bill_id,
        customerId: returnSale.customer_id || null,
        reason: returnReason.value.trim() || 'Full bill return',
        userName: userName(),
        items
      });
      toast('Return recorded and stock restored', 'warning');
      dataChanged();
      returnSale = null;
      renderReturnItems(null);
      await loadSummary();
    });

    document.getElementById('recordTillBtn').addEventListener('click', async () => {
      await window.api.recordTillMovement({ movementType: tillType.value, amount: Number(tillAmount.value || 0), reason: tillReason.value.trim(), userName: userName() });
      toast('Till movement recorded');
      dataChanged();
      await loadSummary();
    });

    document.getElementById('saveTaxBtn').addEventListener('click', async () => {
      await window.api.saveTaxCategory({ name: taxName.value.trim(), rate: Number(taxRate.value || 0) });
      toast('Tax category saved');
      dataChanged();
      await loadSummary();
    });

    document.getElementById('saveBranchBtn').addEventListener('click', async () => {
      await window.api.saveBranch({ name: branchName.value.trim(), phone: branchPhone.value.trim() });
      toast('Branch saved');
      dataChanged();
      branches = await window.api.getBranches();
      fillBranchSelect('transferFromBranch', 'From branch');
      fillBranchSelect('transferToBranch', 'To branch');
      await loadSummary();
    });

    document.getElementById('recordTransferBtn').addEventListener('click', async () => {
      await window.api.recordStockTransfer({
        productId: Number(transferProduct.value || 0),
        fromBranchId: Number(transferFromBranch.value || 0) || null,
        toBranchId: Number(transferToBranch.value || 0) || null,
        quantity: Number(transferQty.value || 0),
        status: transferStatus.value,
        note: transferNote.value.trim(),
        userName: userName()
      });
      toast(transferStatus.value === 'completed' ? 'Transfer completed and stock reduced' : 'Transfer recorded');
      dataChanged();
      products = await window.api.getProducts();
      await loadSummary();
    });

    document.getElementById('addCountLineBtn').addEventListener('click', () => {
      const product = products.find((p) => Number(p.id) === Number(stockCountProduct.value));
      if (!product) {
        toast('Select a product to count', 'warning');
        return;
      }
      const countedQty = Number(stockCountQty.value || 0);
      const existing = stockCountLines.find((line) => Number(line.productId) === Number(product.id));
      const line = {
        productId: product.id,
        name: product.name,
        systemQty: Number(product.current_stock || 0),
        countedQty
      };
      if (existing) Object.assign(existing, line);
      else stockCountLines.push(line);
      stockCountQty.value = '';
      renderStockCountLines();
    });

    document.getElementById('createStockCountBtn').addEventListener('click', async () => {
      const items = stockCountLines.length
        ? stockCountLines
        : products.map((p) => ({ productId: p.id, systemQty: Number(p.current_stock || 0), countedQty: Number(p.current_stock || 0) }));
      await window.api.saveStockCount({ countCode: stockCountCode.value.trim(), items, userName: userName() });
      toast('Stock count snapshot created');
      dataChanged();
      await loadSummary();
    });

    document.getElementById('finalizeStockCountBtn').addEventListener('click', async () => {
      products = await window.api.getProducts();
      const items = stockCountLines.length
        ? stockCountLines
        : products.map((p) => ({ productId: p.id, systemQty: Number(p.current_stock || 0), countedQty: Number(p.current_stock || 0) }));
      await window.api.saveStockCount({ countCode: stockCountCode.value.trim(), status: 'completed', items, userName: userName() });
      toast('Stock count finalized');
      dataChanged();
      stockCountLines = [];
      renderStockCountLines();
      await loadSummary();
    });

    await loadSummary();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
