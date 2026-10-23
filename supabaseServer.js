require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Helper to sanitize Supabase URL
function resolveSupabaseUrl(url) {
    if (!url) return 'https://riwhpkqyhinysukujzfe.supabase.co';
    let trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    // If user passed publishable token or ref
    if (trimmed.startsWith('sb_') || !trimmed.includes('.')) {
        return 'https://riwhpkqyhinysukujzfe.supabase.co';
    }
    return `https://${trimmed}`;
}

const SUPABASE_URL = resolveSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpd2hwa3F5aGlueXN1a3VqemZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NjE3NDEsImV4cCI6MjEwODMzNzc0MX0.8kqFwFNWi7r5jw0lBeOXM1NcEypsgEH9N53fJ9UfKXU';

let supabase = null;
let isConnected = false;

try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: true
        }
    });
    console.log(`✅ Supabase Server Client initialized for ${SUPABASE_URL}`);
} catch (err) {
    console.error('⚠️ Supabase Server Client initialization error:', err.message);
}

// In-memory fallback caches to ensure graceful degradation if tables aren't migrated yet
const localCache = {
    machines: new Map([
        ['TURBINE-GEN-04', { id: 'TURBINE-GEN-04', machine_name: 'Gas Turbine Generator 04', category: 'Turbines', location: 'Primary Powerhouse Bay A', status: 'inspection_required', health_index: 67.5, vibration_iso_zone: 'Zone B', fundamental_hz: 49.8 }],
        ['PUMP-CENT-02', { id: 'PUMP-CENT-02', machine_name: 'High-Pressure Feed Pump 02', category: 'Pumps', location: 'Hydraulic Substation 3', status: 'nominal', health_index: 94.2, vibration_iso_zone: 'Zone A', fundamental_hz: 29.5 }],
        ['COMP-RECIP-01', { id: 'COMP-RECIP-01', machine_name: 'Dual-Stage Air Compressor 01', category: 'Compressors', location: 'Pneumatics Building C', status: 'nominal', health_index: 91.0, vibration_iso_zone: 'Zone A', fundamental_hz: 14.8 }],
        ['TRANS-STEP-03', { id: 'TRANS-STEP-03', machine_name: '33kV Step-Down Transformer 03', category: 'Transformers', location: 'Substation Yard Grid 2', status: 'nominal', health_index: 98.4, vibration_iso_zone: 'Zone A', fundamental_hz: 50.0 }],
        ['GEN-DIESEL-05', { id: 'GEN-DIESEL-05', machine_name: 'Emergency Standby Diesel 05', category: 'Generators', location: 'Auxiliary Backup Yard', status: 'nominal', health_index: 89.6, vibration_iso_zone: 'Zone A', fundamental_hz: 50.2 }],
        ['BLOW-IND-06', { id: 'BLOW-IND-06', machine_name: 'Exhaust Scrubber Blower 06', category: 'Blowers', location: 'Emission Recovery Line', status: 'critical', health_index: 41.2, vibration_iso_zone: 'Zone C', fundamental_hz: 58.4 }],
        ['BOIL-REC-07', { id: 'BOIL-REC-07', machine_name: 'Heat Recovery Steam Gen 07', category: 'Boilers', location: 'Thermal Recovery Sector', status: 'nominal', health_index: 88.0, vibration_iso_zone: 'Zone A', fundamental_hz: 0.0 }],
        ['CHILL-CENT-08', { id: 'CHILL-CENT-08', machine_name: 'Centrifugal Chiller 08', category: 'Chillers', location: 'HVAC Central Plant', status: 'nominal', health_index: 93.5, vibration_iso_zone: 'Zone A', fundamental_hz: 30.1 }]
    ]),
    tengReadings: [],
    materials: new Map(),
    matches: [],
    reports: []
};

