'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, ChevronRight } from 'lucide-react'
import type { ClientWithSubscriptionCount } from '@/lib/actions/admin-actions'

type ClientTableProps = {
  clients: ClientWithSubscriptionCount[]
}

function formatPhone(phone: string | null) {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ClientTable({ clients }: ClientTableProps) {
  const [search, setSearch] = useState('')
  const router = useRouter()

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return (
      c.company_name.toLowerCase().includes(q) ||
      (c.contact_name?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    )
  })

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-6 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by company, contact, or email..."
          className="input-field pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy-50 mb-4">
            <Users className="w-8 h-8 text-navy-300" />
          </div>
          <p className="text-navy-500 font-medium">
            {search ? 'No clients match your search' : 'No clients yet'}
          </p>
          <p className="text-sm text-navy-400 mt-1">
            {search ? 'Try a different search term' : 'Add your first client to get started'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block glass-card rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-100/50">
                  <th className="text-left px-5 py-3 section-title">Company</th>
                  <th className="text-left px-5 py-3 section-title">Contact</th>
                  <th className="text-left px-5 py-3 section-title hidden lg:table-cell">Phone</th>
                  <th className="text-left px-5 py-3 section-title hidden lg:table-cell">Email</th>
                  <th className="text-center px-5 py-3 section-title">Subs</th>
                  <th className="text-center px-5 py-3 section-title">Status</th>
                  <th className="text-left px-5 py-3 section-title hidden xl:table-cell">Added</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, i) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/admin/clients/${client.id}`)}
                    className="table-row-hover cursor-pointer border-b border-navy-50/50 last:border-0 animate-fade-in-up"
                    style={{ animationDelay: `${(i + 1) * 50}ms`, animationFillMode: 'both' }}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-navy-800 text-sm">{client.company_name}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-navy-600">{client.contact_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-navy-500 hidden lg:table-cell">{formatPhone(client.phone)}</td>
                    <td className="px-5 py-3.5 text-sm text-navy-500 hidden lg:table-cell">{client.email ?? '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100/80 text-brand-700">
                        {client.subscription_count}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        client.is_active
                          ? 'bg-emerald-100/80 text-emerald-700'
                          : 'bg-navy-100 text-navy-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          client.is_active ? 'bg-emerald-500 status-dot-pulse' : 'bg-navy-400'
                        }`} />
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-navy-400 hidden xl:table-cell">
                      {formatDate(client.created_at)}
                    </td>
                    <td className="px-3 py-3.5">
                      <ChevronRight className="w-4 h-4 text-navy-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((client, i) => (
              <div
                key={client.id}
                onClick={() => router.push(`/admin/clients/${client.id}`)}
                className="glass-card rounded-xl p-4 card-lift cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${(i + 1) * 60}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-navy-800 text-sm">{client.company_name}</p>
                    <p className="text-xs text-navy-400 mt-0.5">{client.contact_name}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    client.is_active
                      ? 'bg-emerald-100/80 text-emerald-700'
                      : 'bg-navy-100 text-navy-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      client.is_active ? 'bg-emerald-500' : 'bg-navy-400'
                    }`} />
                    {client.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-navy-400">
                  <span>{formatPhone(client.phone)}</span>
                  <span>·</span>
                  <span>{client.subscription_count} subs</span>
                  <span>·</span>
                  <span>{formatDate(client.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
