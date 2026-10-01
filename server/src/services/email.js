// Full-featured email service — Brevo API (production) + Resend/SMTP (fallback)
import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { config } from '../config.js'

let resendClient = null
let transporter = null
let etherealAccount = null
let useBrevo = false

// Initialize email client — priority: Brevo → Resend → SMTP → Simulated
async function initEmailClient() {
  // Priority 1: Brevo HTTP API (free, sends to any email, no domain needed, works on Render)
  if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) {
    useBrevo = true
    console.log('[PHS EMAIL] Using Brevo API for email delivery ✅')
    return
  }

  // Priority 2: Resend API
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
    console.log('[PHS EMAIL] Using Resend API for email delivery ✅')
    return
  }

  // Priority 3: Gmail / custom SMTP (local dev, blocked on Render free tier)
  const isGmail = (config.smtpHost && config.smtpHost.includes('gmail')) || (config.smtpUser && config.smtpUser.includes('@gmail.com'))
  if (isGmail && config.smtpUser && config.smtpPass) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.smtpUser, pass: config.smtpPass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    })
    console.log(`[PHS EMAIL] Using Gmail SMTP transport (${config.smtpUser})`)
  } else if (config.smtpHost && config.smtpUser) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure || config.smtpPort === 465,
      auth: config.smtpPass ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      tls: { rejectUnauthorized: true },
    })
    console.log(`[PHS EMAIL] Using SMTP transport (${config.smtpHost}:${config.smtpPort})`)
  } else {
    try {
      etherealAccount = await nodemailer.createTestAccount()
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: etherealAccount.user, pass: etherealAccount.pass },
      })
      console.log(`[PHS EMAIL] Using Ethereal sandbox account (${etherealAccount.user})`)
    } catch (err) {
      console.warn('[PHS EMAIL] Ethereal unavailable, using simulated mode:', err.message)
      transporter = null
    }
  }
}



// In-memory Outbox queue for live email inspection drawer
const outboxQueue = []

export function getOutboxQueue() {
  return outboxQueue.slice().reverse() // newest first
}

// Professional HTML Email Template Builder for Priority Handling Services, Inc.
export function buildHtmlTemplate({
  title = 'Priority Handling Services, Inc. Notification',
  message = '',
  actionUrl = '',
  actionText = 'View in Priority Handling Services, Inc.',
  details = [],
}) {
  const detailsHtml = details.length > 0
    ? `<table style="width:100%; border-collapse:collapse; margin:16px 0; background:#f8fafc; border-radius:8px; overflow:hidden; font-size:13px;">
        ${details.map(([label, val]) => `
          <tr>
            <td style="padding:8px 12px; font-weight:600; color:#475569; width:35%; border-bottom:1px solid #e2e8f0;">${label}</td>
            <td style="padding:8px 12px; color:#1e293b; border-bottom:1px solid #e2e8f0;">${val}</td>
          </tr>
        `).join('')}
      </table>`
    : ''

  const buttonHtml = actionUrl
    ? `<div style="margin:24px 0 16px; text-align:center;">
        <a href="${actionUrl}" style="background:#7c3aed; color:#ffffff; padding:10px 22px; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; display:inline-block;">${actionText}</a>
      </div>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color:#f1f5f9; margin:0; padding:20px; color:#1e293b;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding:24px 28px; text-align:left;">
              <div style="font-size:16px; font-weight:800; color:#ffffff; letter-spacing:0.8px;">PRIORITY HANDLING SERVICES, INC.</div>
              <div style="font-size:12px; color:#c7d2fe; margin-top:4px;">Workforce Services &amp; Development</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 20px;">
              <h2 style="font-size:18px; font-weight:700; color:#0f172a; margin:0 0 12px;">${title}</h2>
              <p style="font-size:14px; line-height:1.6; color:#334155; margin:0 0 16px;">${message}</p>
              ${detailsHtml}
              ${buttonHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 28px; text-align:center; font-size:11px; color:#94a3b8;">
              This is an automated notification from Priority Handling Services, Inc.<br>
              © ${new Date().getFullYear()} Priority Handling Services, Inc. All rights reserved.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

export async function sendEmail({ to, subject, text, html, details, actionUrl, actionText }) {
  // Lazy init on first send
  if (!resendClient && !transporter) {
    await initEmailClient()
  }

  const finalHtml = html || buildHtmlTemplate({ title: subject, message: text, actionUrl, actionText, details })

  const emailRecord = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    to,
    subject,
    text,
    sentAt: new Date().toISOString(),
    status: 'pending',
    previewUrl: null,
  }

  outboxQueue.push(emailRecord)
  if (outboxQueue.length > 50) outboxQueue.shift()

  // --- Brevo API path (production / cloud — sends to any email, 300/day free) ---
  if (useBrevo) {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER
      const senderName = process.env.BREVO_SENDER_NAME || 'Priority Handling Services, Inc.'
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent: finalHtml,
          textContent: text,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || `Brevo error ${response.status}`)
      emailRecord.status = 'sent'
      console.log(`[PHS EMAIL] Brevo delivered → ${to} | messageId: ${result.messageId}`)
      return { sent: true, messageId: result.messageId, emailRecord }
    } catch (error) {
      console.error('[PHS EMAIL] Brevo failed:', error.message)
      emailRecord.status = `error: ${error.message}`
      return { sent: false, error: error.message, emailRecord }
    }
  }

  // --- Resend API path ---
  if (resendClient) {
    try {
      const fromAddress = process.env.RESEND_FROM || 'Priority Handling Services, Inc. <onboarding@resend.dev>'
      const { data, error } = await resendClient.emails.send({
        from: fromAddress,
        to: [to],
        subject,
        html: finalHtml,
        text,
      })
      if (error) throw new Error(error.message)
      emailRecord.status = 'sent'
      console.log(`[PHS EMAIL] Resend delivered → ${to} | id: ${data.id}`)
      return { sent: true, messageId: data.id, emailRecord }
    } catch (error) {
      console.error('[PHS EMAIL] Resend failed:', error.message)
      emailRecord.status = `error: ${error.message}`
      return { sent: false, error: error.message, emailRecord }
    }
  }

  // --- Nodemailer SMTP path (local dev) ---
  if (!transporter) {
    console.log(`[PHS EMAIL (Simulated)] To: ${to} | Subject: ${subject}`)
    emailRecord.status = 'simulated (demo mode)'
    return { simulated: true, emailRecord }
  }

  try {
    const info = await transporter.sendMail({
      from: config.smtpFrom || (config.smtpUser ? `"Priority Handling Services, Inc." <${config.smtpUser}>` : '"Priority Handling Services, Inc." <noreply@priorityhandlingservices.local>'),
      to,
      subject,
      text,
      html: finalHtml,
    })
    const previewUrl = nodemailer.getTestMessageUrl(info) || null
    emailRecord.status = 'sent'
    emailRecord.previewUrl = previewUrl
    if (previewUrl) console.log(`[PHS EMAIL] Preview: ${previewUrl}`)
    return { sent: true, messageId: info.messageId, previewUrl, emailRecord }
  } catch (error) {
    console.error('[PHS EMAIL] SMTP failed:', error.message)
    emailRecord.status = `error: ${error.message}`
    return { sent: false, error: error.message, emailRecord }
  }
}

