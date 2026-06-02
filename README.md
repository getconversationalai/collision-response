# Collision Ping

Client portal for auto collision companies to manage their MVA (Motor Vehicle Accident) SMS notification subscriptions.

## Features

- **Login** — Email/password authentication via Supabase Auth
- **Dashboard** — Toggle location subscriptions on/off per municipality, edit phone number
- **Notification History** — View past MVA notifications with status tracking

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Supabase (PostgreSQL, Auth, Row Level Security)
- Tailwind CSS

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Run the dev server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deploy to Vercel. Set the environment variables in your Vercel project settings.

## Client Self-Signup

Prospects can apply at the public `/apply` link (no login required). Approved clients are provisioned automatically and emailed a set-password link.

**How it works:**

- **Public apply page** — Share `https://collisionping.com/apply` with prospects. They fill out company info and choose coverage areas. Submissions land as `pending` rows in `client_applications`; no auth user or `collision_companies` row is created until an admin approves.
- **Admin notifications** — Go to `/admin/settings` to add the email addresses that receive "new application" notifications. The list starts empty; until at least one address is added, the new-application email is skipped and submissions only appear in the in-portal list at `/admin/applications`.
- **Approval flow** — Open `/admin/applications/<id>` to review a submission. Two paths:
  - **Comp** — Check "Comp this client" at approval. The client account is immediately active (`billing_status='comped'`, `is_active=true`); no card is ever required.
  - **Pay** — Leave comp unchecked and set a monthly price (defaults to the global default). The client account starts `pending` (`is_active=false`); SMS alerts activate once the client adds a card via the existing Stripe Checkout flow.
  - In both cases the client receives an email with a one-time set-password link.
- **Database migration** — Apply `migrations/005_client_applications.sql` in the Supabase SQL editor before deploying this feature.
- **Resend setup (required for any email):**
  1. In the Resend dashboard (https://resend.com/domains), add your sending domain, e.g. `mail.yourdomain.com`.
  2. Add the DNS records Resend shows (SPF/MX, DKIM TXT, and return-path) at your DNS provider and wait for verification.
  3. Set `RESEND_API_KEY` and `RESEND_FROM` (e.g. `Collision Ping <noreply@mail.yourdomain.com>` — the domain must match the verified one).
  4. If the domain is unverified or the keys are missing, sends fail silently; the app logs the failure and surfaces a "Resend email" affordance on the review page, but never blocks the DB write or the applicant's success page.

## Stripe Billing

Monthly subscription billing — full spec in `Stripe_Integration_Spec.md`. Operator setup steps:

1. **Run the migration.** Apply `migrations/004_stripe_billing.sql` in the Supabase SQL editor before deploying the code.
2. **Create one Stripe Product.** In the Stripe dashboard create a single Product (e.g. "Collision Ping Subscription") and copy its `prod_...` id into `STRIPE_PRODUCT_ID`. Do **not** create Price objects by hand — the app creates a per-client Price automatically.
3. **Configure the webhook endpoint.** In Stripe → Developers → Webhooks, add an endpoint at `https://collisionping.com/api/stripe/webhook` subscribed to exactly these five events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.
4. **Set environment variables** (see `.env.local.example`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRODUCT_ID`, `NEXT_PUBLIC_APP_URL`.
   - **On Cloudflare:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are secrets — set them with `wrangler secret put STRIPE_SECRET_KEY` / `wrangler secret put STRIPE_WEBHOOK_SECRET`. **Do not add them to `wrangler.jsonc` `vars`** — that file is committed to git. `STRIPE_PRODUCT_ID` and `NEXT_PUBLIC_APP_URL` are not secret and may live in `wrangler.jsonc` `vars` or the Cloudflare dashboard.
5. **Enable Stripe-side emails.** In Stripe → Settings → Customer emails, turn on "Successful payments" (monthly receipts) and "Card expiring soon". The payment-*failed* notification is currently the in-app red dashboard banner only — no email/SMS provider is wired into this app yet (see `notifyPaymentFailed` in `src/app/api/stripe/webhook/route.ts`).
6. **Test locally first:** `stripe listen --forward-to localhost:3000/api/stripe/webhook`, then `stripe trigger invoice.payment_failed` (etc.). Use test card `4242 4242 4242 4242` in Checkout.

Notes:

- The Stripe API version is pinned to `2024-06-20` in `src/lib/stripe.ts` (with `stripe` SDK v16, whose types match that version).
- Billing disables SMS by flipping `collision_companies.is_active` to `false` — the same flag the n8n SMS sender already checks.
- The webhook verifies signatures with `constructEventAsync` + a SubtleCrypto provider because the sync `constructEvent` does not run on the Cloudflare Workers runtime.
