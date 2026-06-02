'use client'

import { useState } from 'react'
import { Loader2, Check, AlertTriangle } from 'lucide-react'
import { adminSetSystemDefaultPrice } from '@/lib/actions/billing-actions'

/**
 * Editable global default monthly price. Shown in dollars, stored in cents.
 * Changing it does NOT re-price existing clients (spec §3.3).
 */
export default function DefaultPriceForm({
  initialCents,
}: {
  initialCents: number
}) {
  const [dollars, setDollars] = useState((initialCents / 100).toFixed(2))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    const parsed = Math.round(parseFloat(dollars) * 100)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) {
      setError('Enter a dollar amount between $0 and $10,000')
      return
    }
    setSaving(true)
    try {
      await adminSetSystemDefaultPrice(parsed)
      setDollars((parsed / 100).toFixed(2))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card-rich rounded-2xl p-6 animate-fade-in-up">
      <h2 className="section-title mb-1.5">Default Monthly Price</h2>
      <p className="text-xs text-navy-400 mb-4">
        Applied to new clients and any client without a per-client override.
        Changing it does not re-price existing subscriptions.
      </p>

      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-[200px]">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-navy-400 mb-1.5">
            Price (USD / month)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy-500 bg-navy-50/60 px-3 py-2.5 rounded-xl border border-navy-200/40">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
              className="input-field flex-1"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : null}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Default'}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
