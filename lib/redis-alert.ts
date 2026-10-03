import { createAdminClient } from '@/lib/supabase/server'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { getBuildingAdminEmails } from '@/backend/notifications/recipientResolver'

let lastAlertTime = 0
const ALERT_COOLDOWN_MS = 30 * 60 * 1000 // Alert at most once per 30 minutes

/**
 * Triggers an in-app notification + Brevo email to Building Admins when
 * Upstash Redis hits daily quotas or experiences network connection errors.
 * Application continues operating seamlessly via in-memory fallback.
 */
export async function notifyBuildingAdminOfRedisFallback(errorMsg: string): Promise<void> {
  const now = Date.now()
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) return
  lastAlertTime = now

  try {
    const supabase = createAdminClient()

    // 1. In-app notification to all Building Admins
    await sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Upstash Redis Cache Alert',
      message: `Redis cache service triggered fallback to local memory due to issue: ${errorMsg}`,
      type: 'warning',
      priority: 'high',
    })

    // 2. Email alert to Building Admins via Brevo
    const adminEmails = await getBuildingAdminEmails()
    if (adminEmails.length > 0) {
      await sendBrevoEmail({
        to: adminEmails,
        subject: '[ReserveIT Alert] Upstash Redis Quota / Fallback Triggered',
        htmlBody: `
          <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #1e293b;">
            <h2 style="color: #d97706;">Upstash Redis Cache Alert</h2>
            <p>ReserveIT detected an issue connecting to Upstash Redis and has safely fallen back to process-local memory.</p>
            <p style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace;">${errorMsg}</p>
            <p><strong>Impact:</strong> The application is functioning normally with zero downtime using local memory caching and sliding-window rate limiting.</p>
          </div>
        `,
      })
    }
  } catch (err) {
    console.error('[RedisAlert] Failed to notify building admins:', err)
  }
}
