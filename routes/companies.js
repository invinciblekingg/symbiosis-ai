const express = require('express');
const router = express.Router();

// In-memory storage for companies (replaced by Firebase in frontend)
const companies = new Map();

/**
 * GET /api/companies/:id
 * Get company profile by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const company = companies.get(id);

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        res.json({
            success: true,
            data: company
        });

    } catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * PUT /api/companies/:id
 * Update company profile
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        let company = companies.get(id);
        if (!company) {
            company = { id, createdAt: new Date().toISOString() };
        }

        company = {
            ...company,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        companies.set(id, company);

        res.json({
            success: true,
            message: 'Company updated successfully',
            data: company
        });

    } catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * POST /api/companies/:id/onboarding
 * Save onboarding data (waste materials, requirements, logistics)
 */
router.post('/:id/onboarding', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            wasteProduced,
            materialsRequired,
            logistics,
            sustainability
        } = req.body;

        let company = companies.get(id) || { id };

        company = {
            ...company,
            wasteProduced: wasteProduced || [],
            materialsRequired: materialsRequired || [],
            logistics: logistics || {},
            sustainability: sustainability || {},
            onboardingComplete: true,
            onboardingCompletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        companies.set(id, company);

        res.json({
            success: true,
            message: 'Onboarding completed successfully',
            data: company
        });

    } catch (error) {
        console.error('Onboarding error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during onboarding'
        });
    }
});

/**
 * GET /api/companies
 * List all companies (with optional filters)
 */
router.get('/', async (req, res) => {
    try {
        const { industry, city, state } = req.query;

        let results = Array.from(companies.values());

        if (industry) {
            results = results.filter(c => c.industryType === industry);
        }
        if (city) {
            results = results.filter(c => c.factory?.city === city);
        }
        if (state) {
            results = results.filter(c => c.factory?.state === state);
        }

        res.json({
            success: true,
            data: results,
            total: results.length
        });

    } catch (error) {
        console.error('List companies error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

module.exports = router;
