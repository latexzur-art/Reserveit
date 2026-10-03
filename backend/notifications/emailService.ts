/**
 * Email Service — Microsoft Graph API
 * Sends emails via Azure app registration using client credentials flow.
 * Returns a structured result so callers can detect delivery failures
 * instead of silently treating "function returned" as "email delivered".
 * @module backend/notifications/emailService
 */

import { getGraphClient } from '@/backend/integrations/graphClient'

export interface EmailPayload {
  to: string | string[]
  subject: string
  htmlBody: string
}

export type SendEmailResult =
  | { success: true; skipped?: false }
  | { success: false; skipped?: true; error: string }

export async function sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
  if (!process.env.AZURE_CLIENT_SECRET || !process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID) {
    const reason = 'Azure env vars missing (AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET) — email send skipped'
    console.warn(`[emailService] ${reason}`)
    return { success: false, skipped: true, error: reason }
  }

  const sender = process.env.MAIL_SENDER_ADDRESS
  if (!sender) {
    const reason = 'MAIL_SENDER_ADDRESS not set — email send skipped'
    console.warn(`[emailService] ${reason}`)
    return { success: false, skipped: true, error: reason }
  }

  const client = getGraphClient()

  const toRecipients = (Array.isArray(payload.to) ? payload.to : [payload.to])
    .map(email => ({ emailAddress: { address: email } }))

  try {
    await client.api(`/users/${sender}/sendMail`).post({
      message: {
        subject: payload.subject,
        body: { contentType: 'HTML', content: payload.htmlBody },
        toRecipients,
      },
      saveToSentItems: false,
    })
    console.log(`[emailService] Sent to ${payload.to}: "${payload.subject}"`)
    return { success: true }
  } catch (err: unknown) {
    // GraphError / AzureError objects carry extra fields beyond .message
    const e = err as any
    const error =
      (typeof e?.message === 'string' && e.message) ||
      (typeof e?.code === 'string' && e.code) ||
      (typeof e?.body === 'string' && e.body) ||
      (e?.statusCode ? `HTTP ${e.statusCode}` : '') ||
      (typeof err === 'string' ? err : '') ||
      'Unknown error'

    const detail: Record<string, unknown> = {
      level: 'error',
      event: 'email_send_failed',
      to: payload.to,
      subject: payload.subject,
      error,
    }
    if (e?.statusCode) detail.statusCode = e.statusCode
    if (e?.code) detail.code = e.code
    if (e?.body) detail.body = typeof e.body === 'string' ? e.body.slice(0, 500) : JSON.stringify(e.body).slice(0, 500)

    console.error(JSON.stringify(detail))
    return { success: false, error }
  }
}
