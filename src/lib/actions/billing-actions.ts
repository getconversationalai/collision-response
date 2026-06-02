'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'
import { verifyAdmin } from '@/lib/actions/admin-actions'
import { getStripe } from '@/lib/stripe'
import type Stripe from 'stripe'
import type { BillingStatus, CollisionCompany, PaymentLog } from '@/lib/types'

// ---------------------------------------------------------------------------
// Auth helpers — mirrors src/lib/actions/admin-actions.ts intentionally.
// `getCurrentUserId` is re-implemented here because it isn't exported there;
// `verifyAdmin` IS exported and is reused directly for the admin actions.
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Server actions don't need to set cookies for reads
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function requireAdmin() {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) throw new Error('Unauthorized: admin access required')
}

/**
 * Resolves the authenticated user to their own collision_companies row.
 * Client-facing billing actions derive the company from the session, so a
 * caller can never act on a company that isn't theirs (ownership is implicit,
 * not passed as an argument).
 */
async function getCurrentCompany(): Promise<CollisionCompany> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Unauthorized: you must be signed in')

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('collision_companies')
    .select('*')
    .eq('auth_user_id', userId)
    .single()

  if (error || !data) throw new Error('No company is linked to your account')
  return data as unknown as CollisionCompany
}

// ---------------------------------------------------------------------------
// Config / pricing helpers
// ---------------------------------------------------------------------------

function getProductId(): string {
  const id = process.env.STRIPE_PRODUCT_ID
  if (!id) throw new Error('Missing STRIPE_PRODUCT_ID environment variable')
  return id
}

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable')
  return url.replace(/\/$/, '')
}

async function getSystemDefaultPriceCents(): Promise<number> {
  const admin = getAdminClient()
  const { data } = await admin
    .from('system_settings')
    .select('default_monthly_price_cents')
    .eq('id', 1)
    .single()
  return (
    (data as { default_monthly_price_cents: number } | null)
      ?.default_monthly_price_cents ?? 5000
  )
}

/** Per-client override if set, otherwise the system default. */
function effectivePriceCents(
  company: Pick<CollisionCompany, 'monthly_price_cents'>,
  systemDefault: number
): number {
  return company.monthly_price_cents ?? systemDefault
}

function assertValidPriceCents(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    throw new Error(
      'Price must be a whole number of cents between 0 and 1,000,000 ($10,000)'
    )
  }
}

/**
 * Ensures the company has a Stripe Customer, creating + persisting one on
 * first use. Idempotency key keyed on company id so a double-submit can't
 * spawn two customers.
 */
async function ensureStripeCustomer(company: CollisionCompany): Promise<string> {
  if (company.stripe_customer_id) return company.stripe_customer_id

  const stripe = getStripe()
  const customer = await stripe.customers.create(
    {
      email: company.email ?? undefined,
      name: company.company_name,
      metadata: { company_id: company.id },
    },
    { idempotencyKey: `customer-${company.id}` }
  )

  const admin = getAdminClient()
  const { error } = await admin
    .from('collision_companies')
    .update({ stripe_customer_id: customer.id })
    .eq('id', company.id)
  if (error) throw new Error(`Failed to save Stripe customer: ${error.message}`)

  return customer.id
}

/**
 * Creates a fresh recurring monthly Price under the single shared Product.
 * Stripe Prices are immutable, so every price change is a new Price object
 * (per spec §3.2).
 */
async function createMonthlyPrice(
  priceCents: number,
  companyId: string
): Promise<string> {
  const stripe = getStripe()
  const price = await stripe.prices.create({
    product: getProductId(),
    currency: 'usd',
    unit_amount: priceCents,
    recurring: { interval: 'month' },
    metadata: { company_id: companyId },
  })
  return price.id
}

export type PaymentMethodSummary = {
  brand: string // 'visa', 'mastercard', ...
  last4: string
  expMonth: number
  expYear: number
}

/** Best-effort "card on file" summary for the billing page. */
async function getCardForCustomer(
  stripe: Stripe,
  customerId: string
): Promise<PaymentMethodSummary | null> {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null

  let pm: Stripe.PaymentMethod | null = null
  const defaultPm = customer.invoice_settings?.default_payment_method
  if (typeof defaultPm === 'string') {
    pm = await stripe.paymentMethods.retrieve(defaultPm)
  } else if (defaultPm) {
    pm = defaultPm
  } else {
    // No default set yet — fall back to the most recent card on the customer.
    const list = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 1,
    })
    pm = list.data[0] ?? null
  }

  if (!pm?.card) return null
  return {
    brand: pm.card.brand,
    last4: pm.card.last4,
    expMonth: pm.card.exp_month,
    expYear: pm.card.exp_year,
  }
}

