import { test, expect } from 'vitest'
import { digitsOnly, formatPhoneDisplay, toE164, isValidUsPhone } from './phone'

test('digitsOnly strips non-digits', () => {
  expect(digitsOnly('(555) 123-4567')).toBe('5551234567')
})

test('formatPhoneDisplay formats progressively', () => {
  expect(formatPhoneDisplay('555')).toBe('555')
  expect(formatPhoneDisplay('555123')).toBe('(555) 123')
  expect(formatPhoneDisplay('5551234567')).toBe('(555) 123-4567')
})

test('toE164 produces +1XXXXXXXXXX', () => {
  expect(toE164('(555) 123-4567')).toBe('+15551234567')
})

test('isValidUsPhone requires exactly 10 digits', () => {
  expect(isValidUsPhone('5551234567')).toBe(true)
  expect(isValidUsPhone('555123456')).toBe(false)
  expect(isValidUsPhone('(555) 123-4567')).toBe(true)
  expect(isValidUsPhone('')).toBe(false)
})
