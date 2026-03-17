'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, ChevronRight } from 'lucide-react'
import type { Municipality } from '@/lib/types'

type MunicipalityTableProps = {
  municipalities: Municipality[]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function MunicipalityTable({ municipalities }: MunicipalityTableProps) {
  const [search, setSearch] = useState('')
  const router = useRouter()

  const filtered = municipalities.filter(m => {
    const q = search.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      m.county.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, county, or state..."
          className="input-field pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy-50 mb-4">
            <MapPin className="w-8 h-8 text-navy-300" />
          </div>
          <p className="text-navy-500 font-medium">
            {search ? 'No municipalities match your search' : 'No municipalities yet'}
          </p>
          <p className="text-sm text-navy-400 mt-1">
            {search ? 'Try a different search term' : 'Add your first municipality to get started'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block glass-card rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-100/50">
                  <th className="text-left px-5 py-3 section-title">Name</th>
                  <th className="text-left px-5 py-3 section-title">County</th>
                  <th className="text-left px-5 py-3 section-title">State</th>
                  <th className="text-center px-5 py-3 section-title">Status</th>
                  <th className="text-left px-5 py-3 section-title hidden lg:table-cell">Created</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((mun, i) => (
                  <tr
                    key={mun.id}
                    onClick={() => router.push(`/admin/municipalities/${mun.id}`)}
                    className="table-row-hover cursor-pointer border-b border-navy-50/50 last:border-0 animate-fade-in-up"
                    style={{ animationDelay: `${(i + 1) * 50}ms`, animationFillMode: 'both' }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <MapPin className={`w-3.5 h-3.5 ${mun.is_active ? 'text-brand-500' : 'text-navy-300'}`} />
                        <span className="font-semibold text-navy-800 text-sm">{mun.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-navy-600">{mun.county}</td>
                    <td className="px-5 py-3.5 text-sm text-navy-500">{mun.state}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        mun.is_active
                          ? 'bg-emerald-100/80 text-emerald-700'
                          : 'bg-navy-100 text-navy-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          mun.is_active ? 'bg-emerald-500 status-dot-pulse' : 'bg-navy-400'
                        }`} />
                        {mun.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-navy-400 hidden lg:table-cell">
                      {formatDate(mun.created_at)}
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
            {filtered.map((mun, i) => (
              <div
                key={mun.id}
                onClick={() => router.push(`/admin/municipalities/${mun.id}`)}
                className="glass-card rounded-xl p-4 card-lift cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${(i + 1) * 60}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-3.5 h-3.5 ${mun.is_active ? 'text-brand-500' : 'text-navy-300'}`} />
                    <p className="font-semibold text-navy-800 text-sm">{mun.name}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    mun.is_active
                      ? 'bg-emerald-100/80 text-emerald-700'
                      : 'bg-navy-100 text-navy-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      mun.is_active ? 'bg-emerald-500' : 'bg-navy-400'
                    }`} />
                    {mun.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-navy-400">
                  <span>{mun.county} County</span>
                  <span>·</span>
                  <span>{mun.state}</span>
                  <span>·</span>
                  <span>{formatDate(mun.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
