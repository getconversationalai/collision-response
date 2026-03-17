'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  Save,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  MapPin,
  Power,
  X,
} from 'lucide-react'
import {
  getClientById,
  updateClient,
  toggleClientActive,
  resetClientPassword,
  getMunicipalities,
  updateSubscription,
} from '@/lib/actions/admin-actions'
import type { ClientDetail } from '@/lib/actions/admin-actions'
import type { Municipality } from '@/lib/types'

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&*?'
  const all = upper + lower + digits + symbols
  let pw = ''
  pw += upper[Math.floor(Math.random() * upper.length)]
  pw += lower[Math.floor(Math.random() * lower.length)]
  pw += digits[Math.floor(Math.random() * digits.length)]
  pw += symbols[Math.floor(Math.random() * symbols.length)]
  for (let i = pw.length; i < length; i++) {
    pw += all[Math.floor(Math.random() * all.length)]
  }
  return pw.split('').sort(() => Math.random() - 0.5).join('')
}

type ClientData = ClientDetail

export default function ClientDetailPage() {
  const params = useParams()
  const companyId = params.id as string

  const [data, setData] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Editable fields
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneRaw, setPhoneRaw] = useState('')

  // Password reset
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [passwordResetDone, setPasswordResetDone] = useState(false)

  // Municipalities
  const [allMunicipalities, setAllMunicipalities] = useState<Municipality[]>([])

  const loadData = useCallback(async () => {
    try {
      const [clientData, munis] = await Promise.all([
        getClientById(companyId),
        getMunicipalities(),
      ])
      setData(clientData)
      setAllMunicipalities(munis)
      setCompanyName(clientData.company.company_name)
      setContactName(clientData.company.contact_name ?? '')
      setEmail(clientData.company.email ?? '')
      const phone = clientData.company.phone ?? ''
      const digits = phone.replace(/\D/g, '')
      setPhoneRaw(digits.startsWith('1') ? digits.slice(1) : digits)
    } catch {
      setError('Failed to load client data')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const phoneDigits = phoneRaw.replace(/\D/g, '')
      await updateClient(companyId, {
        company_name: companyName.trim(),
        contact_name: contactName.trim(),
        email: email.trim(),
        phone: `+1${phoneDigits}`,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive() {
    if (!data) return
    const newStatus = !data.company.is_active
    try {
      await toggleClientActive(companyId, newStatus)
      setData(prev => prev ? { ...prev, company: { ...prev.company, is_active: newStatus } } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handlePasswordReset() {
    setResettingPassword(true)
    try {
      await resetClientPassword(companyId, newPassword)
      setPasswordResetDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed')
    } finally {
      setResettingPassword(false)
    }
  }

  async function handleSubscriptionToggle(municipalityId: string, currentlySubscribed: boolean) {
    try {
      await updateSubscription(companyId, municipalityId, !currentlySubscribed)
      const updated = await getClientById(companyId)
      setData(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription')
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-wrapper text-center py-20">
        <p className="text-navy-500 font-medium">Client not found</p>
        <Link href="/admin/clients" className="btn-secondary mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Link>
      </div>
    )
  }

  const subscribedIds = new Set(
    data.subscriptions.filter(s => s.is_subscribed).map(s => s.municipality_id)
  )

  return (
    <div className="page-wrapper">
      {/* Back link */}
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1.5 text-sm text-navy-400 hover:text-navy-600 transition-colors font-medium mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold gradient-text tracking-tight">
              {data.company.company_name}
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              data.company.is_active
                ? 'bg-emerald-100/80 text-emerald-700'
                : 'bg-navy-100 text-navy-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                data.company.is_active ? 'bg-emerald-500 status-dot-pulse' : 'bg-navy-400'
              }`} />
              {data.company.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-navy-400 text-sm mt-1">
            Added {formatDate(data.company.created_at)}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 bg-gradient-to-r from-red-50 to-red-50/50 border border-red-200/60 text-red-700 text-sm rounded-xl px-4 py-3.5 animate-fade-in-down">
          <span className="font-medium">{error}</span>
          <button onClick={() => setError('')} className="ml-auto shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company info card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card-rich rounded-2xl p-6 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
            <h2 className="section-title mb-5">Company Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-navy-400" />
                    Company Name
                  </span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-navy-400" />
                    Contact Person
                  </span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-navy-400" />
                    Email
                  </span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-navy-400" />
                    Phone
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-navy-500 bg-navy-50/60 px-3 py-2.5 rounded-xl border border-navy-200/40">
                    +1
                  </span>
                  <input
                    type="tel"
                    value={formatPhoneInput(phoneRaw)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setPhoneRaw(digits)
                    }}
                    className="input-field flex-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>

          {/* Subscriptions */}
          <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="section-title">Municipality Subscriptions</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100/80 text-brand-700">
                {subscribedIds.size} active
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allMunicipalities.map((mun) => {
                const isSubscribed = subscribedIds.has(mun.id)
                return (
                  <button
                    key={mun.id}
                    onClick={() => handleSubscriptionToggle(mun.id, isSubscribed)}
                    className={`
                      relative p-3 rounded-xl border text-left transition-all duration-300 text-sm
                      ${isSubscribed
                        ? 'bg-brand-50/80 border-brand-200 shadow-sm'
                        : 'bg-white/40 border-navy-200/30 hover:border-navy-300/50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-3.5 h-3.5 ${isSubscribed ? 'text-brand-500' : 'text-navy-300'}`} />
                      <span className={`font-medium ${isSubscribed ? 'text-brand-800' : 'text-navy-600'}`}>
                        {mun.name}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Recent SMS */}
          <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <h2 className="section-title mb-4">Recent Notifications</h2>
            {data.recentSms.length === 0 ? (
              <p className="text-sm text-navy-400 py-4 text-center">No notifications sent yet</p>
            ) : (
              <div className="space-y-2">
                {data.recentSms.map((sms) => (
                  <div key={sms.id} className="flex items-center justify-between p-3 rounded-xl bg-navy-50/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy-700 truncate">
                        {sms.dispatch_log?.incident_type ?? 'Unknown'} — {sms.dispatch_log?.municipality ?? 'N/A'}
                      </p>
                      <p className="text-xs text-navy-400 truncate">{sms.dispatch_log?.address ?? ''}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        sms.status === 'sent' ? 'bg-emerald-100/80 text-emerald-700' :
                        sms.status === 'failed' ? 'bg-red-100/80 text-red-700' :
                        'bg-gold-100/80 text-gold-700'
                      }`}>
                        {sms.status}
                      </span>
                      <span className="text-xs text-navy-400">{formatDate(sms.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-6">
          {/* Password reset */}
          <div className="glass-card rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
            <h3 className="section-title mb-4">Password Management</h3>

            {!showPasswordReset ? (
              <button
                onClick={() => {
                  const pw = generatePassword()
                  setNewPassword(pw)
                  setShowPasswordReset(true)
                  setPasswordResetDone(false)
                  setPasswordCopied(false)
                }}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Password
              </button>
            ) : passwordResetDone ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-emerald-600 mb-2">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-semibold">Password Reset Successfully</span>
                </div>
                <div className="flex items-center justify-between bg-navy-50/50 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-mono font-semibold text-navy-800 truncate">
                    {showNewPassword ? newPassword : '•'.repeat(12)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="p-1.5 rounded-lg hover:bg-navy-100/60 transition-all"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5 text-navy-400" /> : <Eye className="w-3.5 h-3.5 text-navy-400" />}
                    </button>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(newPassword)
                        setPasswordCopied(true)
                        setTimeout(() => setPasswordCopied(false), 2000)
                      }}
                      className="p-1.5 rounded-lg hover:bg-navy-100/60 transition-all"
                    >
                      {passwordCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-navy-400" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPasswordReset(false)
                    setPasswordResetDone(false)
                  }}
                  className="text-xs text-navy-400 hover:text-navy-600 font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between bg-navy-50/50 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-mono font-semibold text-navy-800 truncate">
                    {showNewPassword ? newPassword : '•'.repeat(12)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="p-1.5 rounded-lg hover:bg-navy-100/60 transition-all"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5 text-navy-400" /> : <Eye className="w-3.5 h-3.5 text-navy-400" />}
                    </button>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(newPassword)
                        setPasswordCopied(true)
                        setTimeout(() => setPasswordCopied(false), 2000)
                      }}
                      className="p-1.5 rounded-lg hover:bg-navy-100/60 transition-all"
                    >
                      {passwordCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-navy-400" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePasswordReset}
                    disabled={resettingPassword}
                    className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm py-2"
                  >
                    {resettingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowPasswordReset(false)}
                    className="btn-secondary flex-1 text-sm py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status toggle */}
          <div className="glass-card rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
            <h3 className="section-title mb-4">Account Status</h3>
            <button
              onClick={handleToggleActive}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                data.company.is_active
                  ? 'bg-red-50 text-red-600 border border-red-200/50 hover:bg-red-100/80'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50 hover:bg-emerald-100/80'
              }`}
            >
              <Power className="w-4 h-4" />
              {data.company.is_active ? 'Deactivate Account' : 'Reactivate Account'}
            </button>
            <p className="text-[11px] text-navy-400 mt-2 text-center">
              {data.company.is_active
                ? 'Deactivating will stop all SMS notifications'
                : 'Reactivating will resume SMS notifications'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
