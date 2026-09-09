import { test, expect } from 'vitest'
import { dedupePaymentsByInvoice } from './payments'

type Row = { stripe_invoice_id: string | null; status: string; created_at: string }
const row = (id: string | null, status: string, created_at: string): Row => ({
  stripe_invoice_id: id,
  status,
  created_at,
})

test('collapses two succeeded rows for the SAME invoice into one (the first-seen)', () => {
  const out = dedupePaymentsByInvoice([
    row('in_1', 'succeeded', 'b'),
    row('in_1', 'succeeded', 'a'),
  ])
  expect(out).toHaveLength(1)
  expect(out[0].created_at).toBe('b') // order preserved, first-seen kept
})

test('keeps a failed and a later succeeded for the same invoice (different status)', () => {
  const out = dedupePaymentsByInvoice([
    row('in_1', 'succeeded', 'later'),
    row('in_1', 'failed', 'earlier'),
  ])
  expect(out).toHaveLength(2)
})

test('never collapses rows with a null invoice id (e.g. hand-entered records)', () => {
  const out = dedupePaymentsByInvoice([
    row(null, 'succeeded', 'a'),
    row(null, 'succeeded', 'b'),
  ])
  expect(out).toHaveLength(2)
})

test('keeps distinct invoices (different months) separate', () => {
  const out = dedupePaymentsByInvoice([
    row('in_2', 'succeeded', 'oct'),
    row('in_1', 'succeeded', 'sep'),
  ])
  expect(out).toHaveLength(2)
})

test('preserves input order', () => {
  const out = dedupePaymentsByInvoice([
    row('in_3', 'succeeded', '3'),
    row('in_1', 'succeeded', '1a'),
    row('in_1', 'succeeded', '1b'),
    row('in_2', 'succeeded', '2'),
  ])
  expect(out.map((r) => r.created_at)).toEqual(['3', '1a', '2'])
})
