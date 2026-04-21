-- ============================================================
-- Migration 002
--   * Test-mode infrastructure (system_settings + is_admin)
--   * Municipality nicknames (display_name)
--   * Parent/child municipalities (parent_id)
--   * Admin-only municipalities (admin_only)
--   * sms_recipients view for n8n to query (respects test mode)
-- ============================================================

-- 1. system_settings: single-row kv table for global flags
CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY DEFAULT 1,
  test_mode_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_singleton CHECK (id = 1)
);

INSERT INTO system_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read (admin UI reads it; n8n uses service role)
DROP POLICY IF EXISTS "System settings readable by authenticated" ON system_settings;
CREATE POLICY "System settings readable by authenticated"
  ON system_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. collision_companies additions
ALTER TABLE collision_companies
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_secondary TEXT;

CREATE INDEX IF NOT EXISTS idx_collision_companies_admin
  ON collision_companies(is_admin) WHERE is_admin = true;

-- Block clients from self-escalating via their own row, and from setting their
-- own secondary phone (secondary phones are admin-managed only).
REVOKE UPDATE (is_admin, phone_secondary) ON collision_companies FROM authenticated;

-- 3. municipalities additions
ALTER TABLE municipalities
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES municipalities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_only BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_municipalities_parent ON municipalities(parent_id);

-- 4. sms_recipients view — n8n queries this to find recipients for a municipality.
--    Emits one row per phone number (primary + secondary if set).
--    If test mode is active, only is_admin companies are returned.
-- DROP first: CREATE OR REPLACE can only append columns to an existing view,
-- not reorder them (error 42P16). Any n8n queries against this view need to
-- reference columns by name, not position.
DROP VIEW IF EXISTS sms_recipients;
CREATE VIEW sms_recipients AS
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

-- 5. Updated-at trigger for system_settings (guard for re-runs)
DROP TRIGGER IF EXISTS trg_system_settings_updated ON system_settings;
CREATE TRIGGER trg_system_settings_updated
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Optional: seed is_admin flag from ADMIN_USER_IDS manually.
-- Run in the Supabase SQL editor with the actual auth user id(s):
--
--   UPDATE collision_companies
--      SET is_admin = true
--    WHERE auth_user_id IN ('<admin-uuid-1>', '<admin-uuid-2>');
-- ============================================================
