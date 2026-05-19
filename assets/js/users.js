(function() {
    'use strict';

    let users = [];

    const staffTableBody = document.getElementById('staffTableBody');
    const userModalOverlay = document.getElementById('userModalOverlay');
    const submitUserBtn = document.getElementById('submitUserBtn');

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
