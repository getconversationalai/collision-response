// Stripe-touching billing helpers. Impure (take a Stripe instance) but shared
// by the webhook route, the admin actions and the cron sweep so the duplicate-
// reconcile and lapse-decision behaviour is written once. The pure decisions
// they build on live in ./reconcile.ts (unit tested).
import type Stripe from 'stripe'
import {
  selectCanonicalSubscription,
  isSameBurstDuplicate,
  type SubSummary,
  type StripeSubStatus,
} from './reconcile'

// A duplicate created within this window of the kept subscription is treated as
// a same-signup-burst double-submit and auto-refunded; anything older is left
// for an admin (finding MED-3).
const SAME_BURST_WINDOW_SEC = 60 * 60

/** Fetch a customer's subscriptions as the pure SubSummary shape. */
export async function listSubSummaries(
  stripe: Stripe,
  customerId: string
): Promise<SubSummary[]> {
  const res = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  })
  return res.data.map((s) => ({
    id: s.id,
    status: s.status as StripeSubStatus,
    created: s.created,
    currentPeriodEnd: s.current_period_end,
  }))
}

/**
 * Cancel a subscription, tolerating "already canceled / already gone" as
 * success so the reconcile stays idempotent under Stripe webhook redelivery
 * (adversarial finding C2).
 */
export async function cancelSubscriptionSafe(
  stripe: Stripe,
  id: string
): Promise<void> {
  try {
    await stripe.subscriptions.cancel(id)
    return
  } catch (err) {
    // Swallow ONLY when we can POSITIVELY confirm the subscription is already
    // canceled / gone (finding HIGH-1). If we can't confirm (e.g. the retrieve
    // also fails on a transient error), re-throw so the caller never treats an
    // un-canceled duplicate as handled.
    let confirmedGone = false
    try {
      const existing = await stripe.subscriptions.retrieve(id)
      confirmedGone = existing.status === 'canceled'
    } catch (retrieveErr) {
      // A missing subscription means it's already gone → success.
      if ((retrieveErr as { code?: string })?.code === 'resource_missing') {
        confirmedGone = true
      }
    }
    if (!confirmedGone) throw err
  }
}

export interface RefundResult {
  refunded: boolean
  refundId?: string
  amountCents?: number
}

/**
 * Refund the latest PAID invoice of a subscription — used when we cancel a
 * duplicate that already charged the customer. Refund is issued against the
 * invoice's payment_intent (the correct Refund API shape — finding H4).
 */
export async function refundSubscriptionLatestPaid(
  stripe: Stripe,
  subscriptionId: string
): Promise<RefundResult> {
  const invoices = await stripe.invoices.list({
    subscription: subscriptionId,
    status: 'paid',
    limit: 1,
  })
  const invoice = invoices.data[0]
  if (!invoice) return { refunded: false }

  const paymentIntent =
    typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : invoice.payment_intent?.id ?? null
  if (!paymentIntent) return { refunded: false }

  // Idempotency key keyed on the payment_intent so a concurrent webhook
  // redelivery can't issue a second refund for the same charge (finding HIGH-2).
  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntent },
    { idempotencyKey: `refund-${paymentIntent}` }
  )
  return { refunded: true, refundId: refund.id, amountCents: refund.amount }
}

export interface ReconcileResult {
  customerId: string
  kept: string | null
  canceled: string[] // confirmed canceled
  failedToCancel: string[] // still live — caller must surface / retry
  refunds: Array<{ subscriptionId: string } & RefundResult>
  hadDuplicates: boolean
}

/**
 * Ensure a customer has at most ONE subscription: keep the canonical one
 * (paid states beat incomplete — finding C3), cancel the rest, and optionally
 * refund each SAME-BURST canceled duplicate's most recent paid invoice.
 * Idempotent: on a customer that already has a single subscription it cancels
 * nothing.
 *
 * Robust to partial failure (finding HIGH-2): `kept` is decided up front and
 * always returned, and each duplicate's cancel/refund is isolated — a refund
 * error can never null out the canonical id or abort the remaining work. A
 * duplicate that could not be confirmed canceled is reported in
 * `failedToCancel` (never silently dropped).
 */
export async function reconcileDuplicatesForCustomer(
  stripe: Stripe,
  customerId: string,
  opts: { refundDuplicates: boolean }
): Promise<ReconcileResult> {
  const subs = await listSubSummaries(stripe, customerId)
  const { keep, cancel } = selectCanonicalSubscription(subs)
  const byId = new Map(subs.map((s) => [s.id, s]))
  const keptSub = keep ? byId.get(keep) ?? null : null

  const canceled: string[] = []
  const failedToCancel: string[] = []
  const refunds: ReconcileResult['refunds'] = []

  for (const id of cancel) {
    try {
      await cancelSubscriptionSafe(stripe, id)
      canceled.push(id)
    } catch (err) {
      failedToCancel.push(id)
      console.error(
        `[reconcile] could not cancel duplicate subscription ${id} for customer ${customerId}:`,
        err
      )
      continue // never refund a subscription we couldn't confirm canceled
    }

    if (!opts.refundDuplicates) continue

    // Only auto-refund a same-signup-burst duplicate; older subscriptions are
    // left for an admin to refund deliberately (finding MED-3).
    const dup = byId.get(id)
    const sameBurst =
      keptSub && dup
        ? isSameBurstDuplicate(keptSub.created, dup.created, SAME_BURST_WINDOW_SEC)
        : false
    if (!sameBurst) continue

    try {
      const r = await refundSubscriptionLatestPaid(stripe, id)
      refunds.push({ subscriptionId: id, ...r })
    } catch (err) {
      console.error(
        `[reconcile] refund failed for duplicate subscription ${id} (customer ${customerId}):`,
        err
      )
    }
  }

  return {
    customerId,
    kept: keep,
    canceled,
    failedToCancel,
    refunds,
    hadDuplicates: cancel.length > 0,
  }
}

export interface SweepDecisionData {
  stripeStatus: StripeSubStatus | 'not_found'
  stripeCurrentPeriodEndMs: number | null
}

/**
 * Fetch the FRESH status + period end the non-payment sweep decides on. A
 * missing subscription resolves to 'not_found' (a strong disable signal).
 */
export async function fetchSweepDecisionData(
  stripe: Stripe,
  subscriptionId: string
): Promise<SweepDecisionData> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    return {
      stripeStatus: sub.status as StripeSubStatus,
      stripeCurrentPeriodEndMs: sub.current_period_end * 1000,
    }
  } catch {
    return { stripeStatus: 'not_found', stripeCurrentPeriodEndMs: null }
  }
}
