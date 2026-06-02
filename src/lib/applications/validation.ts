import { isValidUsPhone, toE164 } from '@/lib/phone'

export type RawApplicationInput = {
  companyName: string
  contactName: string
  email: string
  phoneRaw: string
  phoneSecondaryRaw?: string
  municipalityIds: string[]
}

export type NormalizedApplication = {
  company_name: string
  contact_name: string
  email: string
  phone: string                       // E.164
  phone_secondary: string | null      // E.164 or null
  requested_municipality_ids: string[]
}

export type ValidationResult =
  | { ok: true; value: NormalizedApplication }
  | { ok: false; errors: string[] }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateApplicationInput(input: RawApplicationInput): ValidationResult {
  const errors: string[] = []

  const company_name = (input.companyName ?? '').trim()
  const contact_name = (input.contactName ?? '').trim()
  const email = (input.email ?? '').trim().toLowerCase()
  const phoneSecondaryRaw = (input.phoneSecondaryRaw ?? '').trim()
  const municipalityIds = Array.isArray(input.municipalityIds) ? input.municipalityIds : []

  if (!company_name) errors.push('Company name is required')
  if (!contact_name) errors.push('Contact name is required')
  if (!email) errors.push('Email is required')
  else if (!EMAIL_RE.test(email)) errors.push('Please enter a valid email address')
  if (!isValidUsPhone(input.phoneRaw ?? '')) errors.push('A valid 10-digit phone number is required')
  if (phoneSecondaryRaw && !isValidUsPhone(phoneSecondaryRaw)) {
    errors.push('Secondary phone must be a valid 10-digit number')
  }
  if (municipalityIds.length === 0) errors.push('Select at least one coverage area (municipality)')

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      company_name,
      contact_name,
      email,
      phone: toE164(input.phoneRaw),
      phone_secondary: phoneSecondaryRaw ? toE164(phoneSecondaryRaw) : null,
      requested_municipality_ids: municipalityIds,
    },
  }
}
