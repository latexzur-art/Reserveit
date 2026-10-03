/**
 * Email Service — Brevo SMTP
 * Sends transactional emails via Brevo using nodemailer.
 * Same interface as emailService.ts so callers can swap easily.
 * @module backend/notifications/brevoEmailService
 */

import nodemailer from 'nodemailer'
import type { EmailPayload, SendEmailResult } from './emailService'

export type { EmailPayload, SendEmailResult }

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter
  _transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_KEY,
    },
  })
  return _transporter
}

export async function sendBrevoEmail(payload: EmailPayload): Promise<SendEmailResult> {
  if (!process.env.BREVO_SMTP_KEY || !process.env.BREVO_SMTP_USER) {
    const reason = 'Brevo env vars missing — email send skipped'
    console.warn(`[brevoEmailService] ${reason}`)
    return { success: false, skipped: true, error: reason }
  }

  const toList = Array.isArray(payload.to) ? payload.to : [payload.to]
  const senderName = process.env.MAIL_SENDER_NAME ?? 'ReserveIT'
  const senderAddress = process.env.BREVO_SENDER_EMAIL ?? process.env.BREVO_SMTP_USER

  try {
    await getTransporter().sendMail({
      from: `"${senderName}" <${senderAddress}>`,
      to: toList.join(', '),
      subject: payload.subject,
      html: payload.htmlBody,
    })
    console.log(`[brevoEmailService] Sent to ${payload.to}: "${payload.subject}"`)
    return { success: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({
      level: 'error',
      event: 'brevo_email_send_failed',
      to: payload.to,
      subject: payload.subject,
      error,
    }))
    return { success: false, error }
  }
}
