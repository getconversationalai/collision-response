// Stripe webhook handler — NOT a server action (webhooks need the raw
// request body for signature verification). Uses the service-role Supabase
// client; there is no user session on a webhook request.
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, getStripeCryptoProvider } from '@/lib/stripe'
import { getAdminClient } from '@/lib/supabase/admin'
import { reconcileDuplicatesForCustomer } from '@/lib/billing/stripe-ops'
import type { BillingStatus, PaymentStatus } from '@/lib/types'

// Webhooks are always dynamic — never cache or pre-render this route.
export const dynamic = 'force-dynamic'

type Admin = ReturnType<typeof getAdminClient>

type CompanyBillingRow = {
  id: string
  billing_status: BillingStatus
  is_comped: boolean
  stripe_subscription_id: string | null
}

const COMPANY_BILLING_COLUMNS =
  'id, billing_status, is_comped, stripe_subscription_id'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return new NextResponse('Missing Stripe signature or webhook secret', {
      status: 400,
    })
  }

  // 1. Verify the signature. This is the only thing between a random POST and
  //    someone disabling every client. `constructEventAsync` + a SubtleCrypto
  //    provider is required on the Cloudflare Workers runtime — the sync
  //    `constructEvent` depends on Node crypto and throws there.
  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      getStripeCryptoProvider()
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return new NextResponse(
      `Webhook signature verification failed: ${message}`,
      { status: 400 }
    )
  }

  // 2. Process. A thrown error returns 500 so Stripe retries; a clean run
  //    (including idempotent skips) returns 200.
  try {
    await handleEvent(stripe, event)
  } catch (err) {
    console.error(
      `[stripe-webhook] error handling ${event.type} (${event.id}):`,
      err
    )
    return new NextResponse('Webhook handler error', { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(stripe: Stripe, event: Stripe.Event) {
  const admin = getAdminClient()

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(stripe, admin, event)
      break
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(stripe, admin, event)
      break
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(admin, event)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(admin, event)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(admin, event)
      break
    default:
      // Not subscribed to other event types — ignore gracefully.
      break
  }
}

// ---------------------------------------------------------------------------
// Idempotency guard
// ---------------------------------------------------------------------------

/**
 * Inserts the payment_log row that doubles as the webhook idempotency guard.
 * The UNIQUE constraint on stripe_event_id makes a redelivered event fail
 * here with code 23505 — we treat that as "already processed" and skip the
 * rest of the handler (spec §4.2).
 *
 * Note: only the three payment events write payment_log. The two
 * `customer.subscription.*` events don't — they're naturally idempotent
 * (they only re-derive billing_status/is_active from the event, move no
 * money, and create no rows), so reprocessing them is harmless.
 */
async function recordPaymentEvent(
  admin: Admin,
  row: {
    companyId: string
    eventId: string
    invoiceId: string | null
    amountCents: number | null
    status: PaymentStatus
    failureReason: string | null
  }
): Promise<'new' | 'duplicate'> {
  const { error } = await admin.from('payment_log').insert({
    company_id: row.companyId,
    stripe_event_id: row.eventId,
    stripe_invoice_id: row.invoiceId,
    amount_cents: row.amountCents,
    status: row.status,
    failure_reason: row.failureReason,
  })
  if (error) {
    if (error.code === '23505') return 'duplicate'
    throw new Error(`payment_log insert failed: ${error.message}`)
  }
  return 'new'
}

// ---------------------------------------------------------------------------
// Company lookups
// ---------------------------------------------------------------------------

async function findCompanyByCustomer(
  admin: Admin,
  customerId: string
): Promise<CompanyBillingRow | null> {
  const { data, error } = await admin
    .from('collision_companies')
    .select(COMPANY_BILLING_COLUMNS)
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  // Surface a transient DB error (→ 500 → Stripe retry) instead of mistaking it
  // for "no such company" and silently dropping the event (finding MED-1).
  if (error) throw new Error(`company lookup by customer failed: ${error.message}`)
  return (data as CompanyBillingRow | null) ?? null
}

async function findCompanyBySubscription(
  admin: Admin,
  subscriptionId: string
): Promise<CompanyBillingRow | null> {
  const { data, error } = await admin
    .from('collision_companies')
    .select(COMPANY_BILLING_COLUMNS)
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (error) {
    throw new Error(`company lookup by subscription failed: ${error.message}`)
  }
  return (data as CompanyBillingRow | null) ?? null
}

function unixToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * checkout.session.completed — first payment succeeded.
 * Activate the client and persist the subscription id + period end.
 */
async function handleCheckoutCompleted(
  stripe: Stripe,
  admin: Admin,
  event: Stripe.Event
) {
  const session = event.data.object as Stripe.Checkout.Session
  const companyId = session.metadata?.company_id
  if (!companyId) {
    console.warn(
      `[stripe-webhook] checkout.session.completed ${event.id} has no company_id metadata`
    )
    return
  }

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null

  // Self-heal duplicate subscriptions BEFORE the idempotency guard's early
  // return, so a Stripe event redelivery still reconciles (finding C2). This is
  // idempotent (a customer with a single subscription cancels nothing) and
  // best-effort (never fails the webhook). It keeps the canonical subscription
  // and cancels + refunds any duplicate the single-flight checkout didn't stop
  // (finding H2). This — not the checkout guard alone — is what makes
  // "at most one charge per month" hold.
  let canonicalSubId: string | null = null
  let unresolvedDuplicates: string[] = []
  if (customerId) {
    try {
      const result = await reconcileDuplicatesForCustomer(stripe, customerId, {
        refundDuplicates: true,
      })
      canonicalSubId = result.kept
      // A duplicate that couldn't be canceled OR couldn't be refunded is
      // unresolved — both must drive the retry so no double-charge is left
      // uncorrected (review NEW finding).
      unresolvedDuplicates = [...result.failedToCancel, ...result.failedToRefund]
      if (result.hadDuplicates) {
        console.warn(
          `[stripe-webhook] reconciled duplicate subscriptions for customer ${customerId}: ${JSON.stringify(result)}`
        )
      }
    } catch (err) {
      console.error(
        `[stripe-webhook] duplicate reconcile failed (non-fatal) for customer ${customerId}:`,
        err
      )
    }
  }

  // Idempotency guard for the payment record + state mutation.
  const guard = await recordPaymentEvent(admin, {
    companyId,
    eventId: event.id,
    invoiceId:
      typeof session.invoice === 'string'
        ? session.invoice
        : session.invoice?.id ?? null,
    amountCents: session.amount_total,
    status: 'succeeded',
    failureReason: null,
  })
  if (guard === 'duplicate') {
    // Activation already happened on the first delivery. The reconcile above
    // still ran on this redelivery (retrying any stuck cancel/refund), so keep
    // driving retries from the duplicate path too — otherwise the retry throw
    // below is unreachable on redelivery (finding MED-2).
    forceRetryIfUnresolved(event, companyId, unresolvedDuplicates)
    return
  }

  // Prefer the subscription the reconcile kept over the session's own, so we
  // never persist a subscription we just canceled as a duplicate.
  const sessionSubId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null
  const subscriptionId = canonicalSubId ?? sessionSubId

  // The session itself has no period end — retrieve the subscription for it.
  let currentPeriodEnd: string | null = null
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    currentPeriodEnd = unixToIso(subscription.current_period_end)
  }

  const { error } = await admin
    .from('collision_companies')
    .update({
      billing_status: 'active',
      is_active: true,
      stripe_subscription_id: subscriptionId,
      current_period_end: currentPeriodEnd,
      last_payment_failed_at: null,
      // Clear the single-flight hold now that checkout has completed.
      pending_checkout_session_id: null,
      pending_checkout_expires_at: null,
    })
    .eq('id', companyId)
  if (error) throw new Error(error.message)

  // Activation above is persisted and idempotent. If a duplicate is still
  // unresolved, fail now so Stripe redelivers and the reconcile retries — on
  // redelivery the payment_log guard short-circuits re-activation, so a paying
  // client is never held hostage (finding MED-2).
  forceRetryIfUnresolved(event, companyId, unresolvedDuplicates)
}

// How long to keep forcing Stripe redeliveries for an unresolved duplicate
// before giving up and leaving it to the admin reconcile backstop. Bounds the
// 500-retry loop so a permanently-stuck event can't fail forever (which risks
// Stripe disabling the endpoint).
const DUPLICATE_RETRY_WINDOW_MS = 2 * 60 * 60 * 1000 // 2 hours

/**
 * Throw (→ 500 → Stripe redelivery) while a duplicate subscription remains
 * uncanceled/unrefunded, but only within a bounded window from the event's
 * creation. Past the window, log a loud alert and let the request succeed so
 * the endpoint stays healthy; the admin reconcile is the final backstop.
 */
function forceRetryIfUnresolved(
  event: Stripe.Event,
  companyId: string,
  unresolved: string[]
): void {
  if (unresolved.length === 0) return
  const ageMs = Date.now() - event.created * 1000
  if (ageMs > DUPLICATE_RETRY_WINDOW_MS) {
    console.error(
      `[stripe-webhook] ALERT: giving up retrying unresolved duplicate ` +
        `subscription(s) for company ${companyId} after ${Math.round(ageMs / 60000)}m: ` +
        `${unresolved.join(', ')} — needs admin reconcile`
    )
    return
  }
  throw new Error(
    `unresolved duplicate subscription(s) for company ${companyId}: ` +
      `${unresolved.join(', ')} — forcing retry`
  )
}

/**
 * invoice.payment_succeeded — a recurring (or first) payment cleared.
 * Refresh the period end; if the client was past_due, reactivate them.
 */
async function handleInvoicePaymentSucceeded(
  stripe: Stripe,
  admin: Admin,
  event: Stripe.Event
) {
  const invoice = event.data.object as Stripe.Invoice
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id ?? null
  if (!customerId) return

  const company = await findCompanyByCustomer(admin, customerId)
  if (!company) {
    console.warn(
      `[stripe-webhook] invoice.payment_succeeded ${event.id}: no company for customer ${customerId}`
    )
    return
  }

  // Idempotency guard. (On the very first payment this and
  // checkout.session.completed each log a row — distinct event ids, so
  // both are kept. That's an intentionally redundant audit entry, not a bug.)
  const guard = await recordPaymentEvent(admin, {
    companyId: company.id,
    eventId: event.id,
    invoiceId: invoice.id,
    amountCents: invoice.amount_paid,
    status: 'succeeded',
    failureReason: null,
  })
  if (guard === 'duplicate') return

  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id ?? null

  let currentPeriodEnd: string | null = null
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    currentPeriodEnd = unixToIso(subscription.current_period_end)
  }

  const update: Record<string, string | boolean | null> = {
    last_payment_failed_at: null,
  }
  if (currentPeriodEnd) update.current_period_end = currentPeriodEnd
  if (subscriptionId) update.stripe_subscription_id = subscriptionId
  // A recovered payment flips a past_due client back on (spec §3.4).
  // The `=== 'past_due'` check naturally leaves comped/canceled clients alone.
  if (company.billing_status === 'past_due') {
    update.billing_status = 'active'
    update.is_active = true
  }

  const { error } = await admin
    .from('collision_companies')
    .update(update)
    .eq('id', company.id)
  if (error) throw new Error(error.message)
}

