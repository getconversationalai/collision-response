'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Landmark, Flag, Loader2, Tag, Link2, Shield } from 'lucide-react'
import { createMunicipality, getAllMunicipalities } from '@/lib/actions/admin-actions'
import type { Municipality } from '@/lib/types'

export default function NewMunicipalityPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [county, setCounty] = useState('Orange')
  const [state, setState] = useState('NY')
  const [parentId, setParentId] = useState<string>('')
  const [adminOnly, setAdminOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parents, setParents] = useState<Municipality[]>([])

  useEffect(() => {
    getAllMunicipalities()
      .then(list => setParents(list.filter(m => !m.parent_id)))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await createMunicipality({
        name,
        display_name: displayName || null,
        county,
        state,
        parent_id: parentId || null,
        admin_only: adminOnly,
      })
      router.push('/admin/municipalities')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create municipality')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-wrapper">
      <Link
        href="/admin/municipalities"
        className="inline-flex items-center gap-1.5 text-sm text-navy-400 hover:text-navy-600 transition-colors font-medium mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Municipalities
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">
          Add Municipality
        </h1>
        <p className="text-navy-400 text-sm mt-1 font-medium">
          Add a new municipality that clients can subscribe to
        </p>
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

      <form onSubmit={handleSubmit} className="max-w-lg">
        <div className="glass-card-rich rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="animate-fade-in-up" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
            <label className="block text-sm font-semibold text-navy-700 mb-2">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-navy-400" />
                Municipality Name
              </span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="e.g. Woodbury"
            />
          </div>

          <div className="animate-fade-in-up" style={{ animationDelay: '75ms', animationFillMode: 'both' }}>
            <label className="block text-sm font-semibold text-navy-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-navy-400" />
                Display Name (nickname)
                <span className="text-[11px] font-medium text-navy-400">optional</span>
              </span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field"
              placeholder="Shown to clients instead of the backend name"
            />
          </div>

          <div className="animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <label className="block text-sm font-semibold text-navy-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-navy-400" />
                County
              </span>
            </label>
            <input
              type="text"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="input-field"
              placeholder="Orange"
            />
          </div>

          <div className="animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
            <label className="block text-sm font-semibold text-navy-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-navy-400" />
                State
              </span>
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="input-field"
              placeholder="NY"
            />
          </div>

          <div className="animate-fade-in-up" style={{ animationDelay: '175ms', animationFillMode: 'both' }}>
            <label className="block text-sm font-semibold text-navy-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-navy-400" />
                Parent municipality
                <span className="text-[11px] font-medium text-navy-400">optional — for sub-channels like a PD</span>
              </span>
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="input-field"
            >
              <option value="">None (top-level)</option>
              {parents.map(p => (
                <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
              ))}
            </select>
          </div>

          <div className="animate-fade-in-up" style={{ animationDelay: '190ms', animationFillMode: 'both' }}>
            <label className="flex items-start gap-3 p-3 rounded-xl border border-navy-200/40 bg-white/40 cursor-pointer hover:bg-brand-50/40 transition-colors">
              <input
                type="checkbox"
                checked={adminOnly}
                onChange={(e) => setAdminOnly(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-navy-300 text-brand-500 focus:ring-brand-400/30"
              />
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-navy-700">
                  <Shield className="w-3.5 h-3.5 text-navy-400" />
                  Admin-only municipality
                </div>
                <p className="text-[11px] text-navy-500 mt-0.5">
                  Clients can&apos;t self-toggle this one — they see a &ldquo;Contact admin to enable&rdquo; message. Useful for municipalities that require manual approval.
                </p>
              </div>
            </label>
          </div>

          <div className="pt-2 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  Create Municipality
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
