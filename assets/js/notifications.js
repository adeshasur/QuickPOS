(function () {
  'use strict';

  const Notifications = {
    readKey: 'quickpos-read-notifications',
    maxVisibleToasts: 3,
    toastIntervalMs: 2800,
    toastDurationMs: 9000,

    getReadSet() {
      try {
        return new Set(JSON.parse(localStorage.getItem(this.readKey) || '[]'));
      } catch {
        return new Set();
      }
    },

    saveReadSet(readSet) {
      localStorage.setItem(this.readKey, JSON.stringify(Array.from(readSet)));
    },

    markRead(key) {
      const readSet = this.getReadSet();
      readSet.add(key);
      this.saveReadSet(readSet);
      this.refresh();
    },

    markAllRead(keys) {
      const readSet = this.getReadSet();
      keys.forEach((key) => readSet.add(key));
      this.saveReadSet(readSet);
      this.refresh();
    },

    async refresh() {
      if (!window.api?.getNotificationSummary && !window.api?.getLowStockSummary) return;
      try {
        const summary = window.api.getNotificationSummary
          ? await window.api.getNotificationSummary()
          : { lowStock: await window.api.getLowStockSummary(), expiringSoon: { count: 0, items: [] } };
        const lowItems = summary.lowStock?.items || [];
        const lowCount = Number(summary.lowStock?.count || 0);
        const expiryItems = summary.expiringSoon?.items || [];
        const expiryCount = Number(summary.expiringSoon?.count || 0);
        const readSet = this.getReadSet();
        const lowAlerts = lowItems.map((item) => ({
          type: 'low',
          key: `low:${item.id}:${item.current_stock}:${item.alert_level}`,
          item
        })).filter((alert) => !readSet.has(alert.key));
        const expiryAlerts = expiryItems.map((item) => ({
          type: 'expiry',
          key: `expiry:${item.id}:${item.expiry_date}:${item.remaining_qty ?? ''}`,
          item
        })).filter((alert) => !readSet.has(alert.key));
        const unreadKeys = [...lowAlerts, ...expiryAlerts].map((alert) => alert.key);
        const unreadLowCount = lowAlerts.length;
        const unreadExpiryCount = expiryAlerts.length;
        const totalCount = unreadLowCount + unreadExpiryCount;
        const title = `${unreadLowCount} unread low-stock, ${unreadExpiryCount} unread expiring soon`;

        // Update badges
        const sidebarBadge = document.getElementById('lowStockBadge');
        if (sidebarBadge) {
          sidebarBadge.textContent = totalCount > 0 ? String(totalCount) : '';
          sidebarBadge.style.display = totalCount > 0 ? 'inline-flex' : 'none';
          sidebarBadge.title = totalCount > 0 ? title : '';
        }

        const topBadge = document.getElementById('topbarNotifBadge');
        if (topBadge) {
          topBadge.textContent = String(totalCount);
          topBadge.style.display = totalCount > 0 ? 'flex' : 'none';
          topBadge.title = totalCount > 0 ? title : '';
        }

        const header = document.querySelector('#notifDropdown .nd-header');
        if (header) header.textContent = 'Inventory Alerts';

        // Update list
        const list = document.getElementById('notifList');
        if (list) {
          if (totalCount > 0) {
            const lowHtml = lowAlerts.map(({ key, item }) => `
              <div class="nd-item nd-low-stock" onclick="location.href='inventory.html'">
                <div class="nd-item-icon"><i class="fa-solid fa-layer-group"></i></div>
                <div class="nd-item-info">
                  <div class="nd-item-tag">Low Stock Alert</div>
                  <div class="nd-item-name">${item.name}</div>
                  <div class="nd-item-stock">Only ${item.current_stock} left. Alert level ${item.alert_level ?? '-'}.</div>
                </div>
                <button class="nd-read-btn" data-notif-key="${key}" title="Mark as read">Read</button>
              </div>
            `).join('');
            const expiryHtml = expiryAlerts.map(({ key, item }) => `
              <div class="nd-item nd-expiring-soon" onclick="location.href='inventory.html'">
                <div class="nd-item-icon"><i class="fa-solid fa-hourglass-half"></i></div>
                <div class="nd-item-info">
                  <div class="nd-item-tag">Expiring Soon</div>
                  <div class="nd-item-name">${item.name}</div>
                  <div class="nd-item-stock">${Number(item.days_left || 0)} day${Number(item.days_left || 0) === 1 ? '' : 's'} left. Expires ${item.expiry_date}.</div>
                </div>
                <button class="nd-read-btn" data-notif-key="${key}" title="Mark as read">Read</button>
              </div>
            `).join('');
            list.innerHTML = `
              <div class="nd-actions-row">
                <button class="nd-mark-all-btn" data-notif-keys="${unreadKeys.join('|')}">Mark all as read</button>
              </div>
              ${unreadLowCount ? `<div class="nd-section-title nd-low-title">Low Stock (${unreadLowCount})</div>${lowHtml}` : ''}
              ${unreadExpiryCount ? `<div class="nd-section-title nd-expiry-title">Expiring Soon (${unreadExpiryCount})</div>${expiryHtml}` : ''}
            `;
          } else {
            list.innerHTML = '<div class="nd-empty">No unread notifications</div>';
          }
        }

        // Show toasts only on Dashboard and only once per session
        const isDashboard = window.location.pathname.includes('owner_dashboard.html');
        const sessionToastsShown = sessionStorage.getItem('quickpos-toasts-shown');

        if (isDashboard && totalCount > 0 && !sessionToastsShown) {
          sessionStorage.setItem('quickpos-toasts-shown', 'true');
          lowAlerts.forEach(({ item }, i) => {
            setTimeout(() => this.showToast(`${item.name} (${item.current_stock} left)`, 'warning'), i * this.toastIntervalMs);
          });
          expiryAlerts.forEach(({ item }, i) => {
            setTimeout(() => this.showToast(`${item.name} (${item.days_left} days left)`, 'expiry'), (lowAlerts.length + i) * this.toastIntervalMs);
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
      const icon = type === 'warning' ? 'fa-layer-group' : type === 'expiry' ? 'fa-hourglass-half' : 'fa-circle-info';
      const title = type === 'warning' ? 'Low Stock Alert' : type === 'expiry' ? 'Expiring Soon' : 'Notification';
      t.style.setProperty('--toast-duration', `${this.toastDurationMs}ms`);
      t.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
        </div>
        <button class="toast-close" type="button" aria-label="Dismiss notification"><i class="fa-solid fa-xmark"></i></button>
        <div class="toast-progress"></div>
      `;
      const message = document.createElement('span');
      message.className = 'toast-message';
      message.textContent = msg;
      t.querySelector('.toast-content').appendChild(message);
      t.querySelector('.toast-close').addEventListener('click', () => this.dismissToast(t));
      container.appendChild(t);

      const visibleToasts = Array.from(container.querySelectorAll('.toast:not(.is-dismissing)'));
      visibleToasts.slice(0, -this.maxVisibleToasts).forEach((toast) => this.dismissToast(toast));

      setTimeout(() => t.classList.add('show'), 10);
      setTimeout(() => this.dismissToast(t), this.toastDurationMs);
    },

    dismissToast(toast) {
      if (!toast || toast.classList.contains('is-dismissing')) return;
      toast.classList.add('is-dismissing');
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 500);
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
    } else if (e.target.closest('.nd-read-btn')) {
      e.stopPropagation();
      Notifications.markRead(e.target.closest('.nd-read-btn').dataset.notifKey);
    } else if (e.target.closest('.nd-mark-all-btn')) {
      e.stopPropagation();
      const keys = (e.target.closest('.nd-mark-all-btn').dataset.notifKeys || '').split('|').filter(Boolean);
      Notifications.markAllRead(keys);
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
