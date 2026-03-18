'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import LocationToggle from './LocationToggle'

type Location = {
  id: string
  name: string
  county: string
  state: string
  is_active: boolean
  is_subscribed: boolean
  subscription_id: string | null
}

export default function LocationsSection({
  companyId,
  locations: initialLocations,
  initialActiveCount,
  children,
}: {
  companyId: string
  locations: Location[]
  initialActiveCount: number
  children?: React.ReactNode
}) {
  const [activeCount, setActiveCount] = useState(initialActiveCount)
  const [locations, setLocations] = useState(initialLocations)
  const [bulkPending, setBulkPending] = useState(false)
  const [toggleKey, setToggleKey] = useState(0)

  const allSelected = activeCount === locations.length
  const noneSelected = activeCount === 0

  function handleToggle(newState: boolean) {
    setActiveCount((prev) => newState ? prev + 1 : prev - 1)
  }

  const handleBulkToggle = useCallback(async () => {
    if (bulkPending) return
    setBulkPending(true)

    const subscribeAll = !allSelected
    const supabase = createClient()

    const upserts = locations.map((loc) => ({
      company_id: companyId,
      municipality_id: loc.id,
      is_subscribed: subscribeAll,
    }))

    const { error } = await supabase
      .from('subscriptions')
      .upsert(upserts, { onConflict: 'company_id,municipality_id' })

    if (!error) {
      setLocations((prev) =>
        prev.map((loc) => ({ ...loc, is_subscribed: subscribeAll }))
      )
      setActiveCount(subscribeAll ? locations.length : 0)
      setToggleKey((k) => k + 1)
    }

    setBulkPending(false)
  }, [bulkPending, allSelected, locations, companyId])

  return (
    <>
      {/* Welcome banner */}
      <div className="animate-fade-in-up overflow-hidden rounded-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTMwVjBoLTJ2NEgxMFYwSDh2NGgtMnYyaDJ2MmgyVjZoMjR2Mmgydi0yaDJWNGgtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative px-6 py-6 sm:px-8 sm:py-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
              Welcome back
            </h2>
            <p className="text-brand-100 text-sm font-medium">
              {activeCount > 0
                ? `You're receiving alerts for ${activeCount} location${activeCount !== 1 ? 's' : ''}`
                : 'Enable locations below to start receiving MVA alerts'}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <div className="text-3xl font-extrabold text-white transition-all duration-300">{activeCount}</div>
              <div className="text-xs text-brand-200 font-semibold uppercase tracking-wider">Active</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-right">
              <div className="text-3xl font-extrabold text-white/60">{locations.length}</div>
              <div className="text-xs text-brand-200/60 font-semibold uppercase tracking-wider">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Slot for phone editor or other content between banner and grid */}
      {children}

      {/* Locations grid */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <h2 className="section-title">Location Subscriptions</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkToggle}
              disabled={bulkPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                allSelected
                  ? 'bg-navy-100/80 text-navy-600 hover:bg-navy-200/80 border border-navy-200/50'
                  : 'bg-brand-50 text-brand-600 hover:bg-brand-100 border border-brand-100'
              } ${bulkPending ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {bulkPending ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : allSelected ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-600 border border-brand-100 transition-all duration-300">
              {activeCount} / {locations.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {locations.map((location, i) => (
            <div
              key={`${location.id}-${toggleKey}`}
              className="animate-fade-in-up"
              style={{ animationDelay: `${0.05 * (i + 1) + 0.2}s`, animationFillMode: 'both' }}
            >
              <LocationToggle
                companyId={companyId}
                municipality={location}
                onToggle={handleToggle}
              />
            </div>
          ))}
        </div>

        {locations.length === 0 && (
          <div className="glass-card-rich rounded-2xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-navy-100 text-navy-400 mb-4 animate-float">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <p className="text-sm text-navy-500 font-medium">No locations available.</p>
          </div>
        )}
      </div>
    </>
  )
}
