(function() {
    let customers = [];

    async function loadCustomers() {
        try {
            customers = await window.api.getCustomers();
            renderCustomers();
        } catch (err) {
            console.error('Error loading customers:', err);
        }
    }

    // ----- UI elements -----
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    const customerSearch = document.getElementById('customerSearch');
    const customerTableBody = document.getElementById('customerTableBody');

    // Modal elements
    const customerModal = document.getElementById('customerModal');
    const modalTitle = document.getElementById('modalTitle');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const customerForm = document.getElementById('customerForm');
    const customerId = document.getElementById('customerId');
    const custName = document.getElementById('custName');
    const custPhone = document.getElementById('custPhone');
    const custAddress = document.getElementById('custAddress');
    const custBalance = document.getElementById('custBalance');

    const formatCurrency = (amt) => `LKR ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    function renderCustomers(filterText = '') {
        const searchTerm = filterText.trim().toLowerCase();
        let filtered = customers;
        if (searchTerm !== '') {
            filtered = customers.filter(c => 
                (c.name && c.name.toLowerCase().includes(searchTerm)) || 
                (c.phone && c.phone.includes(searchTerm))
            );
        }

        if (filtered.length === 0) {
            customerTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding:0;">
                        <div class="empty-state">
                            <div class="empty-icon">👥</div>
                            <p>No customers found</p>
                            <p style="font-size:13px;">Add a new customer or adjust search</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach(cust => {
            const address = cust.address || '—';
            html += `
                <tr data-id="${cust.id}">
                    <td><strong>${escapeHtml(cust.name)}</strong></td>
                    <td>${escapeHtml(cust.phone)}</td>
                    <td>${escapeHtml(address)}</td>
                    <td class="balance-cell">${formatCurrency(cust.balance ?? 0)}</td>
                    <td class="action-cell">
                        <button class="action-btn edit-btn">
                            <span class="material-symbols-rounded s18">edit</span>
                        </button>
                        <button class="action-btn delete-btn">
                            <span class="material-symbols-rounded s18">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        });
        customerTableBody.innerHTML = html;
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function openAddModal() {
        modalTitle.textContent = 'Add Customer';
        customerId.value = '';
        custName.value = '';
        custPhone.value = '';
        custAddress.value = '';
        custBalance.value = '0';
        customerModal.classList.add('active');
        setTimeout(() => custName.focus(), 250);
    }

    function openEditModal(id) {
        const cust = customers.find(c => c.id === id);
        if (!cust) return;
        modalTitle.textContent = 'Edit Customer';
        customerId.value = cust.id;
        custName.value = cust.name;
        custPhone.value = cust.phone;
        custAddress.value = cust.address || '';
        custBalance.value = cust.balance ?? 0;
        customerModal.classList.add('active');
        setTimeout(() => custName.focus(), 250);
    }

    async function handleCustomerSubmit(e) {
        e.preventDefault();
        const name = custName.value.trim();
        const phone = custPhone.value.trim();
        const address = custAddress.value.trim();
        const balance = parseFloat(custBalance.value) || 0;
        const id = customerId.value ? parseInt(customerId.value) : null;

        if (!name || !phone) {
            alert('Name and Phone are required.');
            return;
        }

        try {
            await window.api.saveCustomer({ id, name, phone, address, balance });
            customerModal.classList.remove('active');
            loadCustomers();
        } catch (err) {
            alert('Error saving customer: ' + err.message);
        }
    }

    async function deleteCustomer(id) {
        if (confirm('Are you sure you want to delete this customer?')) {
            try {
                await window.api.deleteCustomer(id);
                loadCustomers();
            } catch (err) {
                alert('Error deleting customer: ' + err.message);
            }
        }
    }

    function init() {
        // Security check
        const user = JSON.parse(localStorage.getItem('quickpos-user') || 'null');
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        loadCustomers();

        addCustomerBtn.addEventListener('click', openAddModal);
        customerSearch.addEventListener('input', (e) => renderCustomers(e.target.value));

        customerTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const row = btn.closest('tr');
            if (!row) return;
            const custId = parseInt(row.dataset.id);

            if (btn.classList.contains('edit-btn')) {
                openEditModal(custId);
            } else if (btn.classList.contains('delete-btn')) {
                deleteCustomer(custId);
            }
        });

        closeModalBtn.addEventListener('click', () => customerModal.classList.remove('active'));
        cancelModalBtn.addEventListener('click', () => customerModal.classList.remove('active'));
        customerForm.addEventListener('submit', handleCustomerSubmit);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
