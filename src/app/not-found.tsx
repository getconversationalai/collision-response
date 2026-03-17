import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
      </div>
      <div className="animate-scale-in glass-card-rich rounded-2xl p-10 max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-navy-100 to-navy-50 text-navy-400 mb-5 animate-float shadow-sm">
          <span className="text-2xl font-extrabold">404</span>
        </div>
        <h2 className="text-xl font-bold text-navy-900 mb-2">Page Not Found</h2>
        <p className="text-sm text-navy-500 mb-6 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
