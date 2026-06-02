import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBillingPageData } from '@/lib/actions/billing-actions'
import Header from '@/components/Header'
import BillingDashboard from '@/components/BillingDashboard'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: company } = await supabase
    .from('collision_companies')
    .select('id, company_name')
    .eq('auth_user_id', user.id)
    .single()

  if (!company) {
    redirect('/dashboard')
  }

  const data = await getBillingPageData()

  return (
    <div className="min-h-screen relative">
      {/* Background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
      </div>

      <Header companyName={company.company_name} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <BillingDashboard data={data} />
      </main>
    </div>
  )
}
