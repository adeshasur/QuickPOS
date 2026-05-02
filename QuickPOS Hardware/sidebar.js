(function () {
    const sidebar = document.getElementById('sidebar');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const logo = document.getElementById('logo');

    if (!sidebar) return;

    function applyVisualState(isCollapsed) {
        sidebar.classList.toggle('collapsed', isCollapsed);
        sidebar.classList.toggle('expanded', !isCollapsed);
        if (logo) logo.classList.toggle('collapsed', isCollapsed);
    }

    function persistState(isCollapsed) {
        try {
            localStorage.setItem('quickpos-sidebar', isCollapsed ? 'collapsed' : 'expanded');
        } catch (_) {}
    }

    function loadState() {
        try {
            return localStorage.getItem('quickpos-sidebar') === 'collapsed';
        } catch (_) {
            return false;
        }
    }

    const initialCollapsed = loadState();
    applyVisualState(initialCollapsed);

    if (typeof window.toggleSidebar !== 'function' && hamburgerBtn && !hamburgerBtn.dataset.sidebarBound) {
        window.toggleSidebar = function () {
            const isCollapsed = sidebar.classList.contains('collapsed');
            applyVisualState(!isCollapsed);
            persistState(!isCollapsed);
        };
        hamburgerBtn.addEventListener('click', window.toggleSidebar);
        hamburgerBtn.dataset.sidebarBound = '1';
    }
})();