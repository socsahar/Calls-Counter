// MDA CallCounter - Authentication JavaScript
class AuthManager {
    constructor() {
        this.isLoading = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setLoading(false);
    }

    bindEvents() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', this.handleRegister.bind(this));
        }

        // Password confirmation validation
        const confirmPassword = document.getElementById('confirmPassword');
        if (confirmPassword) {
            confirmPassword.addEventListener('input', this.validatePasswordMatch.bind(this));
        }

        // Real-time username validation (only on register page)
        const username = document.getElementById('username');
        if (username && document.getElementById('registerForm')) {
            username.addEventListener('blur', this.validateUsername.bind(this));
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        if (this.isLoading) return;
        
        const formData = {
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value
        };

        if (!this.validateLoginForm(formData)) {
            return;
        }

        try {
            this.setLoading(true);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'שגיאה בהתחברות');
            }

            // Store auth token with remember me option
            const rememberMe = document.getElementById('rememberMe') ? document.getElementById('rememberMe').checked : true;
            
            if (rememberMe) {
                localStorage.setItem('authToken', result.token);
                localStorage.setItem('userData', JSON.stringify(result.user));
                localStorage.setItem('rememberMe', 'true');
            } else {
                sessionStorage.setItem('authToken', result.token);
                sessionStorage.setItem('userData', JSON.stringify(result.user));
            }

            this.showSuccess('התחברת בהצלחה!');
            
            // Redirect to main page after short delay
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            this.showError(error.message || 'שגיאה בהתחברות למערכת');
        } finally {
            this.setLoading(false);
        }
    }

    async handleRegister(event) {
        event.preventDefault();
        
        if (this.isLoading) return;
        
        const formData = {
            fullName: document.getElementById('fullName').value.trim(),
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value,
            confirmPassword: document.getElementById('confirmPassword').value,
            mdaCode: document.getElementById('mdaCode').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            email: document.getElementById('email').value.trim()
        };

        if (!this.validateRegisterForm(formData)) {
            return;
        }

        try {
            this.setLoading(true);
            
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'שגיאה בהרשמה');
            }

            this.showSuccess('נרשמת בהצלחה! מעביר לדף הכניסה...');
            
            // Redirect to login page after short delay
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);

        } catch (error) {
            console.error('Register error:', error);
            this.showError(error.message || 'שגיאה בהרשמה למערכת');
        } finally {
            this.setLoading(false);
        }
    }

    validateLoginForm(data) {
        if (!data.username) {
            this.showError('יש להזין שם משתמש');
            return false;
        }

        if (!data.password) {
            this.showError('יש להזין סיסמה');
            return false;
        }

        return true;
    }

    validateRegisterForm(data) {
        if (!data.fullName) {
            this.showError('יש להזין שם מלא');
            return false;
        }

        if (!data.username) {
            this.showError('יש להזין שם משתמש');
            return false;
        }

        if (data.username.length < 3) {
            this.showError('שם המשתמש חייב להכיל לפחות 3 תווים');
            return false;
        }

        if (!data.mdaCode) {
            this.showError('יש להזין קוד מד״א');
            return false;
        }

        if (!/^\d{2,5}$/.test(data.mdaCode)) {
            this.showError('קוד מד״א חייב להכיל 2-5 ספרות');
            return false;
        }

        if (!data.password) {
            this.showError('יש להזין סיסמה');
            return false;
        }

        if (data.password.length < 6) {
            this.showError('הסיסמה חייבת להכיל לפחות 6 תווים');
            return false;
        }

        if (data.password !== data.confirmPassword) {
            this.showError('הסיסמאות אינן תואמות');
            return false;
        }

        if (data.email && !this.isValidEmail(data.email)) {
            this.showError('כתובת האימייל אינה תקינה');
            return false;
        }

        if (data.phone && !this.isValidPhone(data.phone)) {
            this.showError('מספר הטלפון אינו תקין');
            return false;
        }

        return true;
    }

    validatePasswordMatch() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const confirmInput = document.getElementById('confirmPassword');

        if (confirmPassword && password !== confirmPassword) {
            confirmInput.setCustomValidity('הסיסמאות אינן תואמות');
            confirmInput.style.borderColor = '#dc2626';
        } else {
            confirmInput.setCustomValidity('');
            confirmInput.style.borderColor = '';
        }
    }

    async validateUsername() {
        // Only run on registration page
        if (!document.getElementById('registerForm')) {
            return;
        }
        
        const username = document.getElementById('username').value.trim();
        const usernameInput = document.getElementById('username');

        if (!username || username.length < 3) {
            return;
        }

        try {
            const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
            const result = await response.json();

            if (result.exists) {
                usernameInput.setCustomValidity('שם המשתמש כבר קיים במערכת');
                usernameInput.style.borderColor = '#dc2626';
                this.showError('שם המשתמש כבר קיים במערכת');
            } else {
                usernameInput.setCustomValidity('');
                usernameInput.style.borderColor = '#10b981';
            }
        } catch (error) {
            console.error('Username validation error:', error);
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        // Israeli phone number validation
        const phoneRegex = /^(\+972|0)?[5-9]\d{8}$/;
        return phoneRegex.test(phone.replace(/[-\s]/g, ''));
    }

    setLoading(loading) {
        this.isLoading = loading;
        const overlay = document.getElementById('loadingOverlay');
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        
        if (loading) {
            overlay?.classList.remove('hidden');
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = `
                    <span class="btn-icon">⏳</span>
                    מתחבר...
                `;
            }
            if (registerBtn) {
                registerBtn.disabled = true;
                registerBtn.innerHTML = `
                    <span class="btn-icon">⏳</span>
                    נרשם...
                `;
            }
        } else {
            overlay?.classList.add('hidden');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = `
                    <span class="btn-icon">🔐</span>
                    כניסה למערכת
                `;
            }
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.innerHTML = `
                    <span class="btn-icon">📝</span>
                    הרשמה למערכת
                `;
            }
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'success') {
        const toastId = type === 'success' ? 'successToast' : 'errorToast';
        const toast = document.getElementById(toastId);
        
        if (toast) {
            const messageEl = toast.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
            
            // Show toast
            toast.classList.remove('hidden');
            toast.classList.add('show');
            
            // Hide after 3 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toast.classList.add('hidden');
                }, 300);
            }, 3000);
        }
    }

    // Static method to check if user is logged in
    static isLoggedIn() {
        const token = localStorage.getItem('authToken');
        return !!token;
    }

    // Static method to get current user data
    static getCurrentUser() {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    }

    // Static method to logout
    static logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = '/login.html';
    }

    // Static method to get auth headers for API calls
    static getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 Auth system initialized');
    window.authManager = new AuthManager();
});

// Export for use in other scripts
window.AuthManager = AuthManager;