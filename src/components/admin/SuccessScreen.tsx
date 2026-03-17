'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, UserPlus, Users, PartyPopper } from 'lucide-react'
import confetti from 'canvas-confetti'
import Link from 'next/link'

type SuccessScreenProps = {
  companyName: string
  contactName: string
  email: string
  phone: string
  password: string
  subscriptionCount: number
  onAddAnother: () => void
}

export default function SuccessScreen({
  companyName,
  contactName,
  email,
  phone,
  password,
  subscriptionCount,
  onAddAnother,
}: SuccessScreenProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    // Fire confetti
    const duration = 2000
    const end = Date.now() + duration

    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#3b82f6', '#2563eb', '#f59e0b', '#60a5fa'],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#3b82f6', '#2563eb', '#f59e0b', '#60a5fa'],
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()

    // Stagger content in
    setTimeout(() => setShowContent(true), 400)
  }, [])

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div className="max-w-lg mx-auto text-center">
      {/* Animated checkmark */}
      <div className="relative inline-flex items-center justify-center mb-6 animate-bounce-soft">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-[draw_0.6s_ease-out_0.3s_both]"
              style={{
                strokeDasharray: 30,
                strokeDashoffset: 30,
                animation: 'draw 0.6s ease-out 0.3s both',
              }}
            />
          </svg>
        </div>
        <div className="absolute inset-0 w-20 h-20 rounded-full bg-emerald-400/30 animate-ping" style={{ animationDuration: '1.5s' }} />
      </div>

      <div className="flex items-center justify-center gap-2 mb-2">
        <PartyPopper className="w-5 h-5 text-gold-500" />
        <h2 className="text-2xl font-extrabold gradient-text">Client Created!</h2>
        <PartyPopper className="w-5 h-5 text-gold-500" />
      </div>
      <p className="text-navy-400 text-sm mb-8">
        {companyName} has been successfully onboarded.
      </p>

      {showContent && (
        <div className="space-y-5 animate-fade-in-up">
          {/* Client details card */}
          <div className="glass-card rounded-2xl p-5 text-left">
            <h3 className="section-title mb-3">Client Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-navy-400">Company</span>
                <span className="font-semibold text-navy-800">{companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-400">Contact</span>
                <span className="font-semibold text-navy-800">{contactName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-400">Phone</span>
                <span className="font-semibold text-navy-800">{phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-400">Subscriptions</span>
                <span className="font-semibold text-navy-800">{subscriptionCount} municipalities</span>
              </div>
            </div>
          </div>

          {/* Credentials card */}
          <div className="glass-card-rich rounded-2xl p-5 text-left border-brand-200/40">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-soft" />
              <h3 className="section-title">Login Credentials</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-navy-50/50 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-[11px] text-navy-400 font-medium">Email</p>
                  <p className="text-sm font-semibold text-navy-800">{email}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(email, 'email')}
                  className="p-2 rounded-lg hover:bg-navy-100/60 transition-all"
                >
                  {copiedField === 'email' ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-navy-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between bg-navy-50/50 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-[11px] text-navy-400 font-medium">Password</p>
                  <p className="text-sm font-mono font-semibold text-navy-800">{password}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(password, 'password')}
                  className="p-2 rounded-lg hover:bg-navy-100/60 transition-all"
                >
                  {copiedField === 'password' ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-navy-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 bg-gold-50/80 border border-gold-200/50 rounded-xl px-3 py-2.5">
              <svg className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <p className="text-xs text-gold-700 font-medium">
                Save these credentials now. The password cannot be retrieved later.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onAddAnother} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add Another Client
            </button>
            <Link href="/admin/clients" className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <Users className="w-4 h-4" />
              View All Clients
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
