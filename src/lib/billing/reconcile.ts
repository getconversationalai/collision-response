// Pure billing-reconciliation logic — no Stripe/Supabase calls, fully unit
// tested (reconcile.test.ts). The webhook, admin actions and cron sweep wire
// these decisions to the live services. Keeping the decisions pure is what lets
// us prove the safety-critical property: the non-payment sweep must NEVER
// disable a comped or manually-managed client.

export type StripeSubStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'canceled'
  | 'paused'

export interface SubSummary {
  id: string
  status: StripeSubStatus
  created: number // unix seconds (Stripe `created`)
  currentPeriodEnd: number // unix seconds
}

/**
 * A subscription that still "exists" for billing purposes (not fully dead).
 * Used to decide whether a customer already has a subscription and to pick the
 * set of subscriptions eligible to be the canonical one. `canceled` and
 * `incomplete_expired` are terminal — they never charge again.
 */
export function isLiveSubscriptionStatus(status: StripeSubStatus): boolean {
  return (
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'unpaid' ||
    status === 'incomplete' ||
    status === 'paused'
  )
}

/**
 * "Paid and covering the current period" — the state in which the non-payment
 * sweep must LEAVE a client enabled. Only a genuinely paid subscription
 * (active/trialing) whose period end is still in the future (minus grace)
 * qualifies. A past_due/unpaid subscription is NOT paid-and-current.
 */
export function isPaidAndCurrent(
  status: StripeSubStatus,
  currentPeriodEndMs: number,
  nowMs: number,
  graceMs: number
): boolean {
  const covered = currentPeriodEndMs >= nowMs - graceMs
  return (status === 'active' || status === 'trialing') && covered
}

/**
 * Keep-priority when a customer wrongly has more than one live subscription.
 * Higher wins. A paid/collectible subscription must always beat an
 * `incomplete` one so the reconcile can never cancel a working paid
 * subscription in favour of a half-finished one (adversarial finding C3).
 */
function subscriptionKeepRank(status: StripeSubStatus): number {
  switch (status) {
    case 'active':
      return 5
    case 'trialing':
      return 4
    case 'past_due':
      return 3
    case 'unpaid':
      return 2
    case 'paused':
      return 2
    case 'incomplete':
      return 1
    default:
      return 0 // canceled / incomplete_expired — never keep over a live one
  }
}

export interface CanonicalSelection {
  keep: string | null
  cancel: string[]
}

/**
 * Choose exactly one subscription to keep among a customer's subscriptions and
 * return the (live) duplicates to cancel. Selection is by keep-rank, breaking
 * ties by earliest `created`. Terminal subscriptions are ignored entirely.
 */
export function selectCanonicalSubscription(subs: SubSummary[]): CanonicalSelection {
  const live = subs.filter((s) => isLiveSubscriptionStatus(s.status))
  if (live.length === 0) return { keep: null, cancel: [] }

  const sorted = [...live].sort((a, b) => {
    const byRank = subscriptionKeepRank(b.status) - subscriptionKeepRank(a.status)
    if (byRank !== 0) return byRank
    return a.created - b.created // earliest first among equal rank
  })

  return { keep: sorted[0].id, cancel: sorted.slice(1).map((s) => s.id) }
}

export interface LapseInput {
  billingStatus: string
  isComped: boolean
  stripeSubscriptionId: string | null
  /** Fresh status from Stripe; 'not_found' when the subscription no longer exists. */
  stripeStatus: StripeSubStatus | 'not_found'
  /** Fresh Stripe current_period_end in ms; null when not_found. */
  stripeCurrentPeriodEndMs: number | null
  nowMs: number
  graceMs: number
}

/**
 * The non-payment sweep's decision. Returns true ONLY for a genuinely lapsed,
 * non-paying, non-comped client that has a real Stripe subscription. Fails
 * closed toward "leave enabled" for every ambiguous case.
 *
 * Safety invariants (see reconcile.test.ts):
 *   - comped client            → never disable
 *   - manual client (null sub) → never disable
 *   - billing_status != active → never disable
 *   - paid-and-current sub     → never disable
 *   - within grace window      → never disable
 * Disable only when the subscription is gone, or not paid-and-current AND the
 * paid-through date has lapsed beyond grace.
 */
export function shouldDisableForLapse(i: LapseInput): boolean {
  if (i.isComped) return false
  if (i.billingStatus !== 'active') return false
  if (!i.stripeSubscriptionId) return false // manually-managed client — never touch

  // Subscription no longer exists in Stripe but our DB still says active → disable.
  if (i.stripeStatus === 'not_found') return true

  if (i.stripeCurrentPeriodEndMs == null) return false // can't confirm lapse → leave on

  // Still genuinely paid and covering the period → leave enabled.
  if (isPaidAndCurrent(i.stripeStatus, i.stripeCurrentPeriodEndMs, i.nowMs, i.graceMs)) {
    return false
  }

  // Still inside the paid-through date (+grace) → give the benefit of the doubt.
  if (i.stripeCurrentPeriodEndMs >= i.nowMs - i.graceMs) return false

  // Not paid-and-current AND the period has genuinely lapsed → disable.
  return true
}
