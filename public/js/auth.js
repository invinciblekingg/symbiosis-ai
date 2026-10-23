/**
 * Authentication Module for Symbiosis.ai
 * Handles user registration, login, and session management
 * Uses Firebase Realtime Database for user storage
 */

// Simple hash function for passwords (in production, use bcrypt on server)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'symbiosis_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a unique ID
function generateId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Generate verification token
function generateToken() {
    return Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
}

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Object} - Result with success status and data
 */
async function register(userData) {
    try {
        const { email, password, ...profileData } = userData;

        if (!email || !password) {
            return { success: false, message: 'Email and password are required' };
        }

        // Check if email already exists
        const existingUser = await dbOperations.queryByChild('users', 'email', email.toLowerCase());
        if (existingUser) {
            return { success: false, message: 'An account with this email already exists' };
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Generate user ID and verification token
        const userId = generateId();
        const verificationToken = generateToken();

        // Create user object
        const user = {
            id: userId,
            email: email.toLowerCase(),
            password: hashedPassword,
            ...profileData,
            verified: false,
            verificationToken,
            onboardingComplete: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to database
        await dbOperations.set(`users/${userId}`, user);

        // Store session
        const session = {
            userId,
            email: user.email,
            companyName: user.companyName,
            token: generateToken(),
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        };

        localStorage.setItem('symbiosis_session', JSON.stringify(session));
        localStorage.setItem('symbiosis_user', JSON.stringify({
            id: userId,
            email: user.email,
            companyName: user.companyName,
            verified: user.verified,
            onboardingComplete: user.onboardingComplete
        }));

        return {
            success: true,
            message: 'Registration successful',
            userId,
            verificationToken,
            onboardingComplete: false
        };

    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: 'An error occurred during registration' };
    }
}

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object} - Result with success status and user data
 */
async function login(email, password) {
    try {
        if (!email || !password) {
            return { success: false, message: 'Email and password are required' };
        }

        // Find user by email
        const users = await dbOperations.queryByChild('users', 'email', email.toLowerCase());

        if (!users) {
            return { success: false, message: 'Invalid email or password' };
        }

        // Get the user (should be only one)
        const userId = Object.keys(users)[0];
        const user = users[userId];

        // Verify password
        const hashedPassword = await hashPassword(password);
        if (user.password !== hashedPassword) {
            return { success: false, message: 'Invalid email or password' };
        }

        // Create session
        const session = {
            userId: user.id,
            email: user.email,
            companyName: user.companyName,
            token: generateToken(),
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        };

        localStorage.setItem('symbiosis_session', JSON.stringify(session));
        localStorage.setItem('symbiosis_user', JSON.stringify({
            id: user.id,
            email: user.email,
            companyName: user.companyName,
            verified: user.verified,
            onboardingComplete: user.onboardingComplete,
            industryType: user.industryType,
            factory: user.factory
        }));

        return {
            success: true,
            message: 'Login successful',
            userId: user.id,
            companyName: user.companyName,
            verified: user.verified,
            onboardingComplete: user.onboardingComplete
        };

    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'An error occurred during login' };
    }
}

/**
 * Logout user
 */
function logout() {
    localStorage.removeItem('symbiosis_session');
    localStorage.removeItem('symbiosis_user');
    window.location.href = '/login';
}

/**
 * Get current user
 * @returns {Object|null} - Current user data or null
 */
function getCurrentUser() {
    const session = localStorage.getItem('symbiosis_session');
    const user = localStorage.getItem('symbiosis_user');

    if (!session || !user) {
        return null;
    }

    const sessionData = JSON.parse(session);

    // Check if session expired
    if (Date.now() > sessionData.expiresAt) {
        logout();
        return null;
    }

    return JSON.parse(user);
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
    return getCurrentUser() !== null;
}

/**
 * Update user profile
 * @param {Object} updates - Fields to update
 * @returns {Object} - Result with success status
 */
