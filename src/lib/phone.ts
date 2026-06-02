/** Pure US phone helpers. Storage format is E.164 (+1XXXXXXXXXX). */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatPhoneDisplay(value: string): string {
  const d = digitsOnly(value).slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`
}

export function toE164(value: string): string {
  return `+1${digitsOnly(value).slice(0, 10)}`
}

export function isValidUsPhone(value: string): boolean {
  return digitsOnly(value).length === 10
}
