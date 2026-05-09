(function () {
  'use strict';

  const Components = {
    init(options = {}) {
      const title = options.title || '';
      const topbarContainer = document.getElementById('topbar-container');
      const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');

      if (topbarContainer) {
        topbarContainer.innerHTML = `
          <div class="topbar">
            <div class="tb-title">${title}</div>
            <div class="tb-right">
              <span class="tb-sub">${user.role === 'owner' ? 'Owner' : 'Cashier'}: ${user.name || 'User'}</span>
              <div class="avatar">${String(user.name || 'U').slice(0, 2).toUpperCase()}</div>
            </div>
          </div>
        `;
      }
    }
  };

  window.Components = Components;

  document.addEventListener('DOMContentLoaded', () => {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    // Apply layout class immediately
    document.body.classList.add('dashboard-body');

    sidebarContainer.innerHTML = `
      <div class="sidebar">
        <div class="logo">
          <div class="logo-box"><i class="fa-solid fa-cart-shopping"></i></div>
          <h2><span class="blue">Quick</span><span class="orange">POS</span></h2>
        </div>
        <div class="menu">
          <a href="owner_dashboard.html" class="menu-item owner-only" data-page="owner_dashboard"><i class="fa-solid fa-chart-line"></i> Dashboard</a>
          <a href="sales.html" class="menu-item" data-page="sales"><i class="fa-solid fa-cart-plus"></i> Make a Sale</a>
          <a href="categories.html" class="menu-item" data-page="categories"><i class="fa-solid fa-tags"></i> Categories</a>
          <a href="products.html" class="menu-item" data-page="products"><i class="fa-solid fa-box-open"></i> Products</a>
          <a href="inventory.html" class="menu-item" data-page="inventory"><i class="fa-solid fa-warehouse"></i> Inventory <span id="lowStockBadge" style="display:none;margin-left:auto;padding:2px 8px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;"></span></a>
          <a href="customers.html" class="menu-item" data-page="customers"><i class="fa-solid fa-users"></i> Customers</a>
          <a href="quotations.html" class="menu-item" data-page="quotations"><i class="fa-solid fa-file-invoice"></i> Quotations</a>
          <a href="ledger.html" class="menu-item" data-page="ledger"><i class="fa-solid fa-book"></i> Credit Ledger</a>
          <a href="sales_reports.html" class="menu-item" data-page="sales_reports"><i class="fa-solid fa-history"></i> Invoice History</a>
          <a href="reports.html" class="menu-item reports-allowed" data-page="reports"><i class="fa-solid fa-chart-pie"></i> Shift Reports</a>
          <a href="users.html" class="menu-item owner-only" data-page="users"><i class="fa-solid fa-user-gear"></i> Users</a>
          <a href="settings.html" class="menu-item owner-only" data-page="settings"><i class="fa-solid fa-cog"></i> Settings</a>
        </div>
        <div class="user-card">
          <div class="user-top">
            <div class="avatar" id="sidebarAvatar">U</div>
            <div class="user-info">
              <div class="user-name" id="sidebarUserName">User</div>
              <div class="user-role" id="sidebarUserRole">Role</div>
            </div>
          </div>
          <button class="logout-btn" id="sidebarLogoutBtn">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </div>
      </div>
    `;

    if (user.role === 'cashier') {
      document.querySelectorAll('.owner-only').forEach((el) => {
        el.style.display = 'none';
      });
      if (!user.canViewReports) {
        document.querySelectorAll('.reports-allowed').forEach((el) => {
          el.style.display = 'none';
        });
      }
    }

    // Initialize sidebar logic (copied from sidebar.js for integration)
    const userNameEl = document.getElementById('sidebarUserName');
    const userRoleEl = document.getElementById('sidebarUserRole');
    const avatarEl = document.getElementById('sidebarAvatar');

    if (user && userNameEl) userNameEl.textContent = user.name || 'User';
    if (user && userRoleEl) {
        userRoleEl.textContent = user.role === 'owner' ? 'Supermarket Owner' : 'Cashier';
    }
    if (user && avatarEl && user.name) {
        avatarEl.textContent = user.name.charAt(0).toUpperCase();
        if (user.role === 'cashier') {
            avatarEl.style.background = 'linear-gradient(135deg, #1D2DBF, #4054ff)';
        }
    }

    const menuItems = document.querySelectorAll('.menu-item');
    const currentPage = window.location.pathname.split("/").pop().replace('.html', '');

    menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page && currentPage.includes(item.dataset.page)) {
            item.classList.add('active');
        }
    });

    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('quickpos-user');
                window.location.href = 'login.html';
            }
        });
    }

    if (window.api?.getProducts) {
      window.api.getProducts().then((products) => {
        const low = (products || []).filter((p) => Number(p.current_stock || 0) > 0 && Number(p.current_stock || 0) <= Number(p.alert_level || 0)).length;
        const badge = document.getElementById('lowStockBadge');
        if (badge && low > 0) {
          badge.textContent = String(low);
          badge.style.display = 'inline-block';
        }
      }).catch(() => {});
    }
  });
})();
