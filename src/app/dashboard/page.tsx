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
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-sm text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Not Configured</h2>
          <p className="text-sm text-gray-600">
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={company.company_name} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <PhoneEditor companyId={company.id} initialPhone={company.phone} />

        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            Location Subscriptions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations.map((location) => (
              <LocationToggle
                key={location.id}
                companyId={company.id}
                municipality={location}
              />
            ))}
          </div>
          {locations.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              No locations available.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
