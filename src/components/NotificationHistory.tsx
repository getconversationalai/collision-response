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
  const styles: Record<string, string> = {
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[status] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">No notifications yet.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Address</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {formatDate(entry.sent_at ?? entry.created_at)}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {entry.dispatch_log?.municipality ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {entry.dispatch_log?.incident_type ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {entry.dispatch_log?.address ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={entry.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {formatDate(entry.sent_at ?? entry.created_at)}
              </span>
              <StatusBadge status={entry.status} />
            </div>
            <div className="text-sm font-medium text-gray-900">
              {entry.dispatch_log?.municipality ?? '—'}
            </div>
            <div className="text-sm text-gray-600">
              {entry.dispatch_log?.incident_type ?? '—'}
            </div>
            {entry.dispatch_log?.address && (
              <div className="text-xs text-gray-500">
                {entry.dispatch_log.address}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