const supabaseService = {
    client: supabase,
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,

    // Test connection
    async testConnection() {
        if (!supabase) return { ok: false, error: 'Client not initialized' };
        try {
            const { data, error } = await supabase.from('machines').select('id').limit(1);
            if (error) {
                return { ok: false, error: error.message, code: error.code };
            }
            return { ok: true, count: data ? data.length : 0 };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    },

    // ── Machines ──
    async getMachines() {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('machines').select('*').order('created_at', { ascending: true });
                if (!error && data && data.length > 0) return data;
            } catch (e) {
                console.warn('Supabase machines query fallback:', e.message);
            }
        }
        return Array.from(localCache.machines.values());
    },

    async getMachineById(id) {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('machines').select('*').eq('id', id).single();
                if (!error && data) return data;
            } catch (e) {}
        }
        return localCache.machines.get(id) || null;
    },

    async upsertMachine(machine) {
        if (!machine.id) machine.id = `MACH_${Date.now()}`;
        localCache.machines.set(machine.id, machine);

        if (supabase) {
            try {
                const { data, error } = await supabase.from('machines').upsert(machine).select();
                if (!error && data) return data[0];
            } catch (e) {
                console.warn('Supabase upsertMachine fallback:', e.message);
            }
        }
        return machine;
    },

    // ── TENG Sensor Readings ──
    async addTengReading(reading) {
        const item = {
            id: reading.id || undefined,
            machine_id: reading.machine_id || 'TURBINE-GEN-04',
            voltage_v: parseFloat(reading.voltage_v) || 0,
            current_ua: parseFloat(reading.current_ua) || 0,
            frequency_hz: parseFloat(reading.frequency_hz) || 0,
            vibration_x_rms: parseFloat(reading.vibration_x_rms) || 0,
            vibration_y_rms: parseFloat(reading.vibration_y_rms) || 0,
            peak_acceleration_g: parseFloat(reading.peak_acceleration_g) || 0,
            anomaly_score: parseFloat(reading.anomaly_score) || 0,
            is_anomaly: Boolean(reading.is_anomaly),
            source: reading.source || 'teng_sensor',
            dataset_file_url: reading.dataset_file_url || null,
            raw_waveform: reading.raw_waveform || [],
            recorded_at: reading.recorded_at || new Date().toISOString()
        };

        localCache.tengReadings.unshift(item);
        if (localCache.tengReadings.length > 200) localCache.tengReadings.pop();

        if (supabase) {
            try {
                const { data, error } = await supabase.from('teng_sensor_readings').insert(item).select();
                if (!error && data) return data[0];
            } catch (e) {
                console.warn('Supabase addTengReading fallback:', e.message);
            }
        }
        return item;
    },

    async getTengReadings(machineId = 'TURBINE-GEN-04', limit = 50) {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('teng_sensor_readings')
                    .select('*')
                    .eq('machine_id', machineId)
                    .order('recorded_at', { ascending: false })
                    .limit(limit);
                if (!error && data && data.length > 0) return data;
            } catch (e) {}
        }
        return localCache.tengReadings.filter(r => r.machine_id === machineId).slice(0, limit);
    },

    // ── AI Image Analyses ──
    async addImageAnalysis(analysis) {
        const item = {
            machine_id: analysis.machine_id || 'TURBINE-GEN-04',
            inspection_id: analysis.inspection_id || `INSP_${Date.now()}`,
            company_id: analysis.company_id || 'demo_user',
            image_url: analysis.image_url,
            image_filename: analysis.image_filename || 'defect_sample.jpg',
            defect_detected: Boolean(analysis.defect_detected),
            defect_type: analysis.defect_type || 'None',
            defect_severity: analysis.defect_severity || 'low',
            confidence_score: parseFloat(analysis.confidence_score) || 0.85,
            bounding_boxes: analysis.bounding_boxes || [],
            ai_recommendation: analysis.ai_recommendation || 'Proceed with scheduled monitoring.',
            analyzed_at: new Date().toISOString()
        };

        if (supabase) {
            try {
                const { data, error } = await supabase.from('image_analyses').insert(item).select();
                if (!error && data) return data[0];
            } catch (e) {
                console.warn('Supabase addImageAnalysis fallback:', e.message);
            }
        }
        return item;
    },

    // ── Symbiosis Materials / Listings ──
    async getMaterials() {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('symbiosis_materials').select('*').order('created_at', { ascending: false });
                if (!error && data && data.length > 0) return data;
            } catch (e) {}
        }
        return Array.from(localCache.materials.values());
    },

    async addMaterial(material) {
        if (!material.id) material.id = `listing_${Date.now()}`;
        localCache.materials.set(material.id, material);

        if (supabase) {
            try {
                const { data, error } = await supabase.from('symbiosis_materials').insert(material).select();
                if (!error && data) return data[0];
            } catch (e) {
                console.warn('Supabase addMaterial fallback:', e.message);
            }
        }
        return material;
    },

    // ── Symbiosis Matches ──
    async addMatch(match) {
        if (!match.id) match.id = `match_${Date.now()}`;
        localCache.matches.unshift(match);

        if (supabase) {
            try {
                const { data, error } = await supabase.from('symbiosis_matches').insert(match).select();
                if (!error && data) return data[0];
            } catch (e) {}
        }
        return match;
    },

    // ── Reports ──
    async addReport(report) {
        if (!report.id) report.id = `REP_${Date.now()}`;
        localCache.reports.unshift(report);

        if (supabase) {
            try {
                const { data, error } = await supabase.from('reports').insert(report).select();
                if (!error && data) return data[0];
            } catch (e) {}
        }
        return report;
    },

    // ── Supabase Storage Upload Helper ──
    async uploadFile(bucketName, filename, fileBuffer, contentType) {
        if (!supabase) return { error: 'Supabase client unavailable' };
        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(filename, fileBuffer, {
                    contentType: contentType || 'application/octet-stream',
                    upsert: true
                });

            if (error) return { error: error.message };

            const { data: publicUrlData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filename);

            return { ok: true, path: data.path, publicUrl: publicUrlData.publicUrl };
        } catch (e) {
            return { error: e.message };
        }
    }
};

module.exports = supabaseService;
