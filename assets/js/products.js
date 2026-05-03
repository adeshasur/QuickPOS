document.addEventListener('DOMContentLoaded', () => {
  // ─── USER CHECK ───
  const user = JSON.parse(localStorage.getItem('quickpos-user'));
  if (!user) { window.location.href = 'login.html'; return; }
  
  if (user.role === 'cashier') {
    alert('Access Denied: Cashiers cannot manage products.');
    window.location.href = 'sales.html';
    return;
  }
  
  const userRoleDisplay = document.getElementById('userRoleDisplay');
  if(userRoleDisplay) userRoleDisplay.textContent = `Owner: ${user.name}`;

  // ─── DATA ───
  let categories = JSON.parse(localStorage.getItem('quickpos-categories')) || [
    { id:1, name:"Food" }, { id:2, name:"Drinks" }, { id:3, name:"Snacks" },
    { id:4, name:"Bakery" }, { id:5, name:"Groceries" }, { id:6, name:"Dairy" },
    { id:7, name:"Vegetables" }, { id:8, name:"Fruits" }, { id:9, name:"Meat" }, { id:10, name:"Seafood" }
  ];

  let products = JSON.parse(localStorage.getItem('quickpos-products')) || [
    { id:1, name:"Ceylon Black Tea", categoryId:2, basePrice:550, discount:50, finalPrice:500, currentStock:28, alertLevel:10, isWeighted:false, unitType:null },
    { id:2, name:"Nadu Raw Rice", categoryId:5, basePrice:240, discount:0, finalPrice:240, currentStock:120, alertLevel:25, isWeighted:true, unitType:"kg" },
    { id:3, name:"Coconut Oil (Pure)", categoryId:5, basePrice:420, discount:30, finalPrice:390, currentStock:45, alertLevel:12, isWeighted:true, unitType:"L" },
    { id:4, name:"Wood Apple Juice", categoryId:2, basePrice:180, discount:0, finalPrice:180, currentStock:65, alertLevel:15, isWeighted:false, unitType:null }
  ];

  let deletingId = null;

  // ─── HELPERS ───
  const fmt = n => `LKR ${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const calcFinal = (b, d) => Math.max(0, b - d);
  const saveProducts = () => localStorage.setItem('quickpos-products', JSON.stringify(products));

  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  // ─── POPULATE DROPDOWNS ───
  function populateCatDropdowns() {
    ['addCat','editCat'].forEach(selId => {
      const sel = document.getElementById(selId);
      sel.innerHTML = '<option value="">Select Category</option>';
      categories.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        sel.appendChild(o);
      });
    });
  }

  // ─── RENDER TABLE ───
  function render() {
    const tbody = document.getElementById('productsTableBody');
    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
        <p>No products found</p><small>Click "Add Product" to create your first product</small>
      </div></td></tr>`;
      return;
    }
    
    tbody.innerHTML = '';
    products.forEach(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      const isLow = p.currentStock <= p.alertLevel;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="td-name">${p.name}</td>
        <td class="td-cat">${cat ? cat.name : '—'}</td>
        <td>
          ${p.isWeighted
            ? `<span class="badge weight">⚖ By Weight</span><span class="badge unit-type">${p.unitType}</span>`
            : `<span class="badge unit">📦 Unit</span>`}
        </td>
        <td>
          ${isLow
            ? `<span class="stock-low"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${p.currentStock}</span>`
            : `<span class="stock-ok">${p.currentStock}</span>`}
        </td>
        <td><span class="alert-val">${p.alertLevel}</span></td>
        <td>
          <div class="price-wrap">
            ${p.discount > 0 ? `<span class="price-base">${fmt(p.basePrice)}</span>` : ''}
            <span class="price-final">${fmt(p.finalPrice)}</span>
            ${p.discount > 0 ? `<span class="price-disc">-${fmt(p.discount)}</span>` : ''}
          </div>
        </td>
        <td>
          <div class="actions-cell">
            <button class="tbl-btn edit" data-id="${p.id}">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Edit
            </button>
            <button class="tbl-btn del" data-id="${p.id}">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete
            </button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  // ─── PRICE PREVIEW ───
  function updatePreview(prefix) {
    const base = parseFloat(document.getElementById(prefix+'BasePrice').value) || 0;
    const disc = parseFloat(document.getElementById(prefix+'Discount').value) || 0;
    const final = calcFinal(base, disc);
    document.getElementById(prefix+'PreviewBase').textContent = fmt(base);
    document.getElementById(prefix+'PreviewDisc').textContent = fmt(disc);
    document.getElementById(prefix+'PreviewFinal').textContent = fmt(final);
  }

  // ─── WEIGHTED TOGGLE ───
  function bindWeightToggle(chkId, rowId, unitId) {
    const chk = document.getElementById(chkId);
    const row = document.getElementById(rowId);
    const unit = document.getElementById(unitId);
    chk.addEventListener('change', () => {
      unit.disabled = !chk.checked;
      row.classList.toggle('disabled', !chk.checked);
      if (!chk.checked) unit.value = '';
    });
  }

  // ─── UNIT CHIPS ───
  document.querySelectorAll('.unit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const target = document.getElementById(chip.dataset.target);
      if (!target.disabled) { target.value = chip.textContent; target.focus(); }
    });
  });

  // ─── ADD PRODUCT ───
  document.getElementById('addProductBtn').addEventListener('click', () => {
    document.getElementById('addName').value = '';
    document.getElementById('addCat').value = '';
    document.getElementById('addWeighted').checked = false;
    document.getElementById('addUnit').value = '';
    document.getElementById('addUnit').disabled = true;
    document.getElementById('addUnitRow').classList.add('disabled');
    document.getElementById('addStock').value = '0';
    document.getElementById('addAlert').value = '5';
    document.getElementById('addBasePrice').value = '';
    document.getElementById('addDiscount').value = '0';
    updatePreview('add');
    openModal('addModal');
    setTimeout(() => document.getElementById('addName').focus(), 250);
  });

  document.getElementById('saveAddBtn').addEventListener('click', () => {
    const name = document.getElementById('addName').value.trim();
    const catId = parseInt(document.getElementById('addCat').value);
    const isWeighted = document.getElementById('addWeighted').checked;
    const unit = document.getElementById('addUnit').value.trim();
    const stock = parseInt(document.getElementById('addStock').value) || 0;
    const alert = parseInt(document.getElementById('addAlert').value) || 5;
    const base = parseFloat(document.getElementById('addBasePrice').value);
    const disc = parseFloat(document.getElementById('addDiscount').value) || 0;

    if (!name) { alert('Please enter a product name.'); return; }
    if (!catId) { alert('Please select a category.'); return; }
    if (isWeighted && !unit) { alert('Please enter the unit type (e.g., kg, L).'); return; }
    if (!base || base <= 0) { alert('Please enter a valid price.'); return; }
    if (disc > base) { alert('Discount cannot exceed the base price.'); return; }

    const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({ id:newId, name, categoryId:catId, basePrice:base, discount:disc, finalPrice:calcFinal(base,disc), currentStock:stock, alertLevel:alert, isWeighted, unitType: isWeighted ? unit : null });
    saveProducts(); render(); closeModal('addModal');
  });

  // ─── EDIT PRODUCT ───
  document.getElementById('productsTableBody').addEventListener('click', e => {
    const editBtn = e.target.closest('.edit');
    const delBtn  = e.target.closest('.del');
    
    if (editBtn) {
      const p = products.find(x => x.id === +editBtn.dataset.id);
      if (!p) return;
      document.getElementById('editId').value = p.id;
      document.getElementById('editName').value = p.name;
      document.getElementById('editCat').value = p.categoryId;
      document.getElementById('editStock').value = p.currentStock;
      document.getElementById('editAlert').value = p.alertLevel;
      document.getElementById('editBasePrice').value = p.basePrice;
      document.getElementById('editDiscount').value = p.discount;
      document.getElementById('editWeighted').checked = p.isWeighted;
      document.getElementById('editUnit').disabled = !p.isWeighted;
      document.getElementById('editUnitRow').classList.toggle('disabled', !p.isWeighted);
      document.getElementById('editUnit').value = p.unitType || '';
      updatePreview('edit');
      openModal('editModal');
      setTimeout(() => document.getElementById('editName').focus(), 250);
    }
    
    if (delBtn) {
      deletingId = +delBtn.dataset.id;
      const p = products.find(x => x.id === deletingId);
      document.getElementById('delMsg').textContent = `Are you sure you want to delete "${p ? p.name : 'this product'}"? This cannot be undone.`;
      openModal('deleteModal');
    }
  });

  document.getElementById('saveEditBtn').addEventListener('click', () => {
    const id = +document.getElementById('editId').value;
    const name = document.getElementById('editName').value.trim();
    const catId = parseInt(document.getElementById('editCat').value);
    const isWeighted = document.getElementById('editWeighted').checked;
    const unit = document.getElementById('editUnit').value.trim();
    const alert = parseInt(document.getElementById('editAlert').value) || 0;
    const base = parseFloat(document.getElementById('editBasePrice').value);
    const disc = parseFloat(document.getElementById('editDiscount').value) || 0;

    if (!name || !catId || !base || base <= 0) { alert('Please fill all required fields.'); return; }
    if (isWeighted && !unit) { alert('Please enter the unit type.'); return; }
    if (disc > base) { alert('Discount cannot exceed the base price.'); return; }

    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], name, categoryId:catId, basePrice:base, discount:disc, finalPrice:calcFinal(base,disc), alertLevel:alert, isWeighted, unitType: isWeighted ? unit : null };
      saveProducts(); render(); closeModal('editModal');
    }
  });

  // ─── DELETE ───
  document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
    products = products.filter(p => p.id !== deletingId);
    saveProducts(); render(); closeModal('deleteModal'); deletingId = null;
  });

  // ─── CLOSE BUTTONS ───
  ['closeAddModal','cancelAddModal'].forEach(id => document.getElementById(id).addEventListener('click', () => closeModal('addModal')));
  ['closeEditModal','cancelEditModal'].forEach(id => document.getElementById(id).addEventListener('click', () => closeModal('editModal')));
  document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteModal'));

  ['addModal','editModal','deleteModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target === document.getElementById(id)) closeModal(id);
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal('addModal'); closeModal('editModal'); closeModal('deleteModal'); }
  });

  // ─── PRICE PREVIEW BINDINGS ───
  ['addBasePrice','addDiscount'].forEach(id => document.getElementById(id).addEventListener('input', () => updatePreview('add')));
  ['editBasePrice','editDiscount'].forEach(id => document.getElementById(id).addEventListener('input', () => updatePreview('edit')));

  // ─── WEIGHTED TOGGLE BINDINGS ───
  bindWeightToggle('addWeighted','addUnitRow','addUnit');
  bindWeightToggle('editWeighted','editUnitRow','editUnit');

  populateCatDropdowns();
  render();
});
