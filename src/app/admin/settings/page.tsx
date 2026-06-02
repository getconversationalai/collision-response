import { getNotificationEmails } from '@/lib/actions/application-actions'
import NotificationEmailsForm from '@/components/admin/NotificationEmailsForm'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const emails = await getNotificationEmails()
  return (
    <div className="page-wrapper max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">Settings</h1>
        <p className="text-sm text-navy-400 mt-1 font-medium">Configure who gets notified about new submissions.</p>
      </div>
      <NotificationEmailsForm initialEmails={emails} />
    </div>
  )
}
