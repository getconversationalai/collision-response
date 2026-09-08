// Non-payment enforcement sweep. The app is otherwise 100% reactive to Stripe
// webhooks; this is the safety net that disables a client whose paid period has
// genuinely lapsed even if a `invoice.payment_failed` webhook was missed.
//
// SAFETY: the disable decision is the pure, unit-tested `shouldDisableForLapse`
// (src/lib/billing/reconcile.ts). It NEVER disables a comped client, a
// manually-managed client (null subscription), or a paid-and-current one.
//
// Auth: Bearer CRON_SECRET, length-guarded constant-time compare, fail-closed
// if the secret is unset. Trigger it from Supabase pg_cron+pg_net (secret in
// Vault) or a Cloudflare Cron — see migrations/006.
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getAdminClient } from '@/lib/supabase/admin'
import { fetchSweepDecisionData } from '@/lib/billing/stripe-ops'
import { shouldDisableForLapse } from '@/lib/billing/reconcile'

export const dynamic = 'force-dynamic'

const GRACE_MS = 24 * 60 * 60 * 1000 // 1 day past the paid-through date
const BATCH = 50 // cap Stripe calls per run (Workers subrequest limit — finding M2)

/** Length-guarded constant-time string compare (no node:crypto — Workers-safe). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed
  const header = req.headers.get('authorization')
  if (!header) return false
  return safeEqual(header, `Bearer ${secret}`)
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = getAdminClient()
  const nowMs = Date.now()
  const cutoffIso = new Date(nowMs - GRACE_MS).toISOString()

  // Loose prefilter (authoritative decision is the predicate on fresh Stripe
  // data — finding M3). null current_period_end and null subscription are
  // excluded here AND by the predicate, so manual clients are never selected.
  const { data, error } = await admin
    .from('collision_companies')
    .select(
      'id, company_name, billing_status, is_comped, stripe_subscription_id, current_period_end'
    )
    .eq('billing_status', 'active')
    .eq('is_comped', false)
    .not('stripe_subscription_id', 'is', null)
    .lt('current_period_end', cutoffIso)
    .limit(BATCH)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const stripe = getStripe()
  const disabledIds: string[] = []
  const candidates = data ?? []

  for (const c of candidates) {
    const decision = await fetchSweepDecisionData(stripe, c.stripe_subscription_id!)
    const disable = shouldDisableForLapse({
      billingStatus: c.billing_status,
      isComped: c.is_comped,
      stripeSubscriptionId: c.stripe_subscription_id,
      stripeStatus: decision.stripeStatus,
      stripeCurrentPeriodEndMs: decision.stripeCurrentPeriodEndMs,
      nowMs,
      graceMs: GRACE_MS,
    })
    if (!disable) continue

    const { error: upErr } = await admin
      .from('collision_companies')
      .update({
        is_active: false,
        billing_status: 'past_due',
        last_payment_failed_at: new Date(nowMs).toISOString(),
      })
      .eq('id', c.id)
    if (upErr) {
      return NextResponse.json(
        { error: upErr.message, checked: candidates.length, disabled: disabledIds },
        { status: 500 }
      )
    }
    disabledIds.push(c.id)
  }

  return NextResponse.json({
    checked: candidates.length,
    disabled: disabledIds.length,
    disabledIds,
    batchCapped: candidates.length === BATCH,
  })
}
