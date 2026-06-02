import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Backward-compat: the public signup form moved from /apply to /signup.
// Preserve any pre-fill query params on the redirect.
export default async function ApplyRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value)
  }
  const query = qs.toString()
  redirect(query ? `/signup?${query}` : '/signup')
}
