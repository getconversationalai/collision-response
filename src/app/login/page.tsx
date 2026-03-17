'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-radial from-brand-100/30 via-transparent to-transparent rounded-full" />
      </div>

      <div className="w-full max-w-[400px] animate-scale-in">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative group">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 shadow-btn-glow transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 animate-glow-pulse opacity-50" />
            <svg className="w-8 h-8 text-white relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold gradient-text tracking-tight">Collision Response</h1>
          <p className="text-sm text-navy-400 mt-2 font-medium">Sign in to manage your subscriptions</p>
        </div>

        {/* Login card */}
        <div className="glass-card-rich rounded-2xl p-8 space-y-6">
          {error && (
            <div className="animate-fade-in-down flex items-start gap-3 bg-gradient-to-r from-red-50 to-red-50/50 border border-red-200/60 text-red-700 text-sm rounded-xl px-4 py-3.5">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 shrink-0 mt-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
              <label htmlFor="email" className="block text-sm font-semibold text-navy-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@company.com"
              />
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
              <label htmlFor="password" className="block text-sm font-semibold text-navy-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
              />
            </div>

            <div className="animate-fade-in-up pt-1" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2.5 py-3 text-[15px]"
              >
                {loading ? (
                  <>
                    <svg className="w-4.5 h-4.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-navy-400/60 mt-8 animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
          Need an account? Contact your administrator.
        </p>
      </div>
    </div>
  )
}
