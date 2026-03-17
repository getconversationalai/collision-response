import { getClients } from '@/lib/actions/admin-actions'
import ClientTable from '@/components/admin/ClientTable'
import Link from 'next/link'

export default async function ClientListPage() {
  const clients = await getClients()

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold gradient-text tracking-tight">
            Clients
          </h1>
          <p className="text-navy-400 text-sm mt-1 font-medium">
            {clients.length} collision compan{clients.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <Link href="/admin/clients/new" className="btn-primary flex items-center gap-2 self-start">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          </svg>
          Add Client
        </Link>
      </div>

      <ClientTable clients={clients} />
    </div>
  )
}
