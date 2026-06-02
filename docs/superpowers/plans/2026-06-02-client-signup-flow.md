# Client Self-Signup & Approval Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a prospect self-apply via a public link, have an admin approve/reject from a secure in-portal page (notified by email), then auto-provision the client account and email them to log in and add a card via the existing Stripe flow.

**Architecture:** A new `client_applications` table holds submissions while pending; no auth user or `collision_companies` row exists until approval. Approval mirrors the existing `createClient` provisioning, then emails the client a Supabase set-password link. Email is sent through Resend via `fetch` (Workers-safe). All public + admin data access goes through the service-role client server-side; the table has no client-facing RLS policies.

**Tech Stack:** Next.js 15 App Router, Supabase (auth + Postgres + RLS), Stripe (unchanged), Tailwind, Resend (new), Vitest (new, dev-only for pure-logic tests), Cloudflare Workers via opennextjs.

**Conventions to follow (verified in this codebase):**
- Server actions live in `src/lib/actions/*.ts` with `'use server'`, use `getAdminClient()` (service role) from `@/lib/supabase/admin`, guard admin actions with `requireAdmin()` (pattern in `admin-actions.ts:41-50`), and throw `Error(message)` on failure.
- Design tokens/classes (from `globals.css`): `glass-card`, `glass-card-rich`, `btn-primary`, `btn-secondary`, `input-field`, `section-title`, `gradient-text`, `bg-orb bg-orb-1/2/3`, `animate-fade-in-up`, `animate-slide-in-right/left`, `animate-scale-in`, `animate-bounce-soft`, `animate-pulse-soft`. Colors: `brand-*` (blue), `navy-*`, `gold-*`, `emerald-*`, `red-*`. Icons from `lucide-react`.
- Phone is stored E.164 (`+1XXXXXXXXXX`); forms collect 10 digits and display `(XXX) XXX-XXXX`.
- `updated_at` is maintained by the Postgres trigger function `update_updated_at()`.
- Verify typecheck with `npx tsc --noEmit`. Lint with `npm run lint`.

**Branch:** `feat/client-signup-flow` (already created; spec at `docs/superpowers/specs/2026-06-02-client-signup-flow-design.md`).

---

## File Structure

**New files**
- `vitest.config.ts` — Vitest config (node env, dev-only).
- `migrations/005_client_applications.sql` — new table + `system_settings.notification_emails`.
- `src/lib/phone.ts` — pure phone helpers (extracted, shared, testable).
- `src/lib/phone.test.ts`
- `src/lib/applications/validation.ts` — pure application input validation/normalization.
- `src/lib/applications/validation.test.ts`
- `src/lib/applications/provisioning.ts` — pure activation-field resolver + secure temp-password generator.
- `src/lib/applications/provisioning.test.ts`
- `src/lib/email/send.ts` — Resend send via `fetch` (best-effort).
- `src/lib/email/templates.ts` — pure HTML template builders (admin notify, client approved, applicant rejected).
- `src/lib/email/templates.test.ts`
- `src/lib/actions/application-actions.ts` — all application + settings server actions.
- `src/app/apply/page.tsx` — public application page (server).
- `src/components/apply/ApplicationForm.tsx` — public multi-step form (client).
- `src/app/apply/success/page.tsx` — public success page (server).
- `src/components/apply/ApplicationSuccess.tsx` — success UI w/ confetti (client).
- `src/app/admin/applications/page.tsx` — admin list (server).
- `src/components/admin/ApplicationsTable.tsx` — admin list table (client).
- `src/app/admin/applications/[id]/page.tsx` — admin review (server).
- `src/components/admin/ApplicationReview.tsx` — approve/reject panel (client).
- `src/app/admin/settings/page.tsx` — admin settings (server).
- `src/components/admin/NotificationEmailsForm.tsx` — notify-list editor (client).
- `src/app/auth/confirm/route.ts` — token → session exchange (route handler).
- `src/app/set-password/page.tsx` — first-login set-password (server).
- `src/components/SetPasswordForm.tsx` — set-password form (client).

**Modified files**
- `src/lib/types.ts` — add `ApplicationStatus`, `ClientApplication`, `notification_emails` on `SystemSettings`, `client_applications` + updated `system_settings` in `Database`.
- `src/lib/supabase/middleware.ts` — public allowlist for `/apply`, `/apply/success`, `/auth/confirm`.
- `src/components/admin/AdminSidebar.tsx` — add "Applications" (+ pending badge) and "Settings" nav items; accept `pendingApplications` prop.
- `src/app/admin/layout.tsx` — fetch pending count, pass to `AdminSidebar`.
- `schema.sql` — mirror migration 005 for fresh installs.
- `package.json` — add `vitest` dev dep + `test` script.
- `.env.local.example` / `README.md` — Resend env vars + setup notes.

---

## Task 1: Vitest test harness

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Add dev dependency + script**

Run: `npm install -D vitest@^2`

Then edit `package.json` `scripts` to add a `test` entry (place after `"lint": "next lint"`):

```json
    "lint": "next lint",
    "test": "vitest run"
```

- [ ] **Step 3: Smoke-test the runner**

Create a temporary `src/lib/_smoke.test.ts`:

```ts
import { test, expect } from 'vitest'
test('vitest runs', () => { expect(1 + 1).toBe(2) })
```

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 4: Remove smoke test**

Run: `rm src/lib/_smoke.test.ts`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-logic unit tests"
```

---

## Task 2: Database migration + types

**Files:**
- Create: `migrations/005_client_applications.sql`
- Modify: `schema.sql`, `src/lib/types.ts`

- [ ] **Step 1: Write migration 005**

Create `migrations/005_client_applications.sql`:

```sql
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
```

- [ ] **Step 2: Mirror into schema.sql**

Append the same `CREATE TABLE client_applications` (+ constraint, index, trigger, RLS enable) and the `notification_emails` column to `schema.sql` so fresh installs match. Place the table block after the `payment_log` definition and add `notification_emails TEXT[] NOT NULL DEFAULT '{}'` to the `system_settings` `CREATE TABLE`. Use the exact SQL from Step 1 (drop the `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` guards only if `schema.sql` style omits them — match surrounding style).

- [ ] **Step 3: Apply the migration to Supabase**

Run the SQL in the Supabase SQL editor (or your migration tooling) against the project in `.env.local`. Confirm the table exists:

Run (psql or Supabase SQL editor): `SELECT column_name FROM information_schema.columns WHERE table_name='client_applications';`
Expected: the 13 columns listed in Step 1.

- [ ] **Step 4: Add TypeScript types**

In `src/lib/types.ts`, add after the `SystemSettings` type (line ~53) a new `notification_emails` field on `SystemSettings`:

```ts
export type SystemSettings = {
  id: number
  test_mode_until: string | null
  default_monthly_price_cents: number     // global default monthly price
  notification_emails: string[]           // admin addresses notified on new applications
  updated_at: string
}
```

Add the application types (place near the other `export type` blocks, e.g. after `Subscription`):

```ts
export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export type ClientApplication = {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  phone_secondary: string | null
  requested_municipality_ids: string[]
  status: ApplicationStatus
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_company_id: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 5: Add the table to the `Database` type**

In the `Database['public']['Tables']` object in `src/lib/types.ts`, add a `client_applications` entry (place after `payment_log`):

```ts
      client_applications: {
        Row: ClientApplication
        Insert: Omit<
          ClientApplication,
          'id' | 'created_at' | 'updated_at' | 'status' | 'rejection_reason'
          | 'reviewed_by' | 'reviewed_at' | 'created_company_id' | 'phone_secondary'
          | 'requested_municipality_ids'
        > & {
          id?: string
          status?: ApplicationStatus
          rejection_reason?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_company_id?: string | null
          phone_secondary?: string | null
          requested_municipality_ids: string[]   // required: validation always supplies ≥1
        }
        Update: Partial<Omit<ClientApplication, 'id'>>
        Relationships: []
      }
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add migrations/005_client_applications.sql schema.sql src/lib/types.ts
git commit -m "feat(db): client_applications table + notification_emails setting"
```

---

## Task 3: Phone helpers (TDD)

**Files:**
- Create: `src/lib/phone.ts`, `src/lib/phone.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/phone.test.ts`:

```ts
import { test, expect } from 'vitest'
import { digitsOnly, formatPhoneDisplay, toE164, isValidUsPhone } from './phone'

test('digitsOnly strips non-digits', () => {
  expect(digitsOnly('(555) 123-4567')).toBe('5551234567')
})

test('formatPhoneDisplay formats progressively', () => {
  expect(formatPhoneDisplay('555')).toBe('555')
  expect(formatPhoneDisplay('555123')).toBe('(555) 123')
  expect(formatPhoneDisplay('5551234567')).toBe('(555) 123-4567')
})

test('toE164 produces +1XXXXXXXXXX', () => {
  expect(toE164('(555) 123-4567')).toBe('+15551234567')
})

test('isValidUsPhone requires exactly 10 digits', () => {
  expect(isValidUsPhone('5551234567')).toBe(true)
  expect(isValidUsPhone('555123456')).toBe(false)
  expect(isValidUsPhone('(555) 123-4567')).toBe(true)
  expect(isValidUsPhone('')).toBe(false)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/phone.test.ts`
Expected: FAIL ("Failed to resolve import './phone'").

- [ ] **Step 3: Implement**

Create `src/lib/phone.ts`:

```ts
/** Pure US phone helpers. Storage format is E.164 (+1XXXXXXXXXX). */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatPhoneDisplay(value: string): string {
  const d = digitsOnly(value).slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`
}

export function toE164(value: string): string {
  return `+1${digitsOnly(value).slice(0, 10)}`
}

