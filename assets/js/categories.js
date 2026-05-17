(function () {
  'use strict';

  let categories = [];
  let products = [];
  let topSellingCategoryName = 'None';
  let deletingId = null;

  async function openModal(id) { document.getElementById(id).classList.add('open'); }
  async function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  async function loadData() {
    const results = await Promise.all([
      window.api.getCategories(),
      window.api.getProducts(),
      window.api.getTopSellingCategory()
    ]);
    categories = results[0];
    products = results[1];
    topSellingCategoryName = results[2] || 'None';
  }

  function render() {
    const tbody = document.getElementById('categoriesTableBody');
    const counts = new Map();
    products.forEach((p) => counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1));

    document.getElementById('totalCategories').textContent = categories.length;
    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('topSellingCategory').textContent = topSellingCategoryName;

    if (!categories.length) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>No categories found</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = [...categories]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((cat) => {
        const pCount = counts.get(cat.id) || 0;
        const deleteDisabledAttr = pCount > 0 
          ? 'disabled style="opacity: 0.4; cursor: not-allowed;" title="Cannot delete category with active products"' 
          : '';
        return `<tr>
          <td class="td-name">${cat.name}</td>
          <td><span class="status-badge active">Active</span></td>
          <td><span class="count-badge">${pCount} product(s)</span></td>
          <td>
            <div class="actions-cell">
              <button class="tbl-btn edit" data-id="${cat.id}">Edit</button>
              <button class="tbl-btn del" data-id="${cat.id}" ${deleteDisabledAttr}>Delete</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');
  }

  async function reload() {
    await loadData();
    render();
  }

  function bindEvents() {
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
      document.getElementById('categoryId').value = '';
      document.getElementById('categoryName').value = '';
      document.getElementById('categoryDescription').value = '';
      document.getElementById('modalTitle').textContent = 'Add New Category';
      openModal('categoryModal');
    });

    document.getElementById('categoriesTableBody').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit');
      const delBtn = e.target.closest('.del');

      if (editBtn) {
        const cat = categories.find((c) => c.id === Number(editBtn.dataset.id));
        if (!cat) return;
        document.getElementById('categoryId').value = cat.id;
        document.getElementById('categoryName').value = cat.name;
        document.getElementById('categoryDescription').value = cat.description || '';
        document.getElementById('modalTitle').textContent = 'Edit Category';
        openModal('categoryModal');
      }

      if (delBtn) {
        if (delBtn.disabled) return;
        deletingId = Number(delBtn.dataset.id);
        const cat = categories.find((c) => c.id === deletingId);
        document.getElementById('delMsg').textContent = `Are you sure you want to delete the category "${cat ? cat.name : ''}"? This action cannot be undone.`;
        openModal('deleteModal');
      }
    });

    document.getElementById('saveModalBtn').addEventListener('click', async () => {
      const id = Number(document.getElementById('categoryId').value || 0);
      const name = document.getElementById('categoryName').value.trim();
      const description = document.getElementById('categoryDescription').value.trim();
      if (!name) return alert('Please enter a category name.');

      await window.api.saveCategory({ id: id || null, name, description });
      closeModal('categoryModal');
      await reload();
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
      if (!deletingId) return;
      const result = await window.api.deleteCategory(deletingId);
      if (!result.success) {
        alert(result.message || 'Cannot delete this category.');
        return;
      }
      deletingId = null;
      closeModal('deleteModal');
      await reload();
    });

    ['closeModalBtn', 'cancelModalBtn'].forEach((id) => document.getElementById(id).addEventListener('click', () => closeModal('categoryModal')));
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteModal'));
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
    Components.init({ title: 'Categories' });

    bindEvents();
    try {
      await reload();
    } catch (err) {
      alert(`Failed to load categories: ${err.message}`);
    }
  });
})();
