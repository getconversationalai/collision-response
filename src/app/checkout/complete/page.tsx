import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'

// Public checkout-result landing page. A card-entry link (admin-generated) may
// be completed by the operator OR by the client, logged in or not — so this
// page requires no session and no company lookup. Actual activation happens via
// the Stripe webhook regardless of where the browser lands.
export const dynamic = 'force-dynamic'

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const canceled = status === 'canceled'

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-navy-50/40">
      <div className="glass-card-rich rounded-2xl p-8 max-w-md w-full text-center animate-fade-in-up">
        <div
          className={`mx-auto flex items-center justify-center w-14 h-14 rounded-2xl mb-5 ${
            canceled ? 'bg-navy-100 text-navy-500' : 'bg-emerald-100 text-emerald-600'
          }`}
        >
          {canceled ? (
            <XCircle className="w-7 h-7" />
          ) : (
            <CheckCircle2 className="w-7 h-7" />
          )}
        </div>

        {canceled ? (
          <>
            <h1 className="text-xl font-extrabold text-navy-800">
              Checkout canceled
            </h1>
            <p className="text-sm text-navy-500 mt-2 leading-relaxed">
              No card was saved and no charge was made. You can reopen the
              payment link whenever you&apos;re ready.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-navy-800">
              Payment received
            </h1>
            <p className="text-sm text-navy-500 mt-2 leading-relaxed">
              The subscription is now active and SMS notifications are on. A
              receipt has been emailed by Stripe. You can close this page.
            </p>
          </>
        )}

        <Link
          href="/login"
          className="btn-secondary inline-flex items-center justify-center mt-6 text-sm"
        >
          Go to sign in
        </Link>
      </div>
    </main>
  )
}
