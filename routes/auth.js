const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage (will be replaced by Firebase in frontend)
// This serves as API structure documentation
const users = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'symbiosis-ai-secret-key-change-in-production';
const TOKEN_EXPIRY = '7d';

// Generate JWT Token
const generateToken = (userId, email) => {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
};

// Verify JWT Token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

/**
 * POST /api/auth/register
 * Register a new company/user
 */
router.post('/register', async (req, res) => {
    try {
        const {
            companyName,
            gstNumber,
            industryType,
            registrationNumber,
            yearEstablished,
            employeeCount,
            annualTurnover,
            factoryName,
            address,
            pincode,
            city,
            state,
            latitude,
            longitude,
            representativeName,
            designation,
            email,
            mobile,
            alternateContact,
            password
        } = req.body;

        // Validation
        if (!email || !password || !companyName) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and company name are required'
            });
        }

        // Check if user already exists
        if (users.has(email)) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate verification token
        const verificationToken = uuidv4();
        const userId = uuidv4();

        // Create user object
        const user = {
            id: userId,
            email,
            password: hashedPassword,
            companyName,
            gstNumber,
            industryType,
            registrationNumber,
            yearEstablished,
            employeeCount,
            annualTurnover,
            factory: {
                name: factoryName,
                address,
                pincode,
                city,
                state,
                coordinates: { latitude, longitude }
            },
            representative: {
                name: representativeName,
                designation,
                mobile,
                alternateContact
            },
            documents: [],
            verified: false,
            verificationToken,
            onboardingComplete: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        users.set(email, user);

        // Generate auth token
        const token = generateToken(userId, email);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify your email.',
            data: {
                userId,
                email,
                companyName,
                token,
                verificationToken // In production, send this via email
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during registration'
        });
    }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = users.get(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(user.id, email);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                userId: user.id,
                email: user.email,
                companyName: user.companyName,
                verified: user.verified,
                onboardingComplete: user.onboardingComplete,
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during login'
        });
    }
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', async (req, res) => {
    try {
        const { email, verificationToken } = req.body;

        const user = users.get(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.verificationToken !== verificationToken) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification token'
            });
        }

        user.verified = true;
        user.verificationToken = null;
        user.updatedAt = new Date().toISOString();
        users.set(email, user);

        res.json({
            success: true,
            message: 'Email verified successfully'
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during verification'
        });
    }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = users.get(email);
        if (!user) {
            // Return success even if user doesn't exist (security)
            return res.json({
                success: true,
                message: 'If the email exists, a reset link has been sent'
            });
        }

        // Generate reset token
        const resetToken = uuidv4();
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
        users.set(email, user);

        res.json({
            success: true,
            message: 'If the email exists, a reset link has been sent',
            data: { resetToken } // In production, send via email
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;

        const user = users.get(email);
        if (!user || user.resetToken !== resetToken) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        if (Date.now() > user.resetTokenExpiry) {
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetToken = null;
        user.resetTokenExpiry = null;
        user.updatedAt = new Date().toISOString();
        users.set(email, user);

        res.json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        const user = users.get(decoded.email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Return user without sensitive data
        const { password, verificationToken, resetToken, resetTokenExpiry, ...safeUser } = user;

        res.json({
            success: true,
            data: safeUser
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

module.exports = router;
