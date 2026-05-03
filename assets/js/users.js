(function() {
    'use strict';

    // Mock initial data - should eventually come from SQLite
    let users = JSON.parse(localStorage.getItem('quickpos-users')) || [
        { id: 1, userId: '#001', name: 'Adheesha Owner', username: 'admin', role: 'owner', status: 'active', canViewReports: true },
        { id: 2, userId: '#002', name: 'Staff Member', username: 'staff', role: 'cashier', status: 'active', canViewReports: false }
    ];

    const staffTableBody = document.getElementById('staffTableBody');
    const userModalOverlay = document.getElementById('userModalOverlay');
    const submitUserBtn = document.getElementById('submitUserBtn');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

    function renderStaffTable(filteredUsers = users) {
        if(!staffTableBody) return;
        staffTableBody.innerHTML = filteredUsers.map(user => `
            <tr>
                <td class="user-id-cell">${user.userId}</td>
                <td class="name-cell">${user.name}</td>
                <td class="username-cell">@${user.username}</td>
                <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                <td><div class="status-badge status-${user.status}"><span class="status-dot"></span>${user.status}</div></td>
                <td class="actions-cell">
                    <div class="action-buttons">
                        <button class="action-btn edit-btn" onclick="editUser(${user.id})">✏️</button>
                        <button class="action-btn delete-btn" onclick="deleteUser(${user.id})">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    window.editUser = (id) => {
        const user = users.find(u => u.id === id);
        if(!user) return;
        const nameEl = document.getElementById('userName');
        const usernameEl = document.getElementById('userUsername');
        const roleEl = document.getElementById('userRole');
        const reportsEl = document.getElementById('canViewReports');
        
        if(nameEl) nameEl.value = user.name;
        if(usernameEl) usernameEl.value = user.username;
        if(roleEl) roleEl.value = user.role;
        if(reportsEl) reportsEl.checked = user.canViewReports;
        
        if(submitUserBtn) {
            submitUserBtn.dataset.mode = 'edit';
            submitUserBtn.dataset.userId = id;
        }
        if(userModalOverlay) userModalOverlay.classList.add('active');
    };

    window.deleteUser = (id) => {
        if(confirm('Are you sure you want to delete this user?')) {
            users = users.filter(u => u.id !== id);
            localStorage.setItem('quickpos-users', JSON.stringify(users));
            renderStaffTable();
        }
    };

    function init() {
        const loggedUser = JSON.parse(localStorage.getItem('quickpos-user'));
        if (!loggedUser || loggedUser.role !== 'owner') {
            alert('Access Denied: Owner Only');
            window.location.href = 'owner_dashboard.html';
            return;
        }

        renderStaffTable();

        // Event Listeners
        if(hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => {
                const sb = document.getElementById('sidebar');
                const hi = document.getElementById('hamburgerIcon');
                if(sb && hi) {
                    sb.classList.toggle('collapsed'); sb.classList.toggle('expanded');
                    hi.textContent = sb.classList.contains('collapsed') ? '→' : '☰';
                }
            });
        }

        const createUserBtn = document.getElementById('createUserBtn');
        if(createUserBtn) {
            createUserBtn.addEventListener('click', () => {
                const nameEl = document.getElementById('userName');
                const usernameEl = document.getElementById('userUsername');
                if(nameEl) nameEl.value = '';
                if(usernameEl) usernameEl.value = '';
                if(submitUserBtn) submitUserBtn.dataset.mode = 'create';
                if(userModalOverlay) userModalOverlay.classList.add('active');
            });
        }

        const closeModalBtn = document.getElementById('closeModalBtn');
        if(closeModalBtn) closeModalBtn.addEventListener('click', () => userModalOverlay.classList.remove('active'));
        
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        if(cancelModalBtn) cancelModalBtn.addEventListener('click', () => userModalOverlay.classList.remove('active'));

        if(submitUserBtn) {
            submitUserBtn.addEventListener('click', () => {
                const nameEl = document.getElementById('userName');
                const usernameEl = document.getElementById('userUsername');
                const roleEl = document.getElementById('userRole');
                const reportsEl = document.getElementById('canViewReports');

                const userData = {
                    name: nameEl ? nameEl.value : '',
                    username: usernameEl ? usernameEl.value : '',
                    role: roleEl ? roleEl.value : 'cashier',
                    canViewReports: reportsEl ? reportsEl.checked : false,
                    status: 'active'
                };

                if(submitUserBtn.dataset.mode === 'create') {
                    const newId = users.length + 1;
                    users.push({ ...userData, id: newId, userId: `#${String(newId).padStart(3, '0')}` });
                } else {
                    const id = parseInt(submitUserBtn.dataset.userId);
                    const idx = users.findIndex(u => u.id === id);
                    if(idx !== -1) users[idx] = { ...users[idx], ...userData };
                }

                localStorage.setItem('quickpos-users', JSON.stringify(users));
                renderStaffTable();
                if(userModalOverlay) userModalOverlay.classList.remove('active');
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if(logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if(confirm('Logout?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
