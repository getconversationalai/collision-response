'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { MailCheck, Clock } from 'lucide-react'

export default function ApplicationSuccess() {
  useEffect(() => {
    const end = Date.now() + 1500
    function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ['#3b82f6', '#2563eb', '#f59e0b', '#60a5fa'] })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ['#3b82f6', '#2563eb', '#f59e0b', '#60a5fa'] })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [])

  return (
    <div className="max-w-md w-full text-center animate-scale-in">
      <div className="relative inline-flex items-center justify-center mb-6 animate-bounce-soft">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
          <MailCheck className="w-10 h-10 text-white" />
        </div>
        <div className="absolute inset-0 w-20 h-20 rounded-full bg-emerald-400/30 animate-ping" style={{ animationDuration: '1.5s' }} />
      </div>

      <h1 className="text-2xl font-extrabold gradient-text mb-2">Application received!</h1>
      <p className="text-navy-400 text-sm mb-8">
        Thanks for applying to Collision Response. Your application has been sent to our team for review.
      </p>

      <div className="glass-card-rich rounded-2xl p-6 text-left space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 text-brand-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-800">What happens next</p>
            <p className="text-xs text-navy-400 mt-1 leading-relaxed">
              An administrator will review your application. Once approved, you&apos;ll receive an email with a link to set your password, log in, and add your payment method to activate alerts.
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-navy-400/60 mt-8">
        Already have an account? <a href="/login" className="text-brand-600 font-medium hover:text-brand-700">Log in</a>
      </p>
    </div>
  )
}
