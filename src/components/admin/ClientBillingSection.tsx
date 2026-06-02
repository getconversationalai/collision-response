'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard,
  Loader2,
  Check,
  AlertTriangle,
  ExternalLink,
  Gift,
  X,
} from 'lucide-react'
import {
  adminGetClientBilling,
  adminSetClientPrice,
  adminCompClient,
  type AdminClientBilling,
} from '@/lib/actions/billing-actions'
import type { BillingStatus } from '@/lib/types'

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return '—'
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_META: Record<
  BillingStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  pending: { label: 'Pending', bg: 'bg-gold-100/80', text: 'text-gold-700', dot: 'bg-gold-500' },
  active: { label: 'Active', bg: 'bg-emerald-100/80', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  past_due: { label: 'Past Due', bg: 'bg-red-100/80', text: 'text-red-700', dot: 'bg-red-500' },
  canceled: { label: 'Canceled', bg: 'bg-navy-100', text: 'text-navy-500', dot: 'bg-navy-400' },
  comped: { label: 'Comped', bg: 'bg-brand-100/80', text: 'text-brand-700', dot: 'bg-brand-500' },
}

export default function ClientBillingSection({
  companyId,
}: {
  companyId: string
}) {
  const [billing, setBilling] = useState<AdminClientBilling | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [overrideEnabled, setOverrideEnabled] = useState(false)
  const [priceDollars, setPriceDollars] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  const [priceSaved, setPriceSaved] = useState(false)
  const [showPriceConfirm, setShowPriceConfirm] = useState(false)

  const [savingComp, setSavingComp] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await adminGetClientBilling(companyId)
      setBilling(data)
      setOverrideEnabled(data.monthlyPriceCents !== null)
      setPriceDollars(
        ((data.monthlyPriceCents ?? data.defaultPriceCents) / 100).toFixed(2)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  // The price that WOULD apply after saving, given the current form state.
  function pendingEffectiveCents(): number | null {
    if (!billing) return null
    if (!overrideEnabled) return billing.defaultPriceCents
    const parsed = Math.round(parseFloat(priceDollars) * 100)
    return Number.isFinite(parsed) ? parsed : null
  }

  function priceWouldChange(): boolean {
    const next = pendingEffectiveCents()
    return next !== null && billing !== null && next !== billing.effectivePriceCents
  }

  async function commitPrice() {
    if (!billing) return
    setError('')
    const overrideCents = overrideEnabled
      ? Math.round(parseFloat(priceDollars) * 100)
      : null
    if (
      overrideCents !== null &&
      (!Number.isFinite(overrideCents) || overrideCents < 0 || overrideCents > 1_000_000)
    ) {
      setError('Enter a dollar amount between $0 and $10,000')
      return
    }

    setSavingPrice(true)
    setShowPriceConfirm(false)
    try {
      await adminSetClientPrice(companyId, overrideCents)
      setPriceSaved(true)
      setTimeout(() => setPriceSaved(false), 2000)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update price')
    } finally {
      setSavingPrice(false)
    }
  }

  function handleSavePrice() {
    // Prorating only happens when there's a live subscription AND the
    // effective amount changes — show the confirmation modal then.
    if (billing?.stripeSubscriptionId && priceWouldChange()) {
      setShowPriceConfirm(true)
    } else {
      commitPrice()
    }
  }

  async function handleToggleComp(next: boolean) {
    setError('')
    setSavingComp(true)
    try {
      await adminCompClient(companyId, next)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update comp status')
    } finally {
      setSavingComp(false)
    }
  }

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (!billing) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <h2 className="section-title mb-2">Billing</h2>
        <p className="text-sm text-red-600">{error || 'Billing unavailable'}</p>
      </div>
    )
  }

  const status = STATUS_META[billing.billingStatus]

  return (
    <div className="glass-card rounded-2xl p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-navy-400" />
          <h2 className="section-title">Billing</h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200/60 text-red-700 text-sm rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="font-medium">{error}</span>
          <button onClick={() => setError('')} className="ml-auto shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Read-only facts */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400">
            Effective Price
          </p>
          <p className="text-lg font-extrabold text-navy-800 mt-0.5">
            {formatCents(billing.effectivePriceCents)}
            <span className="text-xs font-semibold text-navy-400"> / mo</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400">
            Current Period Ends
          </p>
          <p className="text-lg font-extrabold text-navy-800 mt-0.5">
            {formatDate(billing.currentPeriodEnd)}
          </p>
        </div>
      </div>

      {/* Price override */}
      <div className="rounded-xl border border-navy-200/40 bg-white/40 p-4 mb-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={overrideEnabled}
            onChange={(e) => {
              setOverrideEnabled(e.target.checked)
              if (!e.target.checked) {
                setPriceDollars((billing.defaultPriceCents / 100).toFixed(2))
              }
            }}
            className="w-4 h-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-semibold text-navy-700">
            Override price for this client
          </span>
        </label>
        <p className="text-[11px] text-navy-400 mt-1 ml-6">
          {overrideEnabled
            ? 'This client is billed at the custom price below.'
            : `Using the system default of ${formatCents(billing.defaultPriceCents)} / month.`}
        </p>

        <div className="flex items-end gap-2 mt-3">
          <div className="flex-1 max-w-[180px]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-navy-500 bg-navy-50/60 px-3 py-2.5 rounded-xl border border-navy-200/40">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={priceDollars}
                disabled={!overrideEnabled}
                onChange={(e) => setPriceDollars(e.target.value)}
                className="input-field flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <button
            onClick={handleSavePrice}
            disabled={savingPrice}
            className="btn-primary flex items-center gap-2"
          >
            {savingPrice ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : priceSaved ? (
              <Check className="w-4 h-4" />
            ) : null}
            {savingPrice ? 'Saving...' : priceSaved ? 'Saved!' : 'Save Price'}
          </button>
        </div>
      </div>

      {/* Comp toggle */}
      <div className="rounded-xl border border-navy-200/40 bg-white/40 p-4 mb-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={billing.isComped}
            disabled={savingComp}
            onChange={(e) => handleToggleComp(e.target.checked)}
            className="w-4 h-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-semibold text-navy-700 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-brand-500" />
            Comp this client
          </span>
          {savingComp && <Loader2 className="w-3.5 h-3.5 animate-spin text-navy-400" />}
        </label>
        <p className="text-[11px] text-navy-400 mt-1 ml-6">
          Comped clients keep SMS at no charge. Comping cancels any paid Stripe
          subscription at period end; un-comping requires the client to re-add a
          card.
        </p>
      </div>

      {/* Stripe link */}
      {billing.stripeCustomerId && (
        <a
          href={`https://dashboard.stripe.com/customers/${billing.stripeCustomerId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View customer in Stripe
        </a>
      )}

      {/* Recent payments */}
      {billing.payments.length > 0 && (
        <div className="mt-5 pt-4 border-t border-navy-100/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400 mb-2">
            Recent Payments
          </p>
          <div className="space-y-1.5">
            {billing.payments.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-xs"
              >
                <span
                  className={`font-semibold ${
                    p.status === 'failed' ? 'text-red-600' : 'text-navy-600'
                  }`}
                >
                  {formatCents(p.amount_cents)} &middot; {p.status}
                </span>
                <span className="text-navy-400">{formatDate(p.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price-change confirmation modal */}
      {showPriceConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-navy-950/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-card-rich rounded-2xl p-6 max-w-sm w-full animate-scale-in">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gold-100 text-gold-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-navy-800">
                Confirm price change
              </h3>
            </div>
            <p className="text-sm text-navy-500 leading-relaxed">
              This will prorate the change on the client&apos;s next invoice.
              The new price is{' '}
              <span className="font-bold text-navy-700">
                {formatCents(pendingEffectiveCents())}
              </span>{' '}
              / month. Continue?
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={commitPrice}
                className="btn-primary flex-1 text-sm py-2"
              >
                Continue
              </button>
              <button
                onClick={() => setShowPriceConfirm(false)}
                className="btn-secondary flex-1 text-sm py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
