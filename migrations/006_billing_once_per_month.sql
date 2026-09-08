-- ============================================================
-- Migration 006 — "charged once per month" guarantee + non-payment sweep
--
--   * Single-flight checkout: one reusable pending Checkout Session per
--     client so a double-submit / back-button can't create a second
--     Stripe subscription (the cause of a client being charged 2-3x).
--   * Supporting index + REVOKE (clients never write their own billing).
--   * Documentation for scheduling the non-payment sweep route
--     (/api/cron/billing-sweep) — the actual disable safety net.
--
-- Additive / non-destructive. Re-runnable (IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================

-- 1. Single-flight checkout columns on collision_companies
ALTER TABLE collision_companies
  ADD COLUMN IF NOT EXISTS pending_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS pending_checkout_expires_at TIMESTAMPTZ;

-- Clients must never edit their own billing state (mirrors migration 004).
REVOKE UPDATE (
  pending_checkout_session_id, pending_checkout_expires_at
) ON collision_companies FROM authenticated;

-- Helps the checkout-session-reuse lookup and any cleanup of expired holds.
CREATE INDEX IF NOT EXISTS idx_collision_companies_pending_checkout
  ON collision_companies(pending_checkout_session_id)
  WHERE pending_checkout_session_id IS NOT NULL;

-- ============================================================
-- 2. Scheduling the non-payment sweep (operator step — NOT auto-applied)
--
-- The sweep lives at POST /api/cron/billing-sweep and is protected by a
-- Bearer CRON_SECRET (fail-closed if unset). Do NOT store the secret in a
-- plaintext cron row (finding M1) — read it from Supabase Vault.
--
-- Prerequisites (enable once in the Supabase dashboard / SQL editor):
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--   -- store the secret in Vault (Project Settings → Vault), name it
--   -- 'cron_secret', matching the deployed CRON_SECRET env var.
--
-- Then schedule hourly (replace the host with the deployed app URL):
--
--   select cron.schedule(
--     'billing-sweep-hourly',
--     '0 * * * *',
--     $$
--       select net.http_post(
--         url     := 'https://<YOUR-DEPLOYED-APP>/api/cron/billing-sweep',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' ||
--             (select decrypted_secret from vault.decrypted_secrets
--               where name = 'cron_secret')
--         ),
--         body    := '{}'::jsonb
--       );
--     $$
--   );
--
-- Alternative: a Cloudflare Cron Trigger hitting the same route with the
-- Bearer header (no DB round-trip). Either scheduler is fine.
-- ============================================================
