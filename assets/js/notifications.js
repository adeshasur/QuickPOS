(function () {
  'use strict';

  const Notifications = {
    async refresh() {
      if (!window.api?.getLowStockSummary) return;
      try {
        const summary = await window.api.getLowStockSummary();
        const lowItems = summary.items || [];
        const lowCount = Number(summary.count || 0);

        // Update badges
        const sidebarBadge = document.getElementById('lowStockBadge');
        if (sidebarBadge) {
          sidebarBadge.textContent = lowCount > 0 ? String(lowCount) : '';
          sidebarBadge.style.display = lowCount > 0 ? 'inline-block' : 'none';
        }

        const topBadge = document.getElementById('topbarNotifBadge');
        if (topBadge) {
          topBadge.textContent = String(lowCount);
          topBadge.style.display = lowCount > 0 ? 'flex' : 'none';
        }

        // Update list
        const list = document.getElementById('notifList');
        if (list) {
          if (lowCount > 0) {
            list.innerHTML = lowItems.map(item => `
              <div class="nd-item" onclick="location.href='inventory.html'">
                <div class="nd-item-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="nd-item-info">
                  <div class="nd-item-tag">Low Stock Alert</div>
                  <div class="nd-item-name">${item.name}</div>
                  <div class="nd-item-stock">Only ${item.current_stock} left in stock.</div>
                </div>
              </div>
            `).join('') + (lowCount > lowItems.length ? `
              <div class="nd-item" onclick="location.href='inventory.html'">
                <div class="nd-item-icon"><i class="fa-solid fa-list"></i></div>
                <div class="nd-item-info">
                  <div class="nd-item-tag">More Alerts</div>
                  <div class="nd-item-name">${lowCount - lowItems.length} more low-stock products</div>
                  <div class="nd-item-stock">Open Inventory to review all items.</div>
                </div>
              </div>
            ` : '');
          } else {
            list.innerHTML = '<div class="nd-empty">No new notifications</div>';
          }
        }

        // Show toasts only on Dashboard and only once per session
        const isDashboard = window.location.pathname.includes('owner_dashboard.html');
        const sessionToastsShown = sessionStorage.getItem('quickpos-toasts-shown');

        if (isDashboard && lowCount > 0 && !sessionToastsShown) {
          sessionStorage.setItem('quickpos-toasts-shown', 'true');
          lowItems.forEach((item, i) => {
            setTimeout(() => this.showToast(`Low Stock: ${item.name} (${item.current_stock} left)`, 'warning'), i * 800);
          });
        }
      } catch (err) {
        console.error('Notification error:', err);
      }
    },

    showToast(msg, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const t = document.createElement('div');
      t.className = `toast ${type}`;
      const icon = type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info';
      t.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
      container.appendChild(t);
      setTimeout(() => t.classList.add('show'), 10);
      setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 500);
      }, 5000);
    },

    async refreshApp() {
      const btn = document.getElementById('topbarRefreshBtn');
      if (btn) btn.classList.add('syncing');

      try {
        // Refresh notifications
        await this.refresh();

        // Check if current page has a specific loadData or refresh function
        // Most of our pages expose their loadData or init functions or we can trigger a custom event
        const event = new CustomEvent('quickpos:refresh');
        document.dispatchEvent(event);

        console.log('App refreshed successfully');
        
        // Brief delay to show animation
        setTimeout(() => {
          if (btn) btn.classList.remove('syncing');
        }, 600);
      } catch (err) {
        console.error('Refresh error:', err);
        if (btn) btn.classList.remove('syncing');
        this.showToast('Failed to sync data', 'warning');
      }
    }
  };

  window.Notifications = Notifications;

  // Event Delegation for the bell
  document.addEventListener('click', (e) => {
    const bell = e.target.closest('#notifBell');
    const dropdown = document.getElementById('notifDropdown');
    
    if (bell) {
      e.stopPropagation();
      if (dropdown) dropdown.classList.toggle('open');
      Notifications.refresh();
    } else if (dropdown && !e.target.closest('#notifDropdown')) {
      dropdown.classList.remove('open');
    }
  });

  // Auto-refresh on load
  document.addEventListener('DOMContentLoaded', () => {
    Notifications.refresh();

    // Start Auto-Sync every 60 seconds
    setInterval(() => {
      console.log('Auto-syncing...');
      Notifications.refresh();
    }, 60000);
  });
})();
