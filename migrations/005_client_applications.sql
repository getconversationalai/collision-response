-- ============================================================
-- Migration 005 — Client self-signup applications
--
--   * client_applications: prospect submissions awaiting admin
--     review. No auth user / collision_companies row exists until
--     an admin approves. Service-role-only (no client RLS policies).
--   * system_settings.notification_emails: configurable list of
--     admin addresses that receive a new-application email.
--
-- Re-runnable: guarded with IF NOT EXISTS / DROP ... IF EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_secondary TEXT,
  requested_municipality_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_company_id UUID REFERENCES collision_companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- status allowed values enforced with a CHECK (not a PG enum) so a
-- future value is a one-line change — mirrors billing_status (mig 004).
ALTER TABLE client_applications
  DROP CONSTRAINT IF EXISTS client_applications_status_check;
ALTER TABLE client_applications
  ADD CONSTRAINT client_applications_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_client_applications_status
  ON client_applications(status, created_at DESC);

-- updated_at trigger (reuses the existing function from schema.sql)
DROP TRIGGER IF EXISTS trg_client_applications_updated ON client_applications;
CREATE TRIGGER trg_client_applications_updated
  BEFORE UPDATE ON client_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Service-role only. The public submit action and admin review run
-- server-side via the service-role client, which bypasses RLS. No
-- policy is granted to anon/authenticated, so the browser client
-- can never read or write applications.
-- No policies is INTENTIONAL: RLS-enabled + zero policies = default-deny
-- for anon/authenticated; only the service role (which bypasses RLS) has access.
ALTER TABLE client_applications ENABLE ROW LEVEL SECURITY;

-- system_settings — configurable admin notification recipients
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS notification_emails TEXT[] NOT NULL DEFAULT '{}';
