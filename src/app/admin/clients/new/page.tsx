export const runtime = 'edge'

import ClientForm from '@/components/admin/ClientForm'

export default function NewClientPage() {
  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold gradient-text tracking-tight">
          Add New Client
        </h1>
        <p className="text-navy-400 text-sm mt-1 font-medium">
          Onboard a new collision company in just a few steps
        </p>
      </div>

      <ClientForm />
    </div>
  )
}
