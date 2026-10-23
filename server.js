require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const supabaseRoutes = require('./routes/supabaseRoutes');
app.use('/api/supabase', supabaseRoutes);
app.use('/api/machines', (req, res, next) => { req.url = '/machines' + (req.url === '/' ? '' : req.url); supabaseRoutes(req, res, next); });
app.use('/api/teng', (req, res, next) => { req.url = '/teng' + (req.url === '/' ? '' : req.url); supabaseRoutes(req, res, next); });
app.use('/api/vision', (req, res, next) => { req.url = '/vision' + (req.url === '/' ? '' : req.url); supabaseRoutes(req, res, next); });
app.use('/api/reports', (req, res, next) => { req.url = '/reports' + (req.url === '/' ? '' : req.url); supabaseRoutes(req, res, next); });
app.use('/api/second-app', (req, res, next) => { req.url = '/second-app' + (req.url === '/' ? '' : req.url); supabaseRoutes(req, res, next); });
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/messages', require('./routes/messages'));

// Serve frontend pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'onboarding.html'));
});

app.get('/marketplace', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'marketplace.html'));
});

app.get('/listing', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'listing.html'));
});

app.get('/messages', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'messages.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

process.on('uncaughtException', (err) => {
    console.error('⚠️ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

const server = app.listen(PORT, () => {
    console.log(`🚀 Symbiosis.ai server running on port ${PORT}`);
    console.log(`📍 Visit http://localhost:${PORT}`);
});