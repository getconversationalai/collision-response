import { test, expect } from 'vitest'
import {
  isLiveSubscriptionStatus,
  isPaidAndCurrent,
  isSameBurstDuplicate,
  selectCanonicalSubscription,
  shouldDisableForLapse,
  type SubSummary,
  type LapseInput,
} from './reconcile'

const DAY = 24 * 60 * 60 * 1000
const GRACE = DAY
const NOW = Date.parse('2026-09-08T00:00:00Z')

// ---------------------------------------------------------------------------
// isLiveSubscriptionStatus
// ---------------------------------------------------------------------------
test('live statuses are recognized; dead ones are not', () => {
  for (const s of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'] as const) {
    expect(isLiveSubscriptionStatus(s)).toBe(true)
  }
  for (const s of ['canceled', 'incomplete_expired'] as const) {
    expect(isLiveSubscriptionStatus(s)).toBe(false)
  }
})

// ---------------------------------------------------------------------------
// selectCanonicalSubscription — must NEVER cancel a paid sub for an incomplete one
// ---------------------------------------------------------------------------
function sub(id: string, status: SubSummary['status'], created: number): SubSummary {
  return { id, status, created, currentPeriodEnd: created + 30 * 86400 }
}

test('keeps the earliest ACTIVE and cancels later duplicates', () => {
  const r = selectCanonicalSubscription([
    sub('a', 'active', 100),
    sub('b', 'active', 200),
  ])
  expect(r.keep).toBe('a')
  expect(r.cancel).toEqual(['b'])
})

test('C3: keeps the ACTIVE sub even when an INCOMPLETE one was created earlier', () => {
  const r = selectCanonicalSubscription([
    sub('early-incomplete', 'incomplete', 100),
    sub('later-active', 'active', 200),
  ])
  expect(r.keep).toBe('later-active')
  expect(r.cancel).toEqual(['early-incomplete'])
})

test('single live sub is kept, nothing canceled', () => {
  const r = selectCanonicalSubscription([sub('only', 'active', 100)])
  expect(r.keep).toBe('only')
  expect(r.cancel).toEqual([])
})

test('no live subs → keep null, cancel none (dead subs are ignored)', () => {
  const r = selectCanonicalSubscription([
    sub('x', 'canceled', 100),
    sub('y', 'incomplete_expired', 200),
  ])
  expect(r.keep).toBeNull()
  expect(r.cancel).toEqual([])
})

test('ranks paid states above incomplete when several coexist', () => {
  const r = selectCanonicalSubscription([
    sub('inc', 'incomplete', 50),
    sub('pastdue', 'past_due', 60),
    sub('active', 'active', 70),
  ])
  expect(r.keep).toBe('active')
  expect(new Set(r.cancel)).toEqual(new Set(['inc', 'pastdue']))
})

// ---------------------------------------------------------------------------
// isPaidAndCurrent
// ---------------------------------------------------------------------------
test('paid-and-current only for active/trialing within the covered period', () => {
  const future = NOW + 10 * DAY
  const pastLapsed = NOW - 10 * DAY
  expect(isPaidAndCurrent('active', future, NOW, GRACE)).toBe(true)
  expect(isPaidAndCurrent('trialing', future, NOW, GRACE)).toBe(true)
  expect(isPaidAndCurrent('past_due', future, NOW, GRACE)).toBe(false)
  expect(isPaidAndCurrent('active', pastLapsed, NOW, GRACE)).toBe(false)
})

// ---------------------------------------------------------------------------
// shouldDisableForLapse — the safety net. Must NEVER disable comped / manual / current.
// ---------------------------------------------------------------------------
function lapse(over: Partial<LapseInput>): LapseInput {
  return {
    billingStatus: 'active',
    isComped: false,
    stripeSubscriptionId: 'sub_1',
    stripeStatus: 'past_due',
    stripeCurrentPeriodEndMs: NOW - 10 * DAY,
    nowMs: NOW,
    graceMs: GRACE,
    ...over,
  }
}

test('NEVER disables a comped client', () => {
  expect(shouldDisableForLapse(lapse({ isComped: true }))).toBe(false)
})

test('NEVER disables a manually-managed client (null subscription) — the Collision-on-the-go case', () => {
  expect(
    shouldDisableForLapse(
      lapse({ stripeSubscriptionId: null, stripeStatus: 'not_found', stripeCurrentPeriodEndMs: null })
    )
  ).toBe(false)
})

test('NEVER disables a client whose billing_status is not active', () => {
  expect(shouldDisableForLapse(lapse({ billingStatus: 'pending' }))).toBe(false)
  expect(shouldDisableForLapse(lapse({ billingStatus: 'comped' }))).toBe(false)
})

test('NEVER disables a paid, current subscription', () => {
  expect(
    shouldDisableForLapse(lapse({ stripeStatus: 'active', stripeCurrentPeriodEndMs: NOW + 10 * DAY }))
  ).toBe(false)
})

test('NEVER disables while still inside the grace window', () => {
  expect(
    shouldDisableForLapse(lapse({ stripeStatus: 'past_due', stripeCurrentPeriodEndMs: NOW - 1000 }))
  ).toBe(false)
})

test('H3: DOES disable a genuinely lapsed past_due non-payer', () => {
  expect(shouldDisableForLapse(lapse({ stripeStatus: 'past_due' }))).toBe(true)
})

test('DOES disable a lapsed unpaid / incomplete subscription', () => {
  expect(shouldDisableForLapse(lapse({ stripeStatus: 'unpaid' }))).toBe(true)
  expect(shouldDisableForLapse(lapse({ stripeStatus: 'incomplete' }))).toBe(true)
})

test('DOES disable when the subscription is gone from Stripe but DB still active', () => {
  expect(
    shouldDisableForLapse(lapse({ stripeStatus: 'not_found', stripeCurrentPeriodEndMs: null }))
  ).toBe(true)
})

// ---------------------------------------------------------------------------
// isSameBurstDuplicate — auto-refund only same-signup-burst duplicates (MED-3)
// ---------------------------------------------------------------------------
test('same-burst duplicate (created seconds apart) is auto-refundable', () => {
  expect(isSameBurstDuplicate(1000, 1005, 3600)).toBe(true)
})

test('a genuinely older subscription is NOT auto-refunded', () => {
  const twoDays = 2 * 24 * 60 * 60
  expect(isSameBurstDuplicate(1000, 1000 + twoDays, 3600)).toBe(false)
})
