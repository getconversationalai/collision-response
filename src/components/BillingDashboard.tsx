'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CreditCard,
  Calendar,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  ExternalLink,
  XCircle,
  Clock,
  ShieldCheck,
  Ban,
  X,
} from 'lucide-react'
import {
  createCheckoutSession,
  createPortalSession,
  cancelSubscriptionAtPeriodEnd,
  type BillingPageData,
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATUS_META: Record<
  BillingStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  pending: { label: 'Pending', bg: 'bg-gold-50', text: 'text-gold-700', dot: 'bg-gold-500' },
  active: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  past_due: { label: 'Past due', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  canceled: { label: 'Canceled', bg: 'bg-navy-100', text: 'text-navy-500', dot: 'bg-navy-400' },
  comped: { label: 'Comped', bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500' },
}

const PAYMENT_STATUS_META: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  succeeded: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/60' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200/60' },
  refunded: { bg: 'bg-navy-50', text: 'text-navy-600', border: 'border-navy-200/60' },
}

export default function BillingDashboard({ data }: { data: BillingPageData }) {
  const searchParams = useSearchParams()
  const checkoutResult = searchParams.get('checkout')

  const { state, paymentMethod } = data
  const [cancelScheduled, setCancelScheduled] = useState(data.cancelAtPeriodEnd)
  const [busy, setBusy] = useState<null | 'checkout' | 'portal' | 'cancel'>(null)
  const [error, setError] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const status = STATUS_META[state.billingStatus]
  const needsCard =
    state.billingStatus === 'pending' || state.billingStatus === 'canceled'
  const canManageCard =
    state.billingStatus === 'active' || state.billingStatus === 'past_due'
  const canCancel =
    state.billingStatus === 'active' && !state.isComped && !cancelScheduled

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

  async function handleCancel() {
    setBusy('cancel')
    setError('')
    try {
      await cancelSubscriptionAtPeriodEnd()
      setCancelScheduled(true)
      setShowCancelConfirm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel the subscription')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex items-center gap-3 animate-fade-in-up">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600">
          <CreditCard className="w-4 h-4" />
        </div>
        <h2 className="section-title">Billing</h2>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${status.bg} ${status.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* Checkout redirect result */}
      {checkoutResult === 'success' && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-sm rounded-xl px-4 py-3.5 animate-fade-in-down">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="font-medium">
            Payment received. Your subscription is active and SMS notifications
            are on.
          </span>
        </div>
      )}
      {checkoutResult === 'canceled' && (
        <div className="flex items-start gap-3 bg-navy-50 border border-navy-200/60 text-navy-600 text-sm rounded-xl px-4 py-3.5 animate-fade-in-down">
          <X className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="font-medium">
            Checkout was canceled. No card was saved and no charge was made.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200/60 text-red-700 text-sm rounded-xl px-4 py-3.5 animate-fade-in-down">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="font-medium">{error}</span>
          <button onClick={() => setError('')} className="ml-auto shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status-driven banners */}
      {state.billingStatus === 'past_due' && (
        <div className="flex items-start gap-3 bg-gradient-to-r from-red-50 to-red-50/50 border border-red-200/60 text-red-700 text-sm rounded-xl px-4 py-4 animate-fade-in-down">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Your last payment failed.</p>
            <p className="text-red-600/90 mt-0.5">
              SMS notifications are paused. Update your card to restore service.
            </p>
          </div>
        </div>
      )}
      {state.billingStatus === 'pending' && (
        <div className="flex items-start gap-3 bg-gradient-to-r from-gold-50 to-gold-50/50 border border-gold-200/60 text-gold-800 text-sm rounded-xl px-4 py-4 animate-fade-in-down">
          <Clock className="w-5 h-5 mt-0.5 shrink-0 text-gold-600" />
          <div>
            <p className="font-bold">Add a card to activate SMS notifications.</p>
            <p className="text-gold-700/90 mt-0.5">
              Billing starts as soon as your card is added &mdash; there is no free
              trial.
            </p>
          </div>
        </div>
      )}
      {state.isComped && (
        <div className="flex items-start gap-3 bg-gradient-to-r from-brand-50 to-brand-50/50 border border-brand-200/60 text-brand-700 text-sm rounded-xl px-4 py-4 animate-fade-in-down">
          <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Your account is comped.</p>
            <p className="text-brand-600/90 mt-0.5">
              SMS notifications are active at no charge. No card is required.
            </p>
          </div>
        </div>
      )}
      {cancelScheduled && state.billingStatus === 'active' && (
        <div className="flex items-start gap-3 bg-gradient-to-r from-gold-50 to-gold-50/50 border border-gold-200/60 text-gold-800 text-sm rounded-xl px-4 py-4 animate-fade-in-down">
          <Ban className="w-5 h-5 mt-0.5 shrink-0 text-gold-600" />
          <div>
            <p className="font-bold">
              Service ends {formatDate(state.currentPeriodEnd)}.
            </p>
            <p className="text-gold-700/90 mt-0.5">
              Your subscription is set to cancel at the end of the current
              period. You keep SMS until then.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan + card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan card */}
          <div className="glass-card-rich rounded-2xl p-6 animate-fade-in-up">
            <h3 className="section-title mb-5">Subscription</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400">
                  Monthly price
                </p>
                <p className="text-2xl font-extrabold text-navy-900 mt-1">
                  {formatCents(state.priceCents)}
                  <span className="text-sm font-semibold text-navy-400">
                    {' '}
                    / month
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-navy-400">
                  {cancelScheduled ? 'Service ends' : 'Next billing date'}
                </p>
                <p className="text-2xl font-extrabold text-navy-900 mt-1 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-navy-300" />
                  {formatDate(state.currentPeriodEnd)}
                </p>
              </div>
            </div>
          </div>

          {/* Card on file */}
          <div
            className="glass-card rounded-2xl p-6 animate-fade-in-up"
            style={{ animationDelay: '80ms', animationFillMode: 'both' }}
          >
            <h3 className="section-title mb-4">Payment method</h3>
            {paymentMethod ? (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-navy-50/40 border border-navy-100/60">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-navy-100">
                  <CreditCard className="w-5 h-5 text-navy-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-navy-800 capitalize">
                    {paymentMethod.brand} &bull;&bull;&bull;&bull; {paymentMethod.last4}
                  </p>
                  <p className="text-xs text-navy-400 font-medium">
                    Expires{' '}
                    {String(paymentMethod.expMonth).padStart(2, '0')}/
                    {paymentMethod.expYear}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-navy-400 py-2">
                {state.isComped
                  ? 'No card required for comped accounts.'
                  : 'No card on file yet.'}
              </p>
            )}

            {!state.isComped && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {needsCard && (
                  <button
                    onClick={handleCheckout}
                    disabled={busy !== null}
                    className="btn-primary flex items-center gap-2"
                  >
                    {busy === 'checkout' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    Add card
                  </button>
                )}
                {canManageCard && (
                  <button
                    onClick={handlePortal}
                    disabled={busy !== null}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {busy === 'portal' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Update card
                  </button>
                )}
                {canCancel && !showCancelConfirm && (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 border border-red-200/60 bg-red-50/60 hover:bg-red-100/70 transition-all duration-300 disabled:opacity-40"
                  >
                    <Ban className="w-4 h-4" />
                    Cancel subscription
                  </button>
                )}
              </div>
            )}

            {/* Cancel confirmation */}
            {showCancelConfirm && (
              <div className="mt-4 p-4 rounded-xl bg-red-50/70 border border-red-200/60 animate-fade-in">
                <p className="text-sm font-semibold text-red-700">
                  Cancel your subscription?
                </p>
                <p className="text-xs text-red-600/90 mt-1">
                  Service continues until{' '}
                  <span className="font-bold">
                    {formatDate(state.currentPeriodEnd)}
                  </span>
                  . You will not be charged again, and SMS stops after that date.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleCancel}
                    disabled={busy === 'cancel'}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {busy === 'cancel' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Ban className="w-3.5 h-3.5" />
                    )}
                    Yes, cancel
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={busy === 'cancel'}
                    className="btn-secondary text-sm py-2"
                  >
                    Keep subscription
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment history */}
        <div
          className="glass-card rounded-2xl p-6 animate-fade-in-up"
          style={{ animationDelay: '160ms', animationFillMode: 'both' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-navy-400" />
            <h3 className="section-title">Payment history</h3>
          </div>
          {state.payments.length === 0 ? (
            <p className="text-sm text-navy-400 py-4 text-center">
              No payments yet.
            </p>
          ) : (
            <div className="space-y-2">
              {state.payments.map((p) => {
                const meta =
                  PAYMENT_STATUS_META[p.status] ?? PAYMENT_STATUS_META.refunded
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-navy-50/30 border border-navy-100/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-navy-800">
                        {formatCents(p.amount_cents)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.bg} ${meta.text} ${meta.border}`}
                      >
                        {p.status === 'failed' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {p.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-navy-400 font-medium mt-1">
                      {formatDateTime(p.created_at)}
                    </p>
                    {p.failure_reason && (
                      <p className="text-[11px] text-red-500 mt-1">
                        {p.failure_reason}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
