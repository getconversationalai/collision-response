'use client'

import { useState } from 'react'
import { Mail, Send, Loader2, Check, X, UserPlus } from 'lucide-react'
import { sendApplicationInvite } from '@/lib/actions/application-actions'

export default function InviteClientForm() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [contactName, setContactName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  function reset() {
    setEmail(''); setContactName(''); setCompanyName(''); setError('')
  }

  async function send() {
    setLoading(true); setError(''); setSentTo(null)
    try {
      const res = await sendApplicationInvite({ email, contactName, companyName })
      if (res.ok) {
        setSentTo(email.trim())
        reset()
      } else {
        setError(res.message ?? 'Could not send the invite.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the invite.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setSentTo(null) }}
        className="btn-primary inline-flex items-center gap-2 shrink-0"
      >
        <UserPlus className="w-4 h-4" /> Invite a client
      </button>
    )
  }

  return (
    <div className="glass-card-rich rounded-2xl p-5 w-full sm:w-[400px] animate-scale-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-brand-500" />
          <h3 className="text-base font-bold text-navy-800">Invite a client</h3>
        </div>
        <button
          onClick={() => { setOpen(false); setSentTo(null) }}
          className="p-1 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {sentTo ? (
        <div className="text-center py-3">
          <div className="inline-flex w-12 h-12 rounded-full bg-emerald-100 items-center justify-center mb-2">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-navy-800">Invite sent to {sentTo}</p>
          <p className="text-xs text-navy-400 mt-1">They&apos;ll get a Collision Ping email with a link to apply.</p>
          <button onClick={() => setSentTo(null)} className="btn-secondary mt-4">Send another</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-navy-600 mb-1.5">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="input-field" placeholder="prospect@company.com"
              onKeyDown={(e) => { if (e.key === 'Enter' && emailValid && !loading) send() }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-navy-600 mb-1.5">Contact name</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="input-field" placeholder="optional" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-600 mb-1.5">Company</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-field" placeholder="optional" />
            </div>
          </div>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          <button
            onClick={send} disabled={!emailValid || loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending&hellip;</> : <><Send className="w-4 h-4" /> Send invite</>}
          </button>
          <p className="text-[11px] text-navy-400 leading-relaxed">
            Sends a branded Collision Ping email with a link that pre-fills their sign-up form.
          </p>
        </div>
      )}
    </div>
  )
}
