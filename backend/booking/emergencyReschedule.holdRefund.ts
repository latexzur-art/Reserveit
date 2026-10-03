/**
 * Emergency reschedule — on-hold + refund-cancellation paths.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNotification, sendNotificationToRoles } from './autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  bookingChangeProposedEmail,
  bookingCancellationEmail,
  emergencyRescheduleAcceptedAdminEmail,
  emergencyRescheduleAcceptedUserEmail,
  emergencyRescheduleDeclinedAdminEmail,
  emergencyRescheduleDeclinedUserEmail,
  emergencyOnHoldEmail,
} from '@/backend/notifications/emailTemplates'
import { checkBookingConflict } from '@/lib/bookings/check-conflict'
import { creditService } from '@/backend/credits/creditService'
import { getBuildingAdminEmails, resolveUserEmail } from '@/backend/notifications/recipientResolver'

// ─── Types ───────────────────────────────────────────────────────────────────
import { formatTime, loadEmergencySettings } from './emergencyReschedule.shared'
import type { EmergencyProposalInput, EmergencyRespondInput, EmergencyHoldInput, EmergencyRefundCancelInput, EmergencyResult, EmergencySettings } from './emergencyReschedule.shared'

export async function putBookingOnHold(
  supabase: SupabaseClient,
  input: EmergencyHoldInput
): Promise<EmergencyResult> {
  const { bookingId, adminUserId } = input

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, current_status, booking_facilities(facility_id, facilities(name))')
    .eq('id', bookingId)
    .single()

  if (error || !booking) {
    return { success: false, message: 'Booking not found.' }
  }

  if (booking.current_status !== 'pending_user_response') {
    return { success: false, message: 'Booking must be in pending_user_response status to be put on hold.' }
  }

  await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: 'on_hold',
    p_changed_by_user_id: adminUserId,
    p_changed_by_ai: false,
    p_reason: 'Booking put on hold by building admin pending phone discussion',
    p_metadata: { source: 'emergency_reschedule_hold' },
  })

  const settings = await loadEmergencySettings(supabase)

  const facilityRow = Array.isArray(booking.booking_facilities)
    ? booking.booking_facilities[0]
    : booking.booking_facilities
  const facilityName = (facilityRow?.facilities as { name?: string } | null)?.name ?? 'Facility'

  void sendNotification(supabase, {
    user_id: booking.user_id,
    title: 'Booking On Hold',
    message: `Your booking ${booking.booking_reference} is on hold while we work to find a resolution. Contact helpdesk: ${settings.helpdeskPhone}.`,
    type: 'warning',
    priority: 'high',
    source_type: 'booking',
    source_id: bookingId,
    metadata: { helpdesk_phone: settings.helpdeskPhone },
  })

  void (async () => {
    const { emailTo, name } = await resolveUserEmail(supabase, booking.user_id)
    if (!emailTo) return
    const template = emergencyOnHoldEmail({
      userName: name ?? 'Valued User',
      bookingRef: booking.booking_reference,
      facilityName,
      helpdeskPhone: settings.helpdeskPhone,
    })
    await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
  })()

  return { success: true, message: 'Booking has been placed on hold.' }
}

// ─── 4. cancelWithRefund ──────────────────────────────────────────────────────

export async function cancelWithRefund(
  supabase: SupabaseClient,
  input: EmergencyRefundCancelInput
): Promise<EmergencyResult> {
  const { bookingId, adminUserId, refundReason, creditAmountCentavos } = input

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, current_status, booking_date, start_time, end_time, booking_facilities(facility_id, facilities(name))')
    .eq('id', bookingId)
    .single()

  if (error || !booking) {
    return { success: false, message: 'Booking not found.' }
  }

  const eligibleStatuses = ['approved', 'auto_approved', 'pending_user_response', 'on_hold']
  if (!eligibleStatuses.includes(booking.current_status)) {
    return { success: false, message: `Booking status '${booking.current_status}' is not eligible for emergency cancellation.` }
  }

  // Determine refund amount: use provided value or sum completed payments
  const { data: completedPayments } = await supabase
    .from('payments')
    .select('id, amount, payment_status')
    .eq('booking_id', bookingId)
    .eq('payment_status', 'completed')

  let amountCentavos = creditAmountCentavos ?? 0
  if (!amountCentavos && completedPayments) {
    amountCentavos = completedPayments.reduce(
      (sum, p) => sum + Math.round(Number(p.amount) * 100),
      0
    )
  }

  // Update booking status → cancelled
  await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: 'cancelled',
    p_changed_by_user_id: adminUserId,
    p_changed_by_ai: false,
    p_reason: refundReason || 'Booking cancelled — refund requested (force majeure)',
    p_metadata: { source: 'emergency_cancel_refund', refund_amount_centavos: amountCentavos },
  })

  await supabase
    .from('bookings')
    .update({ cancellation_type: 'force_majeure', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId)

  // If completed payments exist, mark them as refund_requested for cash/gateway disbursement in Payment Management
  if (completedPayments && completedPayments.length > 0) {
    const paymentIds = completedPayments.map(p => p.id)
    await supabase
      .from('payments')
      .update({ payment_status: 'refund_requested', updated_at: new Date().toISOString() })
      .in('id', paymentIds)
  }

  // Void any pending payments
  await supabase
    .from('payments')
    .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .in('payment_status', ['pending', 'pending_review'])

  const facilityRow = Array.isArray(booking.booking_facilities)
    ? booking.booking_facilities[0]
    : booking.booking_facilities
  const facilityName = (facilityRow?.facilities as { name?: string } | null)?.name ?? 'Facility'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // In-app to booker — explicit cancellation & refund notice
  void sendNotification(supabase, {
    user_id: booking.user_id,
    title: 'Booking Cancelled by Building Admin',
    message: `Your booking ${booking.booking_reference} has been cancelled by the Building Admin.${refundReason ? ' Reason: ' + refundReason : ''}${amountCentavos > 0 ? ` A refund of ₱${(amountCentavos / 100).toFixed(2)} has been requested and will be processed by the Building Admin.` : ''}`,
    type: 'error',
    priority: 'high',
    source_type: 'booking',
    source_id: bookingId,
    action_url: `${appUrl}/client/bookings`,
  })

  // Notify building admins that a refund is owed
  if (amountCentavos > 0) {
    void sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Refund Owed — Emergency Cancellation',
      message: `Emergency cancellation performed on booking ${booking.booking_reference} (${facilityName}). A refund of ₱${(amountCentavos / 100).toFixed(2)} is owed. Please process it in Payment Management.`,
      type: 'warning',
      priority: 'high',
      source_type: 'booking',
      source_id: bookingId,
      action_url: `${appUrl}/admin/building/payments`,
    })
  }

  // Email user — cancellation notice attributed to Building Admin (fire-and-forget)
  void (async () => {
    const { emailTo, name } = await resolveUserEmail(supabase, booking.user_id)
    if (!emailTo) return
    const cancelledAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
    const template = bookingCancellationEmail({
      userName: name ?? 'Valued User',
      bookingRef: booking.booking_reference,
      facilityName,
      bookingDate: booking.booking_date,
      startTime: formatTime(booking.start_time),
      endTime: formatTime(booking.end_time),
      cancelledBy: 'Building Admin',
      cancelledAt,
    })
    await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
  })()

  return {
    success: true,
    message: amountCentavos > 0
      ? `Booking cancelled and a refund of ₱${(amountCentavos / 100).toFixed(2)} has been requested for processing.`
      : 'Booking cancelled. No completed payment found to refund.',
  }
}

// ─── 5. getEmergencySettings ──────────────────────────────────────────────────
