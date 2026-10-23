/**
 * ═══════════════════════════════════════════════════════════════════════
 * SECOND APPLICATION - SUPABASE INTEGRATION CLIENT & VERIFICATION SUITE
 * 
 * This module demonstrates and validates that a SECOND application can
 * securely connect to the EXACT SAME Supabase project as Nivaar AI.
 * 
 * Shared Supabase Project Ref: riwhpkqyhinysukujzfe
 * URL: https://riwhpkqyhinysukujzfe.supabase.co
 * ═══════════════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 1. Credentials for the Shared Supabase Project
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://riwhpkqyhinysukujzfe.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpd2hwa3F5aGlueXN1a3VqemZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NjE3NDEsImV4cCI6MjEwODMzNzc0MX0.8kqFwFNWi7r5jw0lBeOXM1NcEypsgEH9N53fJ9UfKXU';

// 2. Initialize Client in the Second Application
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});

console.log('🤖 [Second App] Connecting to Central Supabase Project:', SUPABASE_URL);

/**
 * Feature A: Read Authorized Machine Records from Central Supabase
 */
async function fetchCentralFleetMachines() {
    console.log('📡 [Second App] Reading machine fleet from Supabase...');
    const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.warn('⚠️ [Second App] Notice when querying machines:', error.message);
        return { ok: false, error: error.message };
    }
    console.log(`✅ [Second App] Successfully retrieved ${data.length} machines from Central Supabase:`);
    data.forEach(m => console.log(`   • [${m.id}] ${m.machine_name} (${m.category}) - Health: ${m.health_index}% - ${m.vibration_iso_zone}`));
    return { ok: true, data };
}

/**
 * Feature B: Read Real-Time TENG Sensor Telemetry from Central Supabase
 */
async function fetchTengTelemetry(machineId = 'TURBINE-GEN-04') {
    console.log(`📡 [Second App] Reading TENG telemetry for ${machineId}...`);
    const { data, error } = await supabase
        .from('teng_sensor_readings')
        .select('*')
        .eq('machine_id', machineId)
        .order('recorded_at', { ascending: false })
        .limit(5);

    if (error) {
        console.warn('⚠️ [Second App] Notice when querying TENG telemetry:', error.message);
        return { ok: false, error: error.message };
    }
    console.log(`✅ [Second App] Found ${data.length} recent TENG sensor readings for ${machineId}`);
    return { ok: true, data };
}

/**
 * Feature C: Save Symbiosis Results to Central Supabase
 * (Allows the 2nd app to calculate/publish circular matches that appear on Nivaar AI's dashboard)
 */
async function publishSymbiosisMatchResult({
    supplierCompanyId = 'demo_user',
    buyerCompanyId = 'demo_user',
    materialName = 'Secondary Turbine Lubricant',
    category = 'Energy & Chemical',
    matchScore = 92.5,
    co2SavingsTons = 14.8,
    costSavingsInr = 185000
} = {}) {
    const matchId = `match_second_app_${Date.now()}`;
    console.log(`🔄 [Second App] Publishing Symbiosis match result [${matchId}] to Supabase...`);

    const payload = {
        id: matchId,
        supplier_company_id: supplierCompanyId,
        buyer_company_id: buyerCompanyId,
        material_name: materialName,
        category: category,
        match_score: matchScore,
        matching_factors: ['Chemical spec verified', 'Proximity < 40km', 'Zero landfill diversion'],
        estimated_co2_savings_tons: co2SavingsTons,
        estimated_cost_savings_inr: costSavingsInr,
        status: 'suggested'
    };

    const { data, error } = await supabase
        .from('symbiosis_matches')
        .insert(payload)
        .select();

    if (error) {
        console.warn('⚠️ [Second App] Notice when saving Symbiosis match:', error.message);
        return { ok: false, error: error.message, payload };
    }
    console.log('✅ [Second App] Symbiosis match saved successfully in Central Supabase:', data[0]);
    return { ok: true, data: data[0] };
}

/**
 * Self-Test Runner
 */
async function runSecondAppVerification() {
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(' NIVAAR AI - SECOND APPLICATION SUPABASE INTEGRATION TEST');
    console.log('═══════════════════════════════════════════════════════════════════════');

    // 1. Fleet Machines Query
    await fetchCentralFleetMachines();

    // 2. TENG Telemetry Query
    await fetchTengTelemetry('TURBINE-GEN-04');

    // 3. Publish Symbiosis Result
    await publishSymbiosisMatchResult();

    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(' Verification Complete: Second application integration pattern ready.');
    console.log('═══════════════════════════════════════════════════════════════════════');
}

// Export module functions
module.exports = {
    supabase,
    fetchCentralFleetMachines,
    fetchTengTelemetry,
    publishSymbiosisMatchResult,
    runSecondAppVerification
};

// Run if executed directly
if (require.main === module) {
    runSecondAppVerification().catch(console.error);
}
