'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PasswordGenerator from '@/components/admin/PasswordGenerator'

export default function SetPasswordForm({
  hasSession, expired, redirectTo, email,
}: {
  hasSession: boolean; expired: boolean; redirectTo: string; email: string | null
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!hasSession || expired) {
    return (
      <div className="glass-card-rich rounded-2xl p-8 text-center">
        <div className="inline-flex w-12 h-12 rounded-full bg-gold-100 items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6 text-gold-600" />
        </div>
        <p className="text-base font-bold text-navy-800">This link has expired</p>
        <p className="text-sm text-navy-400 mt-1 mb-5">Set-password links are single-use and time-limited. Use the link below to request a fresh one.</p>
        <a href="/login" className="btn-secondary inline-flex">Go to login</a>
        <p className="text-xs text-navy-400/70 mt-4">On the login page, choose &ldquo;forgot password&rdquo; to receive a new link, or contact your administrator.</p>
      </div>
    )
  }

  const canSubmit = password.length >= 8 && password === confirm

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message); setLoading(false); return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="glass-card-rich rounded-2xl p-8 space-y-5">
      {email && <p className="text-sm text-navy-500">Setting a password for <span className="font-semibold text-navy-700">{email}</span></p>}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200/60 text-red-700 text-sm rounded-xl px-4 py-3">
          <span className="font-medium">{error}</span>
        </div>
      )}
      <PasswordGenerator password={password} confirmPassword={confirm} onPasswordChange={setPassword} onConfirmChange={setConfirm} />
      <button onClick={handleSubmit} disabled={!canSubmit || loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Set password & continue'}
      </button>
    </div>
  )
}
