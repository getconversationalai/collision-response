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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
      <h2 className="text-sm font-medium text-gray-500 mb-2">Phone Number</h2>

      {!editing ? (
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-gray-900">
            {phone ? formatPhone(phone) : 'Not set'}
          </span>
          <button
            onClick={startEditing}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
          >
            Edit
          </button>
          {saved && (
            <span className="text-sm text-green-600">Saved</span>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">+1</span>
            <input
              type="tel"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="2125551234"
              className="block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
