// Pure payment-history helpers (unit tested in payments.test.ts).

/**
 * Collapse duplicate payment_log rows for DISPLAY. The first payment of a
 * subscription is logged twice — once from `checkout.session.completed` and
 * once from `invoice.payment_succeeded` — both referencing the SAME Stripe
 * invoice. That is one charge, but it reads as two in the history and looks
 * like a double charge. This keeps one row per (invoice, status) pair while
 * leaving the full audit trail untouched in the database.
 *
 * Keyed on invoice id AND status so a `failed`-then-`succeeded` (or a future
 * `refunded`) on the same invoice stays visible as distinct events; rows with
 * no invoice id (e.g. hand-entered records) are always kept. Input order is
 * preserved and the first-seen row of a duplicate pair wins.
 */
export function dedupePaymentsByInvoice<
  T extends { stripe_invoice_id: string | null; status: string }
>(payments: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const p of payments) {
    if (p.stripe_invoice_id) {
      const key = `${p.stripe_invoice_id}|${p.status}`
      if (seen.has(key)) continue
      seen.add(key)
    }
    out.push(p)
  }
  return out
}
