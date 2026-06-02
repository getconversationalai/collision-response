import { notFound } from 'next/navigation'
import { getApplicationById } from '@/lib/actions/application-actions'
import ApplicationReview from '@/components/admin/ApplicationReview'

export const dynamic = 'force-dynamic'

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let detail
  try {
    detail = await getApplicationById(id)
  } catch {
    notFound()
  }
  return <ApplicationReview detail={detail} />
}
