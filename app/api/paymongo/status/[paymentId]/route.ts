import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { PAYMONGO_BASE, paymongoAuthHeader } from '@/lib/paymongo/config'
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

export const dynamic = 'force-dynamic'

const idSchema = z.uuid()

// Payment intent statuses that mean the payment succeeded
const succeededStatuses = new Set(['succeeded', 'paid'])
// Statuses that mean it's permanently done (no need to poll further)
const failedStatuses = new Set(['failed', 'cancelled', 'canceled'])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { paymentId: rawPaymentId } = await params
  const idCheck = idSchema.safeParse(rawPaymentId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid payment id' }, { status: 400 })
  }
  const paymentId = idCheck.data

  const supabase = createAdminClient()
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, payment_status, user_id, paymongo_checkout_session_id')
    .eq('id', paymentId)
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: 'Payment record not found' }, { status: 404 })
  }
  if (payment.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!payment.paymongo_checkout_session_id) {
    return NextResponse.json({ error: 'No PayMongo checkout session attached to this payment' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `${PAYMONGO_BASE}/checkout_sessions/${encodeURIComponent(payment.paymongo_checkout_session_id)}`,
      {
        method: 'GET',
        headers: {
          Authorization: paymongoAuthHeader(),
          'Content-Type': 'application/json',
        },
      },
    )

    const responseJson = await response.json().catch(() => null)
    if (!response.ok) {
      return NextResponse.json(
        { error: responseJson?.errors?.[0]?.detail || responseJson?.message || 'PayMongo request failed' },
        { status: response.status },
      )
    }

    // Checkout session status
    const sessionStatus: string = responseJson?.data?.attributes?.status ?? ''
    // Payment intent status (the authoritative signal for whether money moved)
    const intentStatus: string =
      responseJson?.data?.attributes?.payment_intent?.attributes?.status ?? ''
    // Combine: if either signals success, treat as paid
    const effectiveStatus = intentStatus || sessionStatus

    let message = 'Payment status checked.'

    if (succeededStatuses.has(effectiveStatus)) {
      const alreadyCompleted = payment.payment_status === 'completed'

      const { error: completeError } = await supabase.rpc('complete_payment', {
        p_payment_id: paymentId,
        p_paymongo_data: responseJson,
        p_amount_centavos: extractPaidCentavos(responseJson),
      })
      if (completeError) {
        console.error('[API] GET /paymongo/status complete_payment error:', completeError.message)
        message = 'Payment confirmed by PayMongo but could not update the record.'
      } else {
        message = 'Payment completed successfully.'

        if (!alreadyCompleted) {
          // Check payment_type first to handle reschedule extra payments separately
          const { data: payTypeRow } = await supabase
            .from('payments')
            .select('payment_type')
            .eq('id', paymentId)
            .single()
          const isRescheduleExtra = (payTypeRow as any)?.payment_type === 'reschedule_extra'

          if (isRescheduleExtra) {
            const { applied, message: applyMsg } = await applyRescheduleOnPayment(paymentId)
            message = applied ? 'Reschedule confirmed. Your booking has been updated.' : message
            if (!applied) console.error('[status-poll] applyRescheduleOnPayment failed:', applyMsg)
          }

          if (!isRescheduleExtra) try {
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
              .eq('id', paymentId)
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
              const fmt = (t: string) => {
                const [hStr, mStr] = t.split(':')
                const h = parseInt(hStr, 10)
                return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
              }
              const dateLabel = bk.booking_date
                ? new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
                : bk.booking_date

              await sendNotificationToRoles(supabase, ['building_admin'], {
                title: 'Payment Received',
                message: `${userName} completed payment${amountLabel ? ` (${amountLabel})` : ''} for booking ${bk.booking_reference} — ${facilityName} on ${bk.booking_date} (${bk.start_time?.slice(0, 5)} – ${bk.end_time?.slice(0, 5)}). The reservation is now confirmed.`,
                type: 'success',
                source_type: 'booking',
                source_id: bk.id,
                priority: 'normal',
              })

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
                  console.error('[status-poll] Failed to email building admins:', err)
                )
              }

              const bookerEmail = bk.user?.notification_email ?? null
              if (!bookerEmail) {
                console.warn(`[status-poll] Booking ${bk.id} user has no notification_email set — payment email skipped`)
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
                  console.error('[status-poll] Failed to email booker:', err)
                )
              }

              if (bk.user_id) {
                const { error: notifErr } = await supabase.from('notifications').insert({
                  user_id: bk.user_id,
                  title: 'Payment Confirmed',
                  message: `Your payment${amountLabel ? ` of ${amountLabel}` : ''} for booking ${bk.booking_reference} has been received. Your reservation is now confirmed!`,
                  type: 'success',
                  source_type: 'booking',
                  source_id: bk.id,
                  priority: 'high',
                  read: false,
                })
                if (notifErr) console.error('[status-poll] Failed to notify booker in-app:', notifErr)
              }

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
            console.error('[status-poll] Failed to send payment notifications:', notifErr)
          }
        }
      }
    } else if (failedStatuses.has(effectiveStatus) || sessionStatus === 'inactive') {
      // Only mark failed if session is inactive AND intent didn't succeed
      if (!succeededStatuses.has(intentStatus)) {
        await supabase
          .from('payments')
          .update({
            payment_status: 'failed',
            paymongo_webhook_data: responseJson,
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId)
        message = 'Payment was not completed.'
      }
    }

    const { data: refreshed } = await supabase
      .from('payments')
      .select('id, payment_reference, amount, currency, total_amount, payment_method, payment_status, description, paymongo_checkout_url, paymongo_checkout_session_id, user_id, created_at, updated_at')
      .eq('id', paymentId)
      .single()

    return NextResponse.json({ message, intentStatus, sessionStatus, payment: refreshed })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /paymongo/status error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
