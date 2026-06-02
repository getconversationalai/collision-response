/** Best-effort transactional email via the Resend HTTP API (Workers-safe). */

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
}

export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string }

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) {
    console.error('[email] RESEND_API_KEY / RESEND_FROM not configured; skipping send')
    return { ok: false, error: 'email_not_configured' }
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const recipients = (Array.isArray(to) ? to : [to])
    .map((r) => r.trim())
    .filter((r) => EMAIL_RE.test(r))
  if (recipients.length === 0) return { ok: false, error: 'no_valid_recipients' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[email] Resend error ${res.status}: ${text}`)
      return { ok: false, error: `resend_${res.status}` }
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[email] send failed:', err)
    return { ok: false, error: 'send_exception' }
  }
}
