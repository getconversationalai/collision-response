'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, ChevronRight, ChevronUp, ChevronDown, Filter } from 'lucide-react'
import type { Municipality } from '@/lib/types'

type MunicipalityTableProps = {
  municipalities: Municipality[]
}

type SortKey = 'name' | 'county' | 'state' | 'is_active' | 'created_at'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'active' | 'inactive'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (column !== sortKey) {
    return <ChevronDown className="w-3 h-3 text-navy-300 opacity-0 group-hover:opacity-100 transition-opacity" />
  }
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-brand-500" />
    : <ChevronDown className="w-3 h-3 text-brand-500" />
}

export default function MunicipalityTable({ municipalities }: MunicipalityTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const router = useRouter()

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const result = useMemo(() => {
    let list = municipalities

    // Status filter
    if (statusFilter === 'active') list = list.filter(m => m.is_active)
    else if (statusFilter === 'inactive') list = list.filter(m => !m.is_active)

    // Search
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.county.toLowerCase().includes(q) ||
        m.state.toLowerCase().includes(q)
      )
    }

    // Sort
    const sorted = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'county':
          cmp = a.county.localeCompare(b.county)
          break
        case 'state':
          cmp = a.state.localeCompare(b.state)
          break
        case 'is_active':
          cmp = Number(b.is_active) - Number(a.is_active)
          break
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [municipalities, search, sortKey, sortDir, statusFilter])

  const thClass = 'text-left px-5 py-3 section-title cursor-pointer select-none group'

  return (
    <div>
      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, county, or state..."
            className="input-field pl-10"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="input-field pl-9 pr-8 appearance-none cursor-pointer min-w-[140px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {result.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy-50 mb-4">
            <MapPin className="w-8 h-8 text-navy-300" />
          </div>
          <p className="text-navy-500 font-medium">
            {search || statusFilter !== 'all' ? 'No municipalities match your filters' : 'No municipalities yet'}
          </p>
          <p className="text-sm text-navy-400 mt-1">
            {search || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Add your first municipality to get started'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block glass-card rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-100/50">
                  <th className={thClass} onClick={() => toggleSort('name')}>
                    <span className="inline-flex items-center gap-1">Name <SortIcon column="name" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th className={thClass} onClick={() => toggleSort('county')}>
                    <span className="inline-flex items-center gap-1">County <SortIcon column="county" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th className={thClass} onClick={() => toggleSort('state')}>
                    <span className="inline-flex items-center gap-1">State <SortIcon column="state" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th className="text-center px-5 py-3 section-title cursor-pointer select-none group" onClick={() => toggleSort('is_active')}>
                    <span className="inline-flex items-center gap-1">Status <SortIcon column="is_active" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th className={`${thClass} hidden lg:table-cell`} onClick={() => toggleSort('created_at')}>
                    <span className="inline-flex items-center gap-1">Created <SortIcon column="created_at" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {result.map((mun, i) => (
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
            {result.map((mun, i) => (
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
