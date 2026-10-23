/**
 * Supabase Configuration for Nivaar AI & Symbiosis Platform
 * 
 * Central credentials for all database operations, Realtime subscriptions,
 * and Supabase Storage (images, datasets, reports).
 */

(function () {
    // Helper to resolve Supabase project URL
    function getCleanUrl(url, key) {
        if (!url || typeof url !== 'string') {
            return 'https://riwhpkqyhinysukujzfe.supabase.co';
        }
        let clean = url.trim();
        // If user accidentally put publishable key in URL slot or a raw ref
        if (clean.startsWith('sb_') || (!clean.includes('.') && clean.length > 10)) {
            return 'https://riwhpkqyhinysukujzfe.supabase.co';
        }
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
            clean = 'https://' + clean;
        }
        return clean;
    }

    // ─────────────────────────────────────────────────────────────────
    // YOUR SUPABASE CREDENTIALS
    // ─────────────────────────────────────────────────────────────────
    const rawUrl = "https://riwhpkqyhinysukujzfe.supabase.co";
    const rawAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpd2hwa3F5aGlueXN1a3VqemZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NjE3NDEsImV4cCI6MjEwODMzNzc0MX0.8kqFwFNWi7r5jw0lBeOXM1NcEypsgEH9N53fJ9UfKXU";

    window.SUPABASE_CONFIG = {
        // Primary Supabase Project URL
        url: getCleanUrl(rawUrl, rawAnonKey),

        // Supabase Anon / Publishable Key (safe to use in browser)
        anonKey: rawAnonKey,

        // Storage Buckets
        storageBuckets: {
            images: 'images',
            datasets: 'datasets',
            reports: 'reports'
        },

        // Project Reference
        projectRef: 'riwhpkqyhinysukujzfe'
    };

    console.log('⚡ [Supabase Config] Initialized for project:', window.SUPABASE_CONFIG.projectRef);
})();
