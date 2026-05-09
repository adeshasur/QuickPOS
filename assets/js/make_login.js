document.addEventListener('DOMContentLoaded', () => {

    /* =========================
       USERS
    ========================= */


    /* =========================
       DOM
    ========================= */
    const loginForm = document.getElementById("loginForm");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    
    const ownerBtn = document.getElementById("ownerBtn");
    const cashierBtn = document.getElementById("cashierBtn");
    
    const togglePassword = document.getElementById("togglePassword");
    const errorBox = document.getElementById("errorBox");

    /* =========================
       QUICK LOGIN
    ========================= */
    ownerBtn.addEventListener("click", () => {
        ownerBtn.classList.add("active");
        cashierBtn.classList.remove("active");
        username.value = "admin";
        password.value = "123";
    });

    cashierBtn.addEventListener("click", () => {
        cashierBtn.classList.add("active");
        ownerBtn.classList.remove("active");
        username.value = "staff";
        password.value = "456";
    });

    /* =========================
       SHOW PASSWORD
    ========================= */
    togglePassword.addEventListener("click", () => {
        const icon = togglePassword.querySelector("i");
        
        if(password.type === "password"){
            password.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            password.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    });

    /* =========================
       LOGIN
    ========================= */
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const userVal = username.value.trim();
        const passVal = password.value.trim();
        const role = ownerBtn.classList.contains("active") ? "owner" : "cashier";

        errorBox.classList.remove("show");

        try {
            const response = await window.api.loginAuth({ 
                username: userVal, 
                password: passVal, 
                role: role 
            });

            if (!response.success) {
                errorBox.textContent = response.message || 'Invalid credentials';
                errorBox.classList.add("show");
                return;
            }

            const userData = {
                username: userVal,
                role: response.user.role,
                name: response.user.name,
                canViewReports: response.user.canViewReports,
                loginTime: new Date().toISOString()
            };

            localStorage.setItem("quickpos-user", JSON.stringify(userData));
            console.log("LOGIN SUCCESS", userData);

            /* REDIRECT */
            if (response.user.role === "owner") {
                window.location.href = "owner_dashboard.html";
            } else {
                window.location.href = "sales.html";
            }
        } catch (err) {
            errorBox.textContent = 'Connection error: ' + err.message;
            errorBox.classList.add("show");
        }
    });


});
