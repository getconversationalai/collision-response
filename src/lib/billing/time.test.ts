import { test, expect } from 'vitest'
import { unixSecondsToIso } from './time'

test('converts valid unix seconds to an ISO string', () => {
  expect(unixSecondsToIso(1757422800)).toBe('2025-09-09T13:00:00.000Z')
})

// The regression: a subscription.updated payload from a newer Stripe API
// version omits current_period_end → undefined. This must NOT throw (that was
// the RangeError that 500'd the webhook on every event).
test('returns null for undefined instead of throwing', () => {
  expect(() => unixSecondsToIso(undefined)).not.toThrow()
  expect(unixSecondsToIso(undefined)).toBeNull()
})

test('returns null for null and NaN', () => {
  expect(unixSecondsToIso(null)).toBeNull()
  expect(unixSecondsToIso(NaN)).toBeNull()
})
