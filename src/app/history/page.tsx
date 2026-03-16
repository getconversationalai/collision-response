import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import NotificationHistory from '@/components/NotificationHistory'

const PAGE_SIZE = 20

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const supabase = createClient()

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

  const page = Math.max(1, Number(searchParams?.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

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
    .order('created_at', { ascending: false })
    .range(from, to)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header companyName={company.company_name} />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          Notification History
        </h2>
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
