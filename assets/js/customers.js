(function() {
    // ----- Data management -----
    const STORAGE_KEY = 'quickpos-customers';

    // Default demo customers
    const defaultCustomers = [
        { id: 1, name: 'Kamal Perera', phone: '0771234567', address: 'Colombo 03', balance: 0 },
        { id: 2, name: 'Sunimal Silva', phone: '0719876543', address: 'Maharagama', balance: 0 }
    ];

    let customers = [];

    function loadCustomers() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                customers = JSON.parse(stored);
            } catch (e) {
                customers = [...defaultCustomers];
            }
        } else {
            customers = [...defaultCustomers];
        }
        customers = customers.map((c, idx) => ({ ...c, id: c.id || idx + 1 }));
        saveCustomers();
    }

    function saveCustomers() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
    }

    function getNextId() {
        return customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1;
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

    // Delete modal
    const deleteModal = document.getElementById('deleteModal');
    const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    let deleteCandidateId = null;

    const formatCurrency = (amt) => `LKR ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    function renderCustomers(filterText = '') {
        const searchTerm = filterText.trim().toLowerCase();
        let filtered = customers;
        if (searchTerm !== '') {
            filtered = customers.filter(c => 
                c.name.toLowerCase().includes(searchTerm) || 
                c.phone.includes(searchTerm)
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
                        <button class="action-btn edit" onclick="openEditModal(${cust.id})">
                            <span class="material-symbols-rounded s18">edit</span>
                        </button>
                        <button class="action-btn delete" onclick="requestDelete(${cust.id})">
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
        return unsafe
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

    function closeCustomerModal() {
        customerModal.classList.remove('active');
    }

    function closeDeleteModal() {
        deleteModal.classList.remove('active');
        deleteCandidateId = null;
    }

    function handleCustomerSubmit(e) {
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

        if (id) {
            const index = customers.findIndex(c => c.id === id);
            if (index !== -1) {
                customers[index] = { ...customers[index], name, phone, address, balance };
            }
        } else {
            const newId = getNextId();
            customers.push({ id: newId, name, phone, address, balance });
        }

        saveCustomers();
        renderCustomers(customerSearch.value);
        closeCustomerModal();
    }

    function requestDelete(id) {
        deleteCandidateId = id;
        deleteModal.classList.add('active');
    }

    function confirmDelete() {
        if (deleteCandidateId) {
            customers = customers.filter(c => c.id !== deleteCandidateId);
            saveCustomers();
            renderCustomers(customerSearch.value);
        }
        closeDeleteModal();
    }

    function init() {
        // Security check
        const user = JSON.parse(localStorage.getItem('quickpos-user') || 'null');
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Initialize Components
        Components.init({
            title: 'Customer Management'
        });

        loadCustomers();
        renderCustomers();

        // Search & Add
        addCustomerBtn.addEventListener('click', openAddModal);
        customerSearch.addEventListener('input', (e) => renderCustomers(e.target.value));

        // Table actions
        customerTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const row = btn.closest('tr');
            if (!row) return;
            const custId = parseInt(row.dataset.id);

            if (btn.classList.contains('edit-btn')) {
                openEditModal(custId);
            } else if (btn.classList.contains('delete-btn')) {
                requestDelete(custId);
            }
        });

        // Modals
        closeModalBtn.addEventListener('click', closeCustomerModal);
        cancelModalBtn.addEventListener('click', closeCustomerModal);
        customerModal.addEventListener('click', (e) => {
            if (e.target === customerModal) closeCustomerModal();
        });

        closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
        confirmDeleteBtn.addEventListener('click', confirmDelete);

        customerForm.addEventListener('submit', handleCustomerSubmit);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
