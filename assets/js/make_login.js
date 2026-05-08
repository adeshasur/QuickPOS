document.addEventListener('DOMContentLoaded', () => {

    /* =========================
       USERS
    ========================= */
    const users = {
        admin:{
            password:"123",
            role:"owner",
            name:"Admin User"
        },
        staff:{
            password:"456",
            role:"cashier",
            name:"Cashier User"
        }
    };

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
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const user = username.value.trim();
        const pass = password.value.trim();

        errorBox.classList.remove("show");

        if(!users[user] || users[user].password !== pass) {
            errorBox.classList.add("show");
            return;
        }

        const userData = {
            username: user,
            role: users[user].role,
            name: users[user].name,
            loginTime: new Date().toISOString()
        };

        localStorage.setItem("quickpos-user", JSON.stringify(userData));
        console.log("LOGIN SUCCESS", userData);

        /* REDIRECT */
        if(users[user].role === "owner"){
            window.location.href = "owner_dashboard.html";
        } else {
            window.location.href = "sales.html";
        }
    });

});
