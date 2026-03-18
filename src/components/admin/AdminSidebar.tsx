'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  MapPin,
  Shield,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/clients/new', label: 'Add Client', icon: UserPlus },
  { href: '/admin/municipalities', label: 'Municipalities', icon: MapPin },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl glass-card hover:shadow-card-hover transition-all duration-300"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-navy-700" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-navy-950/30 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 w-[260px]
          bg-white/80 backdrop-blur-2xl border-r border-white/60
          flex flex-col
          transition-transform duration-300 ease-out
          lg:translate-x-0 lg:static lg:z-auto
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.85) 100%)',
        }}
      >
        {/* Close button (mobile) */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg hover:bg-navy-100/50 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-4 h-4 text-navy-500" />
        </button>

        {/* Brand */}
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 flex items-center justify-center shadow-btn-glow">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 animate-glow-pulse opacity-40" />
            </div>
            <div>
              <h2 className="text-sm font-bold gradient-text">Admin Portal</h2>
              <p className="text-[11px] text-navy-400 font-medium">Collision Response</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-navy-200/50 to-transparent" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item, i) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-300 group
                  animate-fade-in-up
                  ${active
                    ? 'bg-brand-50/80 text-brand-700 shadow-sm border border-brand-100/60'
                    : 'text-navy-500 hover:text-navy-800 hover:bg-navy-50/60'
                  }
                `}
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
              >
                <Icon
                  className={`w-[18px] h-[18px] transition-colors duration-300 ${
                    active ? 'text-brand-600' : 'text-navy-400 group-hover:text-navy-600'
                  }`}
                />
                {item.label}
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-soft" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-5 border-t border-navy-100/40 space-y-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs text-navy-400 hover:text-navy-600 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            Back to Client Portal
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-navy-400 hover:text-red-600 transition-colors font-medium w-full"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </aside>
    </>
  )
}