export function isValidUsPhone(value: string): boolean {
  return digitsOnly(value).length === 10
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/phone.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/phone.ts src/lib/phone.test.ts
git commit -m "feat: shared US phone helpers with tests"
```

---

## Task 4: Application input validation (TDD)

**Files:**
- Create: `src/lib/applications/validation.ts`, `src/lib/applications/validation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/applications/validation.test.ts`:

```ts
import { test, expect } from 'vitest'
import { validateApplicationInput } from './validation'

const good = {
  companyName: 'ABC Collision',
  contactName: 'John Smith',
  email: 'john@abc.com',
  phoneRaw: '(555) 123-4567',
  phoneSecondaryRaw: '',
  municipalityIds: ['11111111-1111-1111-1111-111111111111'],
}

test('accepts and normalizes valid input', () => {
  const r = validateApplicationInput(good)
  expect(r.ok).toBe(true)
  if (r.ok) {
    expect(r.value.company_name).toBe('ABC Collision')
    expect(r.value.phone).toBe('+15551234567')
    expect(r.value.phone_secondary).toBeNull()
    expect(r.value.requested_municipality_ids).toEqual([good.municipalityIds[0]])
  }
})

test('rejects bad email', () => {
  const r = validateApplicationInput({ ...good, email: 'nope' })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.errors.join(' ')).toMatch(/email/i)
})

test('rejects short phone', () => {
  const r = validateApplicationInput({ ...good, phoneRaw: '555' })
  expect(r.ok).toBe(false)
})

test('rejects empty company / contact', () => {
  expect(validateApplicationInput({ ...good, companyName: '  ' }).ok).toBe(false)
  expect(validateApplicationInput({ ...good, contactName: '' }).ok).toBe(false)
})

test('requires at least one municipality', () => {
  const r = validateApplicationInput({ ...good, municipalityIds: [] })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.errors.join(' ')).toMatch(/coverage|municipalit/i)
})

test('normalizes a provided secondary phone', () => {
  const r = validateApplicationInput({ ...good, phoneSecondaryRaw: '555-987-6543' })
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.value.phone_secondary).toBe('+15559876543')
})

test('rejects a malformed secondary phone', () => {
  const r = validateApplicationInput({ ...good, phoneSecondaryRaw: '12' })
  expect(r.ok).toBe(false)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/applications/validation.test.ts`
Expected: FAIL (import cannot resolve).

- [ ] **Step 3: Implement**

Create `src/lib/applications/validation.ts`:

```ts
import { isValidUsPhone, toE164 } from '@/lib/phone'

export type RawApplicationInput = {
  companyName: string
  contactName: string
  email: string
  phoneRaw: string
  phoneSecondaryRaw?: string
  municipalityIds: string[]
}

export type NormalizedApplication = {
  company_name: string
  contact_name: string
  email: string
  phone: string                       // E.164
  phone_secondary: string | null      // E.164 or null
  requested_municipality_ids: string[]
}

export type ValidationResult =
  | { ok: true; value: NormalizedApplication }
  | { ok: false; errors: string[] }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateApplicationInput(input: RawApplicationInput): ValidationResult {
  const errors: string[] = []

  const company_name = (input.companyName ?? '').trim()
  const contact_name = (input.contactName ?? '').trim()
  const email = (input.email ?? '').trim().toLowerCase()
  const phoneSecondaryRaw = (input.phoneSecondaryRaw ?? '').trim()
  const municipalityIds = Array.isArray(input.municipalityIds) ? input.municipalityIds : []

  if (!company_name) errors.push('Company name is required')
  if (!contact_name) errors.push('Contact name is required')
  if (!email) errors.push('Email is required')
  else if (!EMAIL_RE.test(email)) errors.push('Please enter a valid email address')
  if (!isValidUsPhone(input.phoneRaw ?? '')) errors.push('A valid 10-digit phone number is required')
  if (phoneSecondaryRaw && !isValidUsPhone(phoneSecondaryRaw)) {
    errors.push('Secondary phone must be a valid 10-digit number')
  }
  if (municipalityIds.length === 0) errors.push('Select at least one coverage area (municipality)')

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      company_name,
      contact_name,
      email,
      phone: toE164(input.phoneRaw),
      phone_secondary: phoneSecondaryRaw ? toE164(phoneSecondaryRaw) : null,
      requested_municipality_ids: municipalityIds,
    },
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/applications/validation.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/applications/validation.ts src/lib/applications/validation.test.ts
git commit -m "feat: application input validation/normalization with tests"
```

---

## Task 5: Activation resolver + temp password (TDD)

**Files:**
- Create: `src/lib/applications/provisioning.ts`, `src/lib/applications/provisioning.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/applications/provisioning.test.ts`:

```ts
import { test, expect } from 'vitest'
import { resolveActivation } from './provisioning'

test('comp path → active comped fields', () => {
  const r = resolveActivation({ comp: true, priceCents: 0, defaultPriceCents: 5000 })
  expect(r).toEqual({
    is_active: true,
    is_comped: true,
    billing_status: 'comped',
    monthly_price_cents: null,
  })
})

test('pay path → pending fields with chosen price', () => {
  const r = resolveActivation({ comp: false, priceCents: 7500, defaultPriceCents: 5000 })
  expect(r).toEqual({
    is_active: false,
    is_comped: false,
    billing_status: 'pending',
    monthly_price_cents: 7500,
  })
})

test('pay path with no explicit price falls back to default', () => {
  const r = resolveActivation({ comp: false, priceCents: null, defaultPriceCents: 5000 })
  expect(r.monthly_price_cents).toBe(5000)
  expect(r.billing_status).toBe('pending')
})

test('pay path rejects non-positive price', () => {
  expect(() => resolveActivation({ comp: false, priceCents: 0, defaultPriceCents: 5000 }))
    .toThrow(/price/i)
  expect(() => resolveActivation({ comp: false, priceCents: -100, defaultPriceCents: 5000 }))
    .toThrow(/price/i)
})

test('pay path rejects non-integer price', () => {
  expect(() => resolveActivation({ comp: false, priceCents: 12.5, defaultPriceCents: 5000 }))
    .toThrow(/price/i)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/applications/provisioning.test.ts`
Expected: FAIL (import cannot resolve).

- [ ] **Step 3: Implement**

Create `src/lib/applications/provisioning.ts`:

```ts
import type { BillingStatus } from '@/lib/types'

export type ActivationFields = {
  is_active: boolean
  is_comped: boolean
  billing_status: BillingStatus
  monthly_price_cents: number | null
}

/**
 * Decide the billing-related fields for a newly provisioned client at
 * approval time. Comped clients are active immediately with no Stripe
 * charge; paying clients start 'pending' (no SMS) until they add a card
 * via the existing Stripe Checkout flow.
 */
export function resolveActivation(args: {
  comp: boolean
  priceCents: number | null
  defaultPriceCents: number
}): ActivationFields {
  if (args.comp) {
    return {
      is_active: true,
      is_comped: true,
      billing_status: 'comped',
      monthly_price_cents: null, // comped clients use no price
    }
  }

  const price = args.priceCents ?? args.defaultPriceCents
  if (!Number.isInteger(price) || price <= 0) {
    throw new Error('Monthly price must be a positive whole number of cents')
  }

  return {
    is_active: false,
    is_comped: false,
    billing_status: 'pending',
    monthly_price_cents: price,
  }
}

/**
 * Generate an unguessable temporary password for a newly created auth
 * user. The client never sees it — they set their own via the recovery
 * link emailed on approval. Uses Web Crypto (available on Workers + Node).
 */
export function generateTempPassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const base = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  // Guarantee complexity regardless of hex content.
  return `Aa1!${base}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/applications/provisioning.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/applications/provisioning.ts src/lib/applications/provisioning.test.ts
git commit -m "feat: activation-field resolver + temp password with tests"
```

---

## Task 6: Email send + templates (TDD on templates)

**Files:**
- Create: `src/lib/email/send.ts`, `src/lib/email/templates.ts`, `src/lib/email/templates.test.ts`

- [ ] **Step 1: Implement the Resend sender**

Create `src/lib/email/send.ts`:

```ts
/** Best-effort transactional email via the Resend HTTP API (Workers-safe). */

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
}

export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string }

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) {
    console.error('[email] RESEND_API_KEY / RESEND_FROM not configured; skipping send')
    return { ok: false, error: 'email_not_configured' }
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const recipients = (Array.isArray(to) ? to : [to])
    .map((r) => r.trim())
    .filter((r) => EMAIL_RE.test(r))
  if (recipients.length === 0) return { ok: false, error: 'no_valid_recipients' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[email] Resend error ${res.status}: ${text}`)
      return { ok: false, error: `resend_${res.status}` }
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[email] send failed:', err)
    return { ok: false, error: 'send_exception' }
  }
}
```

- [ ] **Step 2: Write failing template tests**

Create `src/lib/email/templates.test.ts`:

```ts
import { test, expect } from 'vitest'
import {
  adminNotificationEmail,
  clientApprovedEmail,
  applicantRejectedEmail,
} from './templates'

test('admin notification includes company + review link', () => {
  const e = adminNotificationEmail({
    companyName: 'ABC Collision',
    contactName: 'John Smith',
    email: 'john@abc.com',
    phoneDisplay: '(555) 123-4567',
    municipalityNames: ['Newburgh', 'Goshen'],
    reviewUrl: 'https://app.example.com/admin/applications/abc-123',
  })
  expect(e.subject).toMatch(/ABC Collision/)
  expect(e.html).toContain('https://app.example.com/admin/applications/abc-123')
  expect(e.html).toContain('Newburgh')
  expect(e.html).toContain('John Smith')
})

test('client approved (pay) prompts to add card and links setup', () => {
  const e = clientApprovedEmail({
    companyName: 'ABC Collision',
    setupUrl: 'https://app.example.com/auth/confirm?token_hash=x&type=magiclink&next=/set-password',
    comped: false,
  })
  expect(e.subject).toMatch(/approv/i)
  expect(e.html).toContain('token_hash=x')
  expect(e.html.toLowerCase()).toMatch(/card|payment/)
})

test('client approved (comped) says active, no payment', () => {
  const e = clientApprovedEmail({
    companyName: 'ABC Collision',
    setupUrl: 'https://app.example.com/auth/confirm?token_hash=y&type=magiclink&next=/set-password',
    comped: true,
  })
  expect(e.html).toContain('token_hash=y')
  expect(e.html.toLowerCase()).toMatch(/active/)
})

test('rejection includes reason when provided', () => {
  const e = applicantRejectedEmail({ companyName: 'ABC', reason: 'Outside service area' })
  expect(e.html).toContain('Outside service area')
})

test('rejection omits reason block when absent', () => {
  const e = applicantRejectedEmail({ companyName: 'ABC', reason: null })
  expect(e.subject).toMatch(/ABC|application/i)
  expect(e.html).not.toContain('Reason:')
})

test('rejection escapes HTML in the reason (no XSS)', () => {
  const e = applicantRejectedEmail({ companyName: 'ABC', reason: '<script>alert(1)</script>' })
  expect(e.html).not.toContain('<script>')
  expect(e.html).toContain('&lt;script&gt;')
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/email/templates.test.ts`
Expected: FAIL (import cannot resolve).

- [ ] **Step 4: Implement templates**

Create `src/lib/email/templates.ts`:

```ts
/** Pure, branded HTML email builders. No I/O — returns { subject, html }. */

export type EmailContent = { subject: string; html: string }

const BRAND = '#2563eb'
const NAVY = '#102a43'
const MUTED = '#627d98'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function button(href: string, label: string, color = BRAND): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:12px;">${escapeHtml(label)}</a>`
}

function layout(opts: { heading: string; intro: string; body: string; preview?: string }): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${opts.preview ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preview)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(16,42,67,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e3a8a,#2563eb,#3b82f6);padding:22px 32px;">
          <span style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:-0.01em;">Collision Response</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;color:${NAVY};font-size:22px;font-weight:800;">${escapeHtml(opts.heading)}</h1>
          <p style="margin:0 0 20px;color:${MUTED};font-size:15px;line-height:1.6;">${opts.intro}</p>
          ${opts.body}
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="margin:24px 0 0;color:#9fb3c8;font-size:12px;line-height:1.5;border-top:1px solid #eef2f7;padding-top:16px;">Collision Response — automated MVA alerts for collision centers.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:${MUTED};font-size:13px;width:130px;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:${NAVY};font-size:13px;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`
}

export function adminNotificationEmail(args: {
  companyName: string
  contactName: string
  email: string
  phoneDisplay: string
  municipalityNames: string[]
  reviewUrl: string
}): EmailContent {
  const areas = args.municipalityNames.length
    ? args.municipalityNames.map(escapeHtml).join(', ')
    : '—'
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-radius:12px;padding:8px 16px;margin-bottom:24px;">
      ${infoRow('Company', args.companyName)}
      ${infoRow('Contact', args.contactName)}
      ${infoRow('Email', args.email)}
      ${infoRow('Phone', args.phoneDisplay)}
      ${infoRow('Coverage areas', areas)}
    </table>
    <div style="text-align:center;">${button(args.reviewUrl, 'Review application')}</div>`
  return {
    subject: `New application — ${args.companyName}`,
    html: layout({
      heading: 'New client application',
      intro: `A new collision center has applied to Collision Response. Review the details below and approve or decline in the admin portal.`,
      body,
      preview: `New application from ${args.companyName}`,
    }),
  }
}

export function clientApprovedEmail(args: {
  companyName: string
  setupUrl: string
  comped: boolean
}): EmailContent {
  const body = args.comped
    ? `<p style="margin:0 0 20px;color:${MUTED};font-size:15px;line-height:1.6;">Your account is <strong style="color:${NAVY};">active</strong>. Set your password to log in and manage your coverage areas — no payment needed.</p>
       <div style="text-align:center;">${button(args.setupUrl, 'Set your password & log in')}</div>`
    : `<p style="margin:0 0 20px;color:${MUTED};font-size:15px;line-height:1.6;">Set your password to log in, then add a card to activate SMS alerts for your coverage areas.</p>
       <div style="text-align:center;">${button(args.setupUrl, 'Set your password & log in')}</div>
       <p style="margin:20px 0 0;color:#9fb3c8;font-size:12px;line-height:1.5;">Alerts begin once your payment method is on file.</p>`
  return {
    subject: `You're approved — welcome to Collision Response`,
    html: layout({
      heading: `Welcome, ${escapeHtml(args.companyName)}!`,
      intro: `Your application has been approved.`,
      body,
      preview: `Your Collision Response application was approved`,
    }),
  }
}

export function applicantRejectedEmail(args: {
  companyName: string
  reason: string | null
}): EmailContent {
  const reasonBlock = args.reason
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-radius:12px;margin-top:8px;"><tr><td style="padding:14px 16px;color:${NAVY};font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${escapeHtml(args.reason)}</td></tr></table>`
    : ''
  return {
    subject: `Update on your Collision Response application`,
    html: layout({
      heading: 'Application update',
      intro: `Thank you for your interest in Collision Response. After review, we're unable to approve your application at this time.`,
      body: `${reasonBlock}<p style="margin:20px 0 0;color:${MUTED};font-size:14px;line-height:1.6;">If you believe this was in error or your situation changes, please reach out to us.</p>`,
      preview: `Update on your application`,
    }),
  }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/email/templates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/email/send.ts src/lib/email/templates.ts src/lib/email/templates.test.ts
