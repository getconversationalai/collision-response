'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  MapPin,
  Landmark,
  Flag,
  Save,
  Loader2,
  Check,
  Power,
  X,
  Tag,
  Link2,
  Shield,
  Trash2,
} from 'lucide-react'
import {
  getMunicipalityById,
  updateMunicipality,
  toggleMunicipalityActive,
  deleteMunicipality,
  getAllMunicipalities,
} from '@/lib/actions/admin-actions'
import type { Municipality } from '@/lib/types'
import MunicipalityAliases from '@/components/admin/MunicipalityAliases'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function MunicipalityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const munId = params.id as string

  const [data, setData] = useState<Municipality | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [county, setCounty] = useState('')
  const [state, setState] = useState('')
  const [parentId, setParentId] = useState<string>('')
  const [adminOnly, setAdminOnly] = useState(false)
  const [parentOptions, setParentOptions] = useState<Municipality[]>([])

  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [mun, all] = await Promise.all([
        getMunicipalityById(munId),
        getAllMunicipalities(),
      ])
      setData(mun)
      setName(mun.name)
      setDisplayName(mun.display_name ?? '')
      setCounty(mun.county)
      setState(mun.state)
      setParentId(mun.parent_id ?? '')
      setAdminOnly(mun.admin_only)
      // Don't allow self as parent, and don't allow picking another child as a parent
      setParentOptions(all.filter(m => m.id !== munId && !m.parent_id))
    } catch {
      setError('Failed to load municipality')
    } finally {
      setLoading(false)
    }
  }, [munId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await updateMunicipality(munId, {
        name: name.trim(),
        display_name: displayName.trim() || null,
        county: county.trim(),
        state: state.trim(),
        parent_id: parentId || null,
        admin_only: adminOnly,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setData(prev => prev ? {
        ...prev,
        name: name.trim(),
        display_name: displayName.trim() || null,
        county: county.trim(),
        state: state.trim(),
        parent_id: parentId || null,
        admin_only: adminOnly,
      } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive() {
    if (!data) return
    const newStatus = !data.is_active
    try {
      await toggleMunicipalityActive(munId, newStatus)
      setData(prev => prev ? { ...prev, is_active: newStatus } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteMunicipality(munId)
      router.push('/admin/municipalities')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleting(false)
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
        <p className="text-navy-500 font-medium">Municipality not found</p>
        <Link href="/admin/municipalities" className="btn-secondary mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Municipalities
        </Link>
      </div>
    )
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

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">
          {data.name}
        </h1>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          data.is_active
            ? 'bg-emerald-100/80 text-emerald-700'
            : 'bg-navy-100 text-navy-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            data.is_active ? 'bg-emerald-500 status-dot-pulse' : 'bg-navy-400'
          }`} />
          {data.is_active ? 'Active' : 'Inactive'}
        </span>
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
        {/* Edit form */}
        <div className="lg:col-span-2">
          <div className="glass-card-rich rounded-2xl p-6 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
            <h2 className="section-title mb-5">Municipality Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-navy-400" />
                    Backend Name
                    <span className="text-[11px] font-medium text-navy-400">used for matching dispatches</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-navy-400" />
                    Display Name (nickname)
                    <span className="text-[11px] font-medium text-navy-400">shown to clients — blank = use backend name</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-field"
                  placeholder={name}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">
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
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">
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
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-navy-400" />
                    Parent municipality
                    <span className="text-[11px] font-medium text-navy-400">nests this as a sub-channel</span>
                  </span>
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="input-field"
                >
                  <option value="">None (top-level)</option>
                  {parentOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                  ))}
                </select>
              </div>

              <div>
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
                      Clients see &ldquo;Contact admin to enable&rdquo; instead of a toggle. Admins can still subscribe them from the client detail page.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
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

          {/* Alternate names */}
          <div className="mt-6">
            <MunicipalityAliases municipalityId={munId} primaryName={data.name} />
          </div>

          {/* Info */}
          <div className="glass-card rounded-2xl p-5 mt-6 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <h3 className="section-title mb-3">Details</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-navy-400">Created</span>
              <span className="font-medium text-navy-700">{formatDate(data.created_at)}</span>
              <span className="text-navy-400">ID</span>
              <span className="font-mono text-xs text-navy-500 break-all">{data.id}</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
            <h3 className="section-title mb-4">Status</h3>
            <button
              onClick={handleToggleActive}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                data.is_active
                  ? 'bg-red-50 text-red-600 border border-red-200/50 hover:bg-red-100/80'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50 hover:bg-emerald-100/80'
              }`}
            >
              <Power className="w-4 h-4" />
              {data.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
            <p className="text-[11px] text-navy-400 mt-2 text-center">
              {data.is_active
                ? 'Deactivating hides this from client subscription options'
                : 'Reactivating makes this available for client subscriptions'
              }
            </p>
          </div>

          <div className="glass-card rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <h3 className="section-title mb-4">Danger Zone</h3>
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-600 border border-red-200/50 hover:bg-red-100/80 transition-all duration-300"
              >
                <Trash2 className="w-4 h-4" />
                Delete Municipality
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-navy-600 font-medium text-center">
                  Delete permanently? This removes all subscriptions to it.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-60"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    disabled={deleting}
                    className="flex-1 btn-secondary text-sm py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
