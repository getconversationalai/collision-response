'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'
import { validateApplicationInput, type RawApplicationInput } from '@/lib/applications/validation'
import { resolveActivation, generateTempPassword } from '@/lib/applications/provisioning'
import { adminNotificationEmail, clientApprovedEmail, applicantRejectedEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/send'
import { formatPhoneDisplay } from '@/lib/phone'
import type { Municipality, ClientApplication, CollisionCompany, ApplicationStatus } from '@/lib/types'

// ---------------------------------------------------------------------------
// Admin auth helpers (mirrors admin-actions.ts: ADMIN_USER_IDS allowlist)
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function getAdminIds(): string[] {
  const raw = process.env.ADMIN_USER_IDS ?? ''
  return raw.split(',').map((id) => id.trim()).filter(Boolean)
}

async function requireAdmin(): Promise<string> {
  const userId = await getCurrentUserId()
  if (!userId || !getAdminIds().includes(userId)) {
    throw new Error('Unauthorized: admin access required')
  }
  return userId
}

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

// ---------------------------------------------------------------------------
// Admin: read
// ---------------------------------------------------------------------------

export async function getApplications(): Promise<ClientApplication[]> {
  await requireAdmin()
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('client_applications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ClientApplication[]
}

export async function getPendingApplicationCount(): Promise<number> {
  await requireAdmin()
  const admin = getAdminClient()
  const { count, error } = await admin
    .from('client_applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) return 0
  return count ?? 0
}

export type ApplicationDetail = {
  application: ClientApplication
  municipalityNames: string[]
  defaultPriceCents: number
}

export async function getApplicationById(id: string): Promise<ApplicationDetail> {
  await requireAdmin()
  const admin = getAdminClient()

  const [appRes, settingsRes] = await Promise.all([
    admin.from('client_applications').select('*').eq('id', id).single(),
    admin.from('system_settings').select('default_monthly_price_cents').eq('id', 1).single(),
  ])
  if (appRes.error) throw new Error(appRes.error.message)
  const application = appRes.data as unknown as ClientApplication

  let municipalityNames: string[] = []
  if (application.requested_municipality_ids.length > 0) {
    const { data: muns } = await admin
      .from('municipalities')
      .select('name')
      .in('id', application.requested_municipality_ids)
    municipalityNames = ((muns ?? []) as Array<{ name: string }>).map((m) => m.name)
  }

  const defaultPriceCents =
    (settingsRes.data as { default_monthly_price_cents: number } | null)?.default_monthly_price_cents ?? 5000

  return { application, municipalityNames, defaultPriceCents }
}

// ---------------------------------------------------------------------------
// Admin: approve
// ---------------------------------------------------------------------------

async function buildSetupUrl(email: string): Promise<string> {
  const admin = getAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  // Use 'magiclink': the user is brand-new, and magiclink is the type
  // designed for click-a-link-to-get-a-session via the token_hash + verifyOtp
  // SSR pattern. The resulting full session permits updateUser({ password }),
  // so the client can set a password immediately on /set-password.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`Failed to generate login link: ${error?.message ?? 'unknown'}`)
  }
  const tokenHash = data.properties.hashed_token
  return `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/set-password`
}

export async function approveApplication(
  id: string,
  opts: { priceCents: number | null; comp: boolean }
): Promise<{ ok: true; companyId: string; emailSent: boolean }> {
  const adminUserId = await requireAdmin()
  const admin = getAdminClient()

  // Load + idempotency guard: only pending applications can be approved.
  const { data: appData, error: appErr } = await admin
    .from('client_applications').select('*').eq('id', id).single()
  if (appErr || !appData) throw new Error('Application not found')
  const application = appData as unknown as ClientApplication
  if (application.status !== 'pending') {
    throw new Error(`This application has already been ${application.status}.`)
  }

  // Default price from settings, then decide billing fields.
  const { data: settings } = await admin
    .from('system_settings').select('default_monthly_price_cents').eq('id', 1).single()
  const defaultPriceCents =
    (settings as { default_monthly_price_cents: number } | null)?.default_monthly_price_cents ?? 5000
  const activation = resolveActivation({ comp: opts.comp, priceCents: opts.priceCents, defaultPriceCents })

  // Defensive: re-validate the stored email before the external auth call.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) {
    throw new Error(`Invalid email in application record: ${application.email}`)
  }

  // 1. Create the auth user with a random temporary password.
  // email_confirm: true marks the email verified without sending Supabase's
  // own email. The client never sees or uses this password — they set their
  // own via the magic link emailed in step 5. The Supabase admin API requires
  // a password, so we generate a throwaway one.
  // Race backstop: if two admins approve simultaneously, the second createUser
  // fails here because the email already exists (auth emails are unique), so
  // no duplicate client is provisioned even without a DB row lock.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: application.email,
    password: generateTempPassword(),
    email_confirm: true,
  })
  if (authError || !authData?.user) {
    throw new Error(`Failed to create login: ${authError?.message ?? 'unknown'}`)
  }
  const authUserId = authData.user.id

  // 2. Insert the collision_companies row.
  const { data: companyData, error: companyError } = await admin
    .from('collision_companies')
    .insert({
      auth_user_id: authUserId,
      company_name: application.company_name,
      contact_name: application.contact_name,
      email: application.email,
      phone: application.phone,
      phone_secondary: application.phone_secondary,
      is_active: activation.is_active,
      is_comped: activation.is_comped,
      billing_status: activation.billing_status,
      monthly_price_cents: activation.monthly_price_cents,
    })
    .select()
    .single()
  if (companyError || !companyData) {
    await admin.auth.admin.deleteUser(authUserId) // rollback
    throw new Error(`Failed to create client: ${companyError?.message ?? 'unknown'}`)
  }
  const company = companyData as unknown as CollisionCompany

  // 3. Subscriptions for requested municipalities. The applicant specifically
  // chose these coverage areas, so a failure here rolls the whole approval back
  // (delete company + auth user) and leaves the application 'pending' to retry —
  // rather than provisioning a client with no coverage.
  if (application.requested_municipality_ids.length > 0) {
    const rows = application.requested_municipality_ids.map((municipality_id) => ({
      company_id: company.id, municipality_id, is_subscribed: true,
    }))
    const { error: subErr } = await admin.from('subscriptions').insert(rows)
    if (subErr) {
      await admin.from('collision_companies').delete().eq('id', company.id)
      await admin.auth.admin.deleteUser(authUserId)
      throw new Error(`Failed to create subscriptions: ${subErr.message}`)
    }
  }

  // 4. Mark the application approved.
  await admin.from('client_applications').update({
    status: 'approved' as ApplicationStatus,
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
    created_company_id: company.id,
  }).eq('id', id)

  // 5. Email the client a set-password link (best-effort).
  let emailSent = false
  try {
    const setupUrl = await buildSetupUrl(application.email)
    const { subject, html } = clientApprovedEmail({
      companyName: application.company_name, setupUrl, comped: activation.is_comped,
    })
    const res = await sendEmail({ to: application.email, subject, html })
    emailSent = res.ok
  } catch (e) {
    console.error('[applications] approval email failed:', e)
  }

  return { ok: true, companyId: company.id, emailSent }
}

