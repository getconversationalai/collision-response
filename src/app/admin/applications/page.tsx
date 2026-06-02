import { getApplications } from '@/lib/actions/application-actions'
import ApplicationsTable from '@/components/admin/ApplicationsTable'
import InviteClientForm from '@/components/admin/InviteClientForm'

export const dynamic = 'force-dynamic'

export default async function AdminApplicationsPage() {
  const applications = await getApplications()
  return (
    <div className="page-wrapper">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold gradient-text tracking-tight">Applications</h1>
          <p className="text-sm text-navy-400 mt-1 font-medium">Review and approve new client applications.</p>
        </div>
        <InviteClientForm />
      </div>
      <ApplicationsTable applications={applications} />
    </div>
  )
}
