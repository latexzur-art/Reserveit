import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { getPaymongoWebhookSecret } from '@/lib/paymongo/config'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { voidScheduleConflictsForPaidBooking } from '@/backend/schedule-events/voidScheduleConflictsForPaidBooking'
import { getBuildingAdminEmails } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { buildingAdminPaymentCompletedEmail, bookerPaymentConfirmedEmail } from '@/backend/notifications/emailTemplates'
import { applyRescheduleOnPayment } from '@/backend/booking/emergencyRescheduleRequestService'

/** PayMongo-reported paid amount in centavos, from the payment_intent attributes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPaidCentavos(payload: any): number | null {
  return payload?.data?.attributes?.payment_intent?.attributes?.amount ?? null
}

// Checkout session event types that mean payment succeeded
const paidEventTypes = new Set([
  'checkout_session.payment.paid',
  'payment.paid',
])
const failedEventTypes = new Set([
  'checkout_session.payment.failed',
  'payment.failed',
])

// PayMongo signs webhooks with HMAC-SHA256 over `${timestamp}.${rawBody}`.
// The header looks like: `t=1492774577,te=<test_sig>,li=<live_sig>`.
// We verify the signature matching the current mode (live key prefers `li`,
// test key prefers `te`); fall back to the other if missing.
function verifySignature(rawBody: string, header: string, secret: string): boolean {
  const parts = header.split(',').reduce<Record<string, string>>((acc, kv) => {
    const [k, v] = kv.split('=')
    if (k && v) acc[k.trim()] = v.trim()
    return acc
  }, {})

  const timestamp = parts.t
  const provided = parts.li || parts.te
  if (!timestamp || !provided) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(provided, 'hex')
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sigHeader =
    request.headers.get('Paymongo-Signature') ||
    request.headers.get('paymongo-signature') ||
    ''

  const webhookSecret = getPaymongoWebhookSecret()

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook] PAYMONGO_WEBHOOK_SECRET not configured in production')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }
    // dev: signature already warned via getPaymongoWebhookSecret(); accept
  } else {
    if (!sigHeader || !verifySignature(rawBody, sigHeader, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 })
    }
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const eventType: string = String(payload?.type ?? '').toLowerCase()

  // Debug: log the webhook structure to understand billing data location
  if (process.env.NODE_ENV !== 'production') {
    console.log('[webhook] Event type:', eventType)
    console.log('[webhook] Payload structure:', JSON.stringify({
      type: payload?.type,
      dataType: payload?.data?.type,
      hasBilling: !!payload?.data?.attributes?.billing,
      billingKeys: payload?.data?.attributes?.billing ? Object.keys(payload.data.attributes.billing) : null,
      fullBilling: payload?.data?.attributes?.billing,
    }, null, 2))
  }

  // Extract checkout session ID from the webhook payload.
  // PayMongo sends either the session itself or a payment with a checkout_session_id.
  const sessionId: string | null =
    payload?.data?.attributes?.checkout_session_id  // payment.paid events
    ?? (payload?.data?.type === 'checkout_session' ? payload?.data?.id : null) // checkout_session.* events
    ?? null

  if (!sessionId) {
    // Not a checkout session event — silently acknowledge
    return NextResponse.json({ received: true, action: 'ignored' })
  }

  const supabase = createAdminClient()
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, payment_status')
    .eq('paymongo_checkout_session_id', sessionId)
    .single()

  if (paymentError || !payment) {
    // Unknown session — acknowledge so PayMongo doesn't keep retrying
    console.warn('[webhook] No payment found for checkout session:', sessionId)
    return NextResponse.json({ received: true, action: 'no_match' })
  }

  let actionTaken = 'none'

  try {
    if (paidEventTypes.has(eventType) || (!eventType && payload?.data?.attributes?.status === 'paid')) {
      if (payment.payment_status !== 'completed') {
        const { data: wasCompleted, error: completeError } = await supabase.rpc('complete_payment', {
          p_payment_id: payment.id,
          p_paymongo_data: payload,
          p_amount_centavos: extractPaidCentavos(payload),
        })
        if (completeError) {
          console.error('[webhook] complete_payment error:', completeError.message)
          return NextResponse.json({ error: completeError.message }, { status: 500 })
        }

        if (!wasCompleted) {
          return NextResponse.json({ received: true, action: 'already_completed', sessionId })
        }

        actionTaken = 'completed'

        // Check if this is a reschedule extra payment — apply the reschedule and skip booking notifications
        const { data: paymentTypRow } = await supabase
          .from('payments')
          .select('payment_type')
          .eq('id', payment.id)
          .single()

        if ((paymentTypRow as any)?.payment_type === 'reschedule_extra') {
          const { applied, message: applyMsg } = await applyRescheduleOnPayment(payment.id)
          if (!applied) {
            console.error('[webhook] applyRescheduleOnPayment failed:', applyMsg)
          }
          return NextResponse.json({ received: true, action: actionTaken, sessionId })
        }

        // Notify building admins of the successful payment
        try {
          const { data: paidPayment } = await supabase
            .from('payments')
            .select(`
              id, amount, currency,
              booking:bookings!payments_booking_id_fkey(
                id, booking_reference, booking_date, start_time, end_time, user_id,
                booking_facilities(facility_id, facility:facilities(name)),
                user:users!bookings_user_id_fkey(full_name, email, notification_email)
              )
            `)
            .eq('id', payment.id)
            .single()

          if (paidPayment?.booking) {
            const bk = paidPayment.booking as any

            const facilityEntry = bk.booking_facilities?.[0]
            const facilityName = facilityEntry?.facility?.name ?? 'facility'
            const facilityId = facilityEntry?.facility_id ?? null
            const userName = bk.user?.full_name ?? 'A user'
            const amountLabel = paidPayment.amount
              ? `₱${Number(paidPayment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
              : ''

            await sendNotificationToRoles(supabase, ['building_admin'], {
              title: 'Payment Received',
              message: `${userName} completed payment${amountLabel ? ` (${amountLabel})` : ''} for booking ${bk.booking_reference} — ${facilityName} on ${bk.booking_date} (${bk.start_time?.slice(0, 5)} – ${bk.end_time?.slice(0, 5)}). The reservation is now confirmed.`,
              type: 'success',
              source_type: 'booking',
              source_id: bk.id,
              priority: 'normal',
            })

            // Email all building admins about payment completion
            const fmt = (t: string) => {
              const [hStr, mStr] = t.split(':')
              const h = parseInt(hStr, 10)
              return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
            }
            const dateLabel = bk.booking_date
              ? new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
              : bk.booking_date
            const adminEmails = await getBuildingAdminEmails()
            if (adminEmails.length > 0) {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
              const { subject, htmlBody } = buildingAdminPaymentCompletedEmail({
                bookingRef: bk.booking_reference,
                requesterName: userName,
                facilityName,
                bookingDate: dateLabel,
                startTime: bk.start_time ? fmt(bk.start_time.slice(0, 5)) : '',
                endTime: bk.end_time ? fmt(bk.end_time.slice(0, 5)) : '',
                amountPaid: amountLabel || '—',
                adminPanelUrl: `${appUrl}/admin/building/reservations`,
              })
              await sendBrevoEmail({ to: adminEmails, subject, htmlBody }).catch(err =>
                console.error('[webhook] Failed to email building admins about payment completion:', err)
              )
            }

            // Email the booker a payment confirmation
            const bookerEmail = bk.user?.notification_email ?? null
            if (!bookerEmail) {
              console.warn(`[webhook] Booking ${bk.id} user has no notification_email set — payment email skipped`)
            } else {
              const { subject, htmlBody } = bookerPaymentConfirmedEmail({
                userName,
                bookingRef: bk.booking_reference,
                facilityName,
                bookingDate: dateLabel,
                startTime: bk.start_time ? fmt(bk.start_time.slice(0, 5)) : '',
                endTime: bk.end_time ? fmt(bk.end_time.slice(0, 5)) : '',
                amountPaid: amountLabel || '—',
              })
              await sendBrevoEmail({ to: bookerEmail, subject, htmlBody }).catch(err =>
                console.error('[webhook] Failed to email booker payment confirmation:', err)
              )
            }

            // Notify the booker in-app about payment completion
            if (bk.user_id) {
              const { error: bookerNotifErr } = await supabase.from('notifications').insert({
                user_id: bk.user_id,
                title: 'Payment Confirmed',
                message: `Your payment${amountLabel ? ` of ${amountLabel}` : ''} for booking ${bk.booking_reference} has been received. Your reservation is now confirmed!`,
                type: 'success',
                source_type: 'booking',
                source_id: bk.id,
                priority: 'high',
                read: false,
              })
              if (bookerNotifErr) console.error('[webhook] Failed to notify booker in-app:', bookerNotifErr)
            }

            // Void any class schedules displaced by this paid reservation
            if (facilityId && bk.booking_date && bk.start_time && bk.end_time) {
              await voidScheduleConflictsForPaidBooking(
                supabase,
                facilityId,
                bk.booking_date,
                bk.start_time,
                bk.end_time,
                bk.booking_reference,
                bk.id,
              )
            }
          }
        } catch (notifErr) {
          console.error('[webhook] Failed to notify building admin of payment:', notifErr)
        }
      } else {
        actionTaken = 'already_completed'
      }
    } else if (failedEventTypes.has(eventType)) {
      if (payment.payment_status !== 'completed') {
        await supabase
          .from('payments')
          .update({
            payment_status: 'failed',
            paymongo_webhook_data: payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id)
        actionTaken = 'failed'
      }
    } else {
      // Other event types (e.g. source.chargeable from old integration) — store and ignore
      await supabase
        .from('payments')
        .update({ paymongo_webhook_data: payload, updated_at: new Date().toISOString() })
        .eq('id', payment.id)
      actionTaken = 'stored'
    }

    return NextResponse.json({ received: true, action: actionTaken, sessionId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
