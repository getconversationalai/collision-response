/** Pure, branded HTML email builders. No I/O — returns { subject, html }. */

export type EmailContent = { subject: string; html: string }

const BRAND = '#2563eb'
const NAVY = '#102a43'
const MUTED = '#627d98'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function button(href: string, label: string, color = BRAND): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:12px;">${escapeHtml(label)}</a>`
}

function layout(opts: { heading: string; intro: string; body: string; preview?: string }): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${opts.preview ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preview)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(16,42,67,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e3a8a,#2563eb,#3b82f6);padding:22px 32px;">
          <span style="color:#ffffff;font-size:17px;font-weight:800;letter-spacing:-0.01em;">Collision Response</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;color:${NAVY};font-size:22px;font-weight:800;">${escapeHtml(opts.heading)}</h1>
          <p style="margin:0 0 20px;color:${MUTED};font-size:15px;line-height:1.6;">${opts.intro}</p>
          ${opts.body}
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="margin:24px 0 0;color:#9fb3c8;font-size:12px;line-height:1.5;border-top:1px solid #eef2f7;padding-top:16px;">Collision Response — automated MVA alerts for collision centers.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:${MUTED};font-size:13px;width:130px;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:${NAVY};font-size:13px;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`
}

export function adminNotificationEmail(args: {
  companyName: string
  contactName: string
  email: string
  phoneDisplay: string
  municipalityNames: string[]
  reviewUrl: string
}): EmailContent {
  const areas = args.municipalityNames.length
    ? args.municipalityNames.map(escapeHtml).join(', ')
    : '—'
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-radius:12px;padding:8px 16px;margin-bottom:24px;">
      ${infoRow('Company', args.companyName)}
      ${infoRow('Contact', args.contactName)}
      ${infoRow('Email', args.email)}
      ${infoRow('Phone', args.phoneDisplay)}
      ${infoRow('Coverage areas', areas)}
    </table>
    <div style="text-align:center;">${button(args.reviewUrl, 'Review application')}</div>`
  return {
    subject: `New application — ${args.companyName}`,
    html: layout({
      heading: 'New client application',
      intro: `A new collision center has applied to Collision Response. Review the details below and approve or decline in the admin portal.`,
      body,
      preview: `New application from ${args.companyName}`,
    }),
  }
}

export function clientApprovedEmail(args: {
  companyName: string
  setupUrl: string
  comped: boolean
}): EmailContent {
  const body = args.comped
    ? `<p style="margin:0 0 20px;color:${MUTED};font-size:15px;line-height:1.6;">Your account is <strong style="color:${NAVY};">active</strong>. Set your password to log in and manage your coverage areas — no payment needed.</p>
       <div style="text-align:center;">${button(args.setupUrl, 'Set your password & log in')}</div>`
    : `<p style="margin:0 0 20px;color:${MUTED};font-size:15px;line-height:1.6;">Set your password to log in, then add a card to activate SMS alerts for your coverage areas.</p>
       <div style="text-align:center;">${button(args.setupUrl, 'Set your password & log in')}</div>
       <p style="margin:20px 0 0;color:#9fb3c8;font-size:12px;line-height:1.5;">Alerts begin once your payment method is on file.</p>`
  return {
    subject: `You're approved — welcome to Collision Response`,
    html: layout({
      heading: `Welcome, ${escapeHtml(args.companyName)}!`,
      intro: `Your application has been approved.`,
      body,
      preview: `Your Collision Response application was approved`,
    }),
  }
}

export function applicantRejectedEmail(args: {
  companyName: string
  reason: string | null
}): EmailContent {
  const reasonBlock = args.reason
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-radius:12px;margin-top:8px;"><tr><td style="padding:14px 16px;color:${NAVY};font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${escapeHtml(args.reason)}</td></tr></table>`
    : ''
  return {
    subject: `Update on your Collision Response application`,
    html: layout({
      heading: 'Application update',
      intro: `Thank you for your interest in Collision Response. After review, we're unable to approve your application at this time.`,
      body: `${reasonBlock}<p style="margin:20px 0 0;color:${MUTED};font-size:14px;line-height:1.6;">If you believe this was in error or your situation changes, please reach out to us.</p>`,
      preview: `Update on your application`,
    }),
  }
}
