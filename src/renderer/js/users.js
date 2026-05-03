
        // Initial users data
        let users = JSON.parse(localStorage.getItem('quickpos-users')) || [
            {
                id: 1,
                userId: '#001',
                name: 'John Manager',
                username: 'john',
                role: 'owner',
                status: 'active',
                canViewReports: true,
                password: 'demo123'
            },
            {
                id: 2,
                userId: '#002',
                name: 'Sarah Cashier',
                username: 'sarah',
                role: 'cashier',
                status: 'active',
                canViewReports: true,
                password: 'demo123'
            },
            {
                id: 3,
                userId: '#003',
                name: 'Michael Assistant',
                username: 'michael',
                role: 'cashier',
                status: 'active',
                canViewReports: false,
                password: 'demo123'
            },
            {
                id: 4,
                userId: '#004',
                name: 'Emma Trainee',
                username: 'emma',
                role: 'cashier',
                status: 'inactive',
                canViewReports: false,
                password: 'demo123'
            }
        ];

        // DOM Elements
        const sidebar = document.getElementById('sidebar');
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const hamburgerIcon = document.getElementById('hamburgerIcon');
        const logo = document.getElementById('logo');
        const logoutBtn = document.getElementById('logoutBtn');
        const createUserBtn = document.getElementById('createUserBtn');
        const searchInput = document.getElementById('searchInput');
        const staffTableBody = document.getElementById('staffTableBody');
        
        // Modal Elements
        const userModalOverlay = document.getElementById('userModalOverlay');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelModalBtn = document.getElementById('cancelModalBtn');
        const submitUserBtn = document.getElementById('submitUserBtn');
        const userNameInput = document.getElementById('userName');
        const userUsernameInput = document.getElementById('userUsername');
        const userPasswordInput = document.getElementById('userPassword');
        const userRoleSelect = document.getElementById('userRole');
        const canViewReportsToggle = document.getElementById('canViewReports');

        // Toggle sidebar function (EXACT from reports.html)
        function toggleSidebar() {
            sidebar.classList.toggle('expanded');
            sidebar.classList.toggle('collapsed');
            logo.classList.toggle('collapsed');
            
            if (sidebar.classList.contains('collapsed')) {
                hamburgerIcon.textContent = 'â†’';
                localStorage.setItem('quickpos-sidebar', 'collapsed');
            } else {
                hamburgerIcon.textContent = 'â˜°';
                localStorage.setItem('quickpos-sidebar', 'expanded');
            }
        }

        // Generate User ID
        function generateUserId() {
            const highestId = users.reduce((max, user) => {
                const num = parseInt(user.userId.substring(1));
                return num > max ? num : max;
            }, 0);
            return `#${String(highestId + 1).padStart(3, '0')}`;
        }

        // Render staff table
        function renderStaffTable(filteredUsers = users) {
            staffTableBody.innerHTML = '';
            
            if (filteredUsers.length === 0) {
                staffTableBody.innerHTML = `
                    <tr>
                        <td colspan="6">
                            <div class="empty-state">
                                <div class="empty-icon">ðŸ‘¤</div>
                                <p>No staff members found</p>
                                <p>Click "Create New User" to add staff</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            filteredUsers.forEach(user => {
                const row = document.createElement('tr');
                
                // Determine role badge class and text
                let roleClass = '';
                let roleText = '';
                switch(user.role) {
                    case 'owner':
                        roleClass = 'role-owner';
                        roleText = 'Owner';
                        break;
                    case 'manager':
                        roleClass = 'role-manager';
                        roleText = 'Manager';
                        break;
                    case 'cashier':
                    default:
                        roleClass = 'role-cashier';
                        roleText = 'Cashier';
                }
                
                // Determine status badge
                const statusClass = user.status === 'active' ? 'status-active' : 'status-inactive';
                const statusText = user.status === 'active' ? 'Active' : 'Inactive';
                
                row.innerHTML = `
                    <td class="user-id-cell">${user.userId}</td>
                    <td class="name-cell">${user.name}</td>
                    <td class="username-cell">@${user.username}</td>
                    <td class="role-cell">
                        <span class="role-badge ${roleClass}">${roleText}</span>
                    </td>
                    <td class="status-cell">
                        <div class="status-badge ${statusClass}">
                            <span class="status-dot"></span>
                            ${statusText}
                        </div>
                    </td>
                    <td class="actions-cell">
                        <div class="action-buttons">
                            <button class="action-btn edit-btn" data-id="${user.id}" title="Edit">
                                âœï¸
                            </button>
                            <button class="action-btn delete-btn" data-id="${user.id}" title="Delete">
                                ðŸ—‘ï¸
                            </button>
                        </div>
                    </td>
                `;
                
                staffTableBody.appendChild(row);
            });
        }

        // Search users
        function searchUsers(searchTerm) {
            if (!searchTerm.trim()) {
                renderStaffTable(users);
                return;
            }
            
            const filteredUsers = users.filter(user => 
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.username.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            renderStaffTable(filteredUsers);
        }

        // Open modal for creating new user
        function openUserModal() {
            // Reset form
            userNameInput.value = '';
            userUsernameInput.value = '';
            userPasswordInput.value = '';
            userRoleSelect.value = 'cashier';
            canViewReportsToggle.checked = true;
            
            // Update modal title and button
            document.querySelector('.modal-title').innerHTML = '<span>ðŸ‘¤</span> Create New User';
            submitUserBtn.textContent = 'Create User';
            submitUserBtn.dataset.mode = 'create';
            
            // Show modal
            userModalOverlay.classList.add('active');
            userNameInput.focus();
        }

        // Close modal
        function closeUserModal() {
            userModalOverlay.classList.remove('active');
        }

        // Create new user
        function createUser(userData) {
            const newUser = {
                id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
                userId: generateUserId(),
                name: userData.name,
                username: userData.username,
                password: userData.password,
                role: userData.role,
                status: 'active',
                canViewReports: userData.canViewReports,
                createdAt: new Date().toISOString()
            };
            
            users.push(newUser);
            localStorage.setItem('quickpos-users', JSON.stringify(users));
            renderStaffTable();
            
            // Log users for backend developer
            console.log('=== USERS DATA (for backend) ===');
            console.log(JSON.stringify(users, null, 2));
            console.log('==============================');
            
            return newUser;
        }

        // Edit user
        function editUser(userId) {
            const user = users.find(u => u.id === userId);
            if (!user) return;
            
            // Fill form with user data
            userNameInput.value = user.name;
            userUsernameInput.value = user.username;
            userPasswordInput.value = ''; // Don't show password for security
            userRoleSelect.value = user.role;
            canViewReportsToggle.checked = user.canViewReports;
            
            // Update modal title and button
            document.querySelector('.modal-title').innerHTML = '<span>âœï¸</span> Edit User';
            submitUserBtn.textContent = 'Update User';
            submitUserBtn.dataset.mode = 'edit';
            submitUserBtn.dataset.userId = userId;
            
            // Show modal
            userModalOverlay.classList.add('active');
            userNameInput.focus();
        }

        // Update user
        function updateUser(userId, userData) {
            const userIndex = users.findIndex(u => u.id === userId);
            if (userIndex === -1) return false;
            
            // Update user data
            users[userIndex] = {
                ...users[userIndex],
                name: userData.name,
                username: userData.username,
                role: userData.role,
                canViewReports: userData.canViewReports
            };
            
            // Update password only if provided
            if (userData.password) {
                users[userIndex].password = userData.password;
            }
            
            localStorage.setItem('quickpos-users', JSON.stringify(users));
            renderStaffTable();
            
            // Log users for backend developer
            console.log('=== UPDATED USERS DATA ===');
            console.log(JSON.stringify(users, null, 2));
            console.log('========================');
            
            return true;
        }

        // Delete user
        function deleteUser(userId) {
            if (!confirm('Are you sure you want to delete this user?')) {
                return;
            }
            
            const userIndex = users.findIndex(u => u.id === userId);
            if (userIndex === -1) return;
            
            // Don't allow deleting the last owner
            const userToDelete = users[userIndex];
            const ownerCount = users.filter(u => u.role === 'owner').length;
            
            if (userToDelete.role === 'owner' && ownerCount <= 1) {
                alert('Cannot delete the last owner account. Please assign another user as owner first.');
                return;
            }
            
            users.splice(userIndex, 1);
            localStorage.setItem('quickpos-users', JSON.stringify(users));
            renderStaffTable();
            
            // Log users for backend developer
            console.log('=== USERS AFTER DELETE ===');
            console.log(JSON.stringify(users, null, 2));
            console.log('==========================');
        }

        // Handle form submission
        function handleUserSubmit() {
            const name = userNameInput.value.trim();
            const username = userUsernameInput.value.trim();
            const password = userPasswordInput.value;
            const role = userRoleSelect.value;
            const canViewReports = canViewReportsToggle.checked;
            const mode = submitUserBtn.dataset.mode;
            
            // Basic validation
            if (!name || !username) {
                alert('Please fill in all required fields');
                return;
            }
            
            if (mode === 'create' && !password) {
                alert('Please enter a password for the new user');
                return;
            }
            
            // Check if username already exists (for new users)
            if (mode === 'create') {
                const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
                if (existingUser) {
                    alert('Username already exists. Please choose a different username.');
                    return;
                }
            }
            
            const userData = {
                name,
                username,
                password,
                role,
                canViewReports
            };
            
            if (mode === 'create') {
                createUser(userData);
                alert('User created successfully!');
            } else if (mode === 'edit') {
                const userId = parseInt(submitUserBtn.dataset.userId);
                updateUser(userId, userData);
                alert('User updated successfully!');
            }
            
            closeUserModal();
        }

        // Initialize the app
        function init() {
            // Set up event listeners
            hamburgerBtn.addEventListener('click', toggleSidebar);
            
            logoutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
            
            // Create user button
            createUserBtn.addEventListener('click', openUserModal);
            
            // Search functionality
            searchInput.addEventListener('input', (e) => {
                searchUsers(e.target.value);
            });
            
            // Modal controls
            closeModalBtn.addEventListener('click', closeUserModal);
            cancelModalBtn.addEventListener('click', closeUserModal);
            submitUserBtn.addEventListener('click', handleUserSubmit);
            
            // Close modal when clicking outside
            userModalOverlay.addEventListener('click', (e) => {
                if (e.target === userModalOverlay) {
                    closeUserModal();
                }
            });
            
            // Handle edit/delete clicks (delegated event)
            staffTableBody.addEventListener('click', (e) => {
                const target = e.target.closest('button');
                if (!target) return;
                
                const userId = parseInt(target.dataset.id);
                
                if (target.classList.contains('edit-btn')) {
                    editUser(userId);
                } else if (target.classList.contains('delete-btn')) {
                    deleteUser(userId);
                }
            });
            
            // Set initial sidebar state from localStorage
            const sidebarState = localStorage.getItem('quickpos-sidebar');
            if (sidebarState === 'collapsed') {
                toggleSidebar();
            }
            
            // Initial render
            renderStaffTable();
            
            // Log initial users data for backend developer
            console.log('=== INITIAL USERS DATA ===');
            console.log(JSON.stringify(users, null, 2));
            console.log('==========================');
        }

        // Initialize when DOM is loaded
        document.addEventListener('DOMContentLoaded', init);



        //


        document.addEventListener('DOMContentLoaded', () => {
    // 1. Get the user data from storage
    const user = JSON.parse(localStorage.getItem('quickpos-user'));

    // 2. Security Check: If someone tries to open the file without logging in
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // 3. Role Check: If user is a Cashier, hide the Owner-only buttons
    if (user.role === 'cashier') {
        const ownerLinks = document.querySelectorAll('.owner-only');
        ownerLinks.forEach(link => {
            link.style.display = 'none'; 
        });
    }

    // 4. Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Do you want to logout?')) {
                localStorage.removeItem('quickpos-user');
                window.location.href = 'login.html';
            }
        });
    }
});
    
