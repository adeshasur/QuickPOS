/**
 * QuickPOS Component System
 * Handles dynamic rendering of Sidebar and Top-bar across all pages.
 */

const Components = (function() {
    'use strict';

    const getSidebarTemplate = () => `
        <div class="sidebar expanded" id="sidebar">
            <div class="hamburger-menu">
                <button class="hamburger-btn" id="hamburgerBtn"><span id="hamburgerIcon">☰</span></button>
                <div class="logo" id="logo">QuickPOS</div>
            </div>
            <div class="nav-items">
                <a href="owner_dashboard.html" class="nav-item owner-only">
                    <span class="nav-icon">📋</span><span class="nav-text">Dashboard</span>
                </a>
                <a href="sales.html" class="nav-item">
                    <span class="nav-icon">💰</span><span class="nav-text">Make a Sale</span>
                </a>
                <a href="categories.html" class="nav-item">
                    <span class="nav-icon">🏷️</span><span class="nav-text">Categories</span>
                </a>
                <a href="products.html" class="nav-item">
                    <span class="nav-icon">📦</span><span class="nav-text">Products</span>
                </a>
                <a href="inventory.html" class="nav-item">
                    <span class="nav-icon">🚚</span><span class="nav-text">Inventory</span>
                </a>
                <a href="customers.html" class="nav-item">
                    <span class="nav-icon">👤</span><span class="nav-text">Customers</span>
                </a>
                <a href="quotations.html" class="nav-item">
                    <span class="nav-icon">📄</span><span class="nav-text">Quotations</span>
                </a>
                <a href="ledger.html" class="nav-item">
                    <span class="nav-icon">📒</span><span class="nav-text">Credit Ledger</span>
                </a>
                <a href="sales_reports.html" class="nav-item">
                    <span class="nav-icon">🧾</span><span class="nav-text">Invoice History</span>
                </a>
                <a href="reports.html" class="nav-item owner-only">
                    <span class="nav-icon">📊</span><span class="nav-text">Shift Reports</span>
                </a>
                <a href="users.html" class="nav-item owner-only">
                    <span class="nav-icon">👥</span><span class="nav-text">Users</span>
                </a>
                <a href="settings.html" class="nav-item owner-only">
                    <span class="nav-icon">⚙️</span><span class="nav-text">Settings</span>
                </a>
                <a href="#" class="nav-item" id="logoutBtn">
                    <span class="nav-icon">🚪</span><span class="nav-text">Logout</span>
                </a>
            </div>
        </div>
    `;

    const getTopbarTemplate = (title, user, topbarRight) => `
        <div class="top-bar">
            <div class="page-title">${title}</div>
            <div class="topbar-right-content" style="margin-left: auto; margin-right: 20px;">
                ${topbarRight || ''}
            </div>
            <div class="user-info">
                <span id="cashierNameDisplay">${user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}: ${user ? user.name : 'Loading...'}</span>
                <div class="user-avatar">${user ? user.name.charAt(0).toUpperCase() : 'U'}</div>
            </div>
        </div>
    `;

    function initSidebar() {
        const container = document.getElementById('sidebar-container');
        if (!container) return;

        container.innerHTML = getSidebarTemplate();

        // Handle Active State
        const currentPage = window.location.pathname.split('/').pop() || 'owner_dashboard.html';
        const navItems = container.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href === currentPage) {
                item.classList.add('active');
            }
        });

        // Handle Role Visibility
        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        if (user && user.role === 'cashier') {
            container.querySelectorAll('.owner-only').forEach(el => el.style.display = 'none');
        }

        // Sidebar Persistence
        const sidebar = document.getElementById('sidebar');
        const sidebarState = localStorage.getItem('quickpos-sidebar');
        if (sidebarState === 'collapsed') {
            sidebar.classList.remove('expanded');
            sidebar.classList.add('collapsed');
            const logo = document.getElementById('logo');
            if(logo) logo.classList.add('collapsed');
            const icon = document.getElementById('hamburgerIcon');
            if(icon) icon.textContent = '→';
        }

        // Global Event Listeners (Hamburger, Logout)
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => {
                const sb = document.getElementById('sidebar');
                const lg = document.getElementById('logo');
                const hi = document.getElementById('hamburgerIcon');
                
                if(!sb) return;
                sb.classList.toggle('expanded');
                sb.classList.toggle('collapsed');
                if(lg) lg.classList.toggle('collapsed');
                
                const isCollapsed = sb.classList.contains('collapsed');
                if(hi) hi.textContent = isCollapsed ? '→' : '☰';
                localStorage.setItem('quickpos-sidebar', isCollapsed ? 'collapsed' : 'expanded');
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
        }
    }

    function initTopbar(title, topbarRight) {
        const container = document.getElementById('topbar-container');
        if (!container) return;

        const user = JSON.parse(localStorage.getItem('quickpos-user'));
        container.innerHTML = getTopbarTemplate(title, user, topbarRight);
    }

    return {
        init: function(config) {
            initSidebar();
            if (config && config.title) {
                initTopbar(config.title, config.topbarRight);
            }
        }
    };
})();
