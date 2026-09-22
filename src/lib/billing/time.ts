// Convert Stripe unix-seconds timestamps to ISO strings. Returns null (never
// throws) for a missing/invalid value: newer Stripe API versions ("basil",
// 2025+) omit current_period_end from the raw Subscription object, so a webhook
// payload can hand us `undefined` — and `new Date(undefined * 1000)` is an
// Invalid Date whose .toISOString() throws a RangeError, which would 500 the
// whole webhook. Fail soft to null instead.
export function unixSecondsToIso(
  seconds: number | null | undefined
): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null
  return new Date(seconds * 1000).toISOString()
}
