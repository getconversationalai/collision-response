'use server'

import { getAdminClient } from '@/lib/supabase/admin'
import { validateApplicationInput, type RawApplicationInput } from '@/lib/applications/validation'
import { adminNotificationEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/send'
import { formatPhoneDisplay } from '@/lib/phone'
import type { Municipality } from '@/lib/types'

// ---------------------------------------------------------------------------
// Public: municipalities shown on the application form
// ---------------------------------------------------------------------------

export async function getPublicMunicipalities(): Promise<Municipality[]> {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('municipalities')
    .select('*')
    .eq('is_active', true)
    .eq('admin_only', false)
    .not('name', 'is', null)
    .neq('name', '')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Municipality[]
}

// ---------------------------------------------------------------------------
// Public: submit an application
// ---------------------------------------------------------------------------

export type SubmitApplicationInput = RawApplicationInput & { honeypot?: string }

export type SubmitApplicationResult =
  | { ok: true }
  | { ok: false; reason: 'validation' | 'duplicate_active' | 'duplicate_pending' | 'error'; errors?: string[]; message?: string }

export async function submitApplication(
  input: SubmitApplicationInput
): Promise<SubmitApplicationResult> {
  // Honeypot: a bot filled the hidden field. Pretend success, store nothing.
  if (input.honeypot && input.honeypot.trim() !== '') {
    return { ok: true }
  }

  const validation = validateApplicationInput(input)
  if (!validation.ok) {
    return { ok: false, reason: 'validation', errors: validation.errors }
  }
  const v = validation.value
  const admin = getAdminClient()

  // Guard: an active client already exists with this email → tell them to log in.
  const { data: existingClient } = await admin
    .from('collision_companies')
    .select('id')
    .eq('email', v.email)
    .maybeSingle()
  if (existingClient) {
    return {
      ok: false,
      reason: 'duplicate_active',
      message: 'An account already exists for this email. Please log in instead.',
    }
  }

  // Guard: a pending application already exists with this email → avoid
  // duplicate submissions flooding the admin queue. (Heavier abuse protection
  // — IP rate limiting / Cloudflare Turnstile — is a documented future
  // enhancement; the honeypot + this guard + the admin-review gate are
  // proportionate for now.)
  const { data: existingPending } = await admin
    .from('client_applications')
    .select('id')
    .eq('email', v.email)
    .eq('status', 'pending')
    .limit(1)
  if (existingPending && existingPending.length > 0) {
    return {
      ok: false,
      reason: 'duplicate_pending',
      message: "An application with this email is already under review. We'll be in touch by email soon.",
    }
  }

  // Insert the application (service role; bypasses RLS).
  const { data: appRow, error: insertError } = await admin
    .from('client_applications')
    .insert({
      company_name: v.company_name,
      contact_name: v.contact_name,
      email: v.email,
      phone: v.phone,
      phone_secondary: v.phone_secondary,
      requested_municipality_ids: v.requested_municipality_ids,
    })
    .select('id')
    .single()

  if (insertError || !appRow) {
    console.error('[applications] insert failed:', insertError?.message)
    return { ok: false, reason: 'error', message: 'Could not submit your application. Please try again.' }
  }

  // Best-effort admin notification — never blocks the submission.
  await notifyAdminsOfApplication((appRow as { id: string }).id).catch((e) =>
    console.error('[applications] admin notify failed:', e)
  )

  return { ok: true }
}

async function notifyAdminsOfApplication(applicationId: string): Promise<void> {
  const admin = getAdminClient()

  const [{ data: appData }, { data: settings }] = await Promise.all([
    admin.from('client_applications').select('*').eq('id', applicationId).single(),
    admin.from('system_settings').select('notification_emails').eq('id', 1).single(),
  ])

  const recipients = ((settings as { notification_emails: string[] } | null)?.notification_emails) ?? []
  if (recipients.length === 0) {
    console.warn('[applications] no notification_emails configured; skipping admin email')
    return
  }

  const app = appData as unknown as {
    id: string
    company_name: string
    contact_name: string
    email: string
    phone: string
    requested_municipality_ids: string[]
  }

  // Resolve municipality names for the email.
  let municipalityNames: string[] = []
  if (app.requested_municipality_ids.length > 0) {
    const { data: muns } = await admin
      .from('municipalities')
      .select('name')
      .in('id', app.requested_municipality_ids)
    municipalityNames = ((muns ?? []) as Array<{ name: string }>).map((m) => m.name)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { subject, html } = adminNotificationEmail({
    companyName: app.company_name,
    contactName: app.contact_name,
    email: app.email,
    phoneDisplay: formatPhoneDisplay(app.phone.replace('+1', '')),
    municipalityNames,
    reviewUrl: `${appUrl}/admin/applications/${app.id}`,
  })

  await sendEmail({ to: recipients, subject, html })
}
