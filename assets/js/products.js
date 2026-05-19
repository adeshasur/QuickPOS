(function () {
  'use strict';

  let categories = [];
  let products = [];
  let deletingId = null;

  const fmt = window.fmtLKR;
  const calcFinal = (base, discount) => Math.max(0, Number(base || 0) - Number(discount || 0));



  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  function populateCategoryDropdowns() {
    ['addCat', 'editCat'].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '<option value="">Select Category</option>';
      categories.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
      });
    });

    const filterSelect = document.getElementById('categoryFilter');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">All Categories</option>';
      categories.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        filterSelect.appendChild(opt);
      });
    }
  }

  function updateKPICards() {
    const total = products.length;
    const lowStock = products.filter(p => Number(p.current_stock || 0) <= Number(p.alert_level || 0)).length;
    const outOfStock = products.filter(p => Number(p.current_stock || 0) === 0).length;
    const totalValue = products.reduce((acc, p) => acc + (Number(p.current_stock || 0) * Number(p.selling_price || 0)), 0);

    const totalEl = document.getElementById('totalProductsCount');
    const lowStockEl = document.getElementById('lowStockCount');
    const outOfStockEl = document.getElementById('outOfStockCount');
    const totalValueEl = document.getElementById('totalStockValue');

    if (totalEl) totalEl.textContent = total;
    if (lowStockEl) lowStockEl.textContent = lowStock;
    if (outOfStockEl) outOfStockEl.textContent = outOfStock;
    if (totalValueEl) totalValueEl.textContent = fmt(totalValue);
  }

  function updatePreview(prefix) {
    const base = parseFloat(document.getElementById(`${prefix}BasePrice`).value) || 0;
    const disc = parseFloat(document.getElementById(`${prefix}Discount`).value) || 0;
    document.getElementById(`${prefix}PreviewBase`).textContent = fmt(base);
    document.getElementById(`${prefix}PreviewDisc`).textContent = fmt(disc);
    document.getElementById(`${prefix}PreviewFinal`).textContent = fmt(calcFinal(base, disc));
  }

  function render() {
    const tbody = document.getElementById('productsTableBody');
    
    // Get filter inputs
    const query = (document.getElementById('productSearch')?.value || '').toLowerCase().trim();
    const catFilterVal = document.getElementById('categoryFilter')?.value || '';

    // Filter products list dynamically
    const filteredProducts = products.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(query);
      const barcodeMatch = (p.barcode || '').toLowerCase().includes(query);
      const queryMatch = !query || nameMatch || barcodeMatch;

      const catMatch = !catFilterVal || p.category_id === Number(catFilterVal);

      return queryMatch && catMatch;
    });

    if (!filteredProducts.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>No products found</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = filteredProducts.map((p) => {
      const cat = categories.find((c) => c.id === p.category_id);
      const low = Number(p.current_stock || 0) <= Number(p.alert_level || 0);
      const discount = Math.max(0, Number(p.cost_price || 0) - Number(p.selling_price || 0));
      
      // Dynamic measurement text optimization
      const unitStr = p.unit_type || 'pc';
      const displayUnit = (unitStr.toLowerCase() === 'pcs' || unitStr.toLowerCase() === 'pc') ? '1 pc' : `1 ${unitStr}`;

      return `<tr>
        <td class="td-name">
          <div class="name-box">
            <span class="p-name-main">${p.name}</span>
            <span class="p-barcode-sub">${p.barcode || '-'}</span>
          </div>
        </td>
        <td class="td-cat">${cat ? cat.name : '-'}</td>
        <td><span class="measure-tag">${displayUnit}</span></td>
        <td>${low ? `<span class="stock-low">${p.current_stock}</span>` : `<span class="stock-ok">${p.current_stock}</span>`}</td>
        <td><div class="price-wrap">${discount > 0 ? `<span class="price-base">${fmt(p.cost_price)}</span>` : ''}<span class="price-final">${fmt(p.selling_price)}</span>${discount > 0 ? `<span class="price-disc">-${fmt(discount)}</span>` : ''}</div></td>
        <td><div class="actions-cell"><button class="tbl-btn edit" data-id="${p.id}">Edit</button><button class="tbl-btn del" data-id="${p.id}">Delete</button></div></td>
      </tr>`;
    }).join('');
  }

  async function reload() {
    [categories, products] = await Promise.all([window.api.getCategories(), window.api.getProducts()]);
    populateCategoryDropdowns();
    updateKPICards();
    render();
  }

  function bindWeightToggle(chkId, rowId, unitId) {
    const chk = document.getElementById(chkId);
    const row = document.getElementById(rowId);
    const unit = document.getElementById(unitId);
    chk.addEventListener('change', () => {
      unit.disabled = !chk.checked;
      row.classList.toggle('disabled', !chk.checked);
      if (!chk.checked) {
        unit.value = '';
        row.querySelectorAll('.unit-chip').forEach(c => c.classList.remove('active'));
      }
    });
  }

  function bindEvents() {
    const searchInput = document.getElementById('productSearch');
    const catFilter = document.getElementById('categoryFilter');

    // Unit chips click listener
    document.querySelectorAll('.unit-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const targetId = chip.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        
        const prefix = targetId === 'addUnit' ? 'add' : 'edit';
        const chk = document.getElementById(`${prefix}Weighted`);
        const row = document.getElementById(`${prefix}UnitRow`);
        
        if (chk && !chk.checked) {
          chk.checked = true;
          input.disabled = false;
          row.classList.remove('disabled');
        }
        
        input.value = chip.textContent.trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        chip.parentElement.querySelectorAll('.unit-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        render();
      });
    }

    if (catFilter) {
      catFilter.addEventListener('change', () => {
        render();
      });
    }

    document.getElementById('addProductBtn').addEventListener('click', () => {
      ['addBarcode', 'addName', 'addCat', 'addUnit', 'addBasePrice'].forEach((id) => (document.getElementById(id).value = ''));
      document.getElementById('addWeighted').checked = false;
      document.getElementById('addUnit').disabled = true;
      document.getElementById('addUnitRow').classList.add('disabled');
      document.querySelectorAll('#addUnitRow .unit-chip').forEach(c => c.classList.remove('active'));
      document.getElementById('addStock').value = '0';
      document.getElementById('addAlert').value = '5';
      document.getElementById('addDiscount').value = '0';
      updatePreview('add');
      openModal('addModal');
    });

    if (window.Singlish) {
      window.Singlish.bindImeInput(
        document.getElementById('addName'),
        () => true
      );
      window.Singlish.bindImeInput(
        document.getElementById('editName'),
        () => true
      );
    }

    document.getElementById('saveAddBtn').addEventListener('click', async () => {
      const barcode = document.getElementById('addBarcode').value.trim();
      const name = document.getElementById('addName').value.trim();
      const categoryId = Number(document.getElementById('addCat').value);
      const isWeighted = document.getElementById('addWeighted').checked;
      const unitType = document.getElementById('addUnit').value.trim();
      const stock = Number(document.getElementById('addStock').value || 0);
      const alertLevel = Number(document.getElementById('addAlert').value || 5);
      const basePrice = Number(document.getElementById('addBasePrice').value || 0);
      const discount = Number(document.getElementById('addDiscount').value || 0);
      if (!name || !categoryId || basePrice <= 0) return alert('Fill required fields.');
      if (isWeighted && !unitType) return alert('Unit type is required for weighted items.');

      await window.api.addProduct({
        barcode: barcode || `P-${Date.now()}`,
        name,
        categoryId,
        cost: basePrice,
        price: calcFinal(basePrice, discount),
        stock,
        unit: unitType || 'pc',
        expiry: null
      });

      closeModal('addModal');
      await reload();
    });

    document.getElementById('productsTableBody').addEventListener('click', (e) => {
      const edit = e.target.closest('.edit');
      const del = e.target.closest('.del');
      if (edit) {
        const p = products.find((x) => x.id === Number(edit.dataset.id));
        if (!p) return;
        document.getElementById('editId').value = p.id;
        document.getElementById('editBarcode').value = p.barcode || '';
        document.getElementById('editName').value = p.name;
        document.getElementById('editCat').value = p.category_id;
        document.getElementById('editStock').value = p.current_stock;
        document.getElementById('editAlert').value = p.alert_level || 0;
        document.getElementById('editBasePrice').value = p.cost_price || 0;
        document.getElementById('editDiscount').value = Math.max(0, Number(p.cost_price || 0) - Number(p.selling_price || 0));
        document.getElementById('editWeighted').checked = Number(p.is_weighted) === 1;
        document.getElementById('editUnit').value = p.unit_type || '';
        document.getElementById('editUnit').disabled = Number(p.is_weighted) !== 1;
        document.getElementById('editUnitRow').classList.toggle('disabled', Number(p.is_weighted) !== 1);
        document.querySelectorAll('#editUnitRow .unit-chip').forEach(c => {
          c.classList.toggle('active', c.textContent.trim() === (p.unit_type || ''));
        });
        updatePreview('edit');
        openModal('editModal');
      }

      if (del) {
        deletingId = Number(del.dataset.id);
        openModal('deleteModal');
      }
    });

    document.getElementById('saveEditBtn').addEventListener('click', async () => {
      const id = Number(document.getElementById('editId').value);
      const barcode = document.getElementById('editBarcode').value.trim();
      const name = document.getElementById('editName').value.trim();
      const categoryId = Number(document.getElementById('editCat').value);
      const isWeighted = document.getElementById('editWeighted').checked;
      const unitType = document.getElementById('editUnit').value.trim();
      const alertLevel = Number(document.getElementById('editAlert').value || 0);
      const basePrice = Number(document.getElementById('editBasePrice').value || 0);
      const discount = Number(document.getElementById('editDiscount').value || 0);

      if (!id || !name || !categoryId || basePrice <= 0) return alert('Fill required fields.');
      if (isWeighted && !unitType) return alert('Unit type is required for weighted items.');

      await window.api.updateProduct({
        id,
        barcode,
        name,
        categoryId,
        cost: basePrice,
        price: calcFinal(basePrice, discount),
        alertLevel,
        unitType: unitType || 'pc',
        isWeighted
      });

      closeModal('editModal');
      await reload();
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
      if (!deletingId) return;
      await window.api.deleteProduct(deletingId);
      deletingId = null;
      closeModal('deleteModal');
      await reload();
    });

    ['closeAddModal', 'cancelAddModal'].forEach((id) => document.getElementById(id).addEventListener('click', () => closeModal('addModal')));
    ['closeEditModal', 'cancelEditModal'].forEach((id) => document.getElementById(id).addEventListener('click', () => closeModal('editModal')));
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteModal'));
    ['addBasePrice', 'addDiscount'].forEach((id) => document.getElementById(id).addEventListener('input', () => updatePreview('add')));
    ['editBasePrice', 'editDiscount'].forEach((id) => document.getElementById(id).addEventListener('input', () => updatePreview('edit')));
    bindWeightToggle('addWeighted', 'addUnitRow', 'addUnit');
    bindWeightToggle('editWeighted', 'editUnitRow', 'editUnit');
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
    Components.init({ title: 'Products' });

    bindEvents();
    try {
      await reload();
    } catch (err) {
      alert(`Failed to load products: ${err.message}`);
    }
  });
})();