async function updateProfile(updates) {
    try {
        const user = getCurrentUser();
        if (!user) {
            return { success: false, message: 'Not authenticated' };
        }

        // Update in database
        await dbOperations.update(`users/${user.id}`, {
            ...updates,
            updatedAt: new Date().toISOString()
        });

        // Update local storage
        const updatedUser = { ...user, ...updates };
        localStorage.setItem('symbiosis_user', JSON.stringify(updatedUser));

        return { success: true, message: 'Profile updated successfully' };

    } catch (error) {
        console.error('Update profile error:', error);
        return { success: false, message: 'An error occurred' };
    }
}

/**
 * Complete onboarding
 * @param {Object} onboardingData - Waste, materials, logistics, sustainability data
 * @returns {Object} - Result with success status
 */
async function completeOnboarding(onboardingData) {
    try {
        const user = getCurrentUser();
        if (!user) {
            return { success: false, message: 'Not authenticated' };
        }

        const updates = {
            ...onboardingData,
            onboardingComplete: true,
            onboardingCompletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Update in database
        await dbOperations.update(`users/${user.id}`, updates);

        // Update local storage
        const updatedUser = { ...user, onboardingComplete: true };
        localStorage.setItem('symbiosis_user', JSON.stringify(updatedUser));

        return { success: true, message: 'Onboarding completed successfully' };

    } catch (error) {
        console.error('Onboarding error:', error);
        return { success: false, message: 'An error occurred during onboarding' };
    }
}

/**
 * Save onboarding draft
 * @param {Object} draftData - Partial onboarding data
 * @returns {Object} - Result with success status
 */
async function saveOnboardingDraft(draftData) {
    try {
        const user = getCurrentUser();
        if (!user) {
            return { success: false, message: 'Not authenticated' };
        }

        await dbOperations.update(`users/${user.id}`, {
            onboardingDraft: draftData,
            updatedAt: new Date().toISOString()
        });

        return { success: true, message: 'Draft saved' };

    } catch (error) {
        console.error('Save draft error:', error);
        return { success: false, message: 'Failed to save draft' };
    }
}

/**
 * Get full user profile from database
 * @returns {Object|null} - Full user profile
 */
async function getFullProfile() {
    try {
        const user = getCurrentUser();
        if (!user) {
            return null;
        }

        const fullProfile = await dbOperations.get(`users/${user.id}`);

        // Don't return password
        if (fullProfile) {
            delete fullProfile.password;
        }

        return fullProfile;

    } catch (error) {
        console.error('Get profile error:', error);
        return null;
    }
}

/**
 * Verify email (simple token check)
 * @param {string} token - Verification token
 * @returns {Object} - Result with success status
 */
async function verifyEmail(token) {
    try {
        const user = getCurrentUser();
        if (!user) {
            return { success: false, message: 'Not authenticated' };
        }

        const fullProfile = await dbOperations.get(`users/${user.id}`);

        if (fullProfile.verificationToken !== token) {
            return { success: false, message: 'Invalid verification token' };
        }

        await dbOperations.update(`users/${user.id}`, {
            verified: true,
            verificationToken: null,
            verifiedAt: new Date().toISOString()
        });

        // Update local storage
        const updatedUser = { ...user, verified: true };
        localStorage.setItem('symbiosis_user', JSON.stringify(updatedUser));

        return { success: true, message: 'Email verified successfully' };

    } catch (error) {
        console.error('Verify email error:', error);
        return { success: false, message: 'Verification failed' };
    }
}

/**
 * Protect page - redirect to login if not authenticated
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

/**
 * Redirect to dashboard if already authenticated
 */
function redirectIfAuthenticated() {
    if (isAuthenticated()) {
        const user = getCurrentUser();
        if (user.onboardingComplete) {
            window.location.href = '/dashboard';
        } else {
            window.location.href = '/onboarding';
        }
        return true;
    }
    return false;
}

// Export functions
window.register = register;
window.login = login;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.isAuthenticated = isAuthenticated;
window.updateProfile = updateProfile;
window.completeOnboarding = completeOnboarding;
window.saveOnboardingDraft = saveOnboardingDraft;
window.getFullProfile = getFullProfile;
window.verifyEmail = verifyEmail;
window.requireAuth = requireAuth;
window.redirectIfAuthenticated = redirectIfAuthenticated;
