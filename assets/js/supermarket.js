(function () {
  'use strict';

  const fmt = window.fmtLKR || ((n) => `LKR ${Number(n || 0).toFixed(2)}`);
  let products = [];
  let branches = [];
  let suppliers = [];
  let purchaseInvoices = [];
  let returnSale = null;
  let stockCountLines = [];
  let grnLines = [];
  let shiftPreviewData = null;
  let reorderRows = [];

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

  function bindTabs() {
    document.querySelectorAll('.ops-tab-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.tab;
        if (!target) return;
        document.querySelectorAll('.ops-tab-btn').forEach((btn) => btn.classList.toggle('active', btn === button));
        document.querySelectorAll('.ops-tab-content').forEach((panel) => {
          panel.classList.toggle('active', panel.id === `tab-${target}`);
        });
      });
    });
  }

  function openTab(tabName) {
    const button = document.querySelector(`.ops-tab-btn[data-tab="${tabName}"]`);
    if (button) button.click();
  }

  function handleQuickHash() {
    const hash = String(window.location.hash || '').replace('#', '');
    const map = {
      returns: { tab: 'till-ops', id: 'returnQuickSection' },
      return: { tab: 'till-ops', id: 'returnQuickSection' },
      held: { tab: 'till-ops', id: 'heldQuickSection' },
      reorder: { tab: 'replenishment', id: 'reorderQuickSection' }
    };
    const target = map[hash];
    if (!target) return;
    openTab(target.tab);
    setTimeout(() => {
      document.getElementById(target.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
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

  function fillSupplierSelect(id, label = 'Select supplier') {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = `<option value="">${label}</option>` + suppliers.map((s) => `<option value="${s.id}">${s.name}${Number(s.balance || 0) > 0 ? ` · due ${fmt(s.balance)}` : ''}</option>`).join('');
  }

  function fillInvoiceSelect() {
    const select = document.getElementById('payInvoice');
    if (!select) return;
    const supplierId = Number(document.getElementById('paySupplier')?.value || 0);
    const rows = purchaseInvoices.filter((invoice) => Number(invoice.due_amount || 0) > 0 && (!supplierId || Number(invoice.supplier_id || 0) === supplierId));
    select.innerHTML = '<option value="">General supplier payment</option>' + rows.map((invoice) => `<option value="${invoice.id}">${invoice.grn_no || invoice.invoice_no || invoice.id} · due ${fmt(invoice.due_amount || 0)}</option>`).join('');
  }

  function renderGrnLines() {
    const list = document.getElementById('grnLines');
    if (!list) return;
    if (!grnLines.length) {
      list.innerHTML = '<div class="ops-list-row"><span>No GRN lines</span></div>';
      return;
    }
    list.innerHTML = grnLines.map((line, index) => `
      <div class="ops-list-row">
        <span>${line.name} · ${line.quantity} x ${fmt(line.costPrice)} · sell ${fmt(line.sellingPrice)}</span>
        <button class="ops-btn" data-remove-grn="${index}">Remove</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-remove-grn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        grnLines.splice(Number(btn.dataset.removeGrn), 1);
        renderGrnLines();
      });
    });
  }

  function renderShiftPreview(data) {
    const list = document.getElementById('shiftPreview');
    if (!list) return;
    if (!data) {
      list.innerHTML = '<div class="ops-list-row"><span>No shift preview</span></div>';
      return;
    }
    const opening = Number(document.getElementById('openingFloat')?.value || 0);
    const expected = opening + Number(data.cashTotal || 0) + Number(data.cashIn || 0) - Number(data.cashOut || 0);
    const actual = Number(document.getElementById('actualDrawer')?.value || expected);
    const variance = actual - expected;
    list.innerHTML = [
      ['Bills', data.billCount],
      ['Sales', fmt(data.revenueTotal)],
      ['Cash', fmt(data.cashTotal)],
      ['Card', fmt(data.cardTotal)],
      ['Credit', fmt(data.creditTotal)],
      ['Till Cash In/Out', `${fmt(data.cashIn)} / ${fmt(data.cashOut)}`],
      ['Expected Drawer', fmt(expected)],
      ['Variance', fmt(variance)]
    ].map(([label, value]) => `<div class="ops-list-row"><span>${label}</span><strong>${value}</strong></div>`).join('');
  }

  function renderReorderRows(rows) {
    reorderRows = rows || [];
    const body = document.getElementById('reorderTableBody');
    const badge = document.getElementById('reorderCountBadge');
    if (badge) badge.textContent = `${reorderRows.length} items`;
    if (!body) return;
    if (!reorderRows.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">No reorder alerts</td></tr>';
      return;
    }
    body.innerHTML = reorderRows.slice(0, 80).map((p) => `
      <tr>
        <td style="padding:7px 4px;">${p.name}</td>
        <td style="padding:7px 4px;text-align:center;">${Number(p.current_stock || 0)}</td>
        <td style="padding:7px 4px;text-align:center;">${Number(p.alert_level || 0)}</td>
        <td style="padding:7px 4px;text-align:center;">${Number(p.reorder_qty || 0)}</td>
        <td style="padding:7px 4px;">${p.last_supplier_name || '-'}</td>
      </tr>
    `).join('');
  }

  async function loadReorderRows() {
    renderReorderRows(window.api.getReorderList ? await window.api.getReorderList() : []);
  }

  async function loadScaleRules() {
    const list = document.getElementById('scaleRulesList');
    if (!list || !window.api.getScaleBarcodeRules) return;
    const rows = await window.api.getScaleBarcodeRules();
    list.innerHTML = rows.length ? rows.map((rule) => `
      <div class="ops-list-row">
        <span>${rule.prefix} · ${rule.product_digits}/${rule.value_digits} · ${rule.value_type}</span>
        <button class="ops-btn" data-delete-scale="${rule.id}">Delete</button>
      </div>
    `).join('') : '<div class="ops-list-row"><span>No scale rules</span></div>';
    list.querySelectorAll('[data-delete-scale]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.api.deleteScaleBarcodeRule(Number(btn.dataset.deleteScale));
        toast('Scale barcode rule deleted');
        await loadScaleRules();
      });
    });
  }

  function orderSheetText() {
    return reorderRows.map((p) => [
      p.name,
      `stock ${Number(p.current_stock || 0)}`,
      `safety ${Number(p.alert_level || 0)}`,
      `order ${Number(p.reorder_qty || 0) || Math.max(0, Number(p.alert_level || 0) - Number(p.current_stock || 0))}`,
      p.last_supplier_name || ''
    ].join('\t')).join('\n');
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
    const [supplierRows, promotions, adjustments, heldBills, voids, taxes, branchRows, counts, deadStock, till, purchases, payments, backup, customers] = await Promise.all([
      window.api.getSuppliers(),
      window.api.getPromotions(),
      window.api.getStockAdjustments(),
      window.api.getHeldBills(),
      window.api.getVoidBills(),
      window.api.getTaxCategories(),
      window.api.getBranches(),
      window.api.getStockCounts(),
      window.api.getDeadStockReport(),
      window.api.getTillMovements(),
      window.api.getPurchaseInvoices ? window.api.getPurchaseInvoices() : Promise.resolve([]),
      window.api.getSupplierPayments ? window.api.getSupplierPayments() : Promise.resolve([]),
      window.api.getGoogleDriveBackupStatus ? window.api.getGoogleDriveBackupStatus() : Promise.resolve({}),
      window.api.getCustomers()
    ]);

    suppliers = supplierRows || [];
    branches = branchRows || [];
    purchaseInvoices = purchases || [];
    fillSupplierSelect('grnSupplier');
    fillSupplierSelect('paySupplier');
    fillInvoiceSelect();

    const backupStatus = document.getElementById('backupStatus');
    if (backupStatus) {
      backupStatus.innerHTML = `
        <div class="ops-list-row"><span>Storage</span><strong>${backup.storage || 'Not configured'}</strong></div>
        <div class="ops-list-row"><span>Last result</span><strong>${backup.lastResult || 'No backup yet'}</strong></div>
      `;
    }

    document.getElementById('heldBillsList').innerHTML = heldBills.length
      ? heldBills.slice(0, 6).map((h) => `<div class="ops-list-row"><span>${h.hold_code}</span><button class="ops-btn" data-delete-hold="${h.id}">Clear</button></div>`).join('')
      : '<div class="ops-list-row"><span>No held bills</span></div>';

    document.getElementById('opsSummary').innerHTML = [
      ['Reorder Alerts', reorderRows.length],
      ['Supplier Due', fmt(suppliers.reduce((sum, s) => sum + Number(s.balance || 0), 0))],
      ['GRNs', purchases.length],
      ['Stock Adjustments', adjustments.length],
      ['Held Bills', heldBills.length],
      ['Void Bills', voids.length]
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
    bindTabs();
    products = await window.api.getProducts();
    suppliers = await window.api.getSuppliers();
    branches = await window.api.getBranches();
    purchaseInvoices = window.api.getPurchaseInvoices ? await window.api.getPurchaseInvoices() : [];
    ['promoProduct', 'adjustProduct', 'transferProduct', 'stockCountProduct', 'grnProduct'].forEach(fillProductSelect);
    fillBranchSelect('transferFromBranch', 'From branch');
    fillBranchSelect('transferToBranch', 'To branch');
    fillSupplierSelect('grnSupplier');
    fillSupplierSelect('paySupplier');
    fillInvoiceSelect();
    renderGrnLines();
    renderShiftPreview(null);
    await loadReorderRows();
    await loadScaleRules();

    document.getElementById('saveSupplierBtn').addEventListener('click', async () => {
      await window.api.saveSupplier({ name: supplierName.value.trim(), phone: supplierPhone.value.trim(), userName: userName() });
      supplierName.value = '';
      supplierPhone.value = '';
      toast('Supplier saved');
      dataChanged();
      suppliers = await window.api.getSuppliers();
      fillSupplierSelect('grnSupplier');
      fillSupplierSelect('paySupplier');
      await loadSummary();
    });

    document.getElementById('copyOrderSheetBtn').addEventListener('click', async () => {
      const text = orderSheetText();
      if (!text) {
        toast('No reorder rows to copy', 'warning');
        return;
      }
      await navigator.clipboard.writeText(text);
      toast('Reorder sheet copied');
    });

    document.getElementById('printOrderSheetBtn').addEventListener('click', async () => {
      const html = `
        <h1>Reorder Sheet</h1>
        <table>
          <thead><tr><th>Product</th><th>Stock</th><th>Safety</th><th>Order</th><th>Supplier</th></tr></thead>
          <tbody>${reorderRows.map((p) => `<tr><td>${p.name}</td><td>${Number(p.current_stock || 0)}</td><td>${Number(p.alert_level || 0)}</td><td>${Number(p.reorder_qty || 0)}</td><td>${p.last_supplier_name || ''}</td></tr>`).join('')}</tbody>
        </table>
      `;
      await window.api.exportReportPdf({ title: 'Reorder Sheet', html, mode: 'save' });
      toast('Reorder sheet PDF exported');
    });

    document.getElementById('addGrnLineBtn').addEventListener('click', () => {
      const product = products.find((p) => Number(p.id) === Number(grnProduct.value));
      if (!product) {
        toast('Select a product for the GRN line', 'warning');
        return;
      }
      const quantity = Number(grnQty.value || 0);
      const costPrice = Number(grnCost.value || 0);
      const sellingPrice = Number(grnSell.value || product.selling_price || 0);
      if (quantity <= 0) {
        toast('Received quantity must be greater than zero', 'warning');
        return;
      }
      grnLines.push({
        productId: product.id,
        name: product.name,
        quantity,
        costPrice,
        sellingPrice,
        expiryDate: grnExpiry.value || null
      });
      grnQty.value = '';
      grnCost.value = '';
      grnSell.value = '';
      grnExpiry.value = '';
      renderGrnLines();
    });

    document.getElementById('saveGrnBtn').addEventListener('click', async () => {
      if (!grnLines.length) {
        toast('Add at least one GRN line', 'warning');
        return;
      }
      const result = await window.api.savePurchaseInvoice({
        supplierId: Number(grnSupplier.value || 0) || null,
        grnNo: grnNo.value.trim(),
        invoiceNo: invoiceNo.value.trim(),
        invoiceDate: invoiceDate.value || null,
        paidAmount: Number(grnPaid.value || 0),
        items: grnLines,
        userName: userName()
      });
      toast(`GRN saved: ${result.grnNo} · due ${fmt(result.dueAmount || 0)}`);
      dataChanged();
      grnLines = [];
      renderGrnLines();
      grnNo.value = '';
      invoiceNo.value = '';
      grnPaid.value = '';
      products = await window.api.getProducts();
      purchaseInvoices = await window.api.getPurchaseInvoices();
      await loadReorderRows();
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
      await loadReorderRows();
      await loadSummary();
    });

    document.getElementById('saveScaleRuleBtn').addEventListener('click', async () => {
      await window.api.saveScaleBarcodeRule({
        prefix: scalePrefix.value.trim(),
        productDigits: Number(scaleProductDigits.value || 5),
        valueDigits: Number(scaleValueDigits.value || 5),
        valueType: scaleValueType.value,
        active: scaleActive.checked
      });
      toast('Scale barcode rule saved');
      scalePrefix.value = '';
      await loadScaleRules();
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

    document.getElementById('previewShiftBtn').addEventListener('click', async () => {
      shiftPreviewData = await window.api.getShiftClosePreview({
        cashierName: shiftCashier.value.trim(),
        shiftStart: shiftStart.value ? new Date(shiftStart.value).toISOString() : null
      });
      renderShiftPreview(shiftPreviewData);
    });

    document.getElementById('closeShiftBtn').addEventListener('click', async () => {
      if (!shiftPreviewData) {
        shiftPreviewData = await window.api.getShiftClosePreview({
          cashierName: shiftCashier.value.trim(),
          shiftStart: shiftStart.value ? new Date(shiftStart.value).toISOString() : null
        });
      }
      const opening = Number(openingFloat.value || 0);
      const expectedDrawer = opening + Number(shiftPreviewData.cashTotal || 0) + Number(shiftPreviewData.cashIn || 0) - Number(shiftPreviewData.cashOut || 0);
      const actual = Number(actualDrawer.value || expectedDrawer);
      const result = await window.api.recordShiftReconciliation({
        cashierName: shiftCashier.value.trim() || shiftPreviewData.cashierName || userName(),
        shiftStart: shiftPreviewData.shiftStart,
        openingFloat: opening,
        cashTotal: Number(shiftPreviewData.cashTotal || 0),
        cardTotal: Number(shiftPreviewData.cardTotal || 0),
        creditTotal: Number(shiftPreviewData.creditTotal || 0),
        revenueTotal: Number(shiftPreviewData.revenueTotal || 0),
        expectedDrawer,
        actualDrawer: actual,
        variance: actual - expectedDrawer,
        itemsSold: Number(shiftPreviewData.itemsSold || 0),
        notes: shiftNotes.value.trim()
      });
      toast(`Shift closed #${result.id}`);
      shiftPreviewData = null;
      renderShiftPreview(null);
      await loadSummary();
    });

    document.getElementById('backupDbBtn').addEventListener('click', async () => {
      const result = await window.api.backupDatabase();
      if (!result.cancelled) toast('Backup saved');
      await loadSummary();
    });

    document.getElementById('driveBackupBtn').addEventListener('click', async () => {
      const result = await window.api.runGoogleDriveBackupNow();
      toast(result.skipped ? result.message : 'Google Drive backup completed');
      await loadSummary();
    });

    document.getElementById('restoreDbBtn').addEventListener('click', async () => {
      if (!window.confirm('Restore will replace the current database and restart QuickPOS. Continue?')) return;
      await window.api.restoreDatabase();
    });

    document.getElementById('paySupplier').addEventListener('change', fillInvoiceSelect);

    document.getElementById('recordSupplierPaymentBtn').addEventListener('click', async () => {
      await window.api.recordSupplierPayment({
        supplierId: Number(paySupplier.value || 0),
        purchaseInvoiceId: Number(payInvoice.value || 0) || null,
        amount: Number(payAmount.value || 0),
        refNo: payRef.value.trim(),
        note: payNote.value.trim(),
        userName: userName()
      });
      toast('Supplier payment recorded');
      payAmount.value = '';
      payRef.value = '';
      payNote.value = '';
      suppliers = await window.api.getSuppliers();
      purchaseInvoices = await window.api.getPurchaseInvoices();
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
      await loadReorderRows();
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
      await loadReorderRows();
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
    handleQuickHash();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
