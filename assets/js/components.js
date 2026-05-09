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
              <div class="notif-wrapper">
                <div class="tb-notifications" id="notifBell" title="Low Stock Alerts">
                  <i class="fa-solid fa-bell"></i>
                  <span class="notif-badge" id="topbarNotifBadge" style="display:none;">0</span>
                </div>
                <div class="notif-dropdown" id="notifDropdown">
                  <div class="nd-header">Notifications</div>
                  <div class="nd-body" id="notifList">
                    <div class="nd-empty">No new notifications</div>
                  </div>
                  <div class="nd-footer" onclick="location.href='inventory.html'">View All Inventory</div>
                </div>
              </div>
              <span class="tb-sub">${user.name || 'User'}</span>
              <div class="avatar">${String(user.name || 'U').slice(0, 2).toUpperCase()}</div>
            </div>
          </div>
          <div id="toast-container" class="toast-container"></div>
        `;

        // Bind events after HTML is set
        const bell = document.getElementById('notifBell');
        const dropdown = document.getElementById('notifDropdown');
        if (bell && dropdown) {
          bell.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
          });
          document.addEventListener('click', () => dropdown.classList.remove('open'));
          dropdown.addEventListener('click', (e) => e.stopPropagation());
        }

        // Notifications logic is now handled in notifications.js
        if (window.Notifications) window.Notifications.refresh();
      }
    }
  };

  window.Components = Components;

  document.addEventListener('DOMContentLoaded', () => {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    const user = JSON.parse(localStorage.getItem('quickpos-user') || '{}');
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
        <div style="padding: 20px 0;">
          <button class="logout-btn" id="sidebarLogoutBtn">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </div>
      </div>
    `;

    if (user.role === 'cashier') {
      document.querySelectorAll('.owner-only').forEach((el) => el.style.display = 'none');
      if (!user.canViewReports) {
        document.querySelectorAll('.reports-allowed').forEach((el) => el.style.display = 'none');
      }
    }

    const menuItems = document.querySelectorAll('.menu-item');
    const currentPage = window.location.pathname.split("/").pop().replace('.html', '');
    menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page && currentPage.includes(item.dataset.page)) item.classList.add('active');
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

    // Notifications logic is now handled in notifications.js
    if (window.Notifications) window.Notifications.refresh();
  });
})();
