'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type NotificationEntry = {
  id: string
  status: string
  sent_at: string | null
  created_at: string
  dispatch_log: {
    municipality: string | null
    incident_type: string | null
    address: string | null
  } | null
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string; border: string }> = {
    sent: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200/60' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200/60' },
    pending: { bg: 'bg-gold-50', text: 'text-gold-700', dot: 'bg-gold-500 status-dot-pulse', border: 'border-gold-200/60' },
  }
  const style = config[status] ?? { bg: 'bg-navy-50', text: 'text-navy-700', dot: 'bg-navy-400', border: 'border-navy-200/60' }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${style.bg} ${style.text} border ${style.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function NotificationHistory({
  entries,
  page,
  totalCount,
  pageSize,
}: {
  entries: NotificationEntry[]
  page: number
  totalCount: number
  pageSize: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalPages = Math.ceil(totalCount / pageSize)

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`/history?${params.toString()}`)
  }

  if (entries.length === 0 && page === 1) {
    return (
      <div className="glass-card-rich rounded-2xl p-16 text-center animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy-100/60 text-navy-300 mb-5 animate-float">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-navy-700 mb-1">No notifications yet</h3>
        <p className="text-sm text-navy-400 font-medium">Notifications will appear here once MVA alerts are dispatched.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up space-y-4">
      {/* Desktop table */}
      <div className="hidden md:block glass-card-rich rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-100/60 bg-gradient-to-r from-navy-50/50 to-transparent">
              <th className="text-left px-5 py-4 section-title">Date</th>
              <th className="text-left px-5 py-4 section-title">Location</th>
              <th className="text-left px-5 py-4 section-title">Type</th>
              <th className="text-left px-5 py-4 section-title">Address</th>
              <th className="text-left px-5 py-4 section-title">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr
                key={entry.id}
                className="table-row-hover border-b border-navy-50 last:border-0 animate-fade-in"
                style={{ animationDelay: `${0.04 * i}s`, animationFillMode: 'both' }}
              >
                <td className="px-5 py-4 text-navy-500 whitespace-nowrap font-medium">
                  {formatDate(entry.sent_at ?? entry.created_at)}
                </td>
                <td className="px-5 py-4 font-bold text-navy-900">
                  {entry.dispatch_log?.municipality ?? '\u2014'}
                </td>
                <td className="px-5 py-4 text-navy-600 font-medium">
                  {entry.dispatch_log?.incident_type ?? '\u2014'}
                </td>
                <td className="px-5 py-4 text-navy-400 max-w-[200px] truncate">
                  {entry.dispatch_log?.address ?? '\u2014'}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={entry.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className="glass-card card-lift rounded-xl p-4 space-y-3 animate-fade-in-up"
            style={{ animationDelay: `${0.06 * i}s`, animationFillMode: 'both' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-navy-400 font-bold uppercase tracking-wider">
                {formatDate(entry.sent_at ?? entry.created_at)}
              </span>
              <StatusBadge status={entry.status} />
            </div>
            <div className="text-sm font-bold text-navy-900">
              {entry.dispatch_log?.municipality ?? '\u2014'}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-navy-50 text-navy-600 uppercase tracking-wider">
                {entry.dispatch_log?.incident_type ?? '\u2014'}
              </span>
            </div>
            {entry.dispatch_log?.address && (
              <div className="text-xs text-navy-400 font-medium flex items-start gap-1.5 pt-1 border-t border-navy-100/40">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-navy-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                {entry.dispatch_log.address}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-navy-400 font-semibold">
            Page <span className="text-navy-700">{page}</span> of <span className="text-navy-700">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="group inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-navy-600 rounded-xl border border-navy-200/60 bg-white/80 backdrop-blur-sm hover:bg-navy-50 hover:border-navy-300 hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
            >
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Previous
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="group inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-navy-600 rounded-xl border border-navy-200/60 bg-white/80 backdrop-blur-sm hover:bg-navy-50 hover:border-navy-300 hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
            >
              Next
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
