import Link from 'next/link'

/**
 * Log in / Sign up tab switcher shared by the login and signup pages.
 * The active tab is a static pill; the other is a link to its route.
 */
export default function AuthTabs({ active }: { active: 'login' | 'signup' }) {
  const base = 'flex-1 text-center py-2.5 rounded-lg text-sm font-semibold transition-all duration-200'
  const activeCls = 'bg-white text-brand-700 shadow-sm'
  const inactiveCls = 'text-navy-500 hover:text-navy-800'
  return (
    <div className="flex gap-1 p-1 bg-navy-50/70 rounded-xl border border-navy-100/50">
      {active === 'login' ? (
        <span className={`${base} ${activeCls}`}>Log in</span>
      ) : (
        <Link href="/login" className={`${base} ${inactiveCls}`}>Log in</Link>
      )}
      {active === 'signup' ? (
        <span className={`${base} ${activeCls}`}>Sign up</span>
      ) : (
        <Link href="/signup" className={`${base} ${inactiveCls}`}>Sign up</Link>
      )}
    </div>
  )
}
