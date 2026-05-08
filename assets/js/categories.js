(function () {
  'use strict';

  let categories = [];
  let products = [];
  let deletingId = null;

  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  async function loadData() {
    [categories, products] = await Promise.all([window.api.getCategories(), window.api.getProducts()]);
  }

  function render() {
    const tbody = document.getElementById('categoriesTableBody');
    const counts = new Map();
    products.forEach((p) => counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1));

    document.getElementById('totalCategories').textContent = categories.length;
    document.getElementById('totalProducts').textContent = products.length;

    if (!categories.length) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>No categories found</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = [...categories]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((cat) => `<tr>
        <td class="td-name">${cat.name}</td>
        <td class="${cat.description ? 'td-desc' : 'td-desc empty'}">${cat.description || 'No description'}</td>
        <td><span class="count-badge">${counts.get(cat.id) || 0} product(s)</span></td>
        <td><div class="actions-cell"><button class="tbl-btn edit" data-id="${cat.id}">Edit</button><button class="tbl-btn del" data-id="${cat.id}">Delete</button></div></td>
      </tr>`)
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
        deletingId = Number(delBtn.dataset.id);
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

    bindEvents();
    try {
      await reload();
    } catch (err) {
      alert(`Failed to load categories: ${err.message}`);
    }
  });
})();
