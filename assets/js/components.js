(function () {
  'use strict';

  let isNavigating = false;
  const CASHIER_SIDEBAR_PREF_KEY = 'quickpos-cashier-sidebar-hidden';

  function isMobileSidebarViewport() {
    return window.matchMedia('(max-width: 1024px)').matches;
  }

  function getCurrentUser() {
    const raw = localStorage.getItem('quickpos-user') || localStorage.getItem('quickposUser');
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (_err) {
      return {};
    }
  }

  function runPageEnterTransition() {
    document.body.classList.add('page-enter');
    requestAnimationFrame(() => {
      document.body.classList.add('page-enter-active');
    });
  }

  function smoothNavigate(url) {
    if (!url || isNavigating) return;
    isNavigating = true;
    document.body.classList.add('page-leaving');
    setTimeout(() => {
      window.location.href = url;
    }, 45);
  }

  function bindSmoothNavigation() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target && link.target !== '_self') return;
      if (!href.endsWith('.html')) return;

      event.preventDefault();
      smoothNavigate(href);
    }, true);
  }

  const Components = {
    init(options = {}) {
      const title = options.title || '';
      const actions = options.actions || '';
      const topbarContainer = document.getElementById('topbar-container');
      const user = getCurrentUser();
      const isCashier = user.role === 'cashier';
      const avatarSeed = String(user.name || user.username || 'U').trim();
      const avatarText = avatarSeed.slice(0, 2).toUpperCase();

      if (topbarContainer) {
        topbarContainer.innerHTML = `
          <div class="topbar">
            <button class="menu-toggle-btn" id="globalMenuToggle" title="Open Menu">
              <i class="fa-solid fa-bars"></i>
            </button>
            <div class="tb-title">${title}</div>
            <div class="tb-actions">${actions}</div>
              <div class="tb-right">
                <div class="tb-chip" id="globalTopClock">00:00:00 AM</div>
                <div class="tb-refresh" id="topbarRefreshBtn" title="Sync Data">
                  <i class="fa-solid fa-arrows-rotate"></i>
                </div>
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
                <div class="avatar">${avatarText}</div>
              </div>
          </div>
          <div id="toast-container" class="toast-container"></div>
        `;

        // Bind events after HTML is set
        const toggleBtn = document.getElementById('globalMenuToggle');

        const syncCashierSidebarPreference = () => {
          if (!isCashier) return;
          if (isMobileSidebarViewport()) {
            document.body.classList.remove('sidebar-hidden');
            return;
          }
          const hiddenPref = localStorage.getItem(CASHIER_SIDEBAR_PREF_KEY) === '1';
          document.body.classList.toggle('sidebar-hidden', hiddenPref);
        };

        const updateMenuToggleVisual = () => {
          if (!toggleBtn) return;
          const sidebar = document.querySelector('.sidebar');
          const isOpen = isMobileSidebarViewport()
            ? !!(sidebar && sidebar.classList.contains('open'))
            : !(isCashier && document.body.classList.contains('sidebar-hidden'));
          toggleBtn.title = isOpen ? 'Hide Menu' : 'Show Menu';
          toggleBtn.classList.toggle('is-collapsed', !isOpen);
        };

        const setSidebarVisible = (visible) => {
          const sidebar = document.querySelector('.sidebar');
          if (isMobileSidebarViewport()) {
            if (sidebar) sidebar.classList.toggle('open', visible);
            updateMenuToggleVisual();
            return;
          }

          if (!isCashier) {
            updateMenuToggleVisual();
            return;
          }

          document.body.classList.toggle('sidebar-hidden', !visible);
          if (sidebar) sidebar.classList.remove('open');
          localStorage.setItem(CASHIER_SIDEBAR_PREF_KEY, visible ? '0' : '1');
          updateMenuToggleVisual();
        };

        if (isCashier) {
          document.body.classList.add('sidebar-collapsible');
          syncCashierSidebarPreference();
        } else {
          document.body.classList.remove('sidebar-collapsible');
          document.body.classList.remove('sidebar-hidden');
        }

        if (toggleBtn) {
          updateMenuToggleVisual();
          toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sidebar = document.querySelector('.sidebar');
            const currentlyVisible = isMobileSidebarViewport()
              ? !!(sidebar && sidebar.classList.contains('open'))
              : !(isCashier && document.body.classList.contains('sidebar-hidden'));
            setSidebarVisible(!currentlyVisible);
          });
        }

        document.addEventListener('click', (e) => {
          const sidebar = document.querySelector('.sidebar');
          const toggle = document.getElementById('globalMenuToggle');
          if (!isMobileSidebarViewport()) return;
          if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && (!toggle || !toggle.contains(e.target))) {
            sidebar.classList.remove('open');
            updateMenuToggleVisual();
          }
        });

        window.addEventListener('resize', () => {
          syncCashierSidebarPreference();
          const sidebar = document.querySelector('.sidebar');
          if (sidebar && isMobileSidebarViewport()) sidebar.classList.remove('open');
          updateMenuToggleVisual();
        });

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

        const refreshBtn = document.getElementById('topbarRefreshBtn');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', () => {
            if (window.Notifications && window.Notifications.refreshApp) {
              window.Notifications.refreshApp();
            } else {
              location.reload();
            }
          });
        }

        const clockEl = document.getElementById('globalTopClock');
        if (clockEl) {
          const updateClock = () => {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            });
          };
          updateClock();
          setInterval(updateClock, 1000);
        }

        // Notifications logic is now handled in notifications.js
        if (window.Notifications) window.Notifications.refresh();
      }
    }
  };

  window.fmtLKR = function (n) {
    return `LKR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  window.Components = Components;

  document.addEventListener('DOMContentLoaded', () => {
    runPageEnterTransition();
    bindSmoothNavigation();

    const sidebarContainer = document.getElementById('sidebar-container');
    const currentPage = window.location.pathname.split("/").pop().replace('.html', '');

    // Fallback: ensure business pages always get a standard topbar even if
    // a page script forgets to initialize it.
    const topbarContainer = document.getElementById('topbar-container');
    if (topbarContainer && !topbarContainer.children.length) {
      const pageTitles = {
        sales: 'Make a Sale',
        categories: 'Categories',
        products: 'Products',
        inventory: 'Inventory',
        customers: 'Customers',
        ledger: 'Credit Ledger',
        sales_reports: 'Invoice History',
        reports: 'Shift Reports',
        users: 'Users',
        settings: 'Settings'
      };
      const fallbackTitle = pageTitles[currentPage];
      if (fallbackTitle) {
        Components.init({ title: fallbackTitle });
      }
    }

    if (!sidebarContainer) return;

    const user = getCurrentUser();
    document.body.classList.add('dashboard-body');

    sidebarContainer.innerHTML = `
      <div class="sidebar">
        <div class="logo">
          <div class="logo-box"><i class="fa-solid fa-cart-shopping"></i></div>
          <h2><span class="blue">Quick</span><span class="orange">POS</span></h2>
        </div>
        <div class="menu">
          <a href="owner_dashboard.html" class="menu-item owner-only" data-page="owner_dashboard"><i class="fa-solid fa-chart-line"></i> Dashboard</a>
          <a href="cashier_hub.html" class="menu-item cashier-only" data-page="cashier_hub"><i class="fa-solid fa-border-all"></i> Cashier Hub</a>
          <a href="sales.html" class="menu-item cashier-only" data-page="sales"><i class="fa-solid fa-cash-register"></i> POS Terminal</a>
          <a href="sales.html" class="menu-item owner-sale-link" data-page="sales"><i class="fa-solid fa-cart-plus"></i> Make a Sale</a>
          <a href="categories.html" class="menu-item cashier-hide" data-page="categories"><i class="fa-solid fa-tags"></i> Categories</a>
          <a href="products.html" class="menu-item cashier-hide" data-page="products"><i class="fa-solid fa-box-open"></i> Products</a>
          <a href="inventory.html" class="menu-item cashier-hide" data-page="inventory"><i class="fa-solid fa-warehouse"></i> Inventory <span id="lowStockBadge" style="display:none;margin-left:auto;padding:2px 8px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;"></span></a>
          <a href="customers.html" class="menu-item" data-page="customers"><i class="fa-solid fa-users"></i> Customers</a>
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
      document.querySelectorAll('.owner-sale-link').forEach((el) => el.style.display = 'none');
      document.querySelectorAll('.cashier-hide').forEach((el) => el.style.display = 'none');
      if (!user.canViewReports) {
        document.querySelectorAll('.reports-allowed').forEach((el) => el.style.display = 'none');
      }
    } else {
      document.querySelectorAll('.cashier-only').forEach((el) => el.style.display = 'none');
    }

    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page && currentPage === item.dataset.page) item.classList.add('active');
    });

    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
          localStorage.removeItem('quickpos-user');
          smoothNavigate('login.html');
        }
      });
    }

    // Notifications logic is now handled in notifications.js
    if (window.Notifications) window.Notifications.refresh();
  });
})();
