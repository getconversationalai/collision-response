'use client'

import { MapPin, Check } from 'lucide-react'
import type { Municipality } from '@/lib/types'

type MunicipalityGridProps = {
  municipalities: Municipality[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export default function MunicipalityGrid({
  municipalities,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: MunicipalityGridProps) {
  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-5 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-navy-700">
            {selected.size} of {municipalities.length} selected
          </span>
          {selected.size > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100/80 text-brand-700 animate-scale-in">
              {selected.size}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors px-2 py-1 rounded-lg hover:bg-brand-50"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-xs font-medium text-navy-400 hover:text-navy-600 transition-colors px-2 py-1 rounded-lg hover:bg-navy-50"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {municipalities.map((mun, i) => {
          const isSelected = selected.has(mun.id)
          return (
            <button
              key={mun.id}
              type="button"
              onClick={() => onToggle(mun.id)}
              className={`
                relative p-4 rounded-xl border text-left transition-all duration-300
                animate-fade-in-up group
                ${isSelected
                  ? 'bg-brand-50/80 border-brand-200 shadow-card-active'
                  : 'bg-white/60 border-navy-200/40 hover:border-navy-300/60 hover:shadow-card'
                }
              `}
              style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
            >
              {/* Selected checkmark */}
              <div className={`
                absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center
                transition-all duration-300
                ${isSelected
                  ? 'bg-brand-500 scale-100'
                  : 'bg-navy-100 scale-75 opacity-0 group-hover:opacity-50 group-hover:scale-100'
                }
              `}>
                <Check className="w-3 h-3 text-white" />
              </div>

              <MapPin className={`w-4 h-4 mb-2 transition-colors duration-300 ${
                isSelected ? 'text-brand-500' : 'text-navy-300'
              }`} />
              <p className={`text-sm font-semibold transition-colors duration-300 ${
                isSelected ? 'text-brand-800' : 'text-navy-700'
              }`}>
                {mun.name}
              </p>
              <p className="text-[11px] text-navy-400 mt-0.5">
                {mun.county} County
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
