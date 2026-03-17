'use client'

import { useEffect, useState } from 'react'
import { Users, MapPin, Clock, UserPlus, Building2 } from 'lucide-react'

const iconMap = {
  users: Users,
  'map-pin': MapPin,
  clock: Clock,
  'user-plus': UserPlus,
  building: Building2,
}

type IconName = keyof typeof iconMap

type StatsCardProps = {
  label: string
  value: number
  iconName: IconName
  color: 'brand' | 'gold' | 'navy'
  delay?: number
}

const colorMap = {
  brand: {
    icon: 'from-brand-600 to-brand-400',
    iconShadow: 'shadow-btn-glow',
    text: 'text-brand-700',
  },
  gold: {
    icon: 'from-gold-600 to-gold-400',
    iconShadow: 'shadow-btn-gold-glow',
    text: 'text-gold-700',
  },
  navy: {
    icon: 'from-navy-700 to-navy-500',
    iconShadow: 'shadow-glass',
    text: 'text-navy-700',
  },
}

export default function StatsCard({ label, value, iconName, color, delay = 0 }: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const colors = colorMap[color]
  const Icon = iconMap[iconName]

  useEffect(() => {
    if (value === 0) return
    const duration = 1200
    const start = performance.now()
    let frame: number

    function animate(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(eased * value))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }

    const timeout = setTimeout(() => {
      frame = requestAnimationFrame(animate)
    }, delay + 400)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(frame)
    }
  }, [value, delay])

  return (
    <div
      className="glass-card rounded-2xl p-6 card-lift animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="section-title mb-2">{label}</p>
          <p className={`text-4xl font-extrabold tracking-tight ${colors.text}`}>
            {displayValue}
          </p>
        </div>
        <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${colors.icon} ${colors.iconShadow} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}
