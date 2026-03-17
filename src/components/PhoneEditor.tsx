'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function toE164(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function formatPhone(e164: string): string {
  const match = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`
  return e164
}

export default function PhoneEditor({
  companyId,
  initialPhone,
}: {
  companyId: string
  initialPhone: string | null
}) {
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [inputValue, setInputValue] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function startEditing() {
    setInputValue(phone.startsWith('+1') ? phone.slice(2) : phone)
    setEditing(true)
    setError('')
    setSaved(false)
  }

  function cancel() {
    setEditing(false)
    setError('')
  }

  async function save() {
    const e164 = toE164(inputValue)
    if (!e164) {
      setError('Enter a valid 10-digit US phone number.')
      return
    }

    setSaving(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('collision_companies')
      .update({ phone: e164 })
      .eq('id', companyId)

    setSaving(false)

    if (updateError) {
      setError('Failed to save. Please try again.')
      return
    }

    setPhone(e164)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="glass-card-rich rounded-2xl p-5 sm:p-6 card-lift">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 shadow-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          </svg>
        </div>
        <div>
          <h2 className="section-title">SMS Phone Number</h2>
          <p className="text-[11px] text-navy-400 mt-0.5">Where you receive MVA alerts</p>
        </div>
      </div>

      {!editing ? (
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xl font-bold text-navy-900 tracking-tight">
            {phone ? formatPhone(phone) : 'Not set'}
          </span>
          <button
            onClick={startEditing}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm text-brand-600 hover:text-brand-700 font-semibold bg-brand-50/80 hover:bg-brand-100/80 rounded-lg transition-all duration-300 hover:shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Edit
          </button>
          {saved && (
            <span className="animate-bounce-soft inline-flex items-center gap-1.5 text-sm text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Saved
            </span>
          )}
        </div>
      ) : (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-navy-400 select-none bg-navy-50 px-2.5 py-2.5 rounded-l-xl border border-r-0 border-navy-200/60">+1</span>
            <input
              type="tel"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="2125551234"
              className="input-field max-w-xs !rounded-l-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') cancel()
              }}
            />
          </div>
          {error && (
            <p className="animate-fade-in-down text-sm text-red-600 font-medium flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : 'Save number'}
            </button>
            <button onClick={cancel} disabled={saving} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
