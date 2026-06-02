'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, User, Mail, Phone, MapPin, ClipboardCheck, ArrowRight, ArrowLeft, Loader2,
} from 'lucide-react'
import MunicipalityGrid from '@/components/admin/MunicipalityGrid'
import { submitApplication } from '@/lib/actions/application-actions'
import { formatPhoneDisplay } from '@/lib/phone'
import type { Municipality } from '@/lib/types'

const STEPS = [
  { label: 'Company', icon: Building2 },
  { label: 'Coverage', icon: MapPin },
  { label: 'Review', icon: ClipboardCheck },
]

export default function ApplicationForm({
  municipalities,
  initialEmail = '',
  initialContactName = '',
  initialCompanyName = '',
}: {
  municipalities: Municipality[]
  initialEmail?: string
  initialContactName?: string
  initialCompanyName?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [companyName, setCompanyName] = useState(initialCompanyName)
  const [contactName, setContactName] = useState(initialContactName)
  const [email, setEmail] = useState(initialEmail)
  const [phoneRaw, setPhoneRaw] = useState('')
  const [phoneSecondaryRaw, setPhoneSecondaryRaw] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [honeypot, setHoneypot] = useState('')

  const phoneFormatted = formatPhoneDisplay(phoneRaw)
  const phoneSecondaryFormatted = formatPhoneDisplay(phoneSecondaryRaw)

  function canAdvance(): boolean {
    if (step === 0) {
      const secondaryOk = !phoneSecondaryRaw || phoneSecondaryRaw.length === 10
      return !!(
        companyName.trim() && contactName.trim() && email.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        phoneRaw.length === 10 && secondaryOk
      )
    }
    if (step === 1) return selected.size > 0
    return true
  }

  function goNext() { setDirection('forward'); setStep((s) => Math.min(s + 1, STEPS.length - 1)); setError('') }
  function goBack() { setDirection('back'); setStep((s) => Math.max(s - 1, 0)); setError('') }
  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id) } else { n.add(id) }
      return n
    })
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = await submitApplication({
        companyName, contactName, email,
        phoneRaw, phoneSecondaryRaw,
        municipalityIds: Array.from(selected),
        honeypot,
      })
      if (res.ok) { router.push('/apply/success'); return }
      if (res.reason === 'validation') setError(res.errors?.[0] ?? 'Please check your entries.')
      else setError(res.message ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isComplete = i < step
          const isCurrent = i === step
          return (
            <div key={i} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${
                isCurrent ? 'bg-brand-50/80 border border-brand-200/60 shadow-sm'
                : isComplete ? 'bg-emerald-50/60 border border-emerald-200/40'
                : 'border border-transparent'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  isCurrent ? 'bg-gradient-to-br from-brand-600 to-brand-400 shadow-btn-glow'
                  : isComplete ? 'bg-gradient-to-br from-emerald-500 to-emerald-400'
                  : 'bg-navy-100'}`}>
                  {isComplete ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-navy-400'}`} />}
                </div>
                <span className={`text-sm font-medium hidden sm:inline ${
                  isCurrent ? 'text-brand-700' : isComplete ? 'text-emerald-700' : 'text-navy-400'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 lg:w-12 h-px mx-1 transition-colors duration-300 ${i < step ? 'bg-emerald-300' : 'bg-navy-200/50'}`} />
              )}
            </div>
          )
        })}
      </div>

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

      <div className="glass-card-rich rounded-2xl p-6 sm:p-8">
        <div key={step} className={direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'}>
          {step === 0 && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-navy-800 mb-4">Company information</h3>

              {/* Honeypot — visually hidden, must stay empty */}
              <input
                type="text" tabIndex={-1} autoComplete="off"
                value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
                className="hidden" aria-hidden="true"
                name="company_website"
              />

              <Field label="Company Name" icon={Building2}>
                <input className="input-field" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. ABC Collision Center" />
              </Field>
              <Field label="Contact Person" icon={User}>
                <input className="input-field" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. John Smith" />
              </Field>
              <Field label="Email Address" icon={Mail}>
                <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@abccollision.com" />
                {email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">Please enter a valid email address</p>
                )}
              </Field>
              <PhoneField label="Phone Number" value={phoneFormatted} raw={phoneRaw} onChange={(d) => setPhoneRaw(d)} />
              <PhoneField label="Secondary Phone" optional value={phoneSecondaryFormatted} raw={phoneSecondaryRaw} onChange={(d) => setPhoneSecondaryRaw(d)} />
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="text-lg font-bold text-navy-800 mb-2">Choose your coverage areas</h3>
              <p className="text-sm text-navy-400 mb-6">Select the municipalities you want to receive MVA alerts for.</p>
              {municipalities.length === 0 ? (
                <p className="text-sm text-navy-400 py-8 text-center">No coverage areas are available right now. Please check back soon.</p>
              ) : (
                <MunicipalityGrid
                  municipalities={municipalities}
                  selected={selected}
                  onToggle={toggle}
                  onSelectAll={() => setSelected(new Set(municipalities.map((m) => m.id)))}
                  onDeselectAll={() => setSelected(new Set())}
                />
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-lg font-bold text-navy-800 mb-6">Review &amp; submit</h3>
              <div className="space-y-4">
                <div className="bg-navy-50/40 rounded-xl p-4">
                  <h4 className="section-title mb-3">Company</h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-navy-400">Company</span><span className="font-semibold text-navy-800">{companyName}</span>
                    <span className="text-navy-400">Contact</span><span className="font-semibold text-navy-800">{contactName}</span>
                    <span className="text-navy-400">Email</span><span className="font-semibold text-navy-800">{email}</span>
                    <span className="text-navy-400">Phone</span><span className="font-semibold text-navy-800">+1 {phoneFormatted}</span>
                    {phoneSecondaryRaw && (<><span className="text-navy-400">Secondary</span><span className="font-semibold text-navy-800">+1 {phoneSecondaryFormatted}</span></>)}
                  </div>
                </div>
                <div className="bg-navy-50/40 rounded-xl p-4">
                  <h4 className="section-title mb-3">Coverage areas</h4>
                  <p className="text-sm font-semibold text-navy-800">{selected.size} selected</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {municipalities.filter((m) => selected.has(m.id)).map((m) => (
                      <span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-brand-100/80 text-brand-700">{m.name}</span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-navy-400 leading-relaxed">
                  By submitting, you agree we may contact you about your application. An admin will review and email you next steps.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <button type="button" onClick={goBack} disabled={step === 0}
          className={`btn-secondary flex items-center gap-2 ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} disabled={!canAdvance()} className="btn-primary flex items-center gap-2">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2 px-8">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>) : (<>Submit application <ArrowRight className="w-4 h-4" /></>)}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-navy-700 mb-2">
        <span className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-navy-400" />{label}</span>
      </label>
      {children}
    </div>
  )
}

function PhoneField({ label, value, raw, onChange, optional }: {
  label: string; value: string; raw: string; onChange: (digits: string) => void; optional?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-navy-700 mb-2">
        <span className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-navy-400" />{label}
          {optional && <span className="text-[11px] font-medium text-navy-400">optional</span>}
        </span>
      </label>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-navy-500 bg-navy-50/60 px-3 py-2.5 rounded-xl border border-navy-200/40">+1</span>
        <input type="tel" className="input-field flex-1" value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="(555) 123-4567" />
      </div>
      {raw.length > 0 && raw.length < 10 && (
        <p className="mt-1.5 text-xs text-navy-400 font-medium">{10 - raw.length} more digit{10 - raw.length !== 1 ? 's' : ''} needed</p>
      )}
    </div>
  )
}
