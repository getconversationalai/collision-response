import { getPublicMunicipalities } from '@/lib/actions/application-actions'
import ApplicationForm from '@/components/apply/ApplicationForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Apply — Collision Ping',
  description: 'Apply to receive real-time MVA alerts for your collision center.',
}

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string; company?: string }>
}) {
  const [municipalities, params] = await Promise.all([
    getPublicMunicipalities(),
    searchParams,
  ])

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Brand */}
        <div className="text-center mb-10 animate-scale-in">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 shadow-btn-glow" />
            <svg className="w-7 h-7 text-white relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold gradient-text tracking-tight">Apply for Collision Ping</h1>
          <p className="text-sm text-navy-400 mt-2 font-medium max-w-md mx-auto">
            Real-time MVA alerts for your collision center. Tell us about your company and choose your coverage areas — an admin will review and get you set up.
          </p>
        </div>

        <ApplicationForm
          municipalities={municipalities}
          initialEmail={params.email ?? ''}
          initialContactName={params.name ?? ''}
          initialCompanyName={params.company ?? ''}
        />
      </main>
    </div>
  )
}
