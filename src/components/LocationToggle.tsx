'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type LocationLike = {
  id: string
  name: string
  display_name?: string | null
  county: string
  parent_id?: string | null
  admin_only?: boolean
  is_subscribed: boolean
}

function useSubscriptionToggle(
  companyId: string,
  municipalityId: string,
  initialSubscribed: boolean,
  onToggle?: (next: boolean) => void,
) {
  const [isSubscribed, setIsSubscribed] = useState(initialSubscribed)
  const [isPending, setIsPending] = useState(false)
  const [justToggled, setJustToggled] = useState(false)

  async function toggle() {
    if (isPending) return

    const previous = isSubscribed
    const next = !isSubscribed
    setIsSubscribed(next)
    onToggle?.(next)
    setJustToggled(true)
    setTimeout(() => setJustToggled(false), 600)

    const supabase = createClient()
    setIsPending(true)

    let error
    if (next) {
      const result = await supabase
        .from('subscriptions')
        .upsert(
          { company_id: companyId, municipality_id: municipalityId, is_subscribed: true },
          { onConflict: 'company_id,municipality_id' }
        )
      error = result.error
    } else {
      const result = await supabase
        .from('subscriptions')
        .update({ is_subscribed: false })
        .eq('company_id', companyId)
        .eq('municipality_id', municipalityId)
      error = result.error
    }

    if (error) {
      setIsSubscribed(previous)
      onToggle?.(previous)
    }
    setIsPending(false)
  }

  return { isSubscribed, isPending, justToggled, toggle }
}

type Variant = 'card' | 'sub'

type LocationToggleProps = {
  companyId: string
  municipality: LocationLike
  onToggle?: (newState: boolean) => void
  variant?: Variant
}

export default function LocationToggle({
  companyId,
  municipality,
  onToggle,
  variant = 'card',
}: LocationToggleProps) {
  const { isSubscribed, isPending, justToggled, toggle } = useSubscriptionToggle(
    companyId,
    municipality.id,
    municipality.is_subscribed,
    onToggle,
  )

  const label = municipality.display_name || municipality.name
  const adminOnly = municipality.admin_only === true
  const isSub = variant === 'sub'

  const clickable = !adminOnly

  return (
    <div
      onClick={clickable ? toggle : undefined}
      className={`card-lift group rounded-2xl select-none flex items-center justify-between transition-all duration-300 min-h-[84px] px-4 py-4
        ${clickable ? 'cursor-pointer' : ''}
        ${isSubscribed
          ? 'glass-card border-brand-200/80 bg-gradient-to-r from-brand-50/80 to-white/80 shadow-card-active'
          : 'glass-card hover:shadow-card-hover'}
        ${justToggled ? 'scale-[1.02]' : ''}
      `}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-500 relative ${
          isSubscribed
            ? 'bg-gradient-to-br from-brand-500 to-brand-400 text-white shadow-sm'
            : 'bg-navy-100/80 text-navy-400 group-hover:bg-navy-200/80 group-hover:text-navy-500'
        }`}>
          <svg className={`w-5 h-5 transition-transform duration-500 ${isSubscribed ? 'scale-110' : 'group-hover:scale-105'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          {adminOnly && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center border border-navy-200/60 shadow-sm">
              <svg className="w-2.5 h-2.5 text-navy-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-sm font-bold truncate transition-colors duration-300 ${
              isSubscribed ? 'text-brand-800' : 'text-navy-700'
            }`}>
              {label}
            </span>
            {adminOnly && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide shrink-0 ${
                isSubscribed
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-navy-100 text-navy-500'
              }`}>
                <span className={`w-1 h-1 rounded-full ${
                  isSubscribed ? 'bg-brand-500 status-dot-pulse' : 'bg-navy-400'
                }`} />
                {isSubscribed ? 'Enabled' : 'Disabled'}
              </span>
            )}
          </div>
          <span className={`block text-[11px] mt-0.5 font-medium transition-colors duration-300 truncate ${
            adminOnly ? 'text-navy-400' :
            isSubscribed ? 'text-brand-500' : 'text-navy-400'
          }`}>
            {adminOnly
              ? 'Contact your admin for assistance'
              : isSub
                ? 'Sub-channel'
                : `${municipality.county} County`}
          </span>
        </div>
      </div>

      {!adminOnly && (
        <button
          role="switch"
          aria-checked={isSubscribed}
          aria-label={`Toggle ${label} notifications`}
          onClick={(e) => { e.stopPropagation(); toggle() }}
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
      )}
    </div>
  )
}
