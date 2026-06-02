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
