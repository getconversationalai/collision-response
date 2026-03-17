import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import AdminSidebar from '@/components/admin/AdminSidebar'

function getAdminIds(): string[] {
  const raw = process.env.ADMIN_USER_IDS ?? ''
  return raw.split(',').map(id => id.trim()).filter(Boolean)
}

export const metadata = {
  title: 'Admin Portal — Collision Response',
  description: 'Manage collision company clients',
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminIds = getAdminIds()
  if (!adminIds.includes(user.id)) redirect('/dashboard')

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 lg:pl-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
