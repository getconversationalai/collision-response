'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, User, Mail, Phone, MapPin, Check, X, Loader2, Gift, CreditCard,
} from 'lucide-react'
import { approveApplication, rejectApplication, resendApprovalEmail, resendRejectionEmail } from '@/lib/actions/application-actions'
import { formatPhoneDisplay } from '@/lib/phone'
import type { ApplicationDetail } from '@/lib/actions/application-actions'

export default function ApplicationReview({ detail }: { detail: ApplicationDetail }) {
  const router = useRouter()
  const { application: a, municipalityNames, defaultPriceCents } = detail
  const isPending = a.status === 'pending'

  const [comp, setComp] = useState(false)
  const [priceDollars, setPriceDollars] = useState((defaultPriceCents / 100).toFixed(2))
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(a.created_company_id)

  async function handleApprove() {
    setLoading('approve'); setError('')
    try {
      // Blank price falls back to the system default (resolveActivation uses
      // defaultPriceCents when priceCents is null); comp ignores price entirely.
      const priceCents = comp || priceDollars.trim() === ''
        ? null
        : Math.round(parseFloat(priceDollars) * 100)
      const res = await approveApplication(a.id, { priceCents, comp })
      setCompanyId(res.companyId)
      setDone('approved')
      if (!res.emailSent) setError('Approved, but the welcome email could not be sent. Use "Resend email" below.')
      else router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setLoading(null)
    }
  }

  async function handleReject() {
    setLoading('reject'); setError('')
    try {
      const res = await rejectApplication(a.id, reason)
      setDone('rejected')
      if (!res.emailSent) setError('Rejected, but the decline email could not be sent. Use "Resend email" below.')
      else router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setLoading(null)
    }
  }

  async function handleResend() {
    setResending(true); setError('')
    try {
      const flow = done ?? a.status   // works for in-session actions and revisits
      const res = flow === 'rejected' ? await resendRejectionEmail(a.id) : await resendApprovalEmail(a.id)
      if (res.ok) { setResent(true); setError('') }
      else setError('Could not resend the email. Please try again.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the email.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="page-wrapper max-w-3xl">
      <Link href="/admin/applications" className="inline-flex items-center gap-1.5 text-sm text-navy-400 hover:text-navy-600 mb-6 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to applications
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold gradient-text">{a.company_name}</h1>
          <p className="text-sm text-navy-400 mt-1">Submitted {new Date(a.created_at).toLocaleString()}</p>
        </div>
        <StatusBadge status={done ?? a.status} />
      </div>

      {/* Details */}
      <div className="glass-card rounded-2xl p-6 mb-5">
        <h3 className="section-title mb-4">Applicant details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Detail icon={Building2} label="Company" value={a.company_name} />
          <Detail icon={User} label="Contact" value={a.contact_name} />
          <Detail icon={Mail} label="Email" value={a.email} />
          <Detail icon={Phone} label="Phone" value={`+1 ${formatPhoneDisplay(a.phone.replace('+1', ''))}`} />
          {a.phone_secondary && <Detail icon={Phone} label="Secondary" value={`+1 ${formatPhoneDisplay(a.phone_secondary.replace('+1', ''))}`} />}
        </div>
        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-400 mb-2"><MapPin className="w-3.5 h-3.5" /> Requested coverage areas</p>
          <div className="flex flex-wrap gap-1.5">
            {municipalityNames.length === 0 ? <span className="text-sm text-navy-400">None</span> :
              municipalityNames.map((n) => (
                <span key={n} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-100/80 text-brand-700">{n}</span>
              ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-3 bg-gold-50/80 border border-gold-200/60 text-gold-800 text-sm rounded-xl px-4 py-3.5">
          <span className="font-medium flex-1">{error}</span>
          {done && (
            <button onClick={handleResend} disabled={resending}
              className="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap flex items-center gap-1.5">
              {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Resend email'}
            </button>
          )}
        </div>
      )}

      {resent && (
        <div className="mb-5 flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/60 text-emerald-700 text-sm rounded-xl px-4 py-3">
          <Check className="w-4 h-4" /> <span className="font-medium">Email resent.</span>
        </div>
      )}

      {a.status === 'rejected' && a.rejection_reason && (
        <div className="glass-card rounded-2xl p-5 mb-5">
          <p className="text-xs font-semibold text-navy-400 mb-1">Rejection reason</p>
          <p className="text-sm text-navy-700">{a.rejection_reason}</p>
        </div>
      )}

      {/* Decision panel — only for pending, and only until acted on */}
      {isPending && !done && (
        <div className="glass-card-rich rounded-2xl p-6">
          <h3 className="text-lg font-bold text-navy-800 mb-4">Decision</h3>

          {!rejecting ? (
            <>
              {/* Comp toggle */}
              <button type="button" onClick={() => setComp((c) => !c)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all mb-4 ${
                  comp ? 'bg-gold-50/80 border-gold-200' : 'bg-white/60 border-navy-200/40 hover:border-navy-300/60'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${comp ? 'bg-gold-100' : 'bg-navy-100'}`}>
                  <Gift className={`w-4.5 h-4.5 ${comp ? 'text-gold-600' : 'text-navy-400'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-navy-800">Comp this client (free)</p>
                  <p className="text-xs text-navy-400">Activate immediately, no card required.</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${comp ? 'bg-gold-500 border-gold-500' : 'border-navy-300'}`}>
                  {comp && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>

              {/* Price (hidden when comped) */}
              {!comp && (
                <div className="mb-5 animate-fade-in">
                  <label className="block text-sm font-semibold text-navy-700 mb-2">
                    <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-navy-400" /> Monthly price</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-navy-500 bg-navy-50/60 px-3 py-2.5 rounded-xl border border-navy-200/40">$</span>
                    <input type="number" min="1" step="0.01" value={priceDollars}
                      onChange={(e) => setPriceDollars(e.target.value)} className="input-field flex-1" />
                  </div>
                  <p className="mt-1.5 text-xs text-navy-400">The client adds a card via Stripe Checkout to activate alerts.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={handleApprove} disabled={loading !== null} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading === 'approve' ? <><Loader2 className="w-4 h-4 animate-spin" /> Approving...</> : <><Check className="w-4 h-4" /> Approve</>}
                </button>
                <button onClick={() => setRejecting(true)} disabled={loading !== null}
                  className="btn-secondary flex items-center justify-center gap-2 px-5 hover:!text-red-600 hover:!border-red-200">
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm font-semibold text-navy-700 mb-2">Reason (optional &mdash; included in the email)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                className="input-field resize-none mb-4" placeholder="e.g. Outside our current service area." />
              <div className="flex gap-3">
                <button onClick={handleReject} disabled={loading !== null}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 !bg-gradient-to-r !from-red-600 !to-red-500">
                  {loading === 'reject' ? <><Loader2 className="w-4 h-4 animate-spin" /> Rejecting...</> : <>Confirm reject</>}
                </button>
                <button onClick={() => setRejecting(false)} disabled={loading !== null} className="btn-secondary px-5">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {done === 'approved' && (
        <div className="glass-card-rich rounded-2xl p-6 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-emerald-100 items-center justify-center mb-3">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <p className="text-base font-bold text-navy-800">Approved &amp; provisioned</p>
          <p className="text-sm text-navy-400 mt-1">The client has been emailed a link to set their password and log in.</p>
          {companyId && (
            <Link href={`/admin/clients/${companyId}`} className="btn-secondary inline-flex mt-4">View client record</Link>
          )}
        </div>
      )}

      {done === 'rejected' && (
        <div className="glass-card-rich rounded-2xl p-6 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-navy-100 items-center justify-center mb-3">
            <X className="w-7 h-7 text-navy-500" />
          </div>
          <p className="text-base font-bold text-navy-800">Application rejected</p>
          <p className="text-sm text-navy-400 mt-1">The applicant has been emailed a courteous decline.</p>
          <Link href="/admin/applications" className="btn-secondary inline-flex mt-4">Back to applications</Link>
        </div>
      )}

      {/* Revisiting an already-reviewed application (e.g. a second click of the
          email link): show the outcome + a persistent way to resend the email. */}
      {!done && a.status !== 'pending' && (
        <div className="glass-card-rich rounded-2xl p-6 text-center">
          <div className={`inline-flex w-14 h-14 rounded-full items-center justify-center mb-3 ${a.status === 'approved' ? 'bg-emerald-100' : 'bg-navy-100'}`}>
            {a.status === 'approved' ? <Check className="w-7 h-7 text-emerald-600" /> : <X className="w-7 h-7 text-navy-500" />}
          </div>
          <p className="text-base font-bold text-navy-800">
            {a.status === 'approved' ? 'Application approved' : 'Application rejected'}
          </p>
          <p className="text-sm text-navy-400 mt-1">
            {a.status === 'approved'
              ? 'The client was emailed a link to set their password and log in.'
              : 'The applicant was emailed a courteous decline.'}
            {a.reviewed_at ? ` Reviewed ${new Date(a.reviewed_at).toLocaleDateString()}.` : ''}
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            {a.status === 'approved' && a.created_company_id && (
              <Link href={`/admin/clients/${a.created_company_id}`} className="btn-secondary inline-flex">View client record</Link>
            )}
            <button onClick={handleResend} disabled={resending}
              className="btn-secondary inline-flex items-center gap-1.5">
              {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resend email'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-400 mb-1"><Icon className="w-3.5 h-3.5" /> {label}</p>
      <p className="text-sm font-semibold text-navy-800 break-words">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-gold-50 text-gold-700 border-gold-200/60',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    rejected: 'bg-red-50 text-red-600 border-red-200/60',
  }
  return <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border capitalize ${styles[status] ?? ''}`}>{status}</span>
}
