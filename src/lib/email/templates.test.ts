import { test, expect } from 'vitest'
import {
  adminNotificationEmail,
  clientApprovedEmail,
  applicantRejectedEmail,
} from './templates'

test('admin notification includes company + review link', () => {
  const e = adminNotificationEmail({
    companyName: 'ABC Collision',
    contactName: 'John Smith',
    email: 'john@abc.com',
    phoneDisplay: '(555) 123-4567',
    municipalityNames: ['Newburgh', 'Goshen'],
    reviewUrl: 'https://app.example.com/admin/applications/abc-123',
  })
  expect(e.subject).toMatch(/ABC Collision/)
  expect(e.html).toContain('https://app.example.com/admin/applications/abc-123')
  expect(e.html).toContain('Newburgh')
  expect(e.html).toContain('John Smith')
})

test('client approved (pay) prompts to add card and links setup', () => {
  const e = clientApprovedEmail({
    companyName: 'ABC Collision',
    setupUrl: 'https://app.example.com/auth/confirm?token_hash=x&type=magiclink&next=/set-password',
    comped: false,
  })
  expect(e.subject).toMatch(/approv/i)
  expect(e.html).toContain('token_hash=x')
  expect(e.html.toLowerCase()).toMatch(/card|payment/)
})

test('client approved (comped) says active, no payment', () => {
  const e = clientApprovedEmail({
    companyName: 'ABC Collision',
    setupUrl: 'https://app.example.com/auth/confirm?token_hash=y&type=magiclink&next=/set-password',
    comped: true,
  })
  expect(e.html).toContain('token_hash=y')
  expect(e.html.toLowerCase()).toMatch(/active/)
})

test('rejection includes reason when provided', () => {
  const e = applicantRejectedEmail({ companyName: 'ABC', reason: 'Outside service area' })
  expect(e.html).toContain('Outside service area')
})

test('rejection omits reason block when absent', () => {
  const e = applicantRejectedEmail({ companyName: 'ABC', reason: null })
  expect(e.subject).toMatch(/ABC|application/i)
  expect(e.html).not.toContain('Reason:')
})

test('rejection escapes HTML in the reason (no XSS)', () => {
  const e = applicantRejectedEmail({ companyName: 'ABC', reason: '<script>alert(1)</script>' })
  expect(e.html).not.toContain('<script>')
  expect(e.html).toContain('&lt;script&gt;')
})
