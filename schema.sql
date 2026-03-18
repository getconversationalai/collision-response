-- ============================================================
-- MVA Collision Notification System — Database Schema
-- Supabase (PostgreSQL) + Supabase Auth
-- ============================================================

-- 1. MUNICIPALITIES (master list of subscribable locations)
-- These are the towns/municipalities that generate dispatch calls.
-- Admin-managed — collision companies toggle subscriptions to these.
CREATE TABLE municipalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,          -- e.g. "Woodbury", "Monroe", "Chester"
  county TEXT NOT NULL DEFAULT 'Orange',
  state TEXT NOT NULL DEFAULT 'NY',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. COLLISION COMPANIES (one row per client company)
-- Linked to Supabase Auth via auth.users.id
CREATE TABLE collision_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,                         -- SignalWire SMS destination (E.164 format, e.g. +18451234567)
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SUBSCRIPTIONS (company <-> municipality toggle)
-- If a row exists AND is_subscribed = true, the company gets texts for that municipality.
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES collision_companies(id) ON DELETE CASCADE,
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  is_subscribed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, municipality_id)
);

-- 4. DISPATCH LOG (every MVA notification that was processed)
-- Audit trail — what was sent, to whom, when
CREATE TABLE dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workflow TEXT,               -- 'iar_email', 'groupme', 'ems_fd'
  municipality TEXT,                  -- resolved municipality name
  incident_type TEXT,                 -- 'MVA', 'MVA-Rollover', 'MVA-Entrapment', etc.
  address TEXT,
  gps_url TEXT,
  raw_payload JSONB,                  -- full incoming payload (for debugging)
  sanitized_message TEXT,             -- the actual SMS text that was sent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. SMS LOG (individual SMS sends — one per company per dispatch)
CREATE TABLE sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES dispatch_log(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES collision_companies(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, failed
  signalwire_sid TEXT,                     -- SignalWire message SID for tracking
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_municipality ON subscriptions(municipality_id);
CREATE INDEX idx_subscriptions_active ON subscriptions(company_id, municipality_id) WHERE is_subscribed = true;
CREATE INDEX idx_dispatch_log_created ON dispatch_log(created_at DESC);
CREATE INDEX idx_dispatch_log_municipality ON dispatch_log(municipality);
CREATE INDEX idx_sms_log_dispatch ON sms_log(dispatch_id);
CREATE INDEX idx_sms_log_company ON sms_log(company_id);
CREATE INDEX idx_collision_companies_auth ON collision_companies(auth_user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE collision_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;

-- Companies can only see/edit their own record
CREATE POLICY "Companies can view own record"
  ON collision_companies FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Companies can update own record"
  ON collision_companies FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Companies can see/manage their own subscriptions
CREATE POLICY "Companies can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (company_id IN (
    SELECT id FROM collision_companies WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Companies can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM collision_companies WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Companies can update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (company_id IN (
    SELECT id FROM collision_companies WHERE auth_user_id = auth.uid()
  ));

-- Everyone can read municipalities (it's a public list)
CREATE POLICY "Municipalities are readable by all authenticated"
  ON municipalities FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- SERVICE ROLE ACCESS (for n8n workflow / API calls)
-- n8n will use the Supabase service_role key, which bypasses RLS.
-- This means Workflow 4 can:
--   - Query subscriptions + companies to find SMS recipients
--   - Insert into dispatch_log and sms_log
--   - Read municipalities for matching
-- No extra policies needed for service_role.
-- ============================================================

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collision_companies_updated
  BEFORE UPDATE ON collision_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA: Orange County municipalities
-- ============================================================
INSERT INTO municipalities (name, county, state) VALUES
  ('Monroe', 'Orange', 'NY'),
  ('Woodbury', 'Orange', 'NY'),
  ('Chester', 'Orange', 'NY'),
  ('Kiryas Joel', 'Orange', 'NY'),
  ('Blooming Grove', 'Orange', 'NY'),
  ('South Blooming Grove', 'Orange', 'NY'),
  ('Washingtonville', 'Orange', 'NY'),
  ('Salisbury Mills', 'Orange', 'NY'),
  ('Tuxedo', 'Orange', 'NY'),
  ('Harriman', 'Orange', 'NY'),
  ('Highland Mills', 'Orange', 'NY'),
  ('Central Valley', 'Orange', 'NY'),
  ('Goshen', 'Orange', 'NY'),
  ('Warwick', 'Orange', 'NY'),
  ('Newburgh', 'Orange', 'NY'),
  ('Middletown', 'Orange', 'NY'),
  ('Wallkill', 'Orange', 'NY'),
  ('Pine Bush', 'Orange', 'NY'),
  ('Greenville', 'Orange', 'NY'),
  ('Cornwall', 'Orange', 'NY'),
  ('New Windsor', 'Orange', 'NY'),
  ('Vails Gate', 'Orange', 'NY'),
  ('Mountainville', 'Orange', 'NY'),
  ('Fort Montgomery', 'Orange', 'NY'),
  ('Highland Falls', 'Orange', 'NY')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- CRON: Delete sms_log and dispatch_log entries older than 7 days
-- Requires pg_cron extension (enabled in Supabase dashboard)
-- Run this once in the Supabase SQL editor:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- Then schedule the cleanup job:
-- ============================================================
-- Delete SMS log entries older than 7 days (runs daily at 3:00 AM UTC)
SELECT cron.schedule(
  'cleanup-old-sms-logs',
  '0 3 * * *',
  $$DELETE FROM sms_log WHERE created_at < now() - interval '7 days'$$
);

-- Delete orphaned dispatch_log entries (no remaining sms_log references)
SELECT cron.schedule(
  'cleanup-orphaned-dispatch-logs',
  '5 3 * * *',
  $$DELETE FROM dispatch_log WHERE created_at < now() - interval '7 days' AND id NOT IN (SELECT DISTINCT dispatch_id FROM sms_log)$$
);
