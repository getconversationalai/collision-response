'use client'

export const runtime = 'edge'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Landmark, Flag, Loader2 } from 'lucide-react'
import { createMunicipality } from '@/lib/actions/admin-actions'

export default function NewMunicipalityPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [county, setCounty] = useState('Orange')
  const [state, setState] = useState('NY')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await createMunicipality({ name, county, state })
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