export async function resendApprovalEmail(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('client_applications').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Application not found')
  const application = data as unknown as ClientApplication
  if (application.status !== 'approved') throw new Error('Application is not approved')

  const { data: company } = await admin
    .from('collision_companies').select('is_comped').eq('id', application.created_company_id ?? '').maybeSingle()
  const comped = (company as { is_comped: boolean } | null)?.is_comped ?? false

  const setupUrl = await buildSetupUrl(application.email)
  const { subject, html } = clientApprovedEmail({ companyName: application.company_name, setupUrl, comped })
  const res = await sendEmail({ to: application.email, subject, html })
  return { ok: res.ok }
}

// ---------------------------------------------------------------------------
// Admin: reject
// ---------------------------------------------------------------------------

export async function rejectApplication(
  id: string,
  reason?: string
): Promise<{ ok: true; emailSent: boolean }> {
  const adminUserId = await requireAdmin()
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('client_applications').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Application not found')
  const application = data as unknown as ClientApplication
  if (application.status !== 'pending') {
    throw new Error(`This application has already been ${application.status}.`)
  }

  const cleanReason = reason?.trim() || null
  await admin.from('client_applications').update({
    status: 'rejected' as ApplicationStatus,
    rejection_reason: cleanReason,
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id)

  // Courteous decline email (best-effort).
  let emailSent = false
  try {
    const { subject, html } = applicantRejectedEmail({ companyName: application.company_name, reason: cleanReason })
    const res = await sendEmail({ to: application.email, subject, html })
    emailSent = res.ok
  } catch (e) {
    console.error('[applications] rejection email failed:', e)
  }

  return { ok: true, emailSent }
}

export async function resendRejectionEmail(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('client_applications').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Application not found')
  const application = data as unknown as ClientApplication
  if (application.status !== 'rejected') throw new Error('Application is not rejected')

  const { subject, html } = applicantRejectedEmail({
    companyName: application.company_name,
    reason: application.rejection_reason,
  })
  const res = await sendEmail({ to: application.email, subject, html })
  return { ok: res.ok }
}

// ---------------------------------------------------------------------------
// Admin: notification settings
// ---------------------------------------------------------------------------

export async function getNotificationEmails(): Promise<string[]> {
  await requireAdmin()
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('system_settings').select('notification_emails').eq('id', 1).single()
  if (error) throw new Error(error.message)
  return (data as { notification_emails: string[] } | null)?.notification_emails ?? []
}

export async function updateNotificationEmails(emails: string[]): Promise<{ ok: true; emails: string[] }> {
  await requireAdmin()
  const admin = getAdminClient()

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const cleaned = Array.from(new Set(
    emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  ))
  for (const e of cleaned) {
    if (!EMAIL_RE.test(e)) throw new Error(`Invalid email address: ${e}`)
  }

  const { error } = await admin
    .from('system_settings')
    .upsert({ id: 1, notification_emails: cleaned })
  if (error) throw new Error(error.message)
  return { ok: true, emails: cleaned }
}
