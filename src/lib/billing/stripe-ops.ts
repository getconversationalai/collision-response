// Stripe-touching billing helpers. Impure (take a Stripe instance) but shared
// by the webhook route, the admin actions and the cron sweep so the duplicate-
// reconcile and lapse-decision behaviour is written once. The pure decisions
// they build on live in ./reconcile.ts (unit tested).
import type Stripe from 'stripe'
import {
  selectCanonicalSubscription,
  type SubSummary,
  type StripeSubStatus,
} from './reconcile'

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
  } catch (err) {
    // Already canceled or missing → idempotent success. Anything else re-throws.
    const existing = await stripe.subscriptions.retrieve(id).catch(() => null)
    if (existing && existing.status !== 'canceled') throw err
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

  const refund = await stripe.refunds.create({ payment_intent: paymentIntent })
  return { refunded: true, refundId: refund.id, amountCents: refund.amount }
}

export interface ReconcileResult {
  customerId: string
  kept: string | null
  canceled: string[]
  refunds: Array<{ subscriptionId: string } & RefundResult>
  hadDuplicates: boolean
}

/**
 * Ensure a customer has at most ONE subscription: keep the canonical one
 * (paid states beat incomplete — finding C3), cancel the rest, and optionally
 * refund each canceled duplicate's most recent paid invoice. Idempotent: on a
 * customer that already has a single subscription it cancels nothing.
 */
export async function reconcileDuplicatesForCustomer(
  stripe: Stripe,
  customerId: string,
  opts: { refundDuplicates: boolean }
): Promise<ReconcileResult> {
  const subs = await listSubSummaries(stripe, customerId)
  const { keep, cancel } = selectCanonicalSubscription(subs)

  const refunds: ReconcileResult['refunds'] = []
  for (const id of cancel) {
    await cancelSubscriptionSafe(stripe, id)
    if (opts.refundDuplicates) {
      const r = await refundSubscriptionLatestPaid(stripe, id)
      refunds.push({ subscriptionId: id, ...r })
    }
  }

  return {
    customerId,
    kept: keep,
    canceled: cancel,
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
