import Link from 'next/link'
import { getAdminBillingOverview } from '@/lib/actions/billing-actions'
import DefaultPriceForm from '@/components/admin/DefaultPriceForm'
import type { BillingStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return '—'
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATUS_META: Record<
  BillingStatus,
  { label: string; bg: string; text: string }
> = {
  pending: { label: 'Pending', bg: 'bg-gold-50', text: 'text-gold-700' },
  active: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  past_due: { label: 'Past due', bg: 'bg-red-50', text: 'text-red-700' },
  canceled: { label: 'Canceled', bg: 'bg-navy-100', text: 'text-navy-500' },
  comped: { label: 'Comped', bg: 'bg-brand-50', text: 'text-brand-700' },
}

const STATUS_ORDER: BillingStatus[] = [
  'active',
  'pending',
  'past_due',
  'comped',
  'canceled',
]

export default async function AdminBillingPage() {
  const overview = await getAdminBillingOverview()

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">
          Billing
        </h1>
        <p className="text-navy-400 text-sm mt-1 font-medium">
          System-wide subscription pricing and payment health
        </p>
      </div>

      {/* MRR + status counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div
          className="glass-card-rich rounded-2xl p-6 animate-fade-in-up"
          style={{ animationFillMode: 'both' }}
        >
          <p className="section-title mb-2">Monthly Recurring Revenue</p>
          <p className="text-4xl font-extrabold tracking-tight text-emerald-700">
            {formatCents(overview.mrrCents)}
          </p>
          <p className="text-xs text-navy-400 mt-1">
            Sum of active subscriptions at their effective price
          </p>
        </div>
        <div
          className="glass-card rounded-2xl p-6 animate-fade-in-up"
          style={{ animationDelay: '80ms', animationFillMode: 'both' }}
        >
          <p className="section-title mb-2">Active Clients</p>
          <p className="text-4xl font-extrabold tracking-tight text-brand-700">
            {overview.statusCounts.active}
          </p>
          <p className="text-xs text-navy-400 mt-1">Billing successfully</p>
        </div>
        <div
          className="glass-card rounded-2xl p-6 animate-fade-in-up"
          style={{ animationDelay: '160ms', animationFillMode: 'both' }}
        >
          <p className="section-title mb-2">Need Attention</p>
          <p className="text-4xl font-extrabold tracking-tight text-red-600">
            {overview.statusCounts.past_due + overview.statusCounts.pending}
          </p>
          <p className="text-xs text-navy-400 mt-1">Past due or awaiting a card</p>
        </div>
      </div>

      {/* Default price form */}
      <div className="mb-6">
        <DefaultPriceForm initialCents={overview.defaultPriceCents} />
      </div>

      {/* Status breakdown */}
      <div
        className="glass-card rounded-2xl p-6 mb-6 animate-fade-in-up"
        style={{ animationDelay: '200ms', animationFillMode: 'both' }}
      >
        <h2 className="section-title mb-4">Clients by Billing Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STATUS_ORDER.map((s) => {
            const meta = STATUS_META[s]
            return (
              <div
                key={s}
                className={`rounded-xl p-4 text-center ${meta.bg}`}
              >
                <p className={`text-2xl font-extrabold ${meta.text}`}>
                  {overview.statusCounts[s]}
                </p>
                <p className={`text-[11px] font-bold uppercase tracking-wider mt-1 ${meta.text}`}>
                  {meta.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent failed payments */}
      <div
        className="glass-card rounded-2xl p-6 animate-fade-in-up"
        style={{ animationDelay: '280ms', animationFillMode: 'both' }}
      >
        <h2 className="section-title mb-4">Recent Failed Payments</h2>
        {overview.recentFailedPayments.length === 0 ? (
          <p className="text-sm text-navy-400 py-6 text-center">
            No failed payments — every client is current.
          </p>
        ) : (
          <div className="space-y-2">
            {overview.recentFailedPayments.map((p) => (
              <Link
                key={p.id}
                href={`/admin/clients/${p.company_id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-red-50/40 border border-red-100/60 hover:bg-red-50/70 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-800 group-hover:text-brand-700 transition-colors truncate">
                    {p.company_name ?? 'Unknown client'}
                  </p>
                  <p className="text-[11px] text-red-500 truncate">
                    {p.failure_reason ?? 'Payment failed'}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold text-navy-700">
                    {formatCents(p.amount_cents)}
                  </p>
                  <p className="text-[11px] text-navy-400">
                    {formatDateTime(p.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
