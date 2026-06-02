'use client'

import { useState } from 'react'
import { Mail, Plus, Trash2, Check, Loader2, AlertCircle } from 'lucide-react'
import { updateNotificationEmails } from '@/lib/actions/application-actions'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NotificationEmailsForm({ initialEmails }: { initialEmails: string[] }) {
  const [emails, setEmails] = useState<string[]>(initialEmails)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function addEmail() {
    const e = draft.trim().toLowerCase()
    if (!e) return
    if (!EMAIL_RE.test(e)) { setError('Please enter a valid email address'); return }
    if (emails.includes(e)) { setError('That address is already in the list'); return }
    setEmails((prev) => [...prev, e]); setDraft(''); setError('')
  }

  function removeEmail(e: string) { setEmails((prev) => prev.filter((x) => x !== e)) }

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await updateNotificationEmails(emails)
      setEmails(res.emails); setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card-rich rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-brand-500" />
        <h3 className="text-base font-bold text-navy-800">Application notification emails</h3>
      </div>
      <p className="text-xs text-navy-400 mb-5">These addresses receive an email each time a new application is submitted.</p>

      {/* Add row */}
      <div className="flex gap-2 mb-4">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
          className="input-field flex-1" placeholder="admin@yourcompany.com" type="email" />
        <button onClick={addEmail} className="btn-secondary flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add</button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium mb-3"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>
      )}

      {/* List */}
      {emails.length === 0 ? (
        <p className="text-sm text-navy-400 py-6 text-center bg-navy-50/40 rounded-xl mb-4">
          No recipients yet. Add at least one so applications don&apos;t go unnoticed.
        </p>
      ) : (
        <div className="space-y-2 mb-5">
          {emails.map((e) => (
            <div key={e} className="flex items-center justify-between bg-navy-50/50 rounded-xl px-4 py-2.5">
              <span className="text-sm font-medium text-navy-700">{e}</span>
              <button onClick={() => removeEmail(e)} className="p-1.5 rounded-lg text-navy-400 hover:text-red-600 hover:bg-red-50 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save changes'}
      </button>
    </div>
  )
}
