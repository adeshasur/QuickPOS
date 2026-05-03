// ─── DATA ───
let categories = JSON.parse(localStorage.getItem('quickpos-categories')) || [
  { id: 1, name: "Food", description: "All food items including meals and snacks", productCount: 2 },
  { id: 2, name: "Drinks", description: "Beverages, juices, and hot drinks", productCount: 3 },
  { id: 3, name: "Snacks", description: "Quick bites and light snacks", productCount: 1 },
  { id: 4, name: "Bakery", description: "Freshly baked goods and pastries", productCount: 1 }
];
let products = JSON.parse(localStorage.getItem('quickpos-products')) || [];
let deletingId = null;

// ─── HELPERS ───
function saveCategories() {
  localStorage.setItem('quickpos-categories', JSON.stringify(categories));
}

function updateProductCounts() {
  categories.forEach(c => c.productCount = 0);
  products.forEach(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    if (cat) cat.productCount++;
  });
  saveCategories();
}

// ─── RENDER ───
function render() {
  updateProductCounts();
  const tbody = document.getElementById('categoriesTableBody');
  const emptyRow = document.getElementById('emptyRow');

  document.getElementById('totalCategories').textContent = categories.length;
  const total = categories.reduce((s, c) => s + c.productCount, 0);
  document.getElementById('totalProducts').textContent = total;

  if (!categories.length) {
    tbody.innerHTML = '';
    tbody.appendChild(emptyRow);
    emptyRow.style.display = '';
    return;
  }

  emptyRow.style.display = 'none';
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  tbody.innerHTML = '';
  sorted.forEach(cat => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-name">${cat.name}</td>
      <td class="${cat.description ? 'td-desc' : 'td-desc empty'}">${cat.description || 'No description'}</td>
      <td><span class="count-badge">${cat.productCount} product${cat.productCount !== 1 ? 's' : ''}</span></td>
      <td>
        <div class="actions-cell">
          <button class="tbl-btn edit" data-id="${cat.id}">
            <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Edit
          </button>
          <button class="tbl-btn del" data-id="${cat.id}">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
            Delete
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ─── MODAL HELPERS ───
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── ADD / EDIT ───
document.getElementById('addCategoryBtn').addEventListener('click', () => {
  document.getElementById('categoryId').value = '';
  document.getElementById('categoryName').value = '';
  document.getElementById('categoryDescription').value = '';
  document.getElementById('modalTitle').textContent = 'Add New Category';
  document.getElementById('saveModalBtn').textContent = 'Save Category';
  openModal('categoryModal');
  setTimeout(() => document.getElementById('categoryName').focus(), 250);
});

document.getElementById('categoriesTableBody').addEventListener('click', e => {
  const editBtn = e.target.closest('.edit');
  const delBtn  = e.target.closest('.del');
  
  if (editBtn) {
    const cat = categories.find(c => c.id === +editBtn.dataset.id);
    if (!cat) return;
    document.getElementById('categoryId').value = cat.id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categoryDescription').value = cat.description || '';
    document.getElementById('modalTitle').textContent = 'Edit Category';
    document.getElementById('saveModalBtn').textContent = 'Update Category';
    openModal('categoryModal');
    setTimeout(() => document.getElementById('categoryName').focus(), 250);
  }
  
  if (delBtn) {
    deletingId = +delBtn.dataset.id;
    const cat = categories.find(c => c.id === deletingId);
    if (!cat) return;
    const msg = cat.productCount > 0
      ? `"${cat.name}" has ${cat.productCount} product(s). Deleting it will also remove those products. Continue?`
      : `Are you sure you want to delete "${cat.name}"?`;
    document.getElementById('delMsg').textContent = msg;
    openModal('deleteModal');
  }
});

document.getElementById('saveModalBtn').addEventListener('click', () => {
  const name = document.getElementById('categoryName').value.trim();
  const desc = document.getElementById('categoryDescription').value.trim();
  const existingId = document.getElementById('categoryId').value ? +document.getElementById('categoryId').value : null;

  if (!name) { alert('Please enter a category name.'); document.getElementById('categoryName').focus(); return; }

  const duplicate = categories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== existingId);
  if (duplicate) { alert('A category with this name already exists.'); document.getElementById('categoryName').focus(); return; }

  if (existingId) {
    const idx = categories.findIndex(c => c.id === existingId);
    if (idx !== -1) { categories[idx].name = name; categories[idx].description = desc; }
  } else {
    const newId = categories.length ? Math.max(...categories.map(c => c.id)) + 1 : 1;
    categories.push({ id: newId, name, description: desc, productCount: 0 });
  }

  saveCategories();
  render();
  closeModal('categoryModal');
});

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (!deletingId) return;
  const cat = categories.find(c => c.id === deletingId);
  if (cat && cat.productCount > 0) {
    products = products.filter(p => p.categoryId !== deletingId);
    localStorage.setItem('quickpos-products', JSON.stringify(products));
  }
  categories = categories.filter(c => c.id !== deletingId);
  saveCategories();
  render();
  closeModal('deleteModal');
  deletingId = null;
});

// Close buttons
['closeModalBtn', 'cancelModalBtn'].forEach(id =>
  document.getElementById(id).addEventListener('click', () => closeModal('categoryModal'))
);
document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteModal'));

// Click outside to close
['categoryModal', 'deleteModal'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target === document.getElementById(id)) closeModal(id);
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal('categoryModal'); closeModal('deleteModal'); }
});

// Auth + role check
document.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem('quickpos-user'));
  if (!user) { window.location.href = 'login.html'; return; }
  
  // Prevent Cashier from accessing Categories
  if (user.role === 'cashier') {
    alert('Access Denied: Cashiers cannot manage categories.');
    window.location.href = 'sales.html';
    return;
  }
  
  render();
});
