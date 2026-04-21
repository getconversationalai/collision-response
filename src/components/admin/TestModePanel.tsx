'use client'

import { useState, useEffect, useCallback } from 'react'
import { FlaskConical, Loader2, Power, Clock, Users, AlertTriangle } from 'lucide-react'
import {
  getTestModeStatus,
  enableTestMode,
  disableTestMode,
  type TestModeStatus,
} from '@/lib/actions/admin-actions'

const PRESETS = [15, 30, 60]

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TestModePanel() {
  const [status, setStatus] = useState<TestModeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [duration, setDuration] = useState(30)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const s = await getTestModeStatus()
      setStatus(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test mode status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!status?.active || !status.testModeUntil) return
    const expiresAt = new Date(status.testModeUntil).getTime()
    if (now >= expiresAt) {
      refresh()
    }
  }, [now, status, refresh])

  async function handleEnable() {
    setPending(true)
    setError('')
    try {
      const s = await enableTestMode(duration)
      setStatus(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable test mode')
    } finally {
      setPending(false)
    }
  }

  async function handleDisable() {
    setPending(true)
    setError('')
    try {
      const s = await disableTestMode()
      setStatus(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable test mode')
    } finally {
      setPending(false)
    }
  }

  const remaining = status?.active && status.testModeUntil
    ? new Date(status.testModeUntil).getTime() - now
    : 0

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 animate-fade-in-up flex items-center justify-center min-h-[120px]">
        <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (!status) return null

  if (status.active) {
    return (
      <div className="rounded-2xl p-6 animate-fade-in-up border-2 border-gold-300 bg-gradient-to-br from-gold-50 via-gold-50/60 to-white shadow-card-active">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-gold-500 to-gold-400 text-white shadow-btn-glow shrink-0">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gold-800">Test Mode Active</h3>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-600 text-white uppercase tracking-wider animate-pulse-soft">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                Live
              </span>
            </div>
            <p className="text-xs text-gold-700 mt-1 font-medium">
              SMS notifications are restricted to admin recipients only
            </p>

            <div className="flex items-center gap-5 mt-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold-600" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-gold-500">Expires in</div>
                  <div className="text-lg font-extrabold text-gold-900 tabular-nums">
                    {formatCountdown(remaining)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gold-600" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-gold-500">Admin recipients</div>
                  <div className="text-lg font-extrabold text-gold-900">{status.adminRecipients}</div>
                </div>
              </div>
            </div>

            {status.adminRecipients === 0 && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200/60 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                <span className="text-[11px] text-red-700 font-medium">
                  No admin recipients configured. Mark at least one client as admin on their detail page.
                </span>
              </div>
            )}

            <button
              onClick={handleDisable}
              disabled={pending}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/70 text-gold-800 border border-gold-300 hover:bg-white transition-all duration-300 disabled:opacity-60"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              Disable Test Mode
            </button>

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card-rich rounded-2xl p-6 animate-fade-in-up">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-navy-100 to-navy-50 text-navy-500 shrink-0">
          <FlaskConical className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-navy-800">Test Mode</h3>
          <p className="text-xs text-navy-500 mt-1 font-medium">
            Temporarily restrict outgoing SMS to admin recipients only — useful for testing dispatch workflows without paging all subscribers.
          </p>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-navy-400 mb-1.5">
                Duration
              </label>
              <div className="flex items-center gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => setDuration(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      duration === p
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                    }`}
                  >
                    {p}m
                  </button>
                ))}
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, Math.min(240, Number(e.target.value) || 1)))}
                    className="w-16 px-2 py-1.5 rounded-lg text-xs font-semibold border border-navy-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleEnable}
              disabled={pending || status.adminRecipients === 0}
              className="btn-primary flex items-center gap-2 sm:self-end"
              title={status.adminRecipients === 0 ? 'Mark at least one client as admin first' : undefined}
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
              Enable for {duration}m
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3 text-[11px] text-navy-400 font-medium">
            <div className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {status.adminRecipients} admin recipient{status.adminRecipients === 1 ? '' : 's'}
            </div>
            {status.adminRecipients === 0 && (
              <span className="text-red-500">· Configure admins to enable</span>
            )}
          </div>

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
