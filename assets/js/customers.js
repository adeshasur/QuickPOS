(function () {
  'use strict';

  let customers = [];
  let deleteCandidateId = null;
  const AVATAR_COLORS = ['av-blue', 'av-green', 'av-purple', 'av-amber', 'av-cyan'];

  const fmt = window.fmtLKR;
  const initials = (n) => String(n || '').trim().split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

  function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.className = `toast ${type}`;
    document.getElementById('toastMsg').textContent = msg;
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  async function loadCustomers() {
    customers = await window.api.getCustomers();
  }

  function render(filter = '') {
    const q = filter.toLowerCase().trim();
    const list = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || String(c.phone || '').includes(q)) : customers;
    document.getElementById('countDisplay').textContent = list.length;

    const body = document.getElementById('tableBody');
    if (!list.length) {
      body.innerHTML = '<div class="empty-state"><p>No customers found</p></div>';
      return;
    }

    body.innerHTML = list
      .map((c) => `<div class="cust-row" data-id="${c.id}">
      <div class="td"><div class="cust-name-cell"><div class="cust-avatar ${AVATAR_COLORS[c.id % AVATAR_COLORS.length]}">${initials(c.name)}</div><div><div class="cust-fullname">${c.name}</div><div class="cust-id">#${String(c.id).padStart(4, '0')}</div></div></div></div>
      <div class="td"><span class="phone-val">${c.phone || '-'}</span></div>
      <div class="td"><span class="addr-val">${c.address || '-'}</span></div>
      <div class="td"><span class="bal-val ${(c.balance || 0) > 0 ? 'pos' : 'zero'}">${fmt(c.balance || 0)}</span></div>
      <div class="td"><div class="row-actions"><button class="row-btn edit" data-id="${c.id}">Edit</button><button class="row-btn del" data-id="${c.id}">Delete</button></div></div>
    </div>`)
      .join('');
  }

  async function reload() {
    await loadCustomers();
    render(document.getElementById('searchInput').value || '');
  }

  function openAdd() {
    document.getElementById('formModalTitle').textContent = 'Add Customer';
    document.getElementById('editId').value = '';
    document.getElementById('fName').value = '';
    document.getElementById('fPhone').value = '';
    document.getElementById('fAddress').value = '';
    document.getElementById('formModal').classList.add('open');
  }

  function openEdit(id) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    document.getElementById('formModalTitle').textContent = 'Edit Customer';
    document.getElementById('editId').value = c.id;
    document.getElementById('fName').value = c.name;
    document.getElementById('fPhone').value = c.phone || '';
    document.getElementById('fAddress').value = c.address || '';
    document.getElementById('formModal').classList.add('open');
  }

  async function saveCustomer() {
    const id = Number(document.getElementById('editId').value || 0);
    const name = document.getElementById('fName').value.trim();
    const phone = document.getElementById('fPhone').value.trim();
    const address = document.getElementById('fAddress').value.trim();
    if (!name || !phone) return showToast('Name and phone are required', 'error');

    const existing = id ? customers.find((c) => c.id === id) : null;
    await window.api.saveCustomer({
      id: id || null,
      name,
      phone,
      address,
      balance: existing ? existing.balance || 0 : 0
    });

    document.getElementById('formModal').classList.remove('open');
    await reload();
    showToast(id ? 'Customer updated' : 'Customer added');
  }

  async function confirmDelete() {
    if (!deleteCandidateId) return;
    await window.api.deleteCustomer(deleteCandidateId);
    deleteCandidateId = null;
    document.getElementById('deleteModal').classList.remove('open');
    await reload();
    showToast('Customer deleted');
  }

  function bindEvents() {
    document.getElementById('searchInput').addEventListener('input', (e) => render(e.target.value));
    document.getElementById('addBtn').addEventListener('click', openAdd);
    document.getElementById('saveCustomer').addEventListener('click', saveCustomer);
    document.getElementById('closeFormModal').addEventListener('click', () => document.getElementById('formModal').classList.remove('open'));
    document.getElementById('cancelFormModal').addEventListener('click', () => document.getElementById('formModal').classList.remove('open'));

    document.getElementById('tableBody').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit');
      const delBtn = e.target.closest('.del');
      if (editBtn) openEdit(Number(editBtn.dataset.id));
      if (delBtn) {
        deleteCandidateId = Number(delBtn.dataset.id);
        const c = customers.find((x) => x.id === deleteCandidateId);
        document.getElementById('delName').textContent = c ? c.name : 'Customer';
        document.getElementById('deleteModal').classList.add('open');
      }
    });

    document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
    document.getElementById('cancelDelete').addEventListener('click', () => document.getElementById('deleteModal').classList.remove('open'));
    document.getElementById('closeDeleteModal').addEventListener('click', () => document.getElementById('deleteModal').classList.remove('open'));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    Components.init({ title: 'Customer Management' });

    bindEvents();
    try {
      await reload();
    } catch (err) {
      alert(`Failed to load customers: ${err.message}`);
    }
  });
})();
