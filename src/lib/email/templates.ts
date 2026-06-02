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

// Escape ampersands in a URL so the href attribute is valid HTML. Email
// clients decode `&amp;` back to `&` when following the link.
function escapeHref(href: string): string {
  return href.replace(/&/g, '&amp;')
}

function button(href: string, label: string): string {
  return `<a href="${escapeHref(href)}" style="display:inline-block;background:${BRAND};background-image:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:15px 32px;border-radius:14px;box-shadow:0 8px 20px rgba(37,99,235,0.30);">${escapeHtml(label)}</a>`
}

function layout(opts: { heading: string; intro: string; body: string; preview?: string }): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${opts.preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preview)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:36px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(16,42,67,0.10);">
        <!-- Header / brand -->
        <tr><td style="background:#1e3a8a;background-image:linear-gradient(135deg,#0b2a6b 0%,#1e3a8a 35%,#2563eb 78%,#3b82f6 100%);padding:26px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;padding-right:13px;">
              <div style="width:42px;height:42px;border-radius:13px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.28);text-align:center;line-height:42px;">
                <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.02em;">CP</span>
              </div>
            </td>
            <td style="vertical-align:middle;">
              <div style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:-0.01em;line-height:1.1;">Collision Ping</div>
              <div style="color:rgba(255,255,255,0.72);font-size:10.5px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-top:3px;">by Automate Anything AI</div>
            </td>
          </tr></table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:34px 34px 8px;">
          <h1 style="margin:0 0 14px;color:${NAVY};font-size:23px;font-weight:800;line-height:1.25;letter-spacing:-0.01em;">${escapeHtml(opts.heading)}</h1>
          ${opts.intro ? `<p style="margin:0 0 22px;color:${MUTED};font-size:15px;line-height:1.65;">${opts.intro}</p>` : ''}
          ${opts.body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:8px 34px 30px;">
          <p style="margin:26px 0 0;color:#9fb3c8;font-size:12px;line-height:1.6;border-top:1px solid #eef2f7;padding-top:18px;">
            <strong style="color:#7b8ca0;">Collision Ping</strong> by Automate Anything AI — real-time motor-vehicle-accident alerts for collision centers.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;color:${MUTED};font-size:13px;width:130px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:7px 0;color:${NAVY};font-size:13px;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`
}

export function applicationInviteEmail(args: {
  contactName: string | null
  companyName: string | null
  applyUrl: string
}): EmailContent {
  const greeting = args.contactName ? `Hi ${escapeHtml(args.contactName)}, ` : ''
  const forCompany = args.companyName
    ? ` for <strong style="color:${NAVY};">${escapeHtml(args.companyName)}</strong>`
    : ''
  const intro = `${greeting}you're invited to join <strong style="color:${NAVY};">Collision Ping</strong> — real-time motor-vehicle-accident alerts delivered to your phone the moment they happen, so your collision center can be first on the scene. Complete a quick sign-up${forCompany} and we'll get you set up.`
  const body = `
    <div style="text-align:center;margin:6px 0 4px;">${button(args.applyUrl, 'Start your sign-up')}</div>
    <p style="margin:22px 0 0;color:#9fb3c8;font-size:12.5px;line-height:1.6;">It only takes a minute — tell us about your company and choose the coverage areas you want alerts for.</p>`
  return {
    subject: `You're invited to Collision Ping`,
    html: layout({
      heading: "You're invited to Collision Ping",
      intro,
      body,
      preview: 'Apply to receive real-time MVA alerts for your collision center.',
    }),
  }
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
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-radius:14px;padding:10px 18px;margin-bottom:26px;">
      ${infoRow('Company', args.companyName)}
      ${infoRow('Contact', args.contactName)}
      ${infoRow('Email', args.email)}
      ${infoRow('Phone', args.phoneDisplay)}
      ${infoRow('Coverage areas', areas)}
    </table>
    <div style="text-align:center;">${button(args.reviewUrl, 'Review submission')}</div>`
  return {
    subject: `New submission — ${args.companyName}`,
    html: layout({
      heading: 'New client submission',
      intro: `A new collision center has applied to Collision Ping. Review the details below and approve or decline in the admin portal.`,
      body,
      preview: `New submission from ${args.companyName}`,
    }),
  }
}

export function clientApprovedEmail(args: {
  companyName: string
  setupUrl: string
  comped: boolean
}): EmailContent {
  const body = args.comped
    ? `<p style="margin:0 0 22px;color:${MUTED};font-size:15px;line-height:1.65;">Your account is <strong style="color:${NAVY};">active</strong>. Set your password to log in and manage your coverage areas — no payment needed.</p>
       <div style="text-align:center;">${button(args.setupUrl, 'Set your password & log in')}</div>`
    : `<p style="margin:0 0 22px;color:${MUTED};font-size:15px;line-height:1.65;">Set your password to log in, then add a card to activate alerts for your coverage areas.</p>
       <div style="text-align:center;">${button(args.setupUrl, 'Set your password & log in')}</div>
       <p style="margin:22px 0 0;color:#9fb3c8;font-size:12.5px;line-height:1.6;">Alerts begin once your payment method is on file.</p>`
  return {
    subject: `You're approved — welcome to Collision Ping`,
    html: layout({
      heading: `Welcome, ${escapeHtml(args.companyName)}!`,
      intro: `Your submission has been approved.`,
      body,
      preview: `Your Collision Ping submission was approved`,
    }),
  }
}

export function applicantRejectedEmail(args: {
  companyName: string
  reason: string | null
}): EmailContent {
  const reasonBlock = args.reason
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-radius:14px;margin-top:8px;"><tr><td style="padding:15px 18px;color:${NAVY};font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${escapeHtml(args.reason)}</td></tr></table>`
    : ''
  return {
    subject: `Update on your Collision Ping submission`,
    html: layout({
      heading: 'Submission update',
      intro: `Thank you for your interest in Collision Ping. After review, we're unable to approve your submission at this time.`,
      body: `${reasonBlock}<p style="margin:22px 0 0;color:${MUTED};font-size:14px;line-height:1.65;">If you believe this was in error or your situation changes, please reach out to us.</p>`,
      preview: `Update on your submission`,
    }),
  }
}
