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

  async function toggle() {
    if (isPending) return

    const previous = isSubscribed
    const next = !isSubscribed
    setIsSubscribed(next)
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
    <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3">
      <div>
        <span className="text-sm font-medium text-gray-900">{municipality.name}</span>
        <span className="text-xs text-gray-400 ml-2">
          {municipality.county} Co.
        </span>
      </div>
      <button
        role="switch"
        aria-checked={isSubscribed}
        onClick={toggle}
        disabled={isPending}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-70 ${
          isSubscribed ? 'bg-brand-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
            isSubscribed ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
