(function() {
    'use strict';

    let users = [];

    const staffTableBody = document.getElementById('staffTableBody');
    const userModalOverlay = document.getElementById('userModalOverlay');
    const historyModalOverlay = document.getElementById('historyModalOverlay');
    const submitUserBtn = document.getElementById('submitUserBtn');

    const fmt = window.fmtLKR || ((n) => `LKR ${Number(n || 0).toFixed(2)}`);

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[char]));
    }

    async function loadUsers() {
        try {
            users = await window.api.getUsers();
            
            // Calculate KPI metrics
            const totalStaff = users.length;
            const activeUsers = users.length;
            const cashiers = users.filter(u => u.role === 'cashier').length;

            const totalStaffCount = document.getElementById('totalStaffCount');
            const activeUsersCount = document.getElementById('activeUsersCount');
            const cashiersCount = document.getElementById('cashiersCount');

            if (totalStaffCount) totalStaffCount.textContent = totalStaff;
            if (activeUsersCount) activeUsersCount.textContent = activeUsers;
            if (cashiersCount) cashiersCount.textContent = cashiers;

            renderStaffTable();
        } catch (err) {
            console.error('Error loading users:', err);
        }
    }

    function renderStaffTable(filteredUsers = users) {
        if(!staffTableBody) return;
        const loggedUser = JSON.parse(localStorage.getItem('quickpos-user')) || {};

        staffTableBody.innerHTML = filteredUsers.map(user => {
            const isSelf = user.username === loggedUser.username || user.id === loggedUser.id;
            const contactEmail = `${user.username.toLowerCase()}@quickpos.com`;

            const deleteBtnHtml = isSelf
                ? `<button class="action-btn delete-btn" style="opacity: 0.35; cursor: not-allowed;" title="Cannot delete your own active session account" disabled onclick="event.stopPropagation()">
                       <span class="material-symbols-rounded s18">delete</span>
                   </button>`
                : `<button class="action-btn delete-btn" onclick="deleteUser(${user.id})">
                       <span class="material-symbols-rounded s18">delete</span>
                   </button>`;

            return `
                <tr>
                    <td class="user-id-cell">#${String(user.id).padStart(3, '0')}</td>
                    <td class="name-cell">${user.name}</td>
                    <td class="username-cell">@${user.username}</td>
                    <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                    <td><span class="contact-email">${contactEmail}</span></td>
                    <td><div class="status-badge status-active"><span class="status-dot"></span>active</div></td>
                    <td class="actions-cell">
                        <div class="action-buttons">
                            <button class="action-btn edit-btn" onclick="editUser(${user.id})">
                                <span class="material-symbols-rounded s18">edit</span>
                            </button>
                            <button class="action-btn history-btn" onclick="viewUserHistory(${user.id})" title="Working & Salary History">
                                <span class="material-symbols-rounded s18">work_history</span>
                            </button>
                            ${deleteBtnHtml}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.editUser = (id) => {
        const user = users.find(u => u.id === id);
        if(!user) return;
        
        document.getElementById('userName').value = user.name;
        document.getElementById('userUsername').value = user.username;
        document.getElementById('userRole').value = user.role;
        document.getElementById('canViewReports').checked = Number(user.can_view_reports || 0) === 1;
        document.getElementById('userPassword').value = ''; // Don't show password
        
        if(submitUserBtn) {
            submitUserBtn.dataset.mode = 'edit';
            submitUserBtn.dataset.userId = id;
        }
        if(userModalOverlay) userModalOverlay.classList.add('active');
    };

    window.viewUserHistory = async (id) => {
        const user = users.find(u => u.id === id);
        if (!user) return;

        const summaryGrid = document.getElementById('historySummaryGrid');
        const tbody = document.getElementById('historyTableBody');
        summaryGrid.innerHTML = '<div class="history-loading">Loading history...</div>';
        tbody.innerHTML = '';
        historyModalOverlay.classList.add('active');

        try {
            const result = await window.api.getUserShiftHistory({ cashierName: user.name, limit: 100 });
            const summary = result.summary || {};
            const rows = result.rows || [];

            summaryGrid.innerHTML = `
                <div class="history-summary-card"><span>Staff</span><strong>${escapeHtml(user.name)}</strong></div>
                <div class="history-summary-card"><span>Shifts</span><strong>${Number(summary.shift_count || 0).toLocaleString()}</strong></div>
                <div class="history-summary-card"><span>Total Sales</span><strong>${fmt(summary.total_sales || 0)}</strong></div>
                <div class="history-summary-card"><span>Total Salary</span><strong>${fmt(summary.total_salary || 0)}</strong></div>
            `;

            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No shift history recorded yet.</div></td></tr>';
                return;
            }

            tbody.innerHTML = rows.map((row) => `
                <tr>
                    <td>${row.shift_end ? new Date(row.shift_end).toLocaleString() : '-'}</td>
                    <td>${escapeHtml(row.duration || '-')}</td>
                    <td>${fmt(row.total_sales || 0)}</td>
                    <td>${Number(row.items_sold || 0).toLocaleString()}</td>
                    <td>${escapeHtml(row.salary_basis || '-')}</td>
                    <td>${fmt(row.salary_earned || 0)}</td>
                    <td class="${Number(row.variance || 0) === 0 ? '' : 'variance-warn'}">${fmt(row.variance || 0)}</td>
                </tr>
            `).join('');
        } catch (err) {
            summaryGrid.innerHTML = `<div class="history-loading error">Failed to load history: ${escapeHtml(err.message)}</div>`;
        }
    };

    window.deleteUser = async (id) => {
        if(confirm('Are you sure you want to delete this user?')) {
            try {
                await window.api.deleteUser(id);
                loadUsers();
            } catch (err) {
                alert('Error deleting user: ' + err.message);
            }
        }
    };

    async function handleUserSubmit() {
        const name = document.getElementById('userName').value.trim();
        const username = document.getElementById('userUsername').value.trim();
        const password = document.getElementById('userPassword').value.trim();
        const role = document.getElementById('userRole').value;
        const canViewReports = document.getElementById('canViewReports').checked;

        if (!name || !username) {
            alert('Name and Username are required');
            return;
        }

        const userData = { name, username, role, canViewReports };
        if (password) userData.password = password;

        if (submitUserBtn.dataset.mode === 'edit') {
            userData.id = parseInt(submitUserBtn.dataset.userId);
        } else {
            if (!password) {
                alert('Password is required for new users');
                return;
            }
        }

        try {
            await window.api.saveUser(userData);
            if(userModalOverlay) userModalOverlay.classList.remove('active');
            loadUsers();
        } catch (err) {
            alert('Error saving user: ' + err.message);
        }
    }

    async function init() {
        const loggedUser = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!loggedUser || loggedUser.role !== 'owner') {
            alert('Access Denied: Owner Only');
            window.location.href = loggedUser ? 'owner_dashboard.html' : 'login.html';
            return;
        }

        await loadUsers();
        Components.init({ title: 'User Management' });

        const createUserBtn = document.getElementById('createUserBtn');
        if(createUserBtn) {
            createUserBtn.addEventListener('click', () => {
                document.getElementById('userName').value = '';
                document.getElementById('userUsername').value = '';
                document.getElementById('userPassword').value = '';
                document.getElementById('canViewReports').checked = false;
                if(submitUserBtn) submitUserBtn.dataset.mode = 'create';
                if(userModalOverlay) userModalOverlay.classList.add('active');
            });
        }

        const closeModalBtn = document.getElementById('closeModalBtn');
        if(closeModalBtn) closeModalBtn.addEventListener('click', () => userModalOverlay.classList.remove('active'));
        
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        if(cancelModalBtn) cancelModalBtn.addEventListener('click', () => userModalOverlay.classList.remove('active'));

        document.getElementById('closeHistoryModalBtn')?.addEventListener('click', () => historyModalOverlay.classList.remove('active'));
        document.getElementById('closeHistoryFooterBtn')?.addEventListener('click', () => historyModalOverlay.classList.remove('active'));

        if(submitUserBtn) {
            submitUserBtn.addEventListener('click', handleUserSubmit);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
