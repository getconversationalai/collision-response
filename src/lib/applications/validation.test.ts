import { test, expect } from 'vitest'
import { validateApplicationInput } from './validation'

const good = {
  companyName: 'ABC Collision',
  contactName: 'John Smith',
  email: 'john@abc.com',
  phoneRaw: '(555) 123-4567',
  phoneSecondaryRaw: '',
  municipalityIds: ['11111111-1111-1111-1111-111111111111'],
}

test('accepts and normalizes valid input', () => {
  const r = validateApplicationInput(good)
  expect(r.ok).toBe(true)
  if (r.ok) {
    expect(r.value.company_name).toBe('ABC Collision')
    expect(r.value.phone).toBe('+15551234567')
    expect(r.value.phone_secondary).toBeNull()
    expect(r.value.requested_municipality_ids).toEqual([good.municipalityIds[0]])
  }
})

test('rejects bad email', () => {
  const r = validateApplicationInput({ ...good, email: 'nope' })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.errors.join(' ')).toMatch(/email/i)
})

test('rejects short phone', () => {
  const r = validateApplicationInput({ ...good, phoneRaw: '555' })
  expect(r.ok).toBe(false)
})

test('rejects empty company / contact', () => {
  expect(validateApplicationInput({ ...good, companyName: '  ' }).ok).toBe(false)
  expect(validateApplicationInput({ ...good, contactName: '' }).ok).toBe(false)
})

test('requires at least one municipality', () => {
  const r = validateApplicationInput({ ...good, municipalityIds: [] })
  expect(r.ok).toBe(false)
  if (!r.ok) expect(r.errors.join(' ')).toMatch(/coverage|municipalit/i)
})

test('normalizes a provided secondary phone', () => {
  const r = validateApplicationInput({ ...good, phoneSecondaryRaw: '555-987-6543' })
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.value.phone_secondary).toBe('+15559876543')
})

test('rejects a malformed secondary phone', () => {
  const r = validateApplicationInput({ ...good, phoneSecondaryRaw: '12' })
  expect(r.ok).toBe(false)
})
