import { test, expect } from 'vitest'
import { resolveActivation } from './provisioning'

test('comp path → active comped fields', () => {
  const r = resolveActivation({ comp: true, priceCents: 0, defaultPriceCents: 5000 })
  expect(r).toEqual({
    is_active: true,
    is_comped: true,
    billing_status: 'comped',
    monthly_price_cents: null,
  })
})

test('pay path → pending fields with chosen price', () => {
  const r = resolveActivation({ comp: false, priceCents: 7500, defaultPriceCents: 5000 })
  expect(r).toEqual({
    is_active: false,
    is_comped: false,
    billing_status: 'pending',
    monthly_price_cents: 7500,
  })
})

test('pay path with no explicit price falls back to default', () => {
  const r = resolveActivation({ comp: false, priceCents: null, defaultPriceCents: 5000 })
  expect(r.monthly_price_cents).toBe(5000)
  expect(r.billing_status).toBe('pending')
})

test('pay path rejects non-positive price', () => {
  expect(() => resolveActivation({ comp: false, priceCents: 0, defaultPriceCents: 5000 }))
    .toThrow(/price/i)
  expect(() => resolveActivation({ comp: false, priceCents: -100, defaultPriceCents: 5000 }))
    .toThrow(/price/i)
})

test('pay path rejects non-integer price', () => {
  expect(() => resolveActivation({ comp: false, priceCents: 12.5, defaultPriceCents: 5000 }))
    .toThrow(/price/i)
})
