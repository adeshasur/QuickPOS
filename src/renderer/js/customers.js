
        (function() {
            // ----- Data management -----
            const STORAGE_KEY = 'quickpos-customers';

            // Default demo customers
            const defaultCustomers = [
                { id: 1, name: 'Kamal Perera', phone: '0771234567', address: 'Colombo 03', balance: 0 },
                { id: 2, name: 'Sunimal Silva', phone: '0719876543', address: 'Maharagama', balance: 0 }
            ];

            // Load customers from localStorage or initialize with demo
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
                // ensure each has an id
                customers = customers.map((c, idx) => ({ ...c, id: c.id || idx + 1 }));
                saveCustomers();
            }

            function saveCustomers() {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
            }

            // Helper to get next id
            function getNextId() {
                return customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1;
            }

            // ----- UI elements -----
            const sidebar = document.getElementById('sidebar');
            const hamburgerBtn = document.getElementById('hamburgerBtn');
            const hamburgerIcon = document.getElementById('hamburgerIcon');
            const logo = document.getElementById('logo');
            const logoutBtn = document.getElementById('logoutBtn');
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
            const custBalance = document.getElementById('custBalance'); // hidden

            // Delete modal
            const deleteModal = document.getElementById('deleteModal');
            const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
            const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
            const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
            let deleteCandidateId = null;

            // Format currency (LKR)
            const formatCurrency = (amt) => `LKR ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            // Render table with optional filter
            function renderCustomers(filterText = '') {
                const searchTerm = filterText.trim().toLowerCase();
                let filtered = customers;
                if (searchTerm !== '') {
                    filtered = customers.filter(c => 
                        c.name.toLowerCase().includes(searchTerm) || 
                        c.phone.includes(searchTerm) // phone contains digits
                    );
                }

                if (filtered.length === 0) {
                    customerTableBody.innerHTML = `
                        <tr>
                            <td colspan="5" style="padding:0;">
                                <div class="empty-state">
                                    <div class="empty-icon">ðŸ‘¥</div>
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
                    const address = cust.address || 'â€”';
                    html += `
                        <tr data-id="${cust.id}">
                            <td><strong>${escapeHtml(cust.name)}</strong></td>
                            <td>${escapeHtml(cust.phone)}</td>
                            <td>${escapeHtml(address)}</td>
                            <td class="balance-cell">${formatCurrency(cust.balance ?? 0)}</td>
                            <td class="action-cell">
                                <button class="action-btn edit-btn" data-id="${cust.id}">
                                    <span>âœï¸</span> Edit
                                </button>
                                <button class="action-btn delete-btn" data-id="${cust.id}">
                                    <span>ðŸ—‘ï¸</span> Delete
                                </button>
                            </td>
                        </tr>
                    `;
                });
                customerTableBody.innerHTML = html;
            }

            // simple escape for innerHTML safety
            function escapeHtml(unsafe) {
                if (!unsafe) return '';
                return unsafe
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }

            // Open add modal
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

            // Open edit modal
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

            // Close modals
            function closeCustomerModal() {
                customerModal.classList.remove('active');
            }

            function closeDeleteModal() {
                deleteModal.classList.remove('active');
                deleteCandidateId = null;
            }

            // Save (add or update)
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
                    // update existing
                    const index = customers.findIndex(c => c.id === id);
                    if (index !== -1) {
                        customers[index] = { ...customers[index], name, phone, address, balance };
                    }
                } else {
                    // add new
                    const newId = getNextId();
                    customers.push({ id: newId, name, phone, address, balance });
                }

                saveCustomers();
                renderCustomers(customerSearch.value);
                closeCustomerModal();
            }

            // Delete flow
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

            // ----- Event listeners -----
            function init() {
                loadCustomers();
                renderCustomers();

                // Sidebar toggle
                hamburgerBtn.addEventListener('click', () => {
                    const isCollapsed = sidebar.classList.contains('collapsed');
                    if (isCollapsed) {
                        sidebar.classList.remove('collapsed');
                        sidebar.classList.add('expanded');
                        logo.classList.remove('collapsed');
                        hamburgerIcon.textContent = 'â˜°';
                        localStorage.setItem('quickpos-sidebar', 'expanded');
                    } else {
                        sidebar.classList.remove('expanded');
                        sidebar.classList.add('collapsed');
                        logo.classList.add('collapsed');
                        hamburgerIcon.textContent = 'â†’';
                        localStorage.setItem('quickpos-sidebar', 'collapsed');
                    }
                });

                // Load sidebar state
                const savedSidebar = localStorage.getItem('quickpos-sidebar');
                if (savedSidebar === 'collapsed') {
                    sidebar.classList.remove('expanded');
                    sidebar.classList.add('collapsed');
                    logo.classList.add('collapsed');
                    hamburgerIcon.textContent = 'â†’';
                }

                // Logout
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (confirm('Logout?')) {
                        localStorage.removeItem('quickpos-user');
                        window.location.href = 'login.html';
                    }
                });

                // Add button
                addCustomerBtn.addEventListener('click', openAddModal);

                // Search input
                customerSearch.addEventListener('input', (e) => {
                    renderCustomers(e.target.value);
                });

                // Table actions (edit/delete) via delegation
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

                // Modal close buttons
                closeModalBtn.addEventListener('click', closeCustomerModal);
                cancelModalBtn.addEventListener('click', closeCustomerModal);
                customerModal.addEventListener('click', (e) => {
                    if (e.target === customerModal) closeCustomerModal();
                });

                // Delete modal controls
                closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
                cancelDeleteBtn.addEventListener('click', closeDeleteModal);
                deleteModal.addEventListener('click', (e) => {
                    if (e.target === deleteModal) closeDeleteModal();
                });
                confirmDeleteBtn.addEventListener('click', confirmDelete);

                // Form submit
                customerForm.addEventListener('submit', handleCustomerSubmit);

                // Security/role: hide owner items if cashier
                const user = JSON.parse(localStorage.getItem('quickpos-user') || 'null');
                if (user && user.role === 'cashier') {
                    document.querySelectorAll('.owner-only').forEach(el => el.style.display = 'none');
                }
                const shift = localStorage.getItem('quickpos-shift-time') || '08:00 - 16:00';
                document.getElementById('shiftTime').textContent = `Shift: ${shift}`;
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
            }
        })();
    
