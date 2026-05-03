// Common JavaScript functions shared across all pages

// Load database helper
if (!window.dbHelper) {
    const script = document.createElement('script');
    script.src = 'js/db-helper.js';
    document.head.appendChild(script);
}

// Toggle sidebar function
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const hamburgerIcon = document.getElementById('hamburgerIcon');
    const logo = document.getElementById('logo');
    
    if (!sidebar) return;
    
    sidebar.classList.toggle('expanded');
    sidebar.classList.toggle('collapsed');
    
    if (logo) {
        logo.classList.toggle('collapsed');
    }
    
    if (hamburgerIcon) {
        if (sidebar.classList.contains('collapsed')) {
            hamburgerIcon.textContent = '→';
            localStorage.setItem('quickpos-sidebar', 'collapsed');
        } else {
            hamburgerIcon.textContent = '☰';
            localStorage.setItem('quickpos-sidebar', 'expanded');
        }
    }
}

// Check authentication
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    
    return user;
}

// Check user role and hide owner-only elements
function checkUserRole(user) {
    if (user.role === 'cashier') {
        const ownerLinks = document.querySelectorAll('.owner-only');
        ownerLinks.forEach(link => {
            link.style.display = 'none';
        });
    }
}

// Logout function
function setupLogout() {
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
}

// Initialize sidebar state
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    const sidebarState = localStorage.getItem('quickpos-sidebar');
    if (sidebarState === 'collapsed') {
        sidebar.classList.add('collapsed');
        sidebar.classList.remove('expanded');
        const logo = document.getElementById('logo');
        const hamburgerIcon = document.getElementById('hamburgerIcon');
        if (logo) logo.classList.add('collapsed');
        if (hamburgerIcon) hamburgerIcon.textContent = '→';
    } else {
        sidebar.classList.add('expanded');
        sidebar.classList.remove('collapsed');
    }
}

// Format currency as LKR
function formatCurrency(amount) {
    return `LKR ${amount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    })}`;
}

// Common initialization for all pages
function initCommon() {
    // Check authentication
    const user = checkAuth();
    if (!user) return;
    
    // Check user role
    checkUserRole(user);
    
    // Setup logout
    setupLogout();
    
    // Initialize sidebar
    initSidebar();
    
    // Setup hamburger menu
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleSidebar);
    }
    
    // Display user info if element exists
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        userNameEl.textContent = user.name;
    }
    
    const userRoleEl = document.getElementById('userRole');
    if (userRoleEl) {
        userRoleEl.textContent = user.role;
    }
}

// Run common initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initCommon);
