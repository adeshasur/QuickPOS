document.addEventListener('DOMContentLoaded', () => {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
        const activePage = window.location.pathname.split("/").pop();

        sidebarContainer.innerHTML = `
            <div class="sidebar expanded" id="sidebar">
                <div class="hamburger-menu">
                    <button class="hamburger-btn" id="hamburgerBtn">
                        <span id="hamburgerIcon">☰</span>
                    </button>
                    <div class="logo" id="logo">QuickPOS</div>
                </div>
                <div class="nav-items">
                    <a href="owner_dashboard.html" class="nav-item owner-only ${activePage === 'owner_dashboard.html' ? 'active' : ''}">
                        <span class="nav-icon">📋</span><span class="nav-text">Dashboard</span>
                    </a>
                    <a href="sales.html" class="nav-item ${activePage === 'sales.html' ? 'active' : ''}">
                        <span class="nav-icon">💰</span><span class="nav-text">Make a Sale</span>
                    </a>
                    <a href="categories.html" class="nav-item ${activePage === 'categories.html' ? 'active' : ''}">
                        <span class="nav-icon">🏷️</span><span class="nav-text">Categories</span>
                    </a>
                    <a href="products.html" class="nav-item ${activePage === 'products.html' ? 'active' : ''}">
                        <span class="nav-icon">📦</span><span class="nav-text">Products</span>
                    </a>
                    <a href="inventory.html" class="nav-item ${activePage === 'inventory.html' ? 'active' : ''}">
                        <span class="nav-icon">🚚</span><span class="nav-text">Inventory</span>
                    </a>
                    <a href="customers.html" class="nav-item ${activePage === 'customers.html' ? 'active' : ''}">
                        <span class="nav-icon">👤</span><span class="nav-text">Customers</span>
                    </a>
                    <a href="quotations.html" class="nav-item ${activePage === 'quotations.html' ? 'active' : ''}">
                        <span class="nav-icon">📄</span><span class="nav-text">Quotations</span>
                    </a>
                    <a href="ledger.html" class="nav-item ${activePage === 'ledger.html' ? 'active' : ''}">
                        <span class="nav-icon">📒</span><span class="nav-text">Credit Ledger</span>
                    </a>
                    <a href="sales_reports.html" class="nav-item ${activePage === 'sales_reports.html' ? 'active' : ''}">
                        <span class="nav-icon">🧾</span><span class="nav-text">Invoice History</span>
                    </a>
                    <a href="reports.html" class="nav-item owner-only ${activePage === 'reports.html' ? 'active' : ''}">
                        <span class="nav-icon">📊</span><span class="nav-text">Shift Reports</span>
                    </a>
                    <a href="users.html" class="nav-item owner-only ${activePage === 'users.html' ? 'active' : ''}">
                        <span class="nav-icon">👥</span><span class="nav-text">Users</span>
                    </a>
                    <a href="settings.html" class="nav-item owner-only ${activePage === 'settings.html' ? 'active' : ''}">
                        <span class="nav-icon">⚙️</span><span class="nav-text">Settings</span>
                    </a>
                    <a href="#" class="nav-item" id="globalLogoutBtn">
                        <span class="nav-icon">🚪</span><span class="nav-text">Logout</span>
                    </a>
                </div>
            </div>
        `;

        // Role check (ඕනර්ගේ දේවල් කෑෂියර්ට පෙන්වන්න එපා)
        if (user.role === 'cashier') {
            document.querySelectorAll('.owner-only').forEach(el => el.style.display = 'none');
        }
        
        // සයිඩ්බාර් Toggle Logic
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const sidebar = document.getElementById('sidebar');
        
        if (hamburgerBtn && sidebar) {
            // පෙර සේව් කරපු state එක ලෝඩ් කිරීම
            if (localStorage.getItem('quickpos-sidebar') === 'collapsed') {
                sidebar.classList.add('collapsed');
                sidebar.classList.remove('expanded');
                document.body.classList.add('sidebar-collapsed');
                const logoEl = document.getElementById('logo');
                if(logoEl) logoEl.classList.add('collapsed');
                const iconEl = document.getElementById('hamburgerIcon');
                if(iconEl) iconEl.textContent = '→';
            }

            hamburgerBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                sidebar.classList.toggle('expanded');
                document.body.classList.toggle('sidebar-collapsed');
                const logoEl = document.getElementById('logo');
                if(logoEl) logoEl.classList.toggle('collapsed');
                
                const isCollapsed = sidebar.classList.contains('collapsed');
                const iconEl = document.getElementById('hamburgerIcon');
                if(iconEl) iconEl.textContent = isCollapsed ? '→' : '☰';
                localStorage.setItem('quickpos-sidebar', isCollapsed ? 'collapsed' : 'expanded');
            });
        }

        // Global Logout Logic
        const logoutBtn = document.getElementById('globalLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Logout from the system?')) {
                    localStorage.removeItem('quickpos-user');
                    window.location.href = 'login.html';
                }
            });
        }
    }
});
