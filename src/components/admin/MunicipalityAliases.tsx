'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, X, Tags } from 'lucide-react'
import {
  getMunicipalityAliases,
  addMunicipalityAlias,
  removeMunicipalityAlias,
} from '@/lib/actions/admin-actions'
import type { MunicipalityAlias } from '@/lib/types'

export default function MunicipalityAliases({
  municipalityId,
  primaryName,
}: {
  municipalityId: string
  primaryName: string
}) {
  const [aliases, setAliases] = useState<MunicipalityAlias[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setAliases(await getMunicipalityAliases(municipalityId))
    } catch {
      // leave list empty
    } finally {
      setLoading(false)
    }
  }, [municipalityId])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e?: React.FormEvent) {
    e?.preventDefault()
    const v = input.trim()
    if (!v) return
    setAdding(true)
    setError('')
    try {
      const created = await addMunicipalityAlias(municipalityId, v)
      setAliases(prev => [...prev, created].sort((a, b) => a.alias.localeCompare(b.alias)))
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add alias')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    try {
      await removeMunicipalityAlias(id)
      setAliases(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove alias')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-navy-400" />
            <h2 className="section-title !mb-0">Alternate Names</h2>
          </div>
          <p className="text-xs text-navy-400 mt-1.5 font-medium leading-relaxed">
            Other names the dispatch feed might use for <span className="font-semibold text-navy-600">{primaryName}</span>.
            Any incoming dispatch matching a name here routes to this municipality.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 text-navy-400 animate-spin" />
        </div>
      ) : (
        <>
          {aliases.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {aliases.map(a => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200/60"
                >
                  {a.alias}
                  <button
                    onClick={() => handleRemove(a.id)}
                    disabled={removingId === a.id}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-brand-200/60 transition-colors disabled:opacity-60"
                    aria-label={`Remove alias ${a.alias}`}
                  >
                    {removingId === a.id ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <X className="w-2.5 h-2.5" />
                    )}
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-navy-400 italic mb-4">No alternate names yet.</p>
          )}

          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Add an alternate name (e.g. BG, KJ, Palm Tree)"
              className="input-field flex-1 text-sm"
              maxLength={100}
              disabled={adding}
            />
            <button
              type="submit"
              disabled={adding || !input.trim()}
              className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3 disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
          </form>

          {error && (
            <p className="text-xs text-red-600 mt-2 font-medium">{error}</p>
          )}
        </>
      )}
    </div>
  )
}
