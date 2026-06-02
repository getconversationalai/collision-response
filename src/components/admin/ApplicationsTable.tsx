'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronRight } from 'lucide-react'
import type { ClientApplication, ApplicationStatus } from '@/lib/types'

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  pending: 'bg-gold-50 text-gold-700 border-gold-200/60',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  rejected: 'bg-red-50 text-red-600 border-red-200/60',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ApplicationsTable({ applications }: { applications: ClientApplication[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | ApplicationStatus>('all')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return applications
      .filter((a) => filter === 'all' || a.status === filter)
      .filter((a) => !q || a.company_name.toLowerCase().includes(q) || a.contact_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
  }, [applications, query, filter])

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company, contact, email..."
            className="input-field pl-9" />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                filter === f ? 'bg-brand-500 text-white shadow-sm' : 'bg-white/60 text-navy-500 hover:bg-navy-50'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-sm text-navy-400 py-12">No applications match.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((a, i) => (
            <Link key={a.id} href={`/admin/applications/${a.id}`}
              className="flex items-center gap-4 p-3.5 rounded-xl border border-navy-100/50 bg-white/50 hover:bg-brand-50/40 hover:border-brand-200/50 transition-all duration-200 animate-fade-in-up"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-800 truncate">{a.company_name}</p>
                <p className="text-xs text-navy-400 truncate">{a.contact_name} · {a.email}</p>
              </div>
              <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold border capitalize ${STATUS_STYLES[a.status]}`}>
                {a.status}
              </span>
              <span className="hidden md:block text-xs text-navy-400 w-24 text-right">{formatDate(a.created_at)}</span>
              <ChevronRight className="w-4 h-4 text-navy-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
