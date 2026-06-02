import ApplicationSuccess from '@/components/apply/ApplicationSuccess'

export const metadata = {
  title: 'Application received — Collision Ping',
}

export default function ApplySuccessPage() {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>
      <ApplicationSuccess />
    </div>
  )
}
