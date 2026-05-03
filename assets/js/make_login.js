(function() {
    'use strict';

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const roleInput = document.querySelector('input[name="role"]:checked');

            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value.trim() : '';

            if (!roleInput) {
                if(errorMessage) {
                    errorMessage.textContent = "Please select a role (Cashier or Owner) to continue.";
                    errorMessage.classList.add('show');
                }
                return;
            }

            // Simple validation logic (this will be replaced by SQLite later)
            if (username === "admin" && password === "123" && roleInput.value === "owner") {
                localStorage.setItem('quickpos-user', JSON.stringify({name: 'Admin', role: 'owner'}));
                window.location.href = 'owner_dashboard.html';
            } else if (username === "staff" && password === "456" && roleInput.value === "cashier") {
                localStorage.setItem('quickpos-user', JSON.stringify({name: 'Staff', role: 'cashier'}));
                window.location.href = 'sales.html';
            } else {
                if(errorMessage) {
                    errorMessage.textContent = "Invalid username, password, or role.";
                    errorMessage.classList.add('show');
                }
            }
        });
    }
})();