// ---------------------------------------------------------------------------
// Client-facing actions
// ---------------------------------------------------------------------------

/**
 * Creates a Stripe Checkout session for initial card capture + first charge.
 * The DB is NOT updated here — the `checkout.session.completed` webhook is the
 * source of truth (spec §4). Returns the hosted Checkout URL to redirect to.
 */
export async function createCheckoutSession(): Promise<{ url: string }> {
  const company = await getCurrentCompany()

  if (company.is_comped || company.billing_status === 'comped') {
    throw new Error('Your account is comped — no card is required.')
  }
  if (company.billing_status === 'active') {
    throw new Error(
      'Billing is already active. Use "Update card" to change your payment method.'
    )
  }

  const systemDefault = await getSystemDefaultPriceCents()
  const priceCents = effectivePriceCents(company, systemDefault)
  if (priceCents <= 0) {
    throw new Error(
      'No payment is required for your account. Contact your administrator if SMS is not active.'
    )
  }

  const stripe = getStripe()
  const customerId = await ensureStripeCustomer(company)
  const priceId = await createMonthlyPrice(priceCents, company.id)
  const appUrl = getAppUrl()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { company_id: company.id } },
    metadata: { company_id: company.id },
    success_url: `${appUrl}/billing?checkout=success`,
    cancel_url: `${appUrl}/dashboard?checkout=canceled`,
  })

  if (!session.url) throw new Error('Stripe did not return a Checkout URL')
  return { url: session.url }
}

/**
 * Creates a Stripe Customer Portal session so the client can update their
 * card or cancel. Returns the hosted Portal URL to redirect to.
 */
export async function createPortalSession(): Promise<{ url: string }> {
  const company = await getCurrentCompany()
  if (!company.stripe_customer_id) {
    throw new Error('No billing account yet — add a card first.')
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: company.stripe_customer_id,
    return_url: `${getAppUrl()}/billing`,
  })
  return { url: session.url }
}

export type BillingState = {
  companyId: string
  billingStatus: BillingStatus
  isComped: boolean
  isActive: boolean
  currentPeriodEnd: string | null
  lastPaymentFailedAt: string | null
  priceCents: number // effective monthly price (override ?? system default)
  isPriceOverridden: boolean // true when a per-client override is set
  hasStripeCustomer: boolean
  payments: PaymentLog[] // most recent 12, newest first
}

/** Builds the BillingState from an already-loaded company row (no Stripe calls). */
async function loadBillingState(company: CollisionCompany): Promise<BillingState> {
  const admin = getAdminClient()
  const [paymentsRes, systemDefault] = await Promise.all([
    admin
      .from('payment_log')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(12),
    getSystemDefaultPriceCents(),
  ])

  return {
    companyId: company.id,
    billingStatus: company.billing_status,
    isComped: company.is_comped,
    isActive: company.is_active,
    currentPeriodEnd: company.current_period_end,
    lastPaymentFailedAt: company.last_payment_failed_at,
    priceCents: effectivePriceCents(company, systemDefault),
    isPriceOverridden: company.monthly_price_cents !== null,
    hasStripeCustomer: company.stripe_customer_id !== null,
    payments: (paymentsRes.data ?? []) as unknown as PaymentLog[],
  }
}

/**
 * Client-facing billing snapshot. Hits only the DB (no Stripe round-trip) so
 * it's cheap enough for the dashboard banner on every load.
 */
export async function getBillingState(): Promise<BillingState> {
  const company = await getCurrentCompany()
  return loadBillingState(company)
}

export type BillingPageData = {
  state: BillingState
  paymentMethod: PaymentMethodSummary | null
  cancelAtPeriodEnd: boolean // subscription is set to end at current_period_end
}

/**
 * Richer payload for the dedicated /billing page — adds the card on file and
 * the cancel-at-period-end flag, both of which require Stripe API calls.
 */
export async function getBillingPageData(): Promise<BillingPageData> {
  const company = await getCurrentCompany()
  const state = await loadBillingState(company)

  let paymentMethod: PaymentMethodSummary | null = null
  let cancelAtPeriodEnd = false

  if (company.stripe_customer_id || company.stripe_subscription_id) {
    const stripe = getStripe()
    if (company.stripe_customer_id) {
      paymentMethod = await getCardForCustomer(stripe, company.stripe_customer_id)
    }
    if (company.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(
          company.stripe_subscription_id
        )
        cancelAtPeriodEnd = sub.cancel_at_period_end
      } catch {
        // Subscription may have already been deleted on Stripe's side.
        cancelAtPeriodEnd = false
      }
    }
  }

  return { state, paymentMethod, cancelAtPeriodEnd }
}

