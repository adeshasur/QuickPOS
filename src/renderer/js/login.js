// Page-specific JavaScript for login

// Valid users database
const validUsers = {
    'admin': {
        password: '123',
        name: 'Admin',
        role: 'owner',
        displayName: 'Admin User'
    },
    'staff': {
        password: '456',
        name: 'Staff',
        role: 'cashier',
        displayName: 'Cashier User'
    }
};

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('passwordToggle');
const errorMessage = document.getElementById('errorMessage');
const loginBtn = document.getElementById('loginBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const quickAdminBtn = document.getElementById('quickAdminBtn');
const quickStaffBtn = document.getElementById('quickStaffBtn');
const forgotPasswordLink = document.getElementById('forgotPassword');

// Show/Hide Password
passwordToggle.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
});

// Quick fill buttons
quickAdminBtn.addEventListener('click', function() {
    usernameInput.value = 'admin';
    passwordInput.value = '123';
    errorMessage.classList.remove('show');
});

quickStaffBtn.addEventListener('click', function() {
    usernameInput.value = 'staff';
    passwordInput.value = '456';
    errorMessage.classList.remove('show');
});

// Forgot password
forgotPasswordLink.addEventListener('click', function(e) {
    e.preventDefault();
    alert('For security, please contact the system administrator to reset your password.\n\nDemo accounts:\n• Owner: admin / 123\n• Cashier: staff / 456');
});

// Login function
function loginUser(username, password) {
    if (!validUsers[username]) {
        return { success: false, message: 'Invalid username' };
    }
    
    const user = validUsers[username];
    
    if (user.password !== password) {
        return { success: false, message: 'Invalid password' };
    }
    
    return { 
        success: true, 
        user: {
            name: user.displayName,
            role: user.role,
            username: username
        }
    };
}

// Handle form submission
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    errorMessage.classList.remove('show');
    
    loginBtn.disabled = true;
    loadingSpinner.style.display = 'block';
    loginBtn.innerHTML = '<div class="loading"></div><span>Logging in...</span>';
    
    setTimeout(() => {
        const result = loginUser(username, password);
        
        if (result.success) {
            localStorage.setItem('quickpos-user', JSON.stringify({
                name: result.user.name,
                role: result.user.role,
                username: result.user.username,
                timestamp: new Date().toISOString()
            }));
            
            console.log('=== USER LOGIN SUCCESS ===');
            console.log('User:', result.user);
            
            if (result.user.role === 'owner') {
                window.location.href = 'owner_dashboard.html';
            } else {
                window.location.href = 'sales.html';
            }
        } else {
            errorMessage.classList.add('show');
            
            loginBtn.disabled = false;
            loadingSpinner.style.display = 'none';
            loginBtn.innerHTML = '<span>Login</span><div class="loading"></div>';
        }
    }, 800);
});

// Auto-focus username on page load
document.addEventListener('DOMContentLoaded', function() {
    usernameInput.focus();
    
    const currentUser = localStorage.getItem('quickpos-user');
    if (currentUser) {
        try {
            const userData = JSON.parse(currentUser);
            if (userData.role === 'owner') {
                window.location.href = 'owner_dashboard.html';
            } else {
                window.location.href = 'sales.html';
            }
        } catch (e) {
            localStorage.removeItem('quickpos-user');
        }
    }
});

// Enter key to submit form
usernameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        passwordInput.focus();
    }
});

passwordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        loginForm.dispatchEvent(new Event('submit'));
    }
});
