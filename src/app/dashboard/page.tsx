import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CollisionCompany, Municipality, Subscription } from '@/lib/types'
import Header from '@/components/Header'
import PhoneEditor from '@/components/PhoneEditor'
import LocationsSection from '@/components/LocationsSection'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: companyData } = await supabase
    .from('collision_companies')
    .select('id, company_name, contact_name, phone, phone_secondary, email')
    .eq('auth_user_id', user.id)
    .single()

  const company = companyData as Pick<
    CollisionCompany,
    'id' | 'company_name' | 'contact_name' | 'phone' | 'phone_secondary' | 'email'
  > | null

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
        </div>
        <div className="animate-scale-in glass-card-rich rounded-2xl p-8 max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-700 mb-5 shadow-sm">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-navy-900 mb-2">Account Not Configured</h2>
          <p className="text-sm text-navy-500 leading-relaxed">
            Your account has not been set up yet. Please contact support.
          </p>
        </div>
      </div>
    )
  }

  const [{ data: municipalitiesData }, { data: subscriptionsData }] = await Promise.all([
    supabase
      .from('municipalities')
      .select('id, name, display_name, county, state, is_active, parent_id, admin_only')
      .eq('is_active', true)
      .not('name', 'is', null)
      .neq('name', '')
      .order('name'),
    supabase
      .from('subscriptions')
      .select('id, municipality_id, is_subscribed')
      .eq('company_id', company.id),
  ])

  const municipalities = (municipalitiesData ?? []) as Pick<
    Municipality,
    'id' | 'name' | 'display_name' | 'county' | 'state' | 'is_active' | 'parent_id' | 'admin_only'
  >[]

  const subscriptions = (subscriptionsData ?? []) as Pick<
    Subscription,
    'id' | 'municipality_id' | 'is_subscribed'
  >[]

  const subscriptionMap = new Map(
    subscriptions.map((s) => [s.municipality_id, s])
  )

  const flatLocations = municipalities.map((m) => ({
    ...m,
    is_subscribed: subscriptionMap.get(m.id)?.is_subscribed ?? false,
    subscription_id: subscriptionMap.get(m.id)?.id ?? null,
  }))

  // Group sub-toggles under parents. Root locations keep natural alpha order;
  // children are attached to their parent's `children` array.
  const byId = new Map(flatLocations.map(l => [l.id, l]))
  const children: Record<string, typeof flatLocations> = {}
  for (const loc of flatLocations) {
    if (loc.parent_id && byId.has(loc.parent_id)) {
      (children[loc.parent_id] ??= []).push(loc)
    }
  }

  const locations = flatLocations
    .filter(l => !l.parent_id)
    .map(l => ({
      ...l,
      children: (children[l.id] ?? []).sort((a, b) =>
        (a.display_name || a.name).localeCompare(b.display_name || b.name)
      ),
    }))

  // Count everything that's actually subscribable (includes children)
  const initialActiveCount = flatLocations.filter(l => l.is_subscribed).length

  return (
    <div className="min-h-screen relative">
      {/* Background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <Header companyName={company.company_name} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <LocationsSection
          companyId={company.id}
          locations={locations}
          initialActiveCount={initialActiveCount}
        >
          {/* Phone section — between banner and location grid */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            <PhoneEditor
              companyId={company.id}
              initialPhone={company.phone}
              initialPhoneSecondary={company.phone_secondary}
            />
          </div>
        </LocationsSection>
      </main>
    </div>
  )
}