/**
 * Client-facing "Cancel subscription". Does NOT cancel immediately — sets
 * cancel_at_period_end so the client keeps service through the period they
 * already paid for (spec §3.5). The webhook handles the eventual deletion.
 */
export async function cancelSubscriptionAtPeriodEnd(): Promise<{
  success: true
  periodEnd: string | null
}> {
  const company = await getCurrentCompany()
  if (!company.stripe_subscription_id) {
    throw new Error('No active subscription to cancel.')
  }

  const stripe = getStripe()
  const sub = await stripe.subscriptions.update(
    company.stripe_subscription_id,
    { cancel_at_period_end: true },
    {
      idempotencyKey: `cancel-ape-${company.id}-${company.stripe_subscription_id}`,
    }
  )

  return {
    success: true,
    periodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
  }
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

/**
 * Sets (or clears, with null) a per-client price override.
 *
 * If the client has a live Stripe subscription and the effective amount
 * changed, a new immutable Price is created and the subscription item is
 * swapped with `proration_behavior='create_prorations'`. Per spec §4 the
 * local DB column is only updated AFTER the Stripe call succeeds, so a
 * Stripe outage leaves our DB consistent.
 *
 * Note on $0: passing 0 makes the subscription a $0 (free) recurring price —
 * valid in Stripe, never charges. To activate a client who has never added a
 * card without payment, use `adminCompClient` instead.
 */
export async function adminSetClientPrice(
  companyId: string,
  priceCents: number | null
): Promise<{ success: true; prorated: boolean }> {
  await requireAdmin()
  if (priceCents !== null) assertValidPriceCents(priceCents)

  const admin = getAdminClient()
  const { data: companyRow, error: loadError } = await admin
    .from('collision_companies')
    .select('*')
    .eq('id', companyId)
    .single()
  if (loadError || !companyRow) throw new Error('Company not found')
  const company = companyRow as unknown as CollisionCompany

  const systemDefault = await getSystemDefaultPriceCents()
  const oldEffective = effectivePriceCents(company, systemDefault)
  const newEffective = priceCents ?? systemDefault

  let prorated = false

  if (company.stripe_subscription_id && newEffective !== oldEffective) {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(
      company.stripe_subscription_id
    )
    const itemId = subscription.items.data[0]?.id
    if (!itemId) throw new Error('Stripe subscription has no items to update')

    const newPriceId = await createMonthlyPrice(newEffective, company.id)
    await stripe.subscriptions.update(
      company.stripe_subscription_id,
      {
        items: [{ id: itemId, price: newPriceId }],
        proration_behavior: 'create_prorations',
      },
      { idempotencyKey: `setprice-${company.id}-${newPriceId}` }
    )
    prorated = true
  }

  const { error: updateError } = await admin
    .from('collision_companies')
    .update({ monthly_price_cents: priceCents })
    .eq('id', companyId)
  if (updateError) throw new Error(updateError.message)

  return { success: true, prorated }
}

/**
 * Updates the global default monthly price. Does NOT retroactively re-price
 * existing subscriptions — only new checkouts and clients without an override
 * pick up the new default (spec §3.3).
 */
export async function adminSetSystemDefaultPrice(
  priceCents: number
): Promise<{ success: true }> {
  await requireAdmin()
  assertValidPriceCents(priceCents)

  const admin = getAdminClient()
  const { error } = await admin
    .from('system_settings')
    .update({ default_monthly_price_cents: priceCents })
    .eq('id', 1)
  if (error) throw new Error(error.message)

  return { success: true }
}

/**
 * Comps / un-comps a client.
 *
 * Comp: cancels any live Stripe subscription AT PERIOD END (operator's
 * choice — the client keeps service they already paid for, then the comp
 * takes over), and sets is_comped=true, billing_status='comped', is_active=true.
 *
 * Un-comp: the client must re-add a card before SMS resumes — sets
 * billing_status='pending', is_active=false, and clears the Stripe
 * subscription pointer so a still-winding-down subscription's eventual
 * `customer.subscription.deleted` webhook can't disable a re-subscribed client.
 */
export async function adminCompClient(
  companyId: string,
  isComped: boolean
): Promise<{ success: true }> {
  await requireAdmin()

  const admin = getAdminClient()
  const { data: companyRow, error: loadError } = await admin
    .from('collision_companies')
    .select('*')
    .eq('id', companyId)
    .single()
  if (loadError || !companyRow) throw new Error('Company not found')
  const company = companyRow as unknown as CollisionCompany

  if (isComped) {
    if (company.stripe_subscription_id) {
      const stripe = getStripe()
      await stripe.subscriptions.update(
        company.stripe_subscription_id,
        { cancel_at_period_end: true },
        {
          idempotencyKey: `comp-cancel-${company.id}-${company.stripe_subscription_id}`,
        }
      )
    }

    const { error } = await admin
      .from('collision_companies')
      .update({ is_comped: true, billing_status: 'comped', is_active: true })
      .eq('id', companyId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin
      .from('collision_companies')
      .update({
        is_comped: false,
        billing_status: 'pending',
        is_active: false,
        stripe_subscription_id: null,
        current_period_end: null,
      })
      .eq('id', companyId)
    if (error) throw new Error(error.message)
  }

  return { success: true }
}

export type AdminClientBilling = {
  billingStatus: BillingStatus
  isComped: boolean
  isActive: boolean
  monthlyPriceCents: number | null // per-client override (null = uses default)
  defaultPriceCents: number
  effectivePriceCents: number
  currentPeriodEnd: string | null
  lastPaymentFailedAt: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  payments: PaymentLog[] // most recent 12, newest first
}

/** Admin: full billing detail for one client (drives the client-detail page). */
export async function adminGetClientBilling(
  companyId: string
): Promise<AdminClientBilling> {
  await requireAdmin()
  const admin = getAdminClient()

  const [companyRes, paymentsRes, systemDefault] = await Promise.all([
    admin.from('collision_companies').select('*').eq('id', companyId).single(),
    admin
      .from('payment_log')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(12),
    getSystemDefaultPriceCents(),
  ])

  if (companyRes.error || !companyRes.data) throw new Error('Company not found')
  const company = companyRes.data as unknown as CollisionCompany

  return {
    billingStatus: company.billing_status,
    isComped: company.is_comped,
    isActive: company.is_active,
    monthlyPriceCents: company.monthly_price_cents,
    defaultPriceCents: systemDefault,
    effectivePriceCents: company.monthly_price_cents ?? systemDefault,
    currentPeriodEnd: company.current_period_end,
    lastPaymentFailedAt: company.last_payment_failed_at,
    stripeCustomerId: company.stripe_customer_id,
    stripeSubscriptionId: company.stripe_subscription_id,
    payments: (paymentsRes.data ?? []) as unknown as PaymentLog[],
  }
}

export type AdminBillingOverview = {
  defaultPriceCents: number
  mrrCents: number // sum of effective price across billing_status='active'
  statusCounts: Record<BillingStatus, number>
  recentFailedPayments: Array<{
    id: string
    company_id: string
    company_name: string | null
    amount_cents: number | null
    failure_reason: string | null
    created_at: string
  }>
}

/** Admin: system-wide billing stats for /admin/billing. */
export async function getAdminBillingOverview(): Promise<AdminBillingOverview> {
  await requireAdmin()
  const admin = getAdminClient()

  const [companiesRes, settingsRes, failedRes] = await Promise.all([
    admin.from('collision_companies').select('billing_status, monthly_price_cents'),
    admin
      .from('system_settings')
      .select('default_monthly_price_cents')
      .eq('id', 1)
      .single(),
    admin
      .from('payment_log')
      .select(
        'id, company_id, amount_cents, failure_reason, created_at, collision_companies(company_name)'
      )
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const defaultPriceCents =
    (settingsRes.data as { default_monthly_price_cents: number } | null)
      ?.default_monthly_price_cents ?? 5000

  const companies = (companiesRes.data ?? []) as unknown as Array<{
    billing_status: BillingStatus
    monthly_price_cents: number | null
  }>

  const statusCounts: Record<BillingStatus, number> = {
    pending: 0,
    active: 0,
    past_due: 0,
    canceled: 0,
    comped: 0,
  }
  let mrrCents = 0
  for (const c of companies) {
    statusCounts[c.billing_status] = (statusCounts[c.billing_status] ?? 0) + 1
    if (c.billing_status === 'active') {
      mrrCents += c.monthly_price_cents ?? defaultPriceCents
    }
  }

  const failedRows = (failedRes.data ?? []) as unknown as Array<{
    id: string
    company_id: string
    amount_cents: number | null
    failure_reason: string | null
    created_at: string
    collision_companies: { company_name: string } | null
  }>

  const recentFailedPayments = failedRows.map((row) => ({
    id: row.id,
    company_id: row.company_id,
    company_name: row.collision_companies?.company_name ?? null,
    amount_cents: row.amount_cents,
    failure_reason: row.failure_reason,
    created_at: row.created_at,
  }))

  return { defaultPriceCents, mrrCents, statusCounts, recentFailedPayments }
}
