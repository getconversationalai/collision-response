import { createClient } from '@/lib/supabase/server'
import SetPasswordForm from '@/components/SetPasswordForm'

export const dynamic = 'force-dynamic'

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Decide where to send them after setting a password: pending clients
  // go straight to billing to add a card; everyone else to the dashboard.
  let redirectTo = '/dashboard'
  if (user) {
    const { data: company } = await supabase
      .from('collision_companies')
      .select('billing_status')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if ((company as { billing_status?: string } | null)?.billing_status === 'pending') {
      redirectTo = '/billing'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>
      <div className="w-full max-w-[420px] animate-scale-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold gradient-text">Set your password</h1>
          <p className="text-sm text-navy-400 mt-2">Choose a password to finish setting up your account.</p>
        </div>
        <SetPasswordForm hasSession={!!user} expired={error === 'expired'} redirectTo={redirectTo} email={user?.email ?? null} />
      </div>
    </div>
  )
}
