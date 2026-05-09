document.addEventListener('DOMContentLoaded', () => {

    // 1. Load User Details from LocalStorage
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    
    if (user) {
        const userNameEl = document.getElementById('sidebarUserName');
        const userRoleEl = document.getElementById('sidebarUserRole');
        const avatarEl = document.getElementById('sidebarAvatar');

        if (userNameEl) userNameEl.textContent = user.name;
        if (userRoleEl) {
            userRoleEl.textContent = user.role === 'owner' ? 'Supermarket Owner' : 'Cashier';
        }
        if (avatarEl) {
            // Get first letter of name for avatar
            avatarEl.textContent = user.name.charAt(0).toUpperCase();
            
            // Change avatar color based on role
            if (user.role === 'cashier') {
                avatarEl.style.background = 'linear-gradient(135deg, #1D2DBF, #4054ff)';
            }
        }
    }

    // 2. Handle Active Menu State based on current URL
    const menuItems = document.querySelectorAll('.menu-item');
    const currentPage = window.location.pathname.split("/").pop().replace('.html', '');

    menuItems.forEach(item => {
        // Remove active class from all
        item.classList.remove('active');
        
        // Add active class if data-page matches current URL
        if (item.dataset.page && currentPage.includes(item.dataset.page)) {
            item.classList.add('active');
        }

        // Add Click listener for navigation
        item.addEventListener('click', () => {
            // If it's a link (handled by href), we don't need to do anything here
            // But we can add redirect if needed:
            if (item.tagName === 'A') return;
            
            if (item.dataset.page) {
                window.location.href = `${item.dataset.page}.html`;
            }
        });
    });

    // 3. Handle Logout
    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('quickpos-user');
                window.location.href = 'login.html';
            }
        });
    }

});
