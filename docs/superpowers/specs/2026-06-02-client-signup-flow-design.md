# Client Self-Signup & Approval Flow — Design Spec

**Date:** 2026-06-02
**Branch:** `feat/client-signup-flow`
**Status:** Approved design, ready for implementation planning

## Summary

Add a public, self-serve application flow so a prospect can be sent a link, submit
their company information and desired coverage areas, and be approved by an admin —
after which their account is provisioned and they are emailed to log in and set up
payment. Today, clients can only be created manually by an admin reading credentials
out of band, and the app sends no email of any kind.

## Goals

- A public application page (no login) a prospect reaches via a shared link.
- Applicant submits company info + selects desired municipalities, then sees a
  success page explaining an admin will review.
- A configurable list of admin notification email addresses receives an email per
  application, with a button linking to a secure in-portal review page.
- On approval: provision the auth user + client record (pending billing), create the
  chosen municipality subscriptions, and email the client a "set your password & log
  in" link.
- The client logs in, sets a password, and adds a card via the **existing** Stripe
  Checkout flow, which activates SMS. (Admins may instead comp the client at approval,
  activating immediately with no card.)
- On rejection: mark the application rejected and send the applicant a courteous
  decline email (with an optional admin-written reason).

## Non-Goals

- No change to the existing Stripe billing / webhook / activation mechanics. Approval
  produces a normal `pending` client that rides the existing pay-to-activate path.
- No change to how admin identity is determined (`ADMIN_USER_IDS` env allowlist stays).
- No new billing model, pricing tiers, or trials.
- No public self-service password reset beyond the set-password-on-first-login flow.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Email provider | **Resend** (HTTP API, Cloudflare Workers-compatible) |
| Activation on approval | **Pending → client pays** via existing Stripe Checkout; admin may set price or comp at approval |
| Approve/disapprove mechanism | **Secure in-portal review page** gated by existing `ADMIN_USER_IDS`; email button deep-links to it |
| Coverage areas | **Applicant selects** active, non-`admin_only` municipalities on the public form |
| Pre-approval storage | **New `client_applications` table** (Approach A); no auth user / `collision_companies` row until approval |
| Rejection email | **Sent**, with optional admin-written reason |
| Admin notification list location | **New `/admin/settings` page**; addresses stored in `system_settings.notification_emails` |

## Architecture

Existing stack: Next.js 15 App Router, Supabase (auth + Postgres + RLS), Stripe,
Tailwind, deployed on Cloudflare Workers via `opennextjs-cloudflare`. Three Supabase
clients already exist: browser (`client.ts`), server/cookie (`server.ts`), and
service-role (`admin.ts`). Admin gate is the `ADMIN_USER_IDS` env allowlist enforced in
`middleware.ts` and `admin/layout.tsx`.

### End-to-end flow

```
Prospect ──(shared link)──▶ /apply  (public, no login)
  fills company info + picks municipalities + submits
        ▼
  client_applications row (status: pending)  [via service-role; bypasses RLS]
        ├─▶ Resend email #1 → every system_settings.notification_emails address
        │       "New application from {company}" + [Review] → /admin/applications/[id]
        ▼
  Applicant sees /apply/success

Admin clicks [Review] → existing login/admin gate → /admin/applications/[id]
  reviews details; sets price (prefilled) or toggles Comp
        ├─ APPROVE ─▶ create auth user + collision_companies (pending, is_active=false)
        │             + subscriptions for chosen municipalities
        │             application → approved (reviewed_by/at, created_company_id)
        │             ├─▶ Resend email #2 → client: "Set your password & log in"
        │             ▼   → /auth/confirm → /set-password → /billing
        │             Client sets password → /billing "Add card" → existing Stripe
        │             Checkout → webhook flips is_active=true → SMS live
        │             (If comped: account active immediately; email says "log in")
        └─ REJECT ──▶ application → rejected (+ optional reason)
                      └─▶ Resend email #3 → applicant: courteous decline
```

## Data Model

