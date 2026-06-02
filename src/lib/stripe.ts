// Server-only Stripe client. Never import this from a Client Component —
// it reads STRIPE_SECRET_KEY. Used by billing-actions.ts and the webhook
// route handler.
import Stripe from 'stripe'

// Pinned explicitly, per spec. Stripe SDK v16's TypeScript types are
// generated against this exact API version, so the runtime response
// shape and the compile-time types stay in sync — notably
// `current_period_end` lives on the Subscription object here; newer API
// versions ("basil", 2025+) moved it onto subscription items.
export const STRIPE_API_VERSION = '2024-06-20' as const

let _stripe: Stripe | null = null

/**
 * Lazy Stripe singleton. Throws on first use (not at import time) if the
 * secret key is missing — mirrors getAdminClient() in supabase/admin.ts.
 *
 * Configured for the Cloudflare Workers runtime (the deploy target via
 * @opennextjs/cloudflare): the SDK's default Node `http` client isn't
 * available there, so we use Stripe's fetch-based HTTP client.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }

  _stripe = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  })
  return _stripe
}

let _cryptoProvider: Stripe.CryptoProvider | null = null

/**
 * SubtleCrypto-backed crypto provider for webhook signature verification.
 *
 * Required on the Workers runtime: `stripe.webhooks.constructEvent()` is
 * synchronous and depends on Node's `crypto`, which throws on Workers.
 * The webhook route must use `constructEventAsync()` with this provider.
 */
export function getStripeCryptoProvider(): Stripe.CryptoProvider {
  if (!_cryptoProvider) {
    _cryptoProvider = Stripe.createSubtleCryptoProvider()
  }
  return _cryptoProvider
}
