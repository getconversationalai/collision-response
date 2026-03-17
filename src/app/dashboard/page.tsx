import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CollisionCompany, Municipality, Subscription } from '@/lib/types'
import Header from '@/components/Header'
import PhoneEditor from '@/components/PhoneEditor'
import LocationToggle from '@/components/LocationToggle'

export default async function DashboardPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: companyData } = await supabase
    .from('collision_companies')
    .select('id, company_name, contact_name, phone, email')
    .eq('auth_user_id', user.id)
    .single()

  const company = companyData as Pick<
    CollisionCompany,
    'id' | 'company_name' | 'contact_name' | 'phone' | 'email'
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
      .select('id, name, county, state, is_active')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('subscriptions')
      .select('id, municipality_id, is_subscribed')
      .eq('company_id', company.id),
  ])

  const municipalities = (municipalitiesData ?? []) as Pick<
    Municipality,
    'id' | 'name' | 'county' | 'state' | 'is_active'
  >[]

  const subscriptions = (subscriptionsData ?? []) as Pick<
    Subscription,
    'id' | 'municipality_id' | 'is_subscribed'
  >[]

  const subscriptionMap = new Map(
    subscriptions.map((s) => [s.municipality_id, s])
  )

  const locations = municipalities.map((m) => ({
    ...m,
    is_subscribed: subscriptionMap.get(m.id)?.is_subscribed ?? false,
    subscription_id: subscriptionMap.get(m.id)?.id ?? null,
  }))

  const activeCount = locations.filter(l => l.is_subscribed).length

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
        {/* Welcome banner */}
        <div className="animate-fade-in-up overflow-hidden rounded-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTMwVjBoLTJ2NEgxMFYwSDh2NGgtMnYyaDJ2MmgyVjZoMjR2Mmgydi0yaDJWNGgtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative px-6 py-6 sm:px-8 sm:py-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                Welcome back
              </h2>
              <p className="text-brand-100 text-sm font-medium">
                {activeCount > 0
                  ? `You're receiving alerts for ${activeCount} location${activeCount !== 1 ? 's' : ''}`
                  : 'Enable locations below to start receiving MVA alerts'}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl font-extrabold text-white">{activeCount}</div>
                <div className="text-xs text-brand-200 font-semibold uppercase tracking-wider">Active</div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-right">
                <div className="text-3xl font-extrabold text-white/60">{locations.length}</div>
                <div className="text-xs text-brand-200/60 font-semibold uppercase tracking-wider">Total</div>
              </div>
            </div>
          </div>
        </div>

        {/* Phone section */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          <PhoneEditor companyId={company.id} initialPhone={company.phone} />
        </div>

        {/* Locations section */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              </div>
              <h2 className="section-title">Location Subscriptions</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-600 border border-brand-100">
                {activeCount} / {locations.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations.map((location, i) => (
              <div
                key={location.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${0.05 * (i + 1) + 0.2}s`, animationFillMode: 'both' }}
              >
                <LocationToggle
                  companyId={company.id}
                  municipality={location}
                />
              </div>
            ))}
          </div>

          {locations.length === 0 && (
            <div className="glass-card-rich rounded-2xl p-12 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-navy-100 text-navy-400 mb-4 animate-float">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              </div>
              <p className="text-sm text-navy-500 font-medium">No locations available.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
