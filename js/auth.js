document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const otpVerification = document.getElementById('otpVerification');
    const mobileVerification = document.getElementById('mobileVerification');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    // Buttons
    const switchToRegister = document.getElementById('switchToRegister');
    const switchToLogin = document.getElementById('switchToLogin');
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const verifyOtpButton = document.getElementById('verifyOtpButton');
    const verifyMobileButton = document.getElementById('verifyMobileButton');
    const sendResetLinkButton = document.getElementById('sendResetLinkButton');
    const switchToLoginFromReset = document.getElementById('switchToLoginFromReset');

    // Input Fields
    const loginIdentifier = document.getElementById('loginIdentifier');
    const loginPassword = document.getElementById('loginPassword');
    const regFullName = document.getElementById('regFullName');
    const regUsername = document.getElementById('regUsername');
    const regEmail = document.getElementById('regEmail');
    const regMobile = document.getElementById('regMobile');
    const regPassword = document.getElementById('regPassword');
    const regConfirmPassword = document.getElementById('regConfirmPassword');
    const resetEmail = document.getElementById('resetEmail');

    // Password Toggles
    const toggleLoginPassword = document.getElementById('toggleLoginPassword');
    const toggleRegPassword = document.getElementById('toggleRegPassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

    // Messages
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const successMessage = document.getElementById('successMessage');
    const successText = document.getElementById('successText');

    // Password Strength
    const passwordStrengthBar = document.getElementById('passwordStrengthBar');
    const strengthText = document.getElementById('strengthText');

    // OTP Inputs
    const otpInputs = document.querySelectorAll('.otp-input');

    // Store registration data temporarily
    let registrationData = {};
    let generatedOtp = '';
    let generatedMobileOtp = '';

    // Initialize Firebase Realtime Database reference
    const db = firebase.database();
    const usersRef = db.ref('users');

    // Form Switching
    switchToRegister.addEventListener('click', function (e) {
        e.preventDefault();
        showForm('register');
    });

    switchToLogin.addEventListener('click', function (e) {
        e.preventDefault();
        showForm('login');
    });

    switchToLoginFromReset.addEventListener('click', function (e) {
        e.preventDefault();
        showForm('login');
    });

    // Show Forgot Password
    document.getElementById('forgotPasswordLink').addEventListener('click', function (e) {
        e.preventDefault();
        showForm('forgot');
    });

    // Password Toggle Functions
    toggleLoginPassword.addEventListener('click', function () {
        togglePasswordVisibility(loginPassword, this);
    });

    toggleRegPassword.addEventListener('click', function () {
        togglePasswordVisibility(regPassword, this);
    });

    toggleConfirmPassword.addEventListener('click', function () {
        togglePasswordVisibility(regConfirmPassword, this);
    });

    // Password Strength Checker
    regPassword.addEventListener('input', function () {
        const password = this.value;
        const strength = calculatePasswordStrength(password);
        passwordStrengthBar.className = 'strength-bar strength-' + strength.score;
        strengthText.textContent = strength.text;
        strengthText.style.color = strength.color;
    });

    // OTP Input Navigation
    otpInputs.forEach(input => {
        input.addEventListener('input', function () {
            if (this.value.length === 1) {
                const nextIndex = parseInt(this.dataset.index) + 1;
                const nextInput = document.querySelector(`.otp-input[data-index="${nextIndex}"]`);
                if (nextInput) nextInput.focus();
            }
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && this.value.length === 0) {
                const prevIndex = parseInt(this.dataset.index) - 1;
                const prevInput = document.querySelector(`.otp-input[data-index="${prevIndex}"]`);
                if (prevInput) {
                    prevInput.focus();
                    prevInput.value = '';
                }
            }
        });
    });

    // Login Function
    loginButton.addEventListener('click', async function () {
        const identifier = loginIdentifier.value.trim();
        const password = loginPassword.value.trim();

        // Validation
        if (!identifier || !password) {
            showError('Please enter both email/username and password');
            return;
        }

        showLoading(loginButton);

        try {
            // Check if user exists in Realtime Database
            const snapshot = await usersRef.orderByChild('email').equalTo(identifier).once('value');

            if (!snapshot.exists()) {
                // Check by username
                const usernameSnapshot = await usersRef.orderByChild('username').equalTo(identifier).once('value');

                if (!usernameSnapshot.exists()) {
                    showError('No account found with this email/username');
                    hideLoading(loginButton);
                    return;
                }

                const userData = getFirstUserData(usernameSnapshot);
                await authenticateUser(userData, password);
            } else {
                const userData = getFirstUserData(snapshot);
                await authenticateUser(userData, password);
            }
        } catch (error) {
            showError('Login failed: ' + error.message);
            hideLoading(loginButton);
        }
    });

    // Registration Function
    registerButton.addEventListener('click', async function () {
        // Validate form
        const fullName = regFullName.value.trim();
        const username = regUsername.value.trim();
        const email = regEmail.value.trim();
        const mobile = regMobile.value.trim();
        const password = regPassword.value.trim();
        const confirmPassword = regConfirmPassword.value.trim();
        const acceptTerms = document.getElementById('acceptTerms').checked;

        // Validation
        if (!fullName || !username || !email || !mobile || !password || !confirmPassword) {
            showError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            showError('Password must be at least 8 characters long');
            return;
        }

        if (!acceptTerms) {
            showError('Please accept the Terms & Conditions');
            return;
        }

        if (!validateEmail(email)) {
            showError('Please enter a valid email address');
            return;
        }

        if (!validateMobile(mobile)) {
            showError('Please enter a valid 10-digit mobile number');
            return;
        }

        // Check if email already exists
        const emailSnapshot = await usersRef.orderByChild('email').equalTo(email).once('value');
        if (emailSnapshot.exists()) {
            showError('Email already registered. Please use another email or login.');
            return;
        }

        // Check if username already exists
        const usernameSnapshot = await usersRef.orderByChild('username').equalTo(username).once('value');
        if (usernameSnapshot.exists()) {
            showError('Username already taken. Please choose another.');
            return;
        }

        showLoading(registerButton);

        // Store registration data
        registrationData = {
            fullName,
            username,
            email,
            mobile,
            password: hashPassword(password), // In production, use proper hashing
            createdAt: new Date().toISOString(),
            lastLogin: null,
            status: 'pending_verification',
            companyId: null,
            role: 'representative',
            emailVerified: false,
            mobileVerified: false
        };

        // Generate and send OTP (simulated)
        generatedOtp = generateOTP();

        // In production, send actual email
        console.log('OTP for ' + email + ': ' + generatedOtp);

        // Show OTP verification
        showForm('otp');
        hideLoading(registerButton);
        showSuccess('OTP sent to your email. Please check your inbox.');
    });

    // Verify OTP
    verifyOtpButton.addEventListener('click', async function () {
        const enteredOtp = Array.from(otpInputs).map(input => input.value).join('');

        if (enteredOtp.length !== 6) {
            showError('Please enter the complete 6-digit OTP');
            return;
        }

        if (enteredOtp !== generatedOtp) {
            showError('Invalid OTP. Please try again.');
            return;
        }

        showLoading(verifyOtpButton);

        try {
            // Save user to Firebase Realtime Database
            const newUserRef = usersRef.push();
            await newUserRef.set({
                ...registrationData,
                id: newUserRef.key,
                emailVerified: true,
                otpVerifiedAt: new Date().toISOString()
            });

            // Generate mobile OTP
            generatedMobileOtp = generateOTP();
            console.log('Mobile OTP for ' + registrationData.mobile + ': ' + generatedMobileOtp);

            // Show mobile verification
            showForm('mobile');
            hideLoading(verifyOtpButton);
            showSuccess('Email verified! Please verify your mobile number.');

        } catch (error) {
            showError('Registration failed: ' + error.message);
            hideLoading(verifyOtpButton);
        }
    });

    // Verify Mobile OTP
    verifyMobileButton.addEventListener('click', async function () {
        const enteredOtp = Array.from(otpInputs).map(input => input.value).join('');

        if (enteredOtp.length !== 6) {
            showError('Please enter the complete 6-digit OTP');
            return;
        }

        if (enteredOtp !== generatedMobileOtp) {
            showError('Invalid OTP. Please try again.');
            return;
        }

        showLoading(verifyMobileButton);

        try {
            // Update user with mobile verification
            const emailSnapshot = await usersRef.orderByChild('email').equalTo(registrationData.email).once('value');
            const userData = getFirstUserData(emailSnapshot);
            const userId = Object.keys(emailSnapshot.val())[0];

            await usersRef.child(userId).update({
                mobileVerified: true,
                mobileVerifiedAt: new Date().toISOString(),
                status: 'active'
            });

            // Set user session
            setUserSession({
                id: userId,
                username: registrationData.username,
                email: registrationData.email,
                fullName: registrationData.fullName
            });

            hideLoading(verifyMobileButton);
            showSuccess('Registration successful! Redirecting to dashboard...');

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);

        } catch (error) {
            showError('Verification failed: ' + error.message);
            hideLoading(verifyMobileButton);
        }
    });

    // Resend OTP
    document.getElementById('resendOtp').addEventListener('click', function (e) {
        e.preventDefault();
        generatedOtp = generateOTP();
        console.log('New OTP for ' + registrationData.email + ': ' + generatedOtp);
        showSuccess('New OTP sent to your email.');
    });

    document.getElementById('resendMobileOtp').addEventListener('click', function (e) {
        e.preventDefault();
        generatedMobileOtp = generateOTP();
        console.log('New mobile OTP for ' + registrationData.mobile + ': ' + generatedMobileOtp);
        showSuccess('New OTP sent to your mobile.');
    });

    // Send Reset Link
    sendResetLinkButton.addEventListener('click', async function () {
        const email = resetEmail.value.trim();

        if (!email || !validateEmail(email)) {
            showError('Please enter a valid email address');
            return;
        }

        showLoading(sendResetLinkButton);

        try {
            // Check if email exists
            const snapshot = await usersRef.orderByChild('email').equalTo(email).once('value');

            if (!snapshot.exists()) {
                showError('No account found with this email');
                hideLoading(sendResetLinkButton);
                return;
            }

            // Generate reset token
            const resetToken = generateResetToken();
            const userId = Object.keys(snapshot.val())[0];

            // Save reset token (in production, set expiry)
            await usersRef.child(userId).update({
                resetToken: resetToken,
                resetTokenExpiry: new Date(Date.now() + 3600000).toISOString() // 1 hour
            });

            // Send reset email (simulated)
            console.log('Reset link for ' + email + ': ' +
                window.location.origin + '/reset-password.html?token=' + resetToken);

            hideLoading(sendResetLinkButton);
            showSuccess('Password reset link sent to your email. Please check your inbox.');

            setTimeout(() => {
                showForm('login');
            }, 3000);

        } catch (error) {
            showError('Failed to send reset link: ' + error.message);
            hideLoading(sendResetLinkButton);
        }
    });

    // Helper Functions
    function showForm(formName) {
        // Hide all forms
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        otpVerification.style.display = 'none';
        mobileVerification.style.display = 'none';
        forgotPasswordForm.style.display = 'none';

        // Reset OTP inputs
        otpInputs.forEach(input => input.value = '');

        // Show selected form
        switch (formName) {
            case 'login':
                loginForm.style.display = 'block';
                break;
            case 'register':
                registerForm.style.display = 'block';
                break;
            case 'otp':
                otpVerification.style.display = 'block';
                document.querySelector('.otp-input[data-index="0"]').focus();
                break;
            case 'mobile':
                mobileVerification.style.display = 'block';
                document.querySelector('.otp-input[data-index="0"]').focus();
                break;
            case 'forgot':
                forgotPasswordForm.style.display = 'block';
                break;
        }

        // Clear messages
        hideError();
        hideSuccess();
    }

    function togglePasswordVisibility(passwordField, toggleButton) {
        if (passwordField.type === 'password') {
            passwordField.type = 'text';
            toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            passwordField.type = 'password';
            toggleButton.innerHTML = '<i class="fas fa-eye"></i>';
        }
    }

    function calculatePasswordStrength(password) {
        let score = 0;

        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        if (password.length >= 12) score++;

        const texts = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'];

        return {
            score: Math.min(score, 4),
            text: texts[Math.min(score, 4)],
            color: colors[Math.min(score, 4)]
        };
    }

    async function authenticateUser(userData, password) {
        // In production, use proper password hashing comparison
        // For demo, we're using simple comparison
        if (hashPassword(password) !== userData.password) {
            showError('Invalid password');
            hideLoading(loginButton);
            return;
        }

        // Check if email is verified
        if (!userData.emailVerified) {
            showError('Please verify your email before logging in');
            hideLoading(loginButton);
            return;
        }

        // Update last login
        const userId = Object.keys(userData)[0];
        await usersRef.child(userId).update({
            lastLogin: new Date().toISOString()
        });

        // Set user session
        setUserSession({
            id: userId,
            username: userData.username,
            email: userData.email,
            fullName: userData.fullName
        });

        hideLoading(loginButton);
        showSuccess('Login successful! Redirecting to dashboard...');

        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    }

    function getFirstUserData(snapshot) {
        const data = snapshot.val();
        const userId = Object.keys(data)[0];
        return { ...data[userId], id: userId };
    }

    function setUserSession(user) {
        // Store in localStorage
        localStorage.setItem('symbiosis_user', JSON.stringify(user));

        // Also set a session cookie
        document.cookie = `symbiosis_session=${user.id}; path=/; max-age=86400; Secure; SameSite=Strict`;
    }

    function hashPassword(password) {
        // In production, use proper hashing like bcrypt
        // For demo purposes, using simple hash
        return btoa(password + 'symbiosis_salt');
    }

    function generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    function generateResetToken() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function validateMobile(mobile) {
        const re = /^[6-9]\d{9}$/;
        return re.test(mobile);
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(hideError, 5000);
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    function showSuccess(message) {
        successText.textContent = message;
        successMessage.style.display = 'block';
        setTimeout(hideSuccess, 5000);
    }

    function hideSuccess() {
        successMessage.style.display = 'none';
    }

    function showLoading(button) {
        button.disabled = true;
        const originalText = button.innerHTML;
        button.setAttribute('data-original', originalText);
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    function hideLoading(button) {
        button.disabled = false;
        const originalText = button.getAttribute('data-original');
        if (originalText) {
            button.innerHTML = originalText;
        }
    }

    // Check for existing session
    checkExistingSession();

    function checkExistingSession() {
        const user = localStorage.getItem('symbiosis_user');
        if (user) {
            // User is already logged in, redirect to dashboard
            window.location.href = 'dashboard.html';
        }
    }
});