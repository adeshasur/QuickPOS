// ─── SIDEBAR TOGGLE & PERSISTENCE ───
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('hamburgerBtn') || document.getElementById('sidebarToggle');

if (sidebar && toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('qp-sb', sidebar.classList.contains('collapsed') ? '1' : '0');
  });

  // කලින් collapse කරලා තිබුනොත් ඒ state එක load කිරීම
  if (localStorage.getItem('qp-sb') === '1') {
    sidebar.classList.add('collapsed');
  }
}

// ─── LOGOUT FUNCTIONALITY ───
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', e => {
    e.preventDefault();
    if (confirm('Logout from QuickPOS Pro?')) {
      localStorage.removeItem('quickpos-user');
      window.location.href = 'login.html';
    }
  });
}