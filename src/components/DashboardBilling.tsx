'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  AlertTriangle,
  Clock,
  Loader2,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import {
  createCheckoutSession,
  createPortalSession,
  type BillingState,
} from '@/lib/actions/billing-actions'

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

/**
 * Dashboard billing block: the status banner (red for past_due, yellow for
 * pending) plus a compact billing summary card. Rendered above the location
 * toggles on the client dashboard.
 */
export default function DashboardBilling({ state }: { state: BillingState }) {
  const [busy, setBusy] = useState<null | 'checkout' | 'portal'>(null)
  const [error, setError] = useState('')

  const needsCard =
    state.billingStatus === 'pending' || state.billingStatus === 'canceled'

  async function handleCheckout() {
    setBusy('checkout')
    setError('')
    try {
      const { url } = await createCheckoutSession()
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout')
      setBusy(null)
    }
  }

  async function handlePortal() {
    setBusy('portal')
    setError('')
    try {
      const { url } = await createPortalSession()
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the billing portal')
      setBusy(null)
    }
  }

  const lastPayment = state.payments[0] ?? null

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Past-due: full-width red banner */}
      {state.billingStatus === 'past_due' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl px-6 py-4">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Your last payment failed.</p>
            <p className="text-red-50/90 text-sm">
              SMS notifications are paused. Update your card to restore service.
            </p>
          </div>
          <button
            onClick={handlePortal}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60 shrink-0"
          >
            {busy === 'portal' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            Update card
          </button>
        </div>
      )}

      {/* Pending: yellow banner */}
      {state.billingStatus === 'pending' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gradient-to-r from-gold-50 to-gold-50/60 border border-gold-200/70 text-gold-800 rounded-2xl px-6 py-4">
          <Clock className="w-6 h-6 shrink-0 text-gold-600" />
          <div className="flex-1">
            <p className="font-bold">Add a card to activate SMS notifications.</p>
            <p className="text-gold-700/90 text-sm">
              Your location toggles are inactive until billing is set up. There
              is no free trial — billing starts when the card is added.
            </p>
          </div>
          <button
            onClick={handleCheckout}
            disabled={busy !== null}
            className="btn-primary inline-flex items-center justify-center gap-2 shrink-0"
          >
            {busy === 'checkout' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Add card
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200/60 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Billing summary card */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600">
              {state.isComped ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <CreditCard className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-navy-800">
                {state.isComped
                  ? 'Comped — no charge'
                  : `${formatCents(state.priceCents)} / month`}
              </p>
              <p className="text-xs text-navy-400">
                {state.billingStatus === 'active' &&
                  `Next billing date ${formatDate(state.currentPeriodEnd)}`}
                {state.billingStatus === 'past_due' &&
                  'Payment failed — service paused'}
                {state.billingStatus === 'pending' &&
                  'No card on file yet'}
                {state.billingStatus === 'canceled' &&
                  'Subscription canceled'}
                {state.billingStatus === 'comped' &&
                  'SMS active at no charge'}
                {lastPayment && state.billingStatus === 'active' && (
                  <span className="text-navy-300">
                    {' '}
                    &middot; last payment {lastPayment.status}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {state.billingStatus === 'active' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </span>
            )}
            {needsCard ? (
              <button
                onClick={handleCheckout}
                disabled={busy !== null}
                className="btn-primary inline-flex items-center gap-2 text-sm py-2"
              >
                {busy === 'checkout' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                Add card
              </button>
            ) : !state.isComped ? (
              <button
                onClick={handlePortal}
                disabled={busy !== null}
                className="btn-secondary inline-flex items-center gap-2 text-sm py-2"
              >
                {busy === 'portal' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Update card
              </button>
            ) : null}
            <Link
              href="/billing"
              className="text-xs font-semibold text-navy-400 hover:text-brand-600 transition-colors px-2"
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