New migration (next number after `004_stripe_billing.sql`).

### `client_applications` (new table)

```sql
CREATE TABLE client_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_secondary TEXT,
  requested_municipality_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_company_id UUID REFERENCES collision_companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_applications_status ON client_applications(status, created_at DESC);
ALTER TABLE client_applications ENABLE ROW LEVEL SECURITY;
-- No client-facing RLS policies: only the service-role client reads/writes this table.
```

`requested_municipality_ids` is an array snapshot rather than a join table because the
application exists before there is a company to join to, and it survives municipality
renames. An `updated_at` trigger mirrors the existing
`trg_collision_companies_updated` pattern.

### `system_settings` (alter)

```sql
ALTER TABLE system_settings
  ADD COLUMN notification_emails TEXT[] NOT NULL DEFAULT '{}';
```

## Components & Files

### Public application (unauthenticated)

- **`src/app/apply/page.tsx`** — public multi-step form (Company info → Coverage areas →
  Review). Server component fetches active, non-`admin_only` municipalities via the
  service-role client and passes them to a client component built from the existing
  `ClientForm.tsx` / `LocationToggle.tsx` / stepper patterns. Brand styling
  (`glass-card`, `input-field`, `btn-primary`, staggered animations).
- **`src/app/apply/success/page.tsx`** — confirmation page reusing the `SuccessScreen`
  pattern (checkmark, confetti, "an admin will review and email you").
- **Submit action** — a Next.js **server action** `submitApplication(input)` in
  `src/lib/actions/application-actions.ts` (consistent with the existing
  `admin-actions.ts` / `billing-actions.ts` server-action convention), using the
  service-role client (RLS blocks anon inserts; service role bypasses). Server-side
  validation mirrors `ClientForm` rules (email format, 10-digit phone, required fields,
  at least one municipality). Fires email #1 best-effort after insert.
- **Spam protection** — hidden honeypot field + server-side validation + duplicate-email
  guard. A clearly-marked seam for Cloudflare Turnstile is left for an optional future
  upgrade (not wired by default).

### Middleware change

`src/lib/supabase/middleware.ts` currently redirects every unauthenticated request to
`/login`. Allowlist `/apply` and `/apply/success` (the `submitApplication` server action
POSTs back to `/apply`, so it is covered by the same allowlist) the same way
`/api/stripe/webhook` is already excluded via the `src/middleware.ts` matcher /
in-function checks. **`/auth/confirm` must also be allowlisted**: the client arrives there
from the email link *without a session yet* (it exchanges the token to create one), so
without an allowlist the middleware would bounce it to `/login`. After `/auth/confirm`
sets the session, `/set-password` is reached authenticated and needs no special
allowlisting.

### Email infrastructure (Resend)

- **`src/lib/email/client.ts`** — thin Resend wrapper reading `RESEND_API_KEY` /
  `RESEND_FROM`. All sends are best-effort: failures are logged and never block the DB
  write or the user-facing response.
- **`src/lib/email/templates/`** — three branded HTML templates (navy/blue/gold):
  1. **admin-notification** → each `notification_emails` address; company details +
     **Review application** button → `/admin/applications/[id]`.
  2. **client-approved** → the client; **Set your password & log in** button → set-password
     flow. Comped variant says "your account is active — log in."
  3. **applicant-rejected** → the applicant; courteous decline + optional reason.
- New env vars: `RESEND_API_KEY`, `RESEND_FROM` (e.g.
  `Collision Response <noreply@mail.yourdomain.com>`). Resend requires a verified sending
  domain — documented as a setup step in `.env.local.example` and README.

### Admin review experience

- **`src/app/admin/applications/page.tsx`** — sortable/filterable table reusing
  `ClientTable.tsx` patterns; default sort pending-first. Pending count badge added to
  the `AdminSidebar.tsx` nav (new "Applications" item).
