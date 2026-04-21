'use client'

function formatPhone(e164: string): string {
  const match = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`
  return e164
}

export default function PhoneEditor({
  initialPhone,
  initialPhoneSecondary,
}: {
  companyId: string
  initialPhone: string | null
  initialPhoneSecondary?: string | null
}) {
  const hasSecondary = !!initialPhoneSecondary

  return (
    <div className="glass-card-rich rounded-2xl p-5 sm:p-6 card-lift">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 shadow-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          </svg>
        </div>
        <div>
          <h2 className="section-title">SMS Phone Number{hasSecondary ? 's' : ''}</h2>
          <p className="text-[11px] text-navy-400 mt-0.5">Where you receive MVA alerts</p>
        </div>
      </div>

      <div className={hasSecondary ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
        <div className={hasSecondary ? 'rounded-xl bg-white/50 border border-navy-100/60 px-4 py-3' : ''}>
          {hasSecondary && (
            <div className="text-[10px] font-bold uppercase tracking-wider text-navy-400 mb-0.5">Primary</div>
          )}
          <span className="text-xl font-bold text-navy-900 tracking-tight">
            {initialPhone ? formatPhone(initialPhone) : 'Not set'}
          </span>
        </div>

        {hasSecondary && (
          <div className="rounded-xl bg-white/50 border border-navy-100/60 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-navy-400 mb-0.5">Secondary</div>
            <span className="text-xl font-bold text-navy-900 tracking-tight">
              {formatPhone(initialPhoneSecondary!)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