/**
 * invoice.payment_failed — INSTANT DISABLE. No retries, no grace period.
 */
async function handleInvoicePaymentFailed(admin: Admin, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id ?? null
  if (!customerId) return

  const company = await findCompanyByCustomer(admin, customerId)
  if (!company) {
    console.warn(
      `[stripe-webhook] invoice.payment_failed ${event.id}: no company for customer ${customerId}`
    )
    return
  }

  const failureReason =
    invoice.last_finalization_error?.message ??
    'Payment failed — the card was declined or could not be charged.'

  const guard = await recordPaymentEvent(admin, {
    companyId: company.id,
    eventId: event.id,
    invoiceId: invoice.id,
    amountCents: invoice.amount_due,
    status: 'failed',
    failureReason,
  })
  if (guard === 'duplicate') return

  const { error } = await admin
    .from('collision_companies')
    .update({
      billing_status: 'past_due',
      is_active: false,
      last_payment_failed_at: new Date().toISOString(),
    })
    .eq('id', company.id)
  if (error) throw new Error(error.message)

  notifyPaymentFailed(company.id, failureReason)
}

/**
 * customer.subscription.deleted — the subscription ended.
 */
async function handleSubscriptionDeleted(admin: Admin, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const company = await findCompanyBySubscription(admin, subscription.id)
  // No match → stale subscription (e.g. an un-comped client has since moved
  // to a new subscription). Nothing to do — this is the guard that stops an
  // old winding-down subscription from disabling a re-subscribed client.
  if (!company) return

  // Comped clients keep SMS even when their old paid subscription ends —
  // just drop the now-dead subscription pointer.
  if (company.is_comped || company.billing_status === 'comped') {
    const { error } = await admin
      .from('collision_companies')
      .update({ stripe_subscription_id: null, current_period_end: null })
      .eq('id', company.id)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await admin
    .from('collision_companies')
    .update({
      billing_status: 'canceled',
      is_active: false,
      stripe_subscription_id: null,
      current_period_end: null,
    })
    .eq('id', company.id)
  if (error) throw new Error(error.message)
}

/**
 * customer.subscription.updated — refresh period end; disable on a
 * canceled/unpaid status.
 */
async function handleSubscriptionUpdated(admin: Admin, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const company = await findCompanyBySubscription(admin, subscription.id)
  if (!company) return

  // Never let a winding-down subscription override a comped client.
  if (company.is_comped || company.billing_status === 'comped') return

  const update: Record<string, string | boolean | null> = {
    current_period_end: unixToIso(subscription.current_period_end),
  }

  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    update.is_active = false
    update.billing_status =
      subscription.status === 'canceled' ? 'canceled' : 'past_due'
  }

  const { error } = await admin
    .from('collision_companies')
    .update(update)
    .eq('id', company.id)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * Payment-failure notification stub (spec §3.6).
 *
 * Decision (confirmed with the operator): no email/SMS provider is wired up
 * in this app yet, so the user-facing signal is the red dashboard banner,
 * driven by billing_status='past_due'. When a sender is added, dispatch it
 * from here — fire-and-forget, never awaited, so the webhook still returns
 * in well under 5s.
 */
function notifyPaymentFailed(companyId: string, reason: string): void {
  console.info(
    `[stripe-webhook] payment failed for company ${companyId}: ${reason} ` +
      `(notification deferred — dashboard banner only)`
  )
}