- **`src/app/admin/applications/[id]/page.tsx`** — the review page the email links to.
  Shows submitted details + requested municipalities; an approval panel with a price
  field (prefilled from `system_settings.default_monthly_price_cents`, editable), a
  **Comp** toggle, and **Approve** / **Reject** (reject reveals a reason field). The email
  button may deep-link `?action=approve` to pre-open the panel; the admin still confirms
  while authenticated.
- **`src/app/admin/settings/page.tsx`** — new lightweight settings page to manage the
  notification email list (add/remove addresses) written to
  `system_settings.notification_emails`. New "Settings" nav item.
- **Server actions** — `src/lib/actions/application-actions.ts`:
  `approveApplication(id, { priceCents, comp })`, `rejectApplication(id, reason?)`,
  `resendApprovalEmail(id)`; and a settings action to update `notification_emails`. All
  guard `getAdminIds()` like existing admin actions.

### Approval → provisioning → activation

`approveApplication` mirrors the existing `createClient` in `admin-actions.ts`
(including rollback-on-failure):

1. Create the Supabase auth user (random temp password, `email_confirm: true`).
2. Insert the `collision_companies` row — `billing_status: 'pending'`, `is_active: false`,
   `monthly_price_cents` from the panel; or comped values (`is_comped: true`,
   `billing_status: 'comped'`, `is_active: true`) if the toggle is on.
3. Insert `subscriptions` rows for the chosen municipalities.
4. Mark the application `approved`; stamp `reviewed_by`, `reviewed_at`,
   `created_company_id`.
5. Generate a Supabase set-password action link and send email #2.

**Idempotency:** the action first checks `status = 'pending'`; a double-click or re-opened
email is a no-op. Activation itself is unchanged — it rides the existing Stripe Checkout +
webhook path; no new billing code.

### First-login / set-password flow

- **`src/app/auth/confirm/route.ts`** — verifies the Supabase action token (`verifyOtp`)
  and sets the session cookie (standard Supabase-SSR pattern, Workers-compatible), then
  redirects to `/set-password`.
- **`src/app/set-password/page.tsx`** — branded page where the new client chooses a
  password (reusing `PasswordGenerator.tsx` strength UI) via `supabase.auth.updateUser`,
  then redirects to `/billing` to add a card. Comped clients are routed to the dashboard.
  Handles an expired/used token by offering "email me a fresh link."

## Edge Cases & Security

- **Duplicate email:** if the email already belongs to an active client, `/apply` shows a
  friendly "you already have an account — log in"; a second pending application from the
  same email is surfaced to the admin (flagged), not silently duplicated.
- **Already-reviewed application:** approve/reject are no-ops when status is not
  `pending` (handles email re-clicks / concurrent admins).
- **RLS:** `client_applications` has no client-facing policies; only the service-role
  client touches it. Public submit and admin review run server-side via service-role,
  never the browser client.
- **Email failures:** never block DB writes. Failed admin notification → application still
  visible in portal. Failed approval email → admin sees an error + **Resend invite**.
- **Expired set-password link:** `/set-password` offers a fresh-link request.
- **`admin_only` municipalities** are excluded from the public form.

## Testing

The repo has no test runner configured. Plan:

- Automated coverage on pure logic where it adds value: input validation, the
  comp-vs-pay branch selection, and the idempotency guard (extracted as pure functions).
- A documented manual end-to-end script: submit `/apply` → admin email → approve →
  client email → set password → add card → confirm `is_active=true` and SMS eligibility.
- If desired, a test setup (e.g. Vitest) can be added; out of scope unless requested.

## Environment / Setup additions

- `RESEND_API_KEY`, `RESEND_FROM` added to `.env.local.example` with notes.
- Resend sending domain verification documented in README.
- New migration applied to Supabase (and `schema.sql` updated to match).

## Rollout notes

- The public `/apply` link is the artifact you share with prospects. A `?ref=` style
  tracking param can be layered on later without schema change.
- `notification_emails` starts empty; the first admin must add addresses on
  `/admin/settings` before notifications send (a portal hint/log covers the empty case).
