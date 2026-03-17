'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'
import type { CollisionCompany, Municipality } from '@/lib/types'

export type ClientWithSubscriptionCount = CollisionCompany & {
  subscription_count: number
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Server actions don't need to set cookies for reads
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function getAdminIds(): string[] {
  const raw = process.env.ADMIN_USER_IDS ?? ''
  return raw.split(',').map(id => id.trim()).filter(Boolean)
}

export async function verifyAdmin(): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (!userId) return false
  return getAdminIds().includes(userId)
}

async function requireAdmin() {
  const isAdmin = await verifyAdmin()
  if (!isAdmin) throw new Error('Unauthorized: admin access required')
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export type RecentClient = {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  created_at: string
}

export type DashboardStats = {
  totalClients: number
  totalMunicipalities: number
  recentClients: RecentClient[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin()
  const admin = getAdminClient()

  const [companiesRes, municipalitiesRes, recentRes] = await Promise.all([
    admin.from('collision_companies').select('id', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('municipalities').select('id', { count: 'exact', head: true }).eq('is_active', true),
    admin
      .from('collision_companies')
      .select('id, company_name, contact_name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    totalClients: companiesRes.count ?? 0,
    totalMunicipalities: municipalitiesRes.count ?? 0,
    recentClients: (recentRes.data ?? []) as unknown as RecentClient[],
  }
}

// ---------------------------------------------------------------------------
// Client CRUD
// ---------------------------------------------------------------------------

export async function getClients(): Promise<ClientWithSubscriptionCount[]> {
  await requireAdmin()
  const admin = getAdminClient()

  const { data: companies, error } = await admin
    .from('collision_companies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const typedCompanies = (companies ?? []) as CollisionCompany[]

  // Get subscription counts for each company
  const companyIds = typedCompanies.map(c => c.id)
  const { data: subs } = await admin
    .from('subscriptions')
    .select('company_id')
    .in('company_id', companyIds)
    .eq('is_subscribed', true)

  const subCounts: Record<string, number> = {}
  for (const s of (subs ?? []) as Array<{ company_id: string }>) {
    subCounts[s.company_id] = (subCounts[s.company_id] ?? 0) + 1
  }

  return typedCompanies.map(c => ({
    ...c,
    subscription_count: subCounts[c.id] ?? 0,
  }))
}

export type ClientDetail = {
  company: CollisionCompany
  subscriptions: Array<{
    id: string
    company_id: string
    municipality_id: string
    is_subscribed: boolean
    municipalities: Municipality | null
  }>
  recentSms: Array<{
    id: string
    phone: string
    status: string
    created_at: string
    sent_at: string | null
    dispatch_log: {
      municipality: string | null
      incident_type: string | null
      address: string | null
    } | null
  }>
}

export async function getClientById(companyId: string): Promise<ClientDetail> {
  await requireAdmin()
  const admin = getAdminClient()

  const [companyRes, subsRes, smsRes] = await Promise.all([
    admin.from('collision_companies').select('*').eq('id', companyId).single(),
    admin
      .from('subscriptions')
      .select('*, municipalities(*)')
      .eq('company_id', companyId),
    admin
      .from('sms_log')
      .select('*, dispatch_log(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (companyRes.error) throw new Error(companyRes.error.message)

  return {
    company: companyRes.data as unknown as CollisionCompany,
    subscriptions: (subsRes.data ?? []) as unknown as ClientDetail['subscriptions'],
    recentSms: (smsRes.data ?? []) as unknown as ClientDetail['recentSms'],
  }
}

export async function getMunicipalities(): Promise<Municipality[]> {
  await requireAdmin()
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('municipalities')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Municipality[]
}

// ---------------------------------------------------------------------------
// Create client (multi-step)
// ---------------------------------------------------------------------------

type CreateClientInput = {
  companyName: string
  contactName: string
  email: string
  phone: string
  password: string
  municipalityIds: string[]
}

export async function createClient(input: CreateClientInput) {
  await requireAdmin()
  const admin = getAdminClient()

  // Validate
  if (!input.companyName.trim()) throw new Error('Company name is required')
  if (!input.contactName.trim()) throw new Error('Contact name is required')
  if (!input.email.trim()) throw new Error('Email is required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Invalid email format')
  if (!/^\+1\d{10}$/.test(input.phone)) throw new Error('Phone must be in E.164 format (+1XXXXXXXXXX)')
  if (input.password.length < 8) throw new Error('Password must be at least 8 characters')

  // Step 1: Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  })

  if (authError) throw new Error(`Failed to create auth user: ${authError.message}`)
  const authUserId = authData.user.id

  // Step 2: Insert collision_companies row
  const { data: companyData, error: companyError } = await admin
    .from('collision_companies')
    .insert({
      auth_user_id: authUserId,
      company_name: input.companyName.trim(),
      contact_name: input.contactName.trim(),
      email: input.email.trim(),
      phone: input.phone,
      is_active: true,
    })
    .select()
    .single()

  if (companyError) {
    // Rollback: delete orphaned auth user
    await admin.auth.admin.deleteUser(authUserId)
    throw new Error(`Failed to create company: ${companyError.message}`)
  }

  const company = companyData as unknown as CollisionCompany

  // Step 3: Insert subscriptions
  if (input.municipalityIds.length > 0) {
    const subscriptionRows = input.municipalityIds.map(munId => ({
      company_id: company.id,
      municipality_id: munId,
      is_subscribed: true,
    }))

    const { error: subError } = await admin.from('subscriptions').insert(subscriptionRows)
    if (subError) {
      // Non-fatal: log but don't rollback the whole client
      console.error('Failed to create subscriptions:', subError.message)
    }
  }

  return { company, authUserId }
}

// ---------------------------------------------------------------------------
// Update client
// ---------------------------------------------------------------------------

export async function updateClient(
  companyId: string,
  updates: {
    company_name?: string
    contact_name?: string
    email?: string
    phone?: string
  }
) {
  await requireAdmin()
  const admin = getAdminClient()

  if (updates.phone && !/^\+1\d{10}$/.test(updates.phone)) {
    throw new Error('Phone must be in E.164 format (+1XXXXXXXXXX)')
  }
  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
    throw new Error('Invalid email format')
  }

  const { error } = await admin
    .from('collision_companies')
    .update(updates)
    .eq('id', companyId)

  if (error) throw new Error(error.message)
  return { success: true }
}

export async function toggleClientActive(companyId: string, isActive: boolean) {
  await requireAdmin()
  const admin = getAdminClient()

  const { error } = await admin
    .from('collision_companies')
    .update({ is_active: isActive })
    .eq('id', companyId)

  if (error) throw new Error(error.message)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Subscription management
// ---------------------------------------------------------------------------

export async function updateSubscription(
  companyId: string,
  municipalityId: string,
  isSubscribed: boolean
) {
  await requireAdmin()
  const admin = getAdminClient()

  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        company_id: companyId,
        municipality_id: municipalityId,
        is_subscribed: isSubscribed,
      },
      { onConflict: 'company_id,municipality_id' }
    )

  if (error) throw new Error(error.message)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function resetClientPassword(companyId: string, newPassword: string) {
  await requireAdmin()
  const admin = getAdminClient()

  if (newPassword.length < 8) throw new Error('Password must be at least 8 characters')

  // Look up auth_user_id
  const { data: companyRow, error: lookupError } = await admin
    .from('collision_companies')
    .select('auth_user_id')
    .eq('id', companyId)
    .single()

  if (lookupError || !companyRow) throw new Error('Company not found')

  const { auth_user_id } = companyRow as unknown as { auth_user_id: string }
  const { error } = await admin.auth.admin.updateUserById(auth_user_id, {
    password: newPassword,
  })

  if (error) throw new Error(`Failed to reset password: ${error.message}`)
  return { success: true }
}
