import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import NotificationHistory from '@/components/NotificationHistory'

const PAGE_SIZE = 20

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
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

  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: logs, count } = await supabase
    .from('sms_log')
    .select(
      `
      id,
      status,
      sent_at,
      created_at,
      dispatch_log (
        municipality,
        incident_type,
        address
      )
    `,
      { count: 'exact' }
    )
    .eq('company_id', company.id)
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .range(from, to)

  return (
    <div className="min-h-screen relative">
      {/* Background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
      </div>

      <Header companyName={company.company_name} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-5 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h2 className="section-title">Notification History</h2>
          </div>
          {(count ?? 0) > 0 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-navy-50 text-navy-500 border border-navy-100">
              {count} total
            </span>
          )}
        </div>
        <NotificationHistory
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entries={(logs as unknown as React.ComponentProps<typeof NotificationHistory>['entries']) ?? []}
          page={page}
          totalCount={count ?? 0}
          pageSize={PAGE_SIZE}
        />
      </main>
    </div>
  )
}
