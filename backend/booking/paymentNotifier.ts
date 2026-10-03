import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { getBuildingAdminEmails, resolveUserPageUrls } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  buildingAdminPaymentCompletedEmail,
  bookerPaymentConfirmedEmail,
  extensionPaymentConfirmedEmail,
} from '@/backend/notifications/emailTemplates'
import { voidScheduleConflictsForPaidBooking } from '@/backend/schedule-events/voidScheduleConflictsForPaidBooking'

function fmt12h(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/**
 * Send all payment-completion notifications (in-app + email) for a just-paid booking.
 * Called by both the PayMongo webhook and the status-poll endpoint so that whoever
 * first marks the payment as 'completed' also fires the notifications.
 */
export async function sendPaymentCompletionNotifications(
  supabase: SupabaseClient,
  paymentId: string,
): Promise<void> {
  const { data: paidPayment } = await supabase
    .from('payments')
    .select(`
      id, amount, currency, payment_type,
      booking:bookings!payments_booking_id_fkey(
        id, booking_reference, booking_date, start_time, end_time, user_id,
        booking_facilities(facility_id, facility:facilities(name)),
        user:users!bookings_user_id_fkey(full_name, email, notification_email)
      )
    `)
    .eq('id', paymentId)
    .single()

  if (!paidPayment?.booking) return

  const bk = paidPayment.booking as any

  const facilityEntry = bk.booking_facilities?.[0]
  const facilityName = facilityEntry?.facility?.name ?? 'facility'
  const facilityId = facilityEntry?.facility_id ?? null
  const userName = bk.user?.full_name ?? 'A user'
  const amountLabel = paidPayment.amount
    ? `₱${Number(paidPayment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    : ''
  const dateLabel = bk.booking_date
    ? new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : bk.booking_date

  // In-app notification → building admins
  await sendNotificationToRoles(supabase, ['building_admin'], {
    title: 'Payment Received',
    message: `${userName} completed payment${amountLabel ? ` (${amountLabel})` : ''} for booking ${bk.booking_reference} — ${facilityName} on ${bk.booking_date} (${bk.start_time?.slice(0, 5)} – ${bk.end_time?.slice(0, 5)}). The reservation is now confirmed.`,
    type: 'success',
    source_type: 'booking',
    source_id: bk.id,
    priority: 'normal',
  })

  // Email → building admins
  const adminEmails = await getBuildingAdminEmails()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (adminEmails.length > 0) {
    const { subject, htmlBody } = buildingAdminPaymentCompletedEmail({
      bookingRef: bk.booking_reference,
      requesterName: userName,
      facilityName,
      bookingDate: dateLabel,
      startTime: bk.start_time ? fmt12h(bk.start_time.slice(0, 5)) : '',
      endTime: bk.end_time ? fmt12h(bk.end_time.slice(0, 5)) : '',
      amountPaid: amountLabel || '—',
      adminPanelUrl: `${appUrl}/admin/building/reservations`,
    })
    await sendBrevoEmail({ to: adminEmails, subject, htmlBody }).catch(err =>
      console.error('[paymentNotifier] Failed to email building admins:', err)
    )
  }

  // Email → booker
  const bookerEmail = bk.user?.notification_email ?? null
  const bookerPageUrls = bk.user_id ? await resolveUserPageUrls(supabase, bk.user_id) : null
  if (!bookerEmail) {
    console.warn(`[paymentNotifier] Booking ${bk.booking_reference} user has no notification_email set — payment email skipped`)
  } else {
    const receiptUrl = bookerPageUrls ? `${appUrl}${bookerPageUrls.paymentUrl}` : undefined
    const { subject, htmlBody } = bookerPaymentConfirmedEmail({
      userName,
      bookingRef: bk.booking_reference,
      facilityName,
      bookingDate: dateLabel,
      startTime: bk.start_time ? fmt12h(bk.start_time.slice(0, 5)) : '',
      endTime: bk.end_time ? fmt12h(bk.end_time.slice(0, 5)) : '',
      amountPaid: amountLabel || '—',
      receiptUrl,
    })
    await sendBrevoEmail({ to: bookerEmail, subject, htmlBody }).catch(err =>
      console.error('[paymentNotifier] Failed to email booker:', err)
    )
  }

  // Extension-specific email
  if ((paidPayment as any).payment_type === 'extension' && bookerEmail) {
    const { subject, htmlBody } = extensionPaymentConfirmedEmail({
      userName,
      bookingRef: bk.booking_reference,
      endTime: bk.end_time ? fmt12h(bk.end_time.slice(0, 5)) : '',
      amountPaid: amountLabel || '—',
    })
    await sendBrevoEmail({ to: bookerEmail, subject, htmlBody }).catch(err =>
      console.error('[paymentNotifier] Failed to email booker (extension):', err)
    )
  }

  // In-app notification → booker
  if (bk.user_id) {
    const paymentActionUrl = bookerPageUrls ? `${appUrl}${bookerPageUrls.paymentUrl}` : undefined
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: bk.user_id,
      title: 'Payment Confirmed',
      message: `Your payment${amountLabel ? ` of ${amountLabel}` : ''} for booking ${bk.booking_reference} has been received. Your reservation is now confirmed!`,
      type: 'success',
      source_type: 'booking',
      source_id: bk.id,
      priority: 'high',
      action_url: paymentActionUrl ?? null,
      read: false,
    })
    if (notifErr) console.error('[paymentNotifier] Failed to notify booker in-app:', notifErr)
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
