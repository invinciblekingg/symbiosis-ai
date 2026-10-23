-- ═══════════════════════════════════════════════════════════════════════
-- NIVAAR AI & SYMBIOSIS.AI - SUPABASE CENTRAL DATABASE SCHEMA
-- Schema Migration Script for PostgreSQL with RLS and Storage Policies
-- ═══════════════════════════════════════════════════════════════════════

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. DROP / CLEAN PRE-EXISTING TABLES IF RE-RUNNING (Safe Mode)
-- Tables are created with IF NOT EXISTS to prevent destructive wipes.

-- ─────────────────────────────────────────────────────────────────────
-- TABLE 1: companies (Registered Industrial Entities & Fleet Operators)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    industry_type TEXT,
    gst_number TEXT,
    registration_number TEXT,
    representative_name TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    verified BOOLEAN DEFAULT FALSE,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    raw_profile JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE 2: machines (Machine Registry - Operations & Fleet Management)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.machines (
    id TEXT PRIMARY KEY, -- Unique Machine ID, e.g. TURBINE-GEN-04
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    machine_name TEXT NOT NULL,
    category TEXT NOT NULL, -- Turbines, Pumps, Compressors, Transformers, Generators, etc.
    location TEXT DEFAULT 'Hub Zone 1',
    status TEXT DEFAULT 'nominal', -- 'nominal', 'inspection_required', 'critical'
    health_index DOUBLE PRECISION DEFAULT 100.0,
    vibration_iso_zone TEXT DEFAULT 'Zone A', -- Zone A (Nominal), Zone B, Zone C, Zone D (Dangerous)
    fundamental_hz DOUBLE PRECISION DEFAULT 50.0,
    operating_hours INTEGER DEFAULT 0,
    specifications JSONB DEFAULT '{}'::jsonb,
    last_inspected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE 3: teng_sensor_readings (TENG IoT Triboelectric Telemetry)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teng_sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id TEXT NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    voltage_v DOUBLE PRECISION DEFAULT 0.0, -- Triboelectric open-circuit voltage
    current_ua DOUBLE PRECISION DEFAULT 0.0, -- Short-circuit microcurrent
    frequency_hz DOUBLE PRECISION DEFAULT 0.0, -- Waveform fundamental frequency
    vibration_x_rms DOUBLE PRECISION DEFAULT 0.0, -- X-Axis RMS (mm/s)
    vibration_y_rms DOUBLE PRECISION DEFAULT 0.0, -- Y-Axis RMS (mm/s)
    peak_acceleration_g DOUBLE PRECISION DEFAULT 0.0, -- Peak dynamic g-load
    anomaly_score DOUBLE PRECISION DEFAULT 0.0, -- Isolation Forest anomaly confidence
    is_anomaly BOOLEAN DEFAULT FALSE,
    source TEXT DEFAULT 'teng_sensor', -- 'teng_sensor', 'csv_upload', 'worker_alpha', 'worker_beta'
    dataset_file_url TEXT, -- Link to Supabase Storage if uploaded via CSV
    raw_waveform JSONB DEFAULT '[]'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE 4: image_analyses (AI Computer Vision Defect Diagnostics)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.image_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id TEXT REFERENCES public.machines(id) ON DELETE SET NULL,
    inspection_id TEXT,
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL, -- Supabase Storage URL
    image_filename TEXT,
    defect_detected BOOLEAN DEFAULT FALSE,
    defect_type TEXT DEFAULT 'None', -- 'Thermal Fatigue', 'Surface Fracture', 'Fretting Wear', 'Cavitation Pitting', 'None'
    defect_severity TEXT DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    confidence_score DOUBLE PRECISION DEFAULT 0.0, -- 0.0 - 1.0 (or %)
    bounding_boxes JSONB DEFAULT '[]'::jsonb,
    ai_recommendation TEXT,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE 5: inspections (Structured Machine Diagnostics & Audits)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspections (
    id TEXT PRIMARY KEY, -- Unique Inspection ID, e.g. INSP-2024-001
    machine_id TEXT NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    inspector_name TEXT DEFAULT 'Autonomous AI Sentinel',
    status TEXT DEFAULT 'completed', -- 'scheduled', 'in_progress', 'completed', 'flagged'
    health_index DOUBLE PRECISION DEFAULT 100.0,
    vibration_rms DOUBLE PRECISION DEFAULT 0.0,
    defect_summary TEXT,
    ai_predictions JSONB DEFAULT '{}'::jsonb, -- Health score, failure probability, remaining useful life
    action_plan TEXT,
    report_url TEXT, -- Link to final PDF report in Supabase Storage
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE 6: symbiosis_materials (B2B Circular Resource Listings)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.symbiosis_materials (
    id TEXT PRIMARY KEY, -- e.g. listing_171928374
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- 'waste' (available) or 'requirement' (needed)
    category TEXT NOT NULL,
    material_type TEXT,
    quantity DOUBLE PRECISION DEFAULT 0.0,
    unit TEXT DEFAULT 'tons',
    quality JSONB DEFAULT '{}'::jsonb,
    hazardous TEXT DEFAULT 'non-hazardous',
    pricing JSONB DEFAULT '{}'::jsonb,
    location TEXT,
    images TEXT[] DEFAULT ARRAY[]::TEXT[],
    status TEXT DEFAULT 'active', -- 'active', 'matched', 'closed'
    views INTEGER DEFAULT 0,
    inquiries INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE 7: symbiosis_matches (AI-Powered Multimodal Circular Matches)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.symbiosis_matches (
    id TEXT PRIMARY KEY,
    supplier_company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    buyer_company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    material_id TEXT,
    material_name TEXT NOT NULL,
    category TEXT,
    match_score DOUBLE PRECISION NOT NULL,
    matching_factors TEXT[] DEFAULT ARRAY[]::TEXT[],
    estimated_co2_savings_tons DOUBLE PRECISION DEFAULT 0.0,
    estimated_cost_savings_inr DOUBLE PRECISION DEFAULT 0.0,
    status TEXT DEFAULT 'suggested', -- 'suggested', 'connected', 'in_discussion', 'completed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE 8: reports (ISO 10816 & Multimodal Telemetry Reports)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
    id TEXT PRIMARY KEY, -- e.g. REP-ISO-10816-001
    machine_id TEXT REFERENCES public.machines(id) ON DELETE CASCADE,
    inspection_id TEXT,
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    report_title TEXT NOT NULL,
    report_type TEXT DEFAULT 'ISO_10816_VIBRATION', -- 'ISO_10816_VIBRATION', 'MULTIMODAL_FUSION', 'AI_VISION_DEFECT'
    file_url TEXT NOT NULL, -- Supabase Storage URL
    file_size_bytes BIGINT DEFAULT 0,
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE 9: messages (Real-Time B2B Chat & Communications)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. INDEXES FOR PERFORMANCE & REAL-TIME QUERIES
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_machines_company ON public.machines(company_id);
CREATE INDEX IF NOT EXISTS idx_machines_category ON public.machines(category);
CREATE INDEX IF NOT EXISTS idx_teng_machine ON public.teng_sensor_readings(machine_id);
CREATE INDEX IF NOT EXISTS idx_teng_recorded ON public.teng_sensor_readings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_machine ON public.image_analyses(machine_id);
CREATE INDEX IF NOT EXISTS idx_image_company ON public.image_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_inspections_machine ON public.inspections(machine_id);
CREATE INDEX IF NOT EXISTS idx_materials_company ON public.symbiosis_materials(company_id);
CREATE INDEX IF NOT EXISTS idx_materials_status ON public.symbiosis_materials(status);
CREATE INDEX IF NOT EXISTS idx_matches_supplier ON public.symbiosis_matches(supplier_company_id);
CREATE INDEX IF NOT EXISTS idx_matches_buyer ON public.symbiosis_matches(buyer_company_id);
CREATE INDEX IF NOT EXISTS idx_reports_machine ON public.reports(machine_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teng_sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbiosis_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbiosis_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow public read & write access for anon & authenticated roles
-- (Allows both Nivaar AI and the Second Application to collaborate)
CREATE POLICY "Public full access to companies" ON public.companies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to machines" ON public.machines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to teng_readings" ON public.teng_sensor_readings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to image_analyses" ON public.image_analyses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to inspections" ON public.inspections FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to materials" ON public.symbiosis_materials FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to matches" ON public.symbiosis_matches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to reports" ON public.reports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to messages" ON public.messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────
-- 5. REALTIME REPLICATION CONFIGURATION
-- ─────────────────────────────────────────────────────────────────────
-- Enable Realtime publication for tables so UI updates dynamically
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'teng_sensor_readings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.teng_sensor_readings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'machines'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'image_analyses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.image_analyses;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'symbiosis_matches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.symbiosis_matches;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'reports'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Continue if publication is handled via Supabase Dashboard
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 6. SUPABASE STORAGE BUCKETS SETUP
-- ─────────────────────────────────────────────────────────────────────
-- Setup storage buckets for images, CSV datasets, and PDF reports
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('images', 'images', true),
    ('datasets', 'datasets', true),
    ('reports', 'reports', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage object access policies
CREATE POLICY "Public read access on images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'images');
CREATE POLICY "Public insert access on images" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'images');

CREATE POLICY "Public read access on datasets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'datasets');
CREATE POLICY "Public insert access on datasets" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'datasets');

CREATE POLICY "Public read access on reports" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'reports');
CREATE POLICY "Public insert access on reports" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'reports');

-- ─────────────────────────────────────────────────────────────────────
-- 7. SEED DATA - 8 INDUSTRIAL MACHINE FLEET (Idempotent)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.companies (id, email, company_name, industry_type, city, state, verified, onboarding_complete)
VALUES 
    ('demo_user', 'operator@nivaar.ai', 'NIVAAR Infrastructure', 'Smart Manufacturing & Energy', 'Bengaluru', 'Karnataka', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.machines (id, company_id, machine_name, category, location, status, health_index, vibration_iso_zone, fundamental_hz, operating_hours)
VALUES
    ('TURBINE-GEN-04', 'demo_user', 'Gas Turbine Generator 04', 'Turbines', 'Primary Powerhouse Bay A', 'inspection_required', 67.5, 'Zone B', 49.8, 14200),
    ('PUMP-CENT-02', 'demo_user', 'High-Pressure Feed Pump 02', 'Pumps', 'Hydraulic Substation 3', 'nominal', 94.2, 'Zone A', 29.5, 8740),
    ('COMP-RECIP-01', 'demo_user', 'Dual-Stage Air Compressor 01', 'Compressors', 'Pneumatics Building C', 'nominal', 91.0, 'Zone A', 14.8, 11500),
    ('TRANS-STEP-03', 'demo_user', '33kV Step-Down Transformer 03', 'Transformers', 'Substation Yard Grid 2', 'nominal', 98.4, 'Zone A', 50.0, 23000),
    ('GEN-DIESEL-05', 'demo_user', 'Emergency Standby Diesel 05', 'Generators', 'Auxiliary Backup Yard', 'nominal', 89.6, 'Zone A', 50.2, 420),
    ('BLOW-IND-06', 'demo_user', 'Exhaust Scrubber Blower 06', 'Blowers', 'Emission Recovery Line', 'critical', 41.2, 'Zone C', 58.4, 18900),
    ('BOIL-REC-07', 'demo_user', 'Heat Recovery Steam Gen 07', 'Boilers', 'Thermal Recovery Sector', 'nominal', 88.0, 'Zone A', 0.0, 9600),
    ('CHILL-CENT-08', 'demo_user', 'Centrifugal Chiller 08', 'Chillers', 'HVAC Central Plant', 'nominal', 93.5, 'Zone A', 30.1, 7400)
ON CONFLICT (id) DO NOTHING;

-- Initial Seed TENG Telemetry for TURBINE-GEN-04
INSERT INTO public.teng_sensor_readings (machine_id, voltage_v, current_ua, frequency_hz, vibration_x_rms, vibration_y_rms, peak_acceleration_g, anomaly_score, is_anomaly, source)
VALUES
    ('TURBINE-GEN-04', 18.4, 4.2, 49.8, 2.2, 1.1, 1.45, 0.28, false, 'teng_sensor'),
    ('TURBINE-GEN-04', 19.1, 4.4, 49.9, 2.4, 1.2, 1.52, 0.31, false, 'teng_sensor'),
    ('TURBINE-GEN-04', 21.0, 4.8, 50.1, 2.8, 1.4, 1.80, 0.45, true, 'teng_sensor'),
    ('PUMP-CENT-02', 12.0, 2.8, 29.5, 0.9, 0.6, 0.85, 0.08, false, 'teng_sensor')
ON CONFLICT DO NOTHING;
