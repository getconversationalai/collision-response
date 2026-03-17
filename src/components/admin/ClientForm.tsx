'use client'

import { useState, useCallback } from 'react'
import {
  Building2,
  User,
  Mail,
  Phone,
  Lock,
  MapPin,
  ClipboardCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import PasswordGenerator from './PasswordGenerator'
import MunicipalityGrid from './MunicipalityGrid'
import SuccessScreen from './SuccessScreen'
import { createClient, getMunicipalities } from '@/lib/actions/admin-actions'
import type { Municipality } from '@/lib/types'

const STEPS = [
  { label: 'Company Info', icon: Building2 },
  { label: 'Credentials', icon: Lock },
  { label: 'Subscriptions', icon: MapPin },
  { label: 'Review', icon: ClipboardCheck },
]

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function toE164(value: string): string {
  const digits = value.replace(/\D/g, '')
  return `+1${digits}`
}

export default function ClientForm() {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1: Company info
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneRaw, setPhoneRaw] = useState('')

  // Step 2: Credentials
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 3: Subscriptions
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<Set<string>>(new Set())
  const [munLoaded, setMunLoaded] = useState(false)

  // Success state
  const [success, setSuccess] = useState(false)

  const phoneFormatted = formatPhoneDisplay(phoneRaw)
  const phoneE164 = toE164(phoneRaw)

  // Load municipalities on step 3
  const loadMunicipalities = useCallback(async () => {
    if (munLoaded) return
    try {
      const data = await getMunicipalities()
      setMunicipalities(data)
      setMunLoaded(true)
    } catch (err) {
      console.error('Failed to load municipalities:', err)
    }
  }, [munLoaded])

  function canAdvance(): boolean {
    if (step === 0) {
      return !!(companyName.trim() && contactName.trim() && email.trim() && phoneRaw.replace(/\D/g, '').length === 10 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    }
    if (step === 1) {
      return !!(password && password.length >= 8 && password === confirmPassword)
    }
    return true
  }

  async function goNext() {
    if (step === 2 && !munLoaded) await loadMunicipalities()
    setDirection('forward')
    if (step === 1) {
      // Pre-load municipalities for step 3
      loadMunicipalities()
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
    setError('')
  }

  function goBack() {
    setDirection('back')
    setStep(s => Math.max(s - 1, 0))
    setError('')
  }

  // Fix: load municipalities when entering step 2 so they're ready for step 3
  function handleStepChange(newStep: number) {
    if (newStep > step && !canAdvance()) return
    setDirection(newStep > step ? 'forward' : 'back')
    if (newStep >= 2) loadMunicipalities()
    setStep(newStep)
    setError('')
  }

  function toggleMunicipality(id: string) {
    setSelectedMunicipalities(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      await createClient({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phoneE164,
        password,
        municipalityIds: Array.from(selectedMunicipalities),
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function handleAddAnother() {
    setStep(0)
    setCompanyName('')
    setContactName('')
    setEmail('')
    setPhoneRaw('')
    setPassword('')
    setConfirmPassword('')
    setSelectedMunicipalities(new Set())
    setSuccess(false)
    setError('')
  }

  if (success) {
    return (
      <SuccessScreen
        companyName={companyName}
        contactName={contactName}
        email={email}
        phone={phoneFormatted}
        password={password}
        subscriptionCount={selectedMunicipalities.size}
        onAddAnother={handleAddAnother}
      />
    )
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-10 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isComplete = i < step
          const isCurrent = i === step
          return (
            <div key={i} className="flex items-center">
              <button
                type="button"
                onClick={() => handleStepChange(i)}
                disabled={i > step && !canAdvance()}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300
                  ${isCurrent
                    ? 'bg-brand-50/80 border border-brand-200/60 shadow-sm'
                    : isComplete
                      ? 'bg-emerald-50/60 border border-emerald-200/40'
                      : 'border border-transparent'
                  }
                  ${i <= step ? 'cursor-pointer' : 'cursor-default opacity-50'}
                `}
              >
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300
                  ${isCurrent
                    ? 'bg-gradient-to-br from-brand-600 to-brand-400 shadow-btn-glow'
                    : isComplete
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-400'
                      : 'bg-navy-100'
                  }
                `}>
                  {isComplete ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-navy-400'}`} />
                  )}
                </div>
                <span className={`text-sm font-medium hidden sm:inline ${
                  isCurrent ? 'text-brand-700' : isComplete ? 'text-emerald-700' : 'text-navy-400'
                }`}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-8 lg:w-12 h-px mx-1 transition-colors duration-300 ${
                  i < step ? 'bg-emerald-300' : 'bg-navy-200/50'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 bg-gradient-to-r from-red-50 to-red-50/50 border border-red-200/60 text-red-700 text-sm rounded-xl px-4 py-3.5 animate-fade-in-down">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 shrink-0 mt-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </div>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Step content */}
      <div className="glass-card-rich rounded-2xl p-6 sm:p-8">
        <div
          key={step}
          className={`${direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
        >
          {/* Step 1: Company Info */}
          {step === 0 && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-navy-800 mb-6">Company Information</h3>

              <div className="animate-fade-in-up" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
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
                  placeholder="e.g. ABC Collision Center"
                />
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
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
                  placeholder="e.g. John Smith"
                />
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-navy-400" />
                    Email Address
                  </span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="john@abccollision.com"
                />
                {email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium animate-fade-in">
                    Please enter a valid email address
                  </p>
                )}
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-navy-400" />
                    Phone Number
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-navy-500 bg-navy-50/60 px-3 py-2.5 rounded-xl border border-navy-200/40">
                    +1
                  </span>
                  <input
                    type="tel"
                    value={phoneFormatted}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setPhoneRaw(digits)
                    }}
                    className="input-field flex-1"
                    placeholder="(555) 123-4567"
                  />
                </div>
                {phoneRaw && phoneRaw.length > 0 && phoneRaw.length < 10 && (
                  <p className="mt-1.5 text-xs text-navy-400 font-medium animate-fade-in">
                    {10 - phoneRaw.length} more digit{10 - phoneRaw.length !== 1 ? 's' : ''} needed
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Credentials */}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-bold text-navy-800 mb-2">Login Credentials</h3>
              <p className="text-sm text-navy-400 mb-6">
                Create a login for <span className="font-semibold text-navy-600">{email}</span>
              </p>

              <div className="mb-5 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-navy-400" />
                    Email (login)
                  </span>
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="input-field bg-navy-50/50 text-navy-500 cursor-not-allowed"
                />
              </div>

              <PasswordGenerator
                password={password}
                confirmPassword={confirmPassword}
                onPasswordChange={setPassword}
                onConfirmChange={setConfirmPassword}
              />
            </div>
          )}

          {/* Step 3: Subscriptions */}
          {step === 2 && (
            <div>
              <h3 className="text-lg font-bold text-navy-800 mb-2">Municipality Subscriptions</h3>
              <p className="text-sm text-navy-400 mb-6">
                Select which municipalities <span className="font-semibold text-navy-600">{companyName}</span> should receive alerts for.
              </p>

              {!munLoaded ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                  <span className="ml-3 text-sm text-navy-400 font-medium">Loading municipalities...</span>
                </div>
              ) : (
                <MunicipalityGrid
                  municipalities={municipalities}
                  selected={selectedMunicipalities}
                  onToggle={toggleMunicipality}
                  onSelectAll={() => setSelectedMunicipalities(new Set(municipalities.map(m => m.id)))}
                  onDeselectAll={() => setSelectedMunicipalities(new Set())}
                />
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <div>
              <h3 className="text-lg font-bold text-navy-800 mb-6">Review & Confirm</h3>

              <div className="space-y-4">
                {/* Company info */}
                <div className="bg-navy-50/40 rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
                  <h4 className="section-title mb-3">Company Information</h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-navy-400">Company</span>
                    <span className="font-semibold text-navy-800">{companyName}</span>
                    <span className="text-navy-400">Contact</span>
                    <span className="font-semibold text-navy-800">{contactName}</span>
                    <span className="text-navy-400">Email</span>
                    <span className="font-semibold text-navy-800">{email}</span>
                    <span className="text-navy-400">Phone</span>
                    <span className="font-semibold text-navy-800">+1 {phoneFormatted}</span>
                  </div>
                </div>

                {/* Credentials */}
                <div className="bg-navy-50/40 rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                  <h4 className="section-title mb-3">Login Credentials</h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-navy-400">Email</span>
                    <span className="font-semibold text-navy-800">{email}</span>
                    <span className="text-navy-400">Password</span>
                    <span className="font-mono font-semibold text-navy-800">{'•'.repeat(password.length)}</span>
                  </div>
                </div>

                {/* Subscriptions */}
                <div className="bg-navy-50/40 rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
                  <h4 className="section-title mb-3">Subscriptions</h4>
                  <p className="text-sm font-semibold text-navy-800">
                    {selectedMunicipalities.size} municipalit{selectedMunicipalities.size === 1 ? 'y' : 'ies'} selected
                  </p>
                  {selectedMunicipalities.size > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {municipalities
                        .filter(m => selectedMunicipalities.has(m.id))
                        .map(m => (
                          <span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-brand-100/80 text-brand-700">
                            {m.name}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className={`btn-secondary flex items-center gap-2 ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance()}
            className="btn-primary flex items-center gap-2"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Client
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
