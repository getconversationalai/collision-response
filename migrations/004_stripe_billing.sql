-- ============================================================
-- Migration 004 — Stripe billing
--
--   * Per-client Stripe billing state on collision_companies
--   * Global default monthly price on system_settings
--   * payment_log audit table (idempotent webhook processing)
--
-- Billing model:
--   - Flat monthly price per client. Global default in
--     system_settings.default_monthly_price_cents; per-client
--     override in collision_companies.monthly_price_cents
--     (NULL = use the global default).
--   - is_active (existing column, checked by the sms_recipients
--     view) is the SMS kill-switch. A failed payment flips it to
--     false immediately via the Stripe webhook.
--   - Comped clients keep is_active = true with no Stripe charge.
--
-- Re-runnable: guarded with IF NOT EXISTS / DROP ... IF EXISTS.
-- ============================================================

-- 1. collision_companies — Stripe billing columns
ALTER TABLE collision_companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER,          -- NULL = use system default
  ADD COLUMN IF NOT EXISTS is_comped BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ;

-- billing_status allowed values: 'pending' (no card yet), 'active',
-- 'past_due', 'canceled', 'comped'. Enforced with a CHECK constraint
-- rather than a Postgres enum so future values are a one-line change.
ALTER TABLE collision_companies
  DROP CONSTRAINT IF EXISTS collision_companies_billing_status_check;
ALTER TABLE collision_companies
  ADD CONSTRAINT collision_companies_billing_status_check
  CHECK (billing_status IN ('pending', 'active', 'past_due', 'canceled', 'comped'));

CREATE INDEX IF NOT EXISTS idx_collision_companies_stripe_customer
  ON collision_companies(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_collision_companies_billing_status
  ON collision_companies(billing_status);

-- Clients must never edit their own billing state — the webhook
-- (service role) and admin actions own these columns. Mirrors the
-- existing REVOKE on (is_admin, phone_secondary) from migration 002.
REVOKE UPDATE (
  stripe_customer_id, stripe_subscription_id, monthly_price_cents,
  is_comped, billing_status, current_period_end, last_payment_failed_at
) ON collision_companies FROM authenticated;

-- 2. system_settings — global default monthly price
-- 5000 = $50.00. Admin can change this in the admin billing portal.
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS default_monthly_price_cents INTEGER NOT NULL DEFAULT 5000;

-- 3. payment_log — billing audit trail + webhook idempotency guard
CREATE TABLE IF NOT EXISTS payment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES collision_companies(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  stripe_event_id TEXT UNIQUE,        -- prevents duplicate webhook processing
  amount_cents INTEGER,
  status TEXT NOT NULL,               -- 'succeeded', 'failed', 'refunded'
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_log_company
  ON payment_log(company_id, created_at DESC);

-- 4. RLS — clients read their own payment history; writes are
--    service-role only (the webhook handler and admin actions).
ALTER TABLE payment_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Companies can view own payment log" ON payment_log;
CREATE POLICY "Companies can view own payment log"
  ON payment_log FOR SELECT
  USING (company_id IN (
    SELECT id FROM collision_companies WHERE auth_user_id = auth.uid()
  ));
-- INSERT / UPDATE / DELETE happen only through service_role, which
-- bypasses RLS. No write policy is granted to authenticated users.
