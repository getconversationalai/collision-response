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
  display_name TEXT,                  -- optional nickname; shown to clients if set
  county TEXT NOT NULL DEFAULT 'Orange',
  state TEXT NOT NULL DEFAULT 'NY',
  is_active BOOLEAN NOT NULL DEFAULT true,
  parent_id UUID REFERENCES municipalities(id) ON DELETE SET NULL,  -- nests sub-channels like a PD
  admin_only BOOLEAN NOT NULL DEFAULT false,                        -- clients see "Contact admin to enable"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_municipalities_parent ON municipalities(parent_id);

-- 2. COLLISION COMPANIES (one row per client company)
-- Linked to Supabase Auth via auth.users.id
CREATE TABLE collision_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,                         -- Primary SMS destination (E.164 format)
  phone_secondary TEXT,               -- Optional admin-managed secondary SMS destination
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_admin BOOLEAN NOT NULL DEFAULT false,  -- recipient for test-mode SMS
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

-- 5b. MUNICIPALITY ALIASES (alternate names for dispatch matching)
-- One municipality can be referenced by multiple names in dispatch feeds.
-- Separate from `municipalities.display_name` (the client-facing nickname).
CREATE TABLE municipality_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_municipality_aliases_alias_unique
  ON municipality_aliases (lower(alias));
CREATE INDEX idx_municipality_aliases_municipality
  ON municipality_aliases (municipality_id);

-- municipality_lookup view — resolve any dispatch name (primary or alias)
-- back to a municipality_id. n8n queries this.
CREATE VIEW municipality_lookup AS
SELECT m.id AS municipality_id, m.name AS lookup_name, true AS is_primary, m.is_active
FROM municipalities m
WHERE m.name IS NOT NULL AND m.name <> ''
UNION ALL
SELECT a.municipality_id, a.alias AS lookup_name, false, m.is_active
FROM municipality_aliases a
JOIN municipalities m ON m.id = a.municipality_id;

-- 6. SYSTEM SETTINGS (global feature flags — singleton row)
CREATE TABLE system_settings (
  id INT PRIMARY KEY DEFAULT 1,
  test_mode_until TIMESTAMPTZ,         -- NULL = off; else SMS is restricted to is_admin companies until this time
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_singleton CHECK (id = 1)
);
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 7. SMS_RECIPIENTS VIEW (n8n queries this to find who gets SMS)
-- One row per phone number (primary + secondary if set).
-- When test mode is active, only is_admin rows are returned.
CREATE OR REPLACE VIEW sms_recipients AS
WITH active_subs AS (
  SELECT s.municipality_id, c.id AS company_id, c.company_name,
         c.phone, c.phone_secondary, c.is_admin, c.is_active
  FROM subscriptions s
  JOIN collision_companies c ON c.id = s.company_id
  WHERE s.is_subscribed = true
    AND c.is_active = true
    AND (
      NOT EXISTS (
        SELECT 1 FROM system_settings
        WHERE test_mode_until IS NOT NULL AND test_mode_until > now()
      )
      OR c.is_admin = true
    )
)
SELECT municipality_id, company_id, company_name, phone, 'primary'::text AS phone_kind, is_admin, is_active
FROM active_subs
WHERE phone IS NOT NULL
UNION ALL
SELECT municipality_id, company_id, company_name, phone_secondary AS phone, 'secondary'::text, is_admin, is_active
FROM active_subs
WHERE phone_secondary IS NOT NULL;

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
CREATE INDEX idx_collision_companies_admin ON collision_companies(is_admin) WHERE is_admin = true;

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

-- Prevent clients from self-escalating (is_admin affects SMS routing during
-- test mode) or from setting their own secondary phone. Only service_role can.
REVOKE UPDATE (is_admin, phone_secondary) ON collision_companies FROM authenticated;

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

-- Municipality aliases readable by authenticated; writes via service_role only
ALTER TABLE municipality_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aliases readable by authenticated"
  ON municipality_aliases FOR SELECT
  USING (auth.role() = 'authenticated');

-- System settings readable by any authenticated user (admin UI uses it)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System settings readable by authenticated"
  ON system_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- SMS log & dispatch log — clients can read their own notifications
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can view own SMS logs"
  ON sms_log FOR SELECT
  USING (company_id IN (
    SELECT id FROM collision_companies WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Dispatch logs readable by authenticated users"
  ON dispatch_log FOR SELECT
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

CREATE TRIGGER trg_system_settings_updated
  BEFORE UPDATE ON system_settings
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
