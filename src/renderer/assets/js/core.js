document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('quickpos-user'));
    if (!user && !window.location.pathname.includes('login.html')) {
        window.location.href = '../auth/login.html';
        return;
    }

    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('hamburgerBtn') || document.getElementById('sidebarToggle');

    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('qp-sb', sidebar.classList.contains('collapsed') ? '1' : '0');
        });

        if (localStorage.getItem('qp-sb') === '1') {
            sidebar.classList.add('collapsed');
        }
    }

    const timeEl = document.getElementById('sysTime') || document.querySelector('.tb-sub');
    if (timeEl) {
        const updateTime = () => {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        };
        updateTime();
        setInterval(updateTime, 1000);
    }

    const avatar = document.querySelector('.avatar') || document.getElementById('av');
    if (avatar && user) {
        const initials = (user.full_name || user.username || 'AD').substring(0, 2).toUpperCase();
        avatar.textContent = initials;
    }

    const userNameEl = document.getElementById('userName');
    if (userNameEl && user) {
        userNameEl.textContent = user.full_name || user.username;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
            e.preventDefault();
            if (confirm('Logout from QuickPOS Pro?')) {
                localStorage.removeItem('quickpos-user');
                window.location.href = '../auth/login.html';
            }
        });
    }

    if (user && user.role && user.role.toLowerCase() === 'cashier') {
        document.querySelectorAll('.owner-only').forEach(el => el.style.display = 'none');
    }
});

window.showToast = (message, type = 'success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};

window.formatCurrency = (amount) => {
    return `LKR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

window.confirmAction = (message) => {
    return new Promise((resolve) => {
        if (confirm(message)) resolve(true);
        else resolve(false);
    });
};
