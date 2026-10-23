const express = require('express');
const router = express.Router();
const supabaseService = require('../supabaseServer');

/**
 * GET /api/supabase/config
 * Provide frontend with Supabase project URL and anon key safely
 */
router.get('/config', (req, res) => {
    res.json({
        success: true,
        data: {
            url: supabaseService.url,
            anonKey: supabaseService.anonKey,
            projectRef: 'riwhpkqyhinysukujzfe',
            storageBuckets: {
                images: 'images',
                datasets: 'datasets',
                reports: 'reports'
            }
        }
    });
});

/**
 * GET /api/supabase/status
 * Health check test connection
 */
router.get('/status', async (req, res) => {
    const result = await supabaseService.testConnection();
    res.json({
        success: true,
        connected: result.ok,
        details: result
    });
});

/**
 * GET /api/machines
 * List all registered industrial assets in Machine Registry
 */
router.get('/machines', async (req, res) => {
    try {
        const machines = await supabaseService.getMachines();
        res.json({ success: true, count: machines.length, data: machines });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * POST /api/machines
 * Create or update a machine in the Machine Registry
 */
router.post('/machines', async (req, res) => {
    try {
        const machine = req.body;
        if (!machine.machine_name || !machine.category) {
            return res.status(400).json({ success: false, message: 'machine_name and category required' });
        }
        const saved = await supabaseService.upsertMachine(machine);
        res.status(201).json({ success: true, data: saved });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * GET /api/teng/readings
 * Fetch telemetry stream for a specific machine
 */
router.get('/teng/readings', async (req, res) => {
    try {
        const machineId = req.query.machineId || 'TURBINE-GEN-04';
        const limit = parseInt(req.query.limit, 10) || 50;
        const readings = await supabaseService.getTengReadings(machineId, limit);
        res.json({ success: true, count: readings.length, data: readings });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * POST /api/teng/readings
 * Ingest high-precision TENG sensor readings into Supabase
 */
router.post('/teng/readings', async (req, res) => {
    try {
        const reading = req.body;
        const saved = await supabaseService.addTengReading(reading);
        res.status(201).json({ success: true, data: saved });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * POST /api/vision/analyze
 * Save AI image analysis result and defect classification to Supabase
 */
router.post('/vision/analyze', async (req, res) => {
    try {
        const analysis = req.body;
        if (!analysis.image_url) {
            return res.status(400).json({ success: false, message: 'image_url is required' });
        }
        const saved = await supabaseService.addImageAnalysis(analysis);
        res.status(201).json({ success: true, data: saved });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * POST /api/reports/generate
 * Record generated PDF report into Supabase reports table
 */
router.post('/reports/generate', async (req, res) => {
    try {
        const report = req.body;
        if (!report.report_title || !report.file_url) {
            return res.status(400).json({ success: false, message: 'report_title and file_url required' });
        }
        const saved = await supabaseService.addReport(report);
        res.status(201).json({ success: true, data: saved });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * ─────────────────────────────────────────────────────────────────
 * SECOND APPLICATION INTEGRATION ENDPOINTS
 * Dedicated endpoints enabling a 2nd application to securely
 * read authorized fleet data and save Symbiosis results to the same Supabase project.
 * ─────────────────────────────────────────────────────────────────
 */
router.get('/second-app/telemetry', async (req, res) => {
    try {
        const machineId = req.query.machineId || 'TURBINE-GEN-04';
        const readings = await supabaseService.getTengReadings(machineId, 20);
        res.json({
            success: true,
            source: 'Supabase Central Telemetry',
            machineId,
            data: readings
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

router.post('/second-app/matches', async (req, res) => {
    try {
        const matchData = req.body;
        if (!matchData.material_name || matchData.match_score === undefined) {
            return res.status(400).json({ success: false, message: 'material_name and match_score required' });
        }
        const saved = await supabaseService.addMatch(matchData);
        res.status(201).json({
            success: true,
            message: 'Match synchronized to Central Supabase',
            data: saved
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