git commit -m "feat(email): Resend sender + branded templates with tests"
```

---

## Task 7: Public submit action + municipalities fetch

**Files:**
- Create: `src/lib/actions/application-actions.ts`

- [ ] **Step 1: Implement the public-facing actions**

Create `src/lib/actions/application-actions.ts` with the public actions (admin actions are added in Task 11):

```ts
'use server'

import { getAdminClient } from '@/lib/supabase/admin'
import { validateApplicationInput, type RawApplicationInput } from '@/lib/applications/validation'
import { adminNotificationEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/send'
import { formatPhoneDisplay } from '@/lib/phone'
import type { Municipality } from '@/lib/types'

// ---------------------------------------------------------------------------
// Public: municipalities shown on the application form
// ---------------------------------------------------------------------------

export async function getPublicMunicipalities(): Promise<Municipality[]> {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('municipalities')
    .select('*')
    .eq('is_active', true)
    .eq('admin_only', false)
    .not('name', 'is', null)
    .neq('name', '')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Municipality[]
}

// ---------------------------------------------------------------------------
// Public: submit an application
// ---------------------------------------------------------------------------

export type SubmitApplicationInput = RawApplicationInput & { honeypot?: string }

export type SubmitApplicationResult =
  | { ok: true }
  | { ok: false; reason: 'validation' | 'duplicate_active' | 'duplicate_pending' | 'error'; errors?: string[]; message?: string }

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<SubmitApplicationResult> {
  // Honeypot: a bot filled the hidden field. Pretend success, store nothing.
  if (input.honeypot && input.honeypot.trim() !== '') {
    return { ok: true }
  }

  const validation = validateApplicationInput(input)
  if (!validation.ok) {
    return { ok: false, reason: 'validation', errors: validation.errors }
  }
  const v = validation.value
  const admin = getAdminClient()

  // Guard: an active client already exists with this email → tell them to log in.
  const { data: existingClient } = await admin
    .from('collision_companies')
    .select('id')
    .eq('email', v.email)
    .maybeSingle()
  if (existingClient) {
    return {
      ok: false,
      reason: 'duplicate_active',
      message: 'An account already exists for this email. Please log in instead.',
    }
  }

  // Guard: a pending application already exists with this email → avoid
  // duplicate submissions flooding the admin queue. (Heavier abuse protection
  // — IP rate limiting / Cloudflare Turnstile — is a documented future
  // enhancement; the honeypot + this guard + the admin-review gate are
  // proportionate for now.)
  const { data: existingPending } = await admin
    .from('client_applications')
    .select('id')
    .eq('email', v.email)
    .eq('status', 'pending')
    .limit(1)
  if (existingPending && existingPending.length > 0) {
    return {
      ok: false,
      reason: 'duplicate_pending',
      message: 'An application with this email is already under review. We’ll be in touch by email soon.',
    }
  }

  // Insert the application (service role; bypasses RLS).
  const { data: appRow, error: insertError } = await admin
    .from('client_applications')
    .insert({
      company_name: v.company_name,
      contact_name: v.contact_name,
      email: v.email,
      phone: v.phone,
      phone_secondary: v.phone_secondary,
      requested_municipality_ids: v.requested_municipality_ids,
    })
    .select('id')
    .single()

  if (insertError || !appRow) {
    console.error('[applications] insert failed:', insertError?.message)
    return { ok: false, reason: 'error', message: 'Could not submit your application. Please try again.' }
  }

  // Best-effort admin notification — never blocks the submission.
  await notifyAdminsOfApplication((appRow as { id: string }).id).catch((e) =>
    console.error('[applications] admin notify failed:', e)
  )

  return { ok: true }
}

async function notifyAdminsOfApplication(applicationId: string): Promise<void> {
  const admin = getAdminClient()

  const [{ data: appData }, { data: settings }] = await Promise.all([
    admin.from('client_applications').select('*').eq('id', applicationId).single(),
    admin.from('system_settings').select('notification_emails').eq('id', 1).single(),
  ])

  const recipients = ((settings as { notification_emails: string[] } | null)?.notification_emails) ?? []
  if (recipients.length === 0) {
    console.warn('[applications] no notification_emails configured; skipping admin email')
    return
  }

  const app = appData as unknown as {
    id: string
    company_name: string
    contact_name: string
    email: string
    phone: string
    requested_municipality_ids: string[]
  }

  // Resolve municipality names for the email.
  let municipalityNames: string[] = []
  if (app.requested_municipality_ids.length > 0) {
    const { data: muns } = await admin
      .from('municipalities')
      .select('name')
      .in('id', app.requested_municipality_ids)
    municipalityNames = ((muns ?? []) as Array<{ name: string }>).map((m) => m.name)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { subject, html } = adminNotificationEmail({
    companyName: app.company_name,
    contactName: app.contact_name,
    email: app.email,
    phoneDisplay: formatPhoneDisplay(app.phone.replace('+1', '')),
    municipalityNames,
    reviewUrl: `${appUrl}/admin/applications/${app.id}`,
  })

  await sendEmail({ to: recipients, subject, html })
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/actions/application-actions.ts
git commit -m "feat(applications): public submit action + admin notification"
```

---

## Task 8: Middleware public allowlist

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Add a public-path allowlist**

In `src/lib/supabase/middleware.ts`, replace the unauthenticated-redirect block (currently lines 40-45) with an allowlist-aware version. Add the helper above `updateSession` and update the check:

```ts
// Public paths reachable without a session. `/auth/confirm` exchanges a
// one-time token for a session, so it MUST be reachable while logged out.
const PUBLIC_PREFIXES = ['/login', '/apply', '/auth/confirm']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
```

Then change the redirect condition from:

```ts
  // Unauthenticated users → login (except if already on login)
  if (!user && !pathname.startsWith('/login')) {
```

to:

```ts
  // Unauthenticated users → login (except public paths)
  if (!user && !isPublicPath(pathname)) {
```

Leave the "authenticated user on /login → dashboard" and admin-route blocks unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`. While logged out, visit `http://localhost:3000/apply` → it should render (Task 9 page) instead of redirecting to `/login`. Visit `http://localhost:3000/dashboard` logged out → still redirects to `/login`.

> Note: `/apply` returns a 404 until Task 9 is done — that's fine; the check here is that it is NOT redirected to `/login`. You can temporarily confirm with `curl -sI http://localhost:3000/apply` and verify there is no `location: /login` header.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat(auth): allow /apply and /auth/confirm without a session"
```

---

## Task 9: Public application page + form

**Files:**
- Create: `src/app/apply/page.tsx`, `src/components/apply/ApplicationForm.tsx`

- [ ] **Step 1: Server page that loads municipalities**

Create `src/app/apply/page.tsx`:

```tsx
import { getPublicMunicipalities } from '@/lib/actions/application-actions'
import ApplicationForm from '@/components/apply/ApplicationForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Apply — Collision Response',
  description: 'Apply to receive real-time MVA alerts for your collision center.',
}

export default async function ApplyPage() {
  const municipalities = await getPublicMunicipalities()

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Brand */}
        <div className="text-center mb-10 animate-scale-in">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 shadow-btn-glow" />
            <svg className="w-7 h-7 text-white relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold gradient-text tracking-tight">Apply for Collision Response</h1>
          <p className="text-sm text-navy-400 mt-2 font-medium max-w-md mx-auto">
            Real-time MVA alerts for your collision center. Tell us about your company and choose your coverage areas — an admin will review and get you set up.
          </p>
        </div>

        <ApplicationForm municipalities={municipalities} />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: The multi-step public form**

Create `src/components/apply/ApplicationForm.tsx`. It mirrors the admin `ClientForm` stepper/animation patterns but has 3 steps (Company → Coverage → Review), no credentials step, a honeypot, and submits via `submitApplication`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, User, Mail, Phone, MapPin, ClipboardCheck, ArrowRight, ArrowLeft, Loader2,
} from 'lucide-react'
import MunicipalityGrid from '@/components/admin/MunicipalityGrid'
import { submitApplication } from '@/lib/actions/application-actions'
import { formatPhoneDisplay } from '@/lib/phone'
import type { Municipality } from '@/lib/types'

const STEPS = [
  { label: 'Company', icon: Building2 },
  { label: 'Coverage', icon: MapPin },
  { label: 'Review', icon: ClipboardCheck },
]

export default function ApplicationForm({ municipalities }: { municipalities: Municipality[] }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [phoneSecondaryRaw, setPhoneSecondaryRaw] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [honeypot, setHoneypot] = useState('')

  const phoneFormatted = formatPhoneDisplay(phoneRaw)
  const phoneSecondaryFormatted = formatPhoneDisplay(phoneSecondaryRaw)

  function canAdvance(): boolean {
    if (step === 0) {
      const secondaryOk = !phoneSecondaryRaw || phoneSecondaryRaw.length === 10
      return !!(
        companyName.trim() && contactName.trim() && email.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        phoneRaw.length === 10 && secondaryOk
      )
    }
    if (step === 1) return selected.size > 0
    return true
  }

  function goNext() { setDirection('forward'); setStep((s) => Math.min(s + 1, STEPS.length - 1)); setError('') }
  function goBack() { setDirection('back'); setStep((s) => Math.max(s - 1, 0)); setError('') }
  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = await submitApplication({
        companyName, contactName, email,
        phoneRaw, phoneSecondaryRaw,
        municipalityIds: Array.from(selected),
        honeypot,
      })
      if (res.ok) { router.push('/apply/success'); return }
      if (res.reason === 'validation') setError(res.errors?.[0] ?? 'Please check your entries.')
      else setError(res.message ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isComplete = i < step
          const isCurrent = i === step
          return (
            <div key={i} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${
                isCurrent ? 'bg-brand-50/80 border border-brand-200/60 shadow-sm'
                : isComplete ? 'bg-emerald-50/60 border border-emerald-200/40'
                : 'border border-transparent'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  isCurrent ? 'bg-gradient-to-br from-brand-600 to-brand-400 shadow-btn-glow'
                  : isComplete ? 'bg-gradient-to-br from-emerald-500 to-emerald-400'
                  : 'bg-navy-100'}`}>
                  {isComplete ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-navy-400'}`} />}
                </div>
                <span className={`text-sm font-medium hidden sm:inline ${
                  isCurrent ? 'text-brand-700' : isComplete ? 'text-emerald-700' : 'text-navy-400'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 lg:w-12 h-px mx-1 transition-colors duration-300 ${i < step ? 'bg-emerald-300' : 'bg-navy-200/50'}`} />
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 bg-gradient-to-r from-red-50 to-red-50/50 border border-red-200/60 text-red-700 text-sm rounded-xl px-4 py-3.5 animate-fade-in-down">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 shrink-0 mt-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </div>
          <span className="font-medium">{error}</span>
        </div>
      )}

      <div className="glass-card-rich rounded-2xl p-6 sm:p-8">
        <div key={step} className={direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'}>
          {step === 0 && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-navy-800 mb-4">Company information</h3>

              {/* Honeypot — visually hidden, must stay empty */}
              <input
                type="text" tabIndex={-1} autoComplete="off"
                value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
                className="hidden" aria-hidden="true"
                name="company_website"
              />

              <Field label="Company Name" icon={Building2}>
                <input className="input-field" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. ABC Collision Center" />
              </Field>
              <Field label="Contact Person" icon={User}>
                <input className="input-field" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. John Smith" />
              </Field>
              <Field label="Email Address" icon={Mail}>
                <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@abccollision.com" />
                {email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">Please enter a valid email address</p>
                )}
              </Field>
              <PhoneField label="Phone Number" value={phoneFormatted} raw={phoneRaw} onChange={(d) => setPhoneRaw(d)} />
              <PhoneField label="Secondary Phone" optional value={phoneSecondaryFormatted} raw={phoneSecondaryRaw} onChange={(d) => setPhoneSecondaryRaw(d)} />
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="text-lg font-bold text-navy-800 mb-2">Choose your coverage areas</h3>
              <p className="text-sm text-navy-400 mb-6">Select the municipalities you want to receive MVA alerts for.</p>
              {municipalities.length === 0 ? (
                <p className="text-sm text-navy-400 py-8 text-center">No coverage areas are available right now. Please check back soon.</p>
              ) : (
                <MunicipalityGrid
                  municipalities={municipalities}
                  selected={selected}
                  onToggle={toggle}
                  onSelectAll={() => setSelected(new Set(municipalities.map((m) => m.id)))}
                  onDeselectAll={() => setSelected(new Set())}
                />
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-lg font-bold text-navy-800 mb-6">Review &amp; submit</h3>
              <div className="space-y-4">
                <div className="bg-navy-50/40 rounded-xl p-4">
                  <h4 className="section-title mb-3">Company</h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-navy-400">Company</span><span className="font-semibold text-navy-800">{companyName}</span>
                    <span className="text-navy-400">Contact</span><span className="font-semibold text-navy-800">{contactName}</span>
                    <span className="text-navy-400">Email</span><span className="font-semibold text-navy-800">{email}</span>
                    <span className="text-navy-400">Phone</span><span className="font-semibold text-navy-800">+1 {phoneFormatted}</span>
                    {phoneSecondaryRaw && (<><span className="text-navy-400">Secondary</span><span className="font-semibold text-navy-800">+1 {phoneSecondaryFormatted}</span></>)}
                  </div>
                </div>
                <div className="bg-navy-50/40 rounded-xl p-4">
                  <h4 className="section-title mb-3">Coverage areas</h4>
                  <p className="text-sm font-semibold text-navy-800">{selected.size} selected</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {municipalities.filter((m) => selected.has(m.id)).map((m) => (
                      <span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-brand-100/80 text-brand-700">{m.name}</span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-navy-400 leading-relaxed">
                  By submitting, you agree we may contact you about your application. An admin will review and email you next steps.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <button type="button" onClick={goBack} disabled={step === 0}
          className={`btn-secondary flex items-center gap-2 ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} disabled={!canAdvance()} className="btn-primary flex items-center gap-2">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2 px-8">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>) : (<>Submit application <ArrowRight className="w-4 h-4" /></>)}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-navy-700 mb-2">
        <span className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-navy-400" />{label}</span>
      </label>
      {children}
    </div>
  )
}

function PhoneField({ label, value, raw, onChange, optional }: {
  label: string; value: string; raw: string; onChange: (digits: string) => void; optional?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-navy-700 mb-2">
        <span className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-navy-400" />{label}
          {optional && <span className="text-[11px] font-medium text-navy-400">optional</span>}
        </span>
      </label>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-navy-500 bg-navy-50/60 px-3 py-2.5 rounded-xl border border-navy-200/40">+1</span>
        <input type="tel" className="input-field flex-1" value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="(555) 123-4567" />
      </div>
      {raw.length > 0 && raw.length < 10 && (
        <p className="mt-1.5 text-xs text-navy-400 font-medium">{10 - raw.length} more digit{10 - raw.length !== 1 ? 's' : ''} needed</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

`npm run dev`, logged out, open `/apply`. Walk all three steps. On submit with the dev DB, confirm a row lands in `client_applications` (Supabase table view) and you are redirected to `/apply/success` (404 until Task 10 — acceptable here; verify the DB row and redirect attempt).

- [ ] **Step 5: Commit**

```bash
git add src/app/apply/page.tsx src/components/apply/ApplicationForm.tsx
git commit -m "feat(apply): public multi-step application form"
```

---

## Task 10: Public success page

**Files:**
- Create: `src/app/apply/success/page.tsx`, `src/components/apply/ApplicationSuccess.tsx`

- [ ] **Step 1: Success page (server)**

Create `src/app/apply/success/page.tsx`:

```tsx
import ApplicationSuccess from '@/components/apply/ApplicationSuccess'

export const metadata = {
  title: 'Application received — Collision Response',
}

export default function ApplySuccessPage() {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>
      <ApplicationSuccess />
    </div>
  )
}
```

- [ ] **Step 2: Success UI (client, confetti)**

Create `src/components/apply/ApplicationSuccess.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { MailCheck, Clock } from 'lucide-react'

export default function ApplicationSuccess() {
  useEffect(() => {
    const end = Date.now() + 1500
    function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ['#3b82f6', '#2563eb', '#f59e0b', '#60a5fa'] })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ['#3b82f6', '#2563eb', '#f59e0b', '#60a5fa'] })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [])

  return (
    <div className="max-w-md w-full text-center animate-scale-in">
      <div className="relative inline-flex items-center justify-center mb-6 animate-bounce-soft">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
          <MailCheck className="w-10 h-10 text-white" />
        </div>
        <div className="absolute inset-0 w-20 h-20 rounded-full bg-emerald-400/30 animate-ping" style={{ animationDuration: '1.5s' }} />
      </div>

      <h1 className="text-2xl font-extrabold gradient-text mb-2">Application received!</h1>
      <p className="text-navy-400 text-sm mb-8">
        Thanks for applying to Collision Response. Your application has been sent to our team for review.
      </p>

      <div className="glass-card-rich rounded-2xl p-6 text-left space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 text-brand-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-800">What happens next</p>
            <p className="text-xs text-navy-400 mt-1 leading-relaxed">
              An administrator will review your application. Once approved, you&apos;ll receive an email with a link to set your password, log in, and add your payment method to activate alerts.
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-navy-400/60 mt-8">
        Already have an account? <a href="/login" className="text-brand-600 font-medium hover:text-brand-700">Log in</a>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + manual verify**

Run: `npx tsc --noEmit` (no errors). Then `npm run dev`, visit `/apply/success` directly → confetti + message render.

- [ ] **Step 4: Commit**

```bash
git add src/app/apply/success/page.tsx src/components/apply/ApplicationSuccess.tsx
git commit -m "feat(apply): application success page"
```

---

## Task 11: Admin + settings server actions

**Files:**
- Modify: `src/lib/actions/application-actions.ts`

- [ ] **Step 1: Add admin imports + helpers**

At the top of `src/lib/actions/application-actions.ts`, extend the imports and add the admin-guard helpers (mirroring `admin-actions.ts`). Add to the existing import block:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { resolveActivation, generateTempPassword } from '@/lib/applications/provisioning'
import { clientApprovedEmail, applicantRejectedEmail } from '@/lib/email/templates'
import type { ClientApplication, CollisionCompany, ApplicationStatus } from '@/lib/types'
```

Then add the admin helpers (place below the imports, above `getPublicMunicipalities`):

```ts
async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function getAdminIds(): string[] {
  const raw = process.env.ADMIN_USER_IDS ?? ''
  return raw.split(',').map((id) => id.trim()).filter(Boolean)
}

async function requireAdmin(): Promise<string> {
  const userId = await getCurrentUserId()
  if (!userId || !getAdminIds().includes(userId)) {
    throw new Error('Unauthorized: admin access required')
  }
  return userId
}
```

- [ ] **Step 2: Add read actions**

Append to `src/lib/actions/application-actions.ts`:

```ts
// ---------------------------------------------------------------------------
// Admin: read
// ---------------------------------------------------------------------------

export async function getApplications(): Promise<ClientApplication[]> {
  await requireAdmin()
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('client_applications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ClientApplication[]
}

export async function getPendingApplicationCount(): Promise<number> {
  await requireAdmin()
  const admin = getAdminClient()
  const { count, error } = await admin
    .from('client_applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) return 0
  return count ?? 0
}

export type ApplicationDetail = {
  application: ClientApplication
  municipalityNames: string[]
  defaultPriceCents: number
}

export async function getApplicationById(id: string): Promise<ApplicationDetail> {
  await requireAdmin()
  const admin = getAdminClient()

  const [appRes, settingsRes] = await Promise.all([
    admin.from('client_applications').select('*').eq('id', id).single(),
    admin.from('system_settings').select('default_monthly_price_cents').eq('id', 1).single(),
  ])
  if (appRes.error) throw new Error(appRes.error.message)
  const application = appRes.data as unknown as ClientApplication

  let municipalityNames: string[] = []
  if (application.requested_municipality_ids.length > 0) {
    const { data: muns } = await admin
      .from('municipalities')
      .select('name')
      .in('id', application.requested_municipality_ids)
    municipalityNames = ((muns ?? []) as Array<{ name: string }>).map((m) => m.name)
  }

  const defaultPriceCents =
    (settingsRes.data as { default_monthly_price_cents: number } | null)?.default_monthly_price_cents ?? 5000

  return { application, municipalityNames, defaultPriceCents }
}
```

- [ ] **Step 3: Add approve / reject / resend**

Append to `src/lib/actions/application-actions.ts`:

```ts
// ---------------------------------------------------------------------------
// Admin: approve
// ---------------------------------------------------------------------------

async function buildSetupUrl(email: string): Promise<string> {
  const admin = getAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  // Use 'magiclink': the user is brand-new, and magiclink is the type
  // designed for click-a-link-to-get-a-session via the token_hash + verifyOtp
  // SSR pattern. The resulting full session permits updateUser({ password }),
  // so the client can set a password immediately on /set-password.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`Failed to generate login link: ${error?.message ?? 'unknown'}`)
  }
  const tokenHash = data.properties.hashed_token
  return `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/set-password`
}

export async function approveApplication(
  id: string,
  opts: { priceCents: number | null; comp: boolean }
): Promise<{ ok: true; companyId: string; emailSent: boolean }> {
  const adminUserId = await requireAdmin()
  const admin = getAdminClient()

  // Load + idempotency guard: only pending applications can be approved.
  const { data: appData, error: appErr } = await admin
    .from('client_applications').select('*').eq('id', id).single()
  if (appErr || !appData) throw new Error('Application not found')
  const application = appData as unknown as ClientApplication
  if (application.status !== 'pending') {
    throw new Error(`This application has already been ${application.status}.`)
  }

  // Default price from settings, then decide billing fields.
  const { data: settings } = await admin
    .from('system_settings').select('default_monthly_price_cents').eq('id', 1).single()
  const defaultPriceCents =
    (settings as { default_monthly_price_cents: number } | null)?.default_monthly_price_cents ?? 5000
  const activation = resolveActivation({ comp: opts.comp, priceCents: opts.priceCents, defaultPriceCents })

  // Defensive: re-validate the stored email before the external auth call.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) {
    throw new Error(`Invalid email in application record: ${application.email}`)
  }

  // 1. Create the auth user with a random temporary password.
  // email_confirm: true marks the email verified without sending Supabase's
  // own email. The client never sees or uses this password — they set their
  // own via the magic link emailed in step 5. The Supabase admin API requires
  // a password, so we generate a throwaway one.
  // Race backstop: if two admins approve simultaneously, the second createUser
  // fails here because the email already exists (auth emails are unique), so
  // no duplicate client is provisioned even without a DB row lock.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: application.email,
    password: generateTempPassword(),
    email_confirm: true,
  })
  if (authError || !authData?.user) {
    throw new Error(`Failed to create login: ${authError?.message ?? 'unknown'}`)
  }
  const authUserId = authData.user.id

  // 2. Insert the collision_companies row.
  const { data: companyData, error: companyError } = await admin
    .from('collision_companies')
    .insert({
      auth_user_id: authUserId,
      company_name: application.company_name,
      contact_name: application.contact_name,
      email: application.email,
      phone: application.phone,
      phone_secondary: application.phone_secondary,
      is_active: activation.is_active,
      is_comped: activation.is_comped,
      billing_status: activation.billing_status,
      monthly_price_cents: activation.monthly_price_cents,
    })
    .select()
    .single()
  if (companyError || !companyData) {
    await admin.auth.admin.deleteUser(authUserId) // rollback
    throw new Error(`Failed to create client: ${companyError?.message ?? 'unknown'}`)
  }
  const company = companyData as unknown as CollisionCompany

  // 3. Subscriptions for requested municipalities. The applicant specifically
  // chose these coverage areas, so a failure here rolls the whole approval back
  // (delete company + auth user) and leaves the application 'pending' to retry —
  // rather than provisioning a client with no coverage.
  if (application.requested_municipality_ids.length > 0) {
    const rows = application.requested_municipality_ids.map((municipality_id) => ({
      company_id: company.id, municipality_id, is_subscribed: true,
    }))
    const { error: subErr } = await admin.from('subscriptions').insert(rows)
    if (subErr) {
      await admin.from('collision_companies').delete().eq('id', company.id)
      await admin.auth.admin.deleteUser(authUserId)
      throw new Error(`Failed to create subscriptions: ${subErr.message}`)
    }
  }

  // 4. Mark the application approved.
  await admin.from('client_applications').update({
    status: 'approved' as ApplicationStatus,
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
    created_company_id: company.id,
  }).eq('id', id)

  // 5. Email the client a set-password link (best-effort).
  let emailSent = false
  try {
    const setupUrl = await buildSetupUrl(application.email)
    const { subject, html } = clientApprovedEmail({
      companyName: application.company_name, setupUrl, comped: activation.is_comped,
    })
    const res = await sendEmail({ to: application.email, subject, html })
    emailSent = res.ok
  } catch (e) {
    console.error('[applications] approval email failed:', e)
  }

  return { ok: true, companyId: company.id, emailSent }
}

export async function resendApprovalEmail(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('client_applications').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Application not found')
  const application = data as unknown as ClientApplication
  if (application.status !== 'approved') throw new Error('Application is not approved')

  const { data: company } = await admin
    .from('collision_companies').select('is_comped').eq('id', application.created_company_id ?? '').maybeSingle()
  const comped = (company as { is_comped: boolean } | null)?.is_comped ?? false

  const setupUrl = await buildSetupUrl(application.email)
  const { subject, html } = clientApprovedEmail({ companyName: application.company_name, setupUrl, comped })
  const res = await sendEmail({ to: application.email, subject, html })
  return { ok: res.ok }
}

// ---------------------------------------------------------------------------
// Admin: reject
// ---------------------------------------------------------------------------

export async function rejectApplication(
  id: string,
  reason?: string
): Promise<{ ok: true; emailSent: boolean }> {
  const adminUserId = await requireAdmin()
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('client_applications').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Application not found')
  const application = data as unknown as ClientApplication
  if (application.status !== 'pending') {
    throw new Error(`This application has already been ${application.status}.`)
  }

  const cleanReason = reason?.trim() || null
  await admin.from('client_applications').update({
    status: 'rejected' as ApplicationStatus,
    rejection_reason: cleanReason,
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id)

  // Courteous decline email (best-effort).
  let emailSent = false
  try {
    const { subject, html } = applicantRejectedEmail({ companyName: application.company_name, reason: cleanReason })
    const res = await sendEmail({ to: application.email, subject, html })
    emailSent = res.ok
  } catch (e) {
    console.error('[applications] rejection email failed:', e)
  }

  return { ok: true, emailSent }
}

export async function resendRejectionEmail(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('client_applications').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Application not found')
  const application = data as unknown as ClientApplication
  if (application.status !== 'rejected') throw new Error('Application is not rejected')

  const { subject, html } = applicantRejectedEmail({
    companyName: application.company_name,
    reason: application.rejection_reason,
  })
  const res = await sendEmail({ to: application.email, subject, html })
  return { ok: res.ok }
}

// ---------------------------------------------------------------------------
// Admin: notification settings
// ---------------------------------------------------------------------------

export async function getNotificationEmails(): Promise<string[]> {
  await requireAdmin()
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('system_settings').select('notification_emails').eq('id', 1).single()
  if (error) throw new Error(error.message)
  return (data as { notification_emails: string[] } | null)?.notification_emails ?? []
}

export async function updateNotificationEmails(emails: string[]): Promise<{ ok: true; emails: string[] }> {
  await requireAdmin()
  const admin = getAdminClient()

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const cleaned = Array.from(new Set(
    emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  ))
  for (const e of cleaned) {
    if (!EMAIL_RE.test(e)) throw new Error(`Invalid email address: ${e}`)
  }

  const { error } = await admin
    .from('system_settings')
    .upsert({ id: 1, notification_emails: cleaned })
  if (error) throw new Error(error.message)
  return { ok: true, emails: cleaned }
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/actions/application-actions.ts
git commit -m "feat(applications): admin approve/reject/resend + notification settings actions"
```

---

## Task 12: Admin applications list + sidebar/layout

**Files:**
- Create: `src/app/admin/applications/page.tsx`, `src/components/admin/ApplicationsTable.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`, `src/app/admin/layout.tsx`

- [ ] **Step 1: Sidebar — add nav items + pending badge prop**

In `src/components/admin/AdminSidebar.tsx`:

(a) Add icons to the lucide import: change the import to include `FileText` and `Settings`:

```ts
import {
  LayoutDashboard, Users, UserPlus, MapPin, CreditCard, Shield,
  FileText, Settings, Menu, X, LogOut,
} from 'lucide-react'
```

(b) Replace the `navItems` constant with one that includes Applications + Settings:

```ts
const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/applications', label: 'Applications', icon: FileText },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/clients/new', label: 'Add Client', icon: UserPlus },
  { href: '/admin/municipalities', label: 'Municipalities', icon: MapPin },
  { href: '/admin/billing', label: 'Billing', icon: CreditCard },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]
```

(c) Accept a prop and render a badge. Change the component signature:

```ts
export default function AdminSidebar({ pendingApplications = 0 }: { pendingApplications?: number }) {
```

(d) Inside the `navItems.map(...)`, render a count badge for the Applications item. Replace the trailing active-dot block:

```tsx
                {item.href === '/admin/applications' && pendingApplications > 0 ? (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-brand-500 text-white">
                    {pendingApplications}
                  </span>
                ) : active ? (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-soft" />
                ) : null}
```

- [ ] **Step 2: Layout — fetch count and pass it**

In `src/app/admin/layout.tsx`, import the action and fetch the count after the admin check, then pass to the sidebar. Add the import near the top:

```ts
import { getPendingApplicationCount } from '@/lib/actions/application-actions'
```

After `if (!adminIds.includes(user.id)) redirect('/dashboard')`, add:

```ts
  let pendingApplications = 0
  try {
    pendingApplications = await getPendingApplicationCount()
  } catch {
    pendingApplications = 0
  }
```

And change `<AdminSidebar />` to:

```tsx
        <AdminSidebar pendingApplications={pendingApplications} />
```

- [ ] **Step 3: Applications list page (server)**

Create `src/app/admin/applications/page.tsx`:

```tsx
import { getApplications } from '@/lib/actions/application-actions'
import ApplicationsTable from '@/components/admin/ApplicationsTable'

export const dynamic = 'force-dynamic'

export default async function AdminApplicationsPage() {
  const applications = await getApplications()
  return (
    <div className="page-wrapper">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">Applications</h1>
        <p className="text-sm text-navy-400 mt-1 font-medium">Review and approve new client applications.</p>
      </div>
      <ApplicationsTable applications={applications} />
    </div>
  )
}
```

- [ ] **Step 4: Applications table (client)**

Create `src/components/admin/ApplicationsTable.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronRight } from 'lucide-react'
import type { ClientApplication, ApplicationStatus } from '@/lib/types'

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  pending: 'bg-gold-50 text-gold-700 border-gold-200/60',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  rejected: 'bg-red-50 text-red-600 border-red-200/60',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ApplicationsTable({ applications }: { applications: ClientApplication[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | ApplicationStatus>('all')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return applications
      .filter((a) => filter === 'all' || a.status === filter)
      .filter((a) => !q || a.company_name.toLowerCase().includes(q) || a.contact_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
  }, [applications, query, filter])

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company, contact, email..."
            className="input-field pl-9" />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                filter === f ? 'bg-brand-500 text-white shadow-sm' : 'bg-white/60 text-navy-500 hover:bg-navy-50'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-sm text-navy-400 py-12">No applications match.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((a, i) => (
            <Link key={a.id} href={`/admin/applications/${a.id}`}
              className="flex items-center gap-4 p-3.5 rounded-xl border border-navy-100/50 bg-white/50 hover:bg-brand-50/40 hover:border-brand-200/50 transition-all duration-200 animate-fade-in-up"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-800 truncate">{a.company_name}</p>
                <p className="text-xs text-navy-400 truncate">{a.contact_name} · {a.email}</p>
              </div>
              <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold border capitalize ${STATUS_STYLES[a.status]}`}>
                {a.status}
              </span>
              <span className="hidden md:block text-xs text-navy-400 w-24 text-right">{formatDate(a.created_at)}</span>
              <ChevronRight className="w-4 h-4 text-navy-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck + manual verify**

Run: `npx tsc --noEmit` (no errors). `npm run dev`, log in as an admin, open `/admin` → sidebar shows "Applications" with a badge count if pending rows exist, and "Settings". Open `/admin/applications` → the application(s) submitted earlier appear; search/filter work; clicking a row navigates to `/admin/applications/<id>` (404 until Task 13).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminSidebar.tsx src/app/admin/layout.tsx src/app/admin/applications/page.tsx src/components/admin/ApplicationsTable.tsx
git commit -m "feat(admin): applications list, sidebar nav + pending badge"
```

---

## Task 13: Admin review page + approve/reject panel

**Files:**
- Create: `src/app/admin/applications/[id]/page.tsx`, `src/components/admin/ApplicationReview.tsx`

- [ ] **Step 1: Review page (server)**

Create `src/app/admin/applications/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getApplicationById } from '@/lib/actions/application-actions'
import ApplicationReview from '@/components/admin/ApplicationReview'

export const dynamic = 'force-dynamic'

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let detail
  try {
    detail = await getApplicationById(id)
  } catch {
    notFound()
  }
  return <ApplicationReview detail={detail} />
}
```

- [ ] **Step 2: Review + approval panel (client)**

Create `src/components/admin/ApplicationReview.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, User, Mail, Phone, MapPin, Check, X, Loader2, Gift, CreditCard,
} from 'lucide-react'
import { approveApplication, rejectApplication, resendApprovalEmail, resendRejectionEmail } from '@/lib/actions/application-actions'
import { formatPhoneDisplay } from '@/lib/phone'
import type { ApplicationDetail } from '@/lib/actions/application-actions'

export default function ApplicationReview({ detail }: { detail: ApplicationDetail }) {
  const router = useRouter()
  const { application: a, municipalityNames, defaultPriceCents } = detail
  const isPending = a.status === 'pending'

  const [comp, setComp] = useState(false)
  const [priceDollars, setPriceDollars] = useState((defaultPriceCents / 100).toFixed(2))
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  async function handleApprove() {
    setLoading('approve'); setError('')
    try {
      const priceCents = comp ? null : Math.round(parseFloat(priceDollars || '0') * 100)
      const res = await approveApplication(a.id, { priceCents, comp })
      setDone('approved')
      if (!res.emailSent) setError('Approved, but the welcome email could not be sent. Use “Resend email” below.')
      else router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setLoading(null)
    }
  }

  async function handleReject() {
    setLoading('reject'); setError('')
    try {
      const res = await rejectApplication(a.id, reason)
      setDone('rejected')
      if (!res.emailSent) setError('Rejected, but the decline email could not be sent. Use “Resend email” below.')
      else router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setLoading(null)
    }
  }

  async function handleResend() {
    setResending(true); setError('')
    try {
      const res = done === 'rejected' ? await resendRejectionEmail(a.id) : await resendApprovalEmail(a.id)
      if (res.ok) setResent(true)
      else setError('Could not resend the email. Please try again.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the email.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="page-wrapper max-w-3xl">
      <Link href="/admin/applications" className="inline-flex items-center gap-1.5 text-sm text-navy-400 hover:text-navy-600 mb-6 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to applications
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold gradient-text">{a.company_name}</h1>
          <p className="text-sm text-navy-400 mt-1">Submitted {new Date(a.created_at).toLocaleString()}</p>
        </div>
        <StatusBadge status={done ?? a.status} />
      </div>

      {/* Details */}
      <div className="glass-card rounded-2xl p-6 mb-5">
        <h3 className="section-title mb-4">Applicant details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Detail icon={Building2} label="Company" value={a.company_name} />
          <Detail icon={User} label="Contact" value={a.contact_name} />
          <Detail icon={Mail} label="Email" value={a.email} />
          <Detail icon={Phone} label="Phone" value={`+1 ${formatPhoneDisplay(a.phone.replace('+1', ''))}`} />
          {a.phone_secondary && <Detail icon={Phone} label="Secondary" value={`+1 ${formatPhoneDisplay(a.phone_secondary.replace('+1', ''))}`} />}
        </div>
        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-400 mb-2"><MapPin className="w-3.5 h-3.5" /> Requested coverage areas</p>
          <div className="flex flex-wrap gap-1.5">
            {municipalityNames.length === 0 ? <span className="text-sm text-navy-400">None</span> :
              municipalityNames.map((n) => (
                <span key={n} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-100/80 text-brand-700">{n}</span>
              ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-3 bg-gold-50/80 border border-gold-200/60 text-gold-800 text-sm rounded-xl px-4 py-3.5">
          <span className="font-medium flex-1">{error}</span>
          {done && (
            <button onClick={handleResend} disabled={resending}
              className="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap flex items-center gap-1.5">
              {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Resend email'}
            </button>
          )}
        </div>
      )}

      {resent && (
        <div className="mb-5 flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/60 text-emerald-700 text-sm rounded-xl px-4 py-3">
          <Check className="w-4 h-4" /> <span className="font-medium">Email resent.</span>
        </div>
      )}

      {a.status === 'rejected' && a.rejection_reason && (
        <div className="glass-card rounded-2xl p-5 mb-5">
          <p className="text-xs font-semibold text-navy-400 mb-1">Rejection reason</p>
          <p className="text-sm text-navy-700">{a.rejection_reason}</p>
        </div>
      )}

      {/* Decision panel — only for pending, and only until acted on */}
      {isPending && !done && (
        <div className="glass-card-rich rounded-2xl p-6">
          <h3 className="text-lg font-bold text-navy-800 mb-4">Decision</h3>

          {!rejecting ? (
            <>
              {/* Comp toggle */}
              <button type="button" onClick={() => setComp((c) => !c)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all mb-4 ${
                  comp ? 'bg-gold-50/80 border-gold-200' : 'bg-white/60 border-navy-200/40 hover:border-navy-300/60'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${comp ? 'bg-gold-100' : 'bg-navy-100'}`}>
                  <Gift className={`w-4.5 h-4.5 ${comp ? 'text-gold-600' : 'text-navy-400'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-navy-800">Comp this client (free)</p>
                  <p className="text-xs text-navy-400">Activate immediately, no card required.</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${comp ? 'bg-gold-500 border-gold-500' : 'border-navy-300'}`}>
                  {comp && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>

              {/* Price (hidden when comped) */}
              {!comp && (
                <div className="mb-5 animate-fade-in">
                  <label className="block text-sm font-semibold text-navy-700 mb-2">
                    <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-navy-400" /> Monthly price</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-navy-500 bg-navy-50/60 px-3 py-2.5 rounded-xl border border-navy-200/40">$</span>
                    <input type="number" min="1" step="0.01" value={priceDollars}
                      onChange={(e) => setPriceDollars(e.target.value)} className="input-field flex-1" />
                  </div>
                  <p className="mt-1.5 text-xs text-navy-400">The client adds a card via Stripe Checkout to activate alerts.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={handleApprove} disabled={loading !== null} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading === 'approve' ? <><Loader2 className="w-4 h-4 animate-spin" /> Approving...</> : <><Check className="w-4 h-4" /> Approve</>}
                </button>
                <button onClick={() => setRejecting(true)} disabled={loading !== null}
                  className="btn-secondary flex items-center justify-center gap-2 px-5 hover:!text-red-600 hover:!border-red-200">
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm font-semibold text-navy-700 mb-2">Reason (optional — included in the email)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                className="input-field resize-none mb-4" placeholder="e.g. Outside our current service area." />
              <div className="flex gap-3">
                <button onClick={handleReject} disabled={loading !== null}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 !bg-gradient-to-r !from-red-600 !to-red-500">
                  {loading === 'reject' ? <><Loader2 className="w-4 h-4 animate-spin" /> Rejecting...</> : <>Confirm reject</>}
                </button>
                <button onClick={() => setRejecting(false)} disabled={loading !== null} className="btn-secondary px-5">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {done === 'approved' && (
        <div className="glass-card-rich rounded-2xl p-6 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-emerald-100 items-center justify-center mb-3">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <p className="text-base font-bold text-navy-800">Approved & provisioned</p>
          <p className="text-sm text-navy-400 mt-1">The client has been emailed a link to set their password and log in.</p>
          {detail.application.created_company_id && (
            <Link href={`/admin/clients/${detail.application.created_company_id}`} className="btn-secondary inline-flex mt-4">View client record</Link>
          )}
        </div>
      )}

      {done === 'rejected' && (
        <div className="glass-card-rich rounded-2xl p-6 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-navy-100 items-center justify-center mb-3">
            <X className="w-7 h-7 text-navy-500" />
          </div>
          <p className="text-base font-bold text-navy-800">Application rejected</p>
          <p className="text-sm text-navy-400 mt-1">The applicant has been emailed a courteous decline.</p>
          <Link href="/admin/applications" className="btn-secondary inline-flex mt-4">Back to applications</Link>
        </div>
      )}
    </div>
  )
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-400 mb-1"><Icon className="w-3.5 h-3.5" /> {label}</p>
      <p className="text-sm font-semibold text-navy-800 break-words">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-gold-50 text-gold-700 border-gold-200/60',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    rejected: 'bg-red-50 text-red-600 border-red-200/60',
  }
  return <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border capitalize ${styles[status] ?? ''}`}>{status}</span>
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification (defer the email/login check to Task 16's E2E)**

`npm run dev`, log in as admin, open a pending application. Confirm the details + coverage areas render and the comp toggle hides/shows the price field. Don't approve yet if you want to first wire the set-password flow (Tasks 14–15); or approve and verify a `collision_companies` row + `subscriptions` rows are created and the application flips to `approved` (the email needs Resend env vars from Task 16).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/applications/[id]/page.tsx src/components/admin/ApplicationReview.tsx
git commit -m "feat(admin): application review page with approve/reject panel"
```

---

## Task 14: Admin settings page (notification emails)

**Files:**
- Create: `src/app/admin/settings/page.tsx`, `src/components/admin/NotificationEmailsForm.tsx`

- [ ] **Step 1: Settings page (server)**

Create `src/app/admin/settings/page.tsx`:

```tsx
import { getNotificationEmails } from '@/lib/actions/application-actions'
import NotificationEmailsForm from '@/components/admin/NotificationEmailsForm'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const emails = await getNotificationEmails()
  return (
    <div className="page-wrapper max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">Settings</h1>
        <p className="text-sm text-navy-400 mt-1 font-medium">Configure who gets notified about new applications.</p>
      </div>
      <NotificationEmailsForm initialEmails={emails} />
    </div>
  )
}
```

- [ ] **Step 2: Notification list editor (client)**

Create `src/components/admin/NotificationEmailsForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Mail, Plus, Trash2, Check, Loader2, AlertCircle } from 'lucide-react'
import { updateNotificationEmails } from '@/lib/actions/application-actions'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NotificationEmailsForm({ initialEmails }: { initialEmails: string[] }) {
  const [emails, setEmails] = useState<string[]>(initialEmails)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function addEmail() {
    const e = draft.trim().toLowerCase()
    if (!e) return
    if (!EMAIL_RE.test(e)) { setError('Please enter a valid email address'); return }
    if (emails.includes(e)) { setError('That address is already in the list'); return }
    setEmails((prev) => [...prev, e]); setDraft(''); setError('')
  }

  function removeEmail(e: string) { setEmails((prev) => prev.filter((x) => x !== e)) }

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await updateNotificationEmails(emails)
      setEmails(res.emails); setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card-rich rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-brand-500" />
        <h3 className="text-base font-bold text-navy-800">Application notification emails</h3>
      </div>
      <p className="text-xs text-navy-400 mb-5">These addresses receive an email each time a new application is submitted.</p>

      {/* Add row */}
      <div className="flex gap-2 mb-4">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
          className="input-field flex-1" placeholder="admin@yourcompany.com" type="email" />
        <button onClick={addEmail} className="btn-secondary flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add</button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium mb-3"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>
      )}

      {/* List */}
      {emails.length === 0 ? (
        <p className="text-sm text-navy-400 py-6 text-center bg-navy-50/40 rounded-xl mb-4">
          No recipients yet. Add at least one so applications don&apos;t go unnoticed.
        </p>
      ) : (
        <div className="space-y-2 mb-5">
          {emails.map((e) => (
            <div key={e} className="flex items-center justify-between bg-navy-50/50 rounded-xl px-4 py-2.5">
              <span className="text-sm font-medium text-navy-700">{e}</span>
              <button onClick={() => removeEmail(e)} className="p-1.5 rounded-lg text-navy-400 hover:text-red-600 hover:bg-red-50 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save changes'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + manual verify**

Run: `npx tsc --noEmit` (no errors). `npm run dev`, open `/admin/settings`, add an email, Save → it persists (reload to confirm), remove one + Save → persists.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/settings/page.tsx src/components/admin/NotificationEmailsForm.tsx
git commit -m "feat(admin): settings page to manage notification emails"
```

---

## Task 15: Auth confirm route + set-password page

> **PREREQUISITE:** Task 8 (middleware public allowlist) MUST be done before this task. The approval email link lands the logged-out client on `/auth/confirm?token_hash=...`; without `/auth/confirm` in the public allowlist, the middleware redirects that token-bearing request to `/login` before the route runs, and the token is never exchanged for a session — breaking the entire set-password flow. The route reads `type` from the query string (`magiclink`), so it stays in sync with `buildSetupUrl` automatically.

**Files:**
- Create: `src/app/auth/confirm/route.ts`, `src/app/set-password/page.tsx`, `src/components/SetPasswordForm.tsx`

- [ ] **Step 1: Token → session route handler**

Create `src/app/auth/confirm/route.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/set-password'

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Invalid / expired token → set-password page shows a "request a fresh link" state.
  return NextResponse.redirect(`${origin}/set-password?error=expired`)
}
```

- [ ] **Step 2: Set-password page (server)**

Create `src/app/set-password/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import SetPasswordForm from '@/components/SetPasswordForm'

export const dynamic = 'force-dynamic'

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Decide where to send them after setting a password: pending clients
  // go straight to billing to add a card; everyone else to the dashboard.
  let redirectTo = '/dashboard'
  if (user) {
    const { data: company } = await supabase
      .from('collision_companies')
      .select('billing_status')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if ((company as { billing_status?: string } | null)?.billing_status === 'pending') {
      redirectTo = '/billing'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>
      <div className="w-full max-w-[420px] animate-scale-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold gradient-text">Set your password</h1>
          <p className="text-sm text-navy-400 mt-2">Choose a password to finish setting up your account.</p>
        </div>
        <SetPasswordForm hasSession={!!user} expired={error === 'expired'} redirectTo={redirectTo} email={user?.email ?? null} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Set-password form (client)**

Create `src/components/SetPasswordForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PasswordGenerator from '@/components/admin/PasswordGenerator'

export default function SetPasswordForm({
  hasSession, expired, redirectTo, email,
}: {
  hasSession: boolean; expired: boolean; redirectTo: string; email: string | null
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!hasSession || expired) {
    return (
      <div className="glass-card-rich rounded-2xl p-8 text-center">
        <div className="inline-flex w-12 h-12 rounded-full bg-gold-100 items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6 text-gold-600" />
        </div>
        <p className="text-base font-bold text-navy-800">This link has expired</p>
        <p className="text-sm text-navy-400 mt-1 mb-5">Set-password links are single-use and time-limited. Use the link below to request a fresh one.</p>
        <a href="/login" className="btn-secondary inline-flex">Go to login</a>
        <p className="text-xs text-navy-400/70 mt-4">On the login page, choose “forgot password” to receive a new link, or contact your administrator.</p>
      </div>
    )
  }

  const canSubmit = password.length >= 8 && password === confirm

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message); setLoading(false); return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="glass-card-rich rounded-2xl p-8 space-y-5">
      {email && <p className="text-sm text-navy-500">Setting a password for <span className="font-semibold text-navy-700">{email}</span></p>}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200/60 text-red-700 text-sm rounded-xl px-4 py-3">
          <span className="font-medium">{error}</span>
        </div>
      )}
      <PasswordGenerator password={password} confirmPassword={confirm} onPasswordChange={setPassword} onConfirmChange={setConfirm} />
      <button onClick={handleSubmit} disabled={!canSubmit || loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Set password & continue'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Visit `/set-password` directly while logged out → the "link expired / request fresh" state shows (no session). The authenticated path is verified end-to-end in Task 16.

- [ ] **Step 6: Commit**

```bash
git add src/app/auth/confirm/route.ts src/app/set-password/page.tsx src/components/SetPasswordForm.tsx
git commit -m "feat(auth): token-confirm route + first-login set-password flow"
```

---

## Task 16: Env, docs, and end-to-end verification

**Files:**
- Modify: `.env.local.example`, `README.md`, `.env.local` (local only — do not commit secrets)

- [ ] **Step 1: Document env vars**

Add to `.env.local.example` (after the existing vars):

```bash
# Resend transactional email (https://resend.com)
# Required for application notifications + client onboarding emails.
RESEND_API_KEY=re_your_api_key
# Verified sending identity, e.g. "Collision Response <noreply@mail.yourdomain.com>".
# The domain must be verified in the Resend dashboard before sends succeed.
RESEND_FROM="Collision Response <noreply@mail.yourdomain.com>"
```

- [ ] **Step 2: README setup notes**

Add a short "Client self-signup" section to `README.md` documenting:
- The public `/apply` link is what you share with prospects.
- Admins must add notification recipients at `/admin/settings` (the list starts empty; until at least one address is added, the new-application email is skipped and only the in-portal list reflects submissions).
- The approval flow: pending → client pays via the existing Stripe Checkout, or comp at approval for immediate activation.
- Migration `005_client_applications.sql` must be applied to Supabase.
- **Resend setup (required for any email):**
  1. In the Resend dashboard (https://resend.com/domains), add your sending domain, e.g. `mail.yourdomain.com`.
  2. Add the DNS records Resend shows (SPF/`MX`, DKIM `TXT`, and return-path) at your DNS provider and wait for verification.
  3. Set `RESEND_API_KEY` and `RESEND_FROM` (e.g. `Collision Response <noreply@mail.yourdomain.com>` — the domain must match the verified one).
  4. If the domain is unverified or the keys are missing, sends fail; the app logs the failure and surfaces a "Resend email" affordance on the review page, but never blocks the DB write or the applicant's success page.

- [ ] **Step 3: Set real local env values + restart**

Put a real `RESEND_API_KEY` and `RESEND_FROM` (with a Resend-verified domain) into `.env.local`. Restart `npm run dev`.

- [ ] **Step 4: Full end-to-end manual test**

Run through the entire flow and confirm each checkpoint:

1. Logged out, open `/apply`. Complete all 3 steps, submit. → redirected to `/apply/success`; a `pending` row appears in `client_applications`.
2. The address(es) in `/admin/settings` receive the "New application" email; its **Review application** button opens `/admin/applications/<id>`.
3. As admin, open the review page, leave comp off, keep the default price, click **Approve**. → `collision_companies` row created with `billing_status='pending'`, `is_active=false`; `subscriptions` rows created; application status `approved`.
4. The applicant receives the "You're approved" email. Its button opens `/auth/confirm?...` → redirects to `/set-password`.
5. Set a password → redirected to `/billing`. Add a card via the existing Stripe Checkout (use a Stripe test card). → webhook flips `is_active=true`, `billing_status='active'`.
6. Repeat once choosing **Comp** at approval: the client email says "active"; after set-password they land on `/dashboard`; `billing_status='comped'`, `is_active=true`, no card needed.
7. Reject an application with a reason → applicant receives the decline email; status `rejected`.
8. Re-open an already-approved application and confirm **Approve** is a no-op error ("already approved").
9. **admin_only exclusion:** mark a municipality `admin_only=true` in the admin portal, then reload `/apply` → it does NOT appear in the coverage-area grid.
10. **Duplicate pending:** submit `/apply` twice with the same email while the first is still pending → the second is rejected with the "already under review" message (no duplicate row).

- [ ] **Step 5: Full typecheck, lint, unit tests, build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run lint` → no new errors.
Run: `npm test` → all unit tests pass.
Run: `npm run build` → succeeds.

- [ ] **Step 6: Commit docs**

```bash
git add .env.local.example README.md
git commit -m "docs: Resend env + client self-signup setup notes"
```

---

## Self-Review (completed during planning)

**Spec coverage** — every spec section maps to a task:
- Public `/apply` form + municipality select → Tasks 9, 7 (`getPublicMunicipalities`).
- `/apply/success` → Task 10.
- `client_applications` table + `notification_emails` → Task 2.
- Resend infra + 3 templates → Task 6; sends wired in Tasks 7 (admin notify), 13/11 (approved, rejected), 11 (resend).
- Middleware allowlist (incl. `/auth/confirm` fix) → Task 8.
- Admin list + sidebar nav + pending badge → Task 12.
- Admin review + price/comp at approval + idempotency → Tasks 11, 13.
- Admin settings page → Task 14.
- Provisioning mirrors `createClient` + rollback → Task 11.
- Set-password / first-login (`/auth/confirm` + `/set-password`) → Task 15.
- Edge cases: duplicate active email (Task 7), already-reviewed no-op (Task 11), expired link (Task 15), `admin_only` excluded (Task 7), email failures best-effort (Tasks 7/11/13).
- Testing: pure-logic TDD (Tasks 3–6) + manual E2E (Task 16).

**Type consistency** — shared names verified across tasks: `RawApplicationInput`/`NormalizedApplication`/`validateApplicationInput` (Task 4 → used 7, 9), `resolveActivation`/`ActivationFields`/`generateTempPassword` (Task 5 → 11), `EmailContent` + the three template builders (Task 6 → 7/11/13), `ApplicationDetail` (Task 11 → 13), `ClientApplication`/`ApplicationStatus` (Task 2 → everywhere), `getPendingApplicationCount` (Task 11 → 12), `getPublicMunicipalities` (Task 7 → 9).

**Placeholder scan** — no TBD/TODO; every code step contains complete code. The only intentional human-supplied values are real secrets/domain in `.env.local` (Task 16 Step 3) and the prose README section (Task 16 Step 2).

**Ordering** — foundation (1–6) → public submit + gate (7–10) → admin (11–14) → client login (15) → env/E2E (16). Approval (Task 11/13) depends on email (6) and provisioning (5); all dependencies precede their use.

---

## Adversarial review applied (2026-06-02)

A four-lens review (type consistency, spec coverage, runtime correctness, security/data) with independent verification ran against this plan. Confirmed fixes folded in above:

- **Critical:** set-password link changed from `recovery` to `magiclink` (unambiguous click-to-session via `token_hash`/`verifyOtp`); Task 8 marked an explicit prerequisite of Task 15 so `/auth/confirm` is reachable while logged out.
- **Integrity:** approval now fully rolls back (delete company + auth user) if the subscription insert fails; duplicate-pending-application guard added to `submitApplication`; defensive email re-validation + duplicate-email race-backstop comment in `approveApplication`.
- **Spec alignment / UX:** `resendApprovalEmail` + `resendRejectionEmail` wired to a "Resend email" button on the review page; rejection now returns `emailSent` and has a done state; recipient-format validation in `sendEmail`; `requested_municipality_ids` required in the Insert type; HTML-escaping test for rejection reason; expanded Resend domain-verification docs; E2E checkpoints for `admin_only` exclusion and duplicate-pending.

**Consciously deferred (not silently dropped)** — disproportionate for a two-admin internal tool today; revisit if scale/threat model changes:

- `system_settings` change-audit table for `notification_emails`.
- IP-based rate limiting / Cloudflare Turnstile on `/apply` (a marked seam exists; honeypot + duplicate-pending guard + admin-review gate cover the realistic cases now).
- Email retry queue / dead-letter / failure-rate alerting (the manual "Resend email" affordance covers recovery).
- Randomized honeypot field name + submission-timing heuristics.
