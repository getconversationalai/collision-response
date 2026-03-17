export const runtime = 'edge'

import { getDashboardStats } from '@/lib/actions/admin-actions'
import type { RecentClient } from '@/lib/actions/admin-actions'
import StatsCard from '@/components/admin/StatsCard'
import Link from 'next/link'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats()

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-navy-400 text-sm mt-1 font-medium">
          Manage collision company clients and subscriptions
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatsCard
          label="Active Clients"
          value={stats.totalClients}
          iconName="users"
          color="brand"
          delay={0}
        />
        <StatsCard
          label="Municipalities"
          value={stats.totalMunicipalities}
          iconName="map-pin"
          color="navy"
          delay={100}
        />
        <StatsCard
          label="Recent Additions"
          value={stats.recentClients.length}
          iconName="clock"
          color="gold"
          delay={200}
        />
      </div>

      {/* Add new client CTA */}
      <AdminCTA />

      {/* Recent activity */}
      <div
        className="glass-card rounded-2xl p-6 animate-fade-in-up"
        style={{ animationDelay: '400ms', animationFillMode: 'both' }}
      >
        <h2 className="section-title mb-4">Recent Onboarding Activity</h2>

        {stats.recentClients.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {stats.recentClients.map((client: RecentClient, i: number) => (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-navy-50/50 transition-all duration-200 group animate-fade-in-up"
                style={{ animationDelay: `${500 + i * 80}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50 flex items-center justify-center">
                    <span className="text-sm font-bold text-brand-600">
                      {client.company_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy-800 group-hover:text-brand-700 transition-colors">
                      {client.company_name}
                    </p>
                    <p className="text-xs text-navy-400">{client.contact_name ?? client.email}</p>
                  </div>
                </div>
                <span className="text-xs text-navy-400 font-medium">
                  {formatDate(client.created_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Client sub-components that use Lucide icons
function AdminCTA() {
  // Inline SVG to avoid server→client icon issue
  return (
    <div
      className="glass-card-rich rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up"
      style={{ animationDelay: '300ms', animationFillMode: 'both' }}
    >
      <div>
        <h2 className="text-lg font-bold text-navy-800">Onboard a New Client</h2>
        <p className="text-sm text-navy-400 mt-0.5">Create account, set up credentials, and configure subscriptions</p>
      </div>
      <Link
        href="/admin/clients/new"
        className="btn-primary flex items-center gap-2 px-6 py-3 shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
        </svg>
        Add New Client
      </Link>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-10">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-navy-50 mb-3">
        <svg className="w-7 h-7 text-navy-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      </div>
      <p className="text-navy-500 font-medium text-sm">No clients onboarded yet</p>
      <p className="text-navy-400 text-xs mt-1">Add your first client to see activity here</p>
    </div>
  )
}
