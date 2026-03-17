export const runtime = 'edge'

import { getAllMunicipalities } from '@/lib/actions/admin-actions'
import MunicipalityTable from '@/components/admin/MunicipalityTable'
import Link from 'next/link'

export default async function MunicipalitiesPage() {
  const municipalities = await getAllMunicipalities()

  return (
    <div className="page-wrapper">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold gradient-text tracking-tight">
            Municipalities
          </h1>
          <p className="text-navy-400 text-sm mt-1 font-medium">
            {municipalities.length} municipalit{municipalities.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <Link href="/admin/municipalities/new" className="btn-primary flex items-center gap-2 self-start">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Municipality
        </Link>
      </div>

      <MunicipalityTable municipalities={municipalities} />
    </div>
  )
}
