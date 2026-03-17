'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type LocationToggleProps = {
  companyId: string
  municipality: {
    id: string
    name: string
    county: string
    is_subscribed: boolean
  }
}

export default function LocationToggle({
  companyId,
  municipality,
}: LocationToggleProps) {
  const [isSubscribed, setIsSubscribed] = useState(municipality.is_subscribed)
  const [isPending, setIsPending] = useState(false)
  const [justToggled, setJustToggled] = useState(false)

  async function toggle() {
    if (isPending) return

    const previous = isSubscribed
    const next = !isSubscribed
    setIsSubscribed(next)
    setJustToggled(true)
    setTimeout(() => setJustToggled(false), 600)

    const supabase = createClient()
    setIsPending(true)

    let error

    if (next) {
      const result = await supabase
        .from('subscriptions')
        .upsert(
          {
            company_id: companyId,
            municipality_id: municipality.id,
            is_subscribed: true,
          },
          { onConflict: 'company_id,municipality_id' }
        )
      error = result.error
    } else {
      const result = await supabase
        .from('subscriptions')
        .update({ is_subscribed: false })
        .eq('company_id', companyId)
        .eq('municipality_id', municipality.id)
      error = result.error
    }

    if (error) {
      setIsSubscribed(previous)
    }

    setIsPending(false)
  }

  return (
    <div
      className={`card-lift group flex items-center justify-between rounded-2xl px-4 py-4 cursor-pointer select-none
        ${isSubscribed
          ? 'glass-card border-brand-200/80 bg-gradient-to-r from-brand-50/80 to-white/80 shadow-card-active'
          : 'glass-card hover:shadow-card-hover'
        }
        ${justToggled ? 'scale-[1.02]' : ''}
      `}
      onClick={toggle}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-500 ${
          isSubscribed
            ? 'bg-gradient-to-br from-brand-500 to-brand-400 text-white shadow-sm'
            : 'bg-navy-100/80 text-navy-400 group-hover:bg-navy-200/80 group-hover:text-navy-500'
        }`}>
          <svg className={`w-5 h-5 transition-transform duration-500 ${isSubscribed ? 'scale-110' : 'group-hover:scale-105'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
        </div>
        <div className="min-w-0">
          <span className={`block text-sm font-bold truncate transition-colors duration-300 ${
            isSubscribed ? 'text-brand-800' : 'text-navy-700'
          }`}>
            {municipality.name}
          </span>
          <span className={`block text-[11px] mt-0.5 font-medium transition-colors duration-300 ${
            isSubscribed ? 'text-brand-500' : 'text-navy-400'
          }`}>
            {municipality.county} County
          </span>
        </div>
      </div>

      <button
        role="switch"
        aria-checked={isSubscribed}
        aria-label={`Toggle ${municipality.name} notifications`}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        disabled={isPending}
        className={`toggle-track relative inline-flex h-7 w-[52px] shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:ring-offset-2 disabled:opacity-70 ${
          isSubscribed
            ? 'active bg-gradient-to-r from-brand-600 to-brand-400'
            : 'bg-navy-300/60 group-hover:bg-navy-400/60'
        }`}
      >
        <span
          className={`toggle-knob inline-block h-5 w-5 rounded-full bg-white shadow-toggle ${
            isSubscribed ? 'translate-x-[26px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
    </div>
  )
}
