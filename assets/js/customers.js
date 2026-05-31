(function () {
  'use strict';

  let customers = [];
  let deleteCandidateId = null;
  const AVATAR_COLORS = ['av-blue', 'av-green', 'av-purple', 'av-amber', 'av-cyan'];

  const fmt = window.fmtLKR;
  const initials = (n) => String(n || '').trim().split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
  const formatPhone = (phone) => {
    if (!phone) return '-';
    const clean = String(phone).replace(/\s+/g, '');
    if (clean.length === 10) {
      return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    }
    return phone;
  };

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
    const filterSelect = document.getElementById('creditFilter');
    const creditOnly = filterSelect ? filterSelect.value === 'credit' : false;

    let list = customers;
    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q) || String(c.phone || '').includes(q));
    }
    if (creditOnly) {
      list = list.filter((c) => (c.balance || 0) > 0);
    }

    document.getElementById('countDisplay').textContent = list.length;

    const body = document.getElementById('tableBody');
    if (!list.length) {
      body.innerHTML = '<div class="empty-state"><p>No customers found</p></div>';
      return;
    }

    body.innerHTML = list
      .map((c) => `<div class="cust-row" data-id="${c.id}">
      <div class="td"><div class="cust-name-cell"><div class="cust-avatar ${AVATAR_COLORS[c.id % AVATAR_COLORS.length]}">${initials(c.name)}</div><div><div class="cust-fullname">${c.name}</div><div class="cust-meta-row"><span class="cust-id">#${String(c.id).padStart(4, '0')}</span>${Number(c.is_loyal_customer || 0) === 1 ? '<span class="loyal-customer-badge"><i class="fa-solid fa-star"></i> Loyal Customer</span>' : ''}</div></div></div></div>
      <div class="td"><span class="phone-val">${formatPhone(c.phone)}</span></div>
      <div class="td"><span class="addr-val">${c.address || '-'}</span></div>
      <div class="td"><span class="loyalty-val">${c.loyalty_points || 0}</span></div>
      <div class="td"><span class="bal-val ${(c.balance || 0) > 0 ? 'credit-due' : 'zero'}">${fmt(c.balance || 0)}</span></div>
      <div class="td"><div class="row-actions">
        <button class="row-btn view" data-id="${c.id}"><i class="fa-solid fa-eye"></i> History</button>
        <button class="row-btn edit" data-id="${c.id}">Edit</button>
        <button class="row-btn del" data-id="${c.id}">Delete</button>
      </div></div>
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
    document.getElementById('fLoyaltyPoints').value = '0';
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
    document.getElementById('fLoyaltyPoints').value = c.loyalty_points || 0;
    document.getElementById('formModal').classList.add('open');
  }

  async function saveCustomer() {
    const id = Number(document.getElementById('editId').value || 0);
    const name = document.getElementById('fName').value.trim();
    const phone = document.getElementById('fPhone').value.trim();
    const address = document.getElementById('fAddress').value.trim();
    const loyaltyPoints = Number(document.getElementById('fLoyaltyPoints').value || 0);
    if (!name || !phone) return showToast('Name and phone are required', 'error');

    const existing = id ? customers.find((c) => c.id === id) : null;
    await window.api.saveCustomer({
      id: id || null,
      name,
      phone,
      address,
      balance: existing ? existing.balance || 0 : 0,
      loyaltyPoints
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

  async function openHistory(customerId) {
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;

    document.getElementById('historyModalTitle').textContent = `Purchase History - ${c.name}`;
    const listContainer = document.getElementById('historyList');
    listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-weight:500;">Loading purchases...</div>';
    document.getElementById('historyModal').classList.add('open');

    try {
      const allSales = await window.api.getSalesHistory();
      const customerSales = allSales.filter((s) => s.customer_id === customerId);

      if (!customerSales.length) {
        listContainer.innerHTML = `
          <div style="text-align:center;padding:40px 20px;color:var(--text3);">
            <div style="font-size:40px;margin-bottom:12px;opacity:0.5;"><i class="fa-solid fa-receipt"></i></div>
            <div style="font-size:15px;font-weight:600;margin-bottom:4px;">No purchase records found</div>
            <div style="font-size:13px;opacity:0.8;">Invoices will show up here once sales are recorded.</div>
          </div>`;
        return;
      }

      listContainer.innerHTML = customerSales.map((s) => {
        const methodClass = String(s.payment_method || '').toLowerCase();
        const dateStr = new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + 
                       new Date(s.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' });
        return `
          <div class="history-item">
            <div class="hi-left">
              <div class="hi-bill">${s.bill_id}</div>
              <div class="hi-date">${dateStr}</div>
            </div>
            <div class="hi-right">
              <div class="hi-amount">${fmt(s.total_amount || 0)}</div>
              <div class="hi-method ${methodClass}">${s.payment_method || 'Cash'}</div>
            </div>
          </div>`;
      }).join('');

    } catch (err) {
      listContainer.innerHTML = `<div style="text-align:center;padding:20px;color:var(--danger);font-weight:600;">Failed to load purchase history: ${err.message}</div>`;
    }
  }

  function bindEvents() {
    document.getElementById('searchInput').addEventListener('input', (e) => render(e.target.value));
    
    const creditFilter = document.getElementById('creditFilter');
    if (creditFilter) {
      creditFilter.addEventListener('change', () => render(document.getElementById('searchInput').value));
    }

    document.getElementById('addBtn').addEventListener('click', openAdd);
    document.getElementById('saveCustomer').addEventListener('click', saveCustomer);
    document.getElementById('closeFormModal').addEventListener('click', () => document.getElementById('formModal').classList.remove('open'));
    document.getElementById('cancelFormModal').addEventListener('click', () => document.getElementById('formModal').classList.remove('open'));

    document.getElementById('tableBody').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit');
      const delBtn = e.target.closest('.del');
      const viewBtn = e.target.closest('.view');
      if (editBtn) openEdit(Number(editBtn.dataset.id));
      if (viewBtn) openHistory(Number(viewBtn.dataset.id));
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
    
    document.getElementById('closeHistoryModal').addEventListener('click', () => document.getElementById('historyModal').classList.remove('open'));
    document.getElementById('closeHistoryBtn').addEventListener('click', () => document.getElementById('historyModal').classList.remove('open'));
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
