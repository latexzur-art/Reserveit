/**
 * Emergency reschedule — user response handling (accept / decline-to-credit).
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

export async function respondToEmergencyReschedule(
  supabase: SupabaseClient,
  input: EmergencyRespondInput
): Promise<EmergencyResult> {
  const { bookingId, userId, action } = input

  // Load booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, current_status, booking_date, start_time, end_time, metadata, booking_facilities(facility_id, facilities(name))')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return { success: false, message: 'Booking not found.' }
  }

  if (booking.user_id !== userId) {
    return { success: false, message: 'Unauthorized.' }
  }

  if (booking.current_status !== 'pending_user_response') {
    return { success: false, message: 'This booking is not awaiting a response.' }
  }

  // Load the latest emergency_reschedule override
  const { data: override } = await supabase
    .from('booking_overrides')
    .select('id, new_values')
    .eq('booking_id', bookingId)
    .eq('override_action', 'emergency_reschedule')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!override) {
    return { success: false, message: 'No emergency reschedule proposal found.' }
  }

  const newValues = override.new_values as { booking_date: string; start_time: string; end_time: string }

  const facilityRow = Array.isArray(booking.booking_facilities)
    ? booking.booking_facilities[0]
    : booking.booking_facilities
  const facilityName = (facilityRow?.facilities as { name?: string } | null)?.name ?? 'Facility'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // Fetch user email once — needed by both accept and decline paths
  const { emailTo: userEmailTo, name: userName } = await resolveUserEmail(supabase, userId)

  if (action === 'accept') {
    // Atomically apply new date/time
    const { data: applied } = await supabase.rpc('apply_emergency_reschedule', {
      p_booking_id: bookingId,
      p_new_date: newValues.booking_date,
      p_new_start: newValues.start_time,
      p_new_end: newValues.end_time,
    })

    if (!applied) {
      return { success: false, message: 'Failed to apply reschedule.' }
    }

    // Update status → approved
    await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_new_status: 'approved',
      p_changed_by_user_id: userId,
      p_changed_by_ai: false,
      p_reason: 'User accepted emergency reschedule proposal',
      p_metadata: { source: 'emergency_reschedule_accept', override_id: override.id },
    })

    // Notify user (confirmation)
    void sendNotification(supabase, {
      user_id: userId,
      title: 'Reschedule Confirmed',
      message: `Your booking ${booking.booking_reference} has been rescheduled to ${newValues.booking_date} ${formatTime(newValues.start_time)}–${formatTime(newValues.end_time)}.`,
      type: 'success',
      priority: 'high',
      source_type: 'booking',
      source_id: bookingId,
    })

    // Notify building admins
    void sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Reschedule Accepted',
      message: `User accepted reschedule for ${booking.booking_reference}. New schedule: ${newValues.booking_date} ${formatTime(newValues.start_time)}–${formatTime(newValues.end_time)}.`,
      type: 'success',
      priority: 'normal',
      source_type: 'booking',
      source_id: bookingId,
    })

    // Email to admins + user confirmation (fire-and-forget)
    void (async () => {
      const adminEmails = await getBuildingAdminEmails()
      for (const email of adminEmails) {
        const template = emergencyRescheduleAcceptedAdminEmail({
          adminName: 'Building Admin',
          userName: userName ?? '',
          bookingRef: booking.booking_reference,
          facilityName,
          newDate: newValues.booking_date,
          newStart: formatTime(newValues.start_time),
          newEnd: formatTime(newValues.end_time),
        })
        await sendBrevoEmail({ to: email, subject: template.subject, htmlBody: template.htmlBody })
      }

      // Confirmation email to user with new schedule details
      if (userEmailTo) {
        const template = emergencyRescheduleAcceptedUserEmail({
          userName: userName ?? 'Valued User',
          bookingRef: booking.booking_reference,
          facilityName,
          newDate: newValues.booking_date,
          newStart: formatTime(newValues.start_time),
          newEnd: formatTime(newValues.end_time),
        })
        await sendBrevoEmail({ to: userEmailTo, subject: template.subject, htmlBody: template.htmlBody })
      }
    })()

    return { success: true, message: 'Reschedule accepted. Your booking has been updated.' }
  }

  // DECLINE → Cancel booking; request refund if a completed payment exists
  // 1. Check completed payments for this booking
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount')
    .eq('booking_id', bookingId)
    .eq('payment_status', 'completed')

  const totalCentavos = (payments ?? []).reduce(
    (sum, p) => sum + Math.round(Number(p.amount) * 100),
    0
  )

  // 2. Cancel booking
  await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: 'cancelled',
    p_changed_by_user_id: userId,
    p_changed_by_ai: false,
    p_reason: 'User declined emergency reschedule — booking cancelled',
    p_metadata: { source: 'emergency_decline_to_refund', refund_amount_centavos: totalCentavos },
  })

  await supabase
    .from('bookings')
    .update({ cancellation_type: 'alternative_declined', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId)

  // 3. Mark completed payment(s) as refund_requested so Building Admin can disburse refund in Payment Management
  if (payments && payments.length > 0) {
    const paymentIds = payments.map(p => p.id)
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

  if (totalCentavos > 0) {
    // Notify admins that user declined and refund is owed
    void sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'User Declined Reschedule — Refund Owed',
      message: `${userName ?? 'User'} declined the reschedule for ${booking.booking_reference}. A refund of ₱${(totalCentavos / 100).toFixed(2)} needs to be processed in Payment Management.`,
      type: 'warning',
      priority: 'high',
      source_type: 'emergency_request',
      source_id: bookingId,
      action_url: `${appUrl}/admin/building/payments`,
    })
  } else {
    // No payment — just notify admins of the declined reschedule
    void sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'User Declined Reschedule — Booking Cancelled',
      message: `${userName ?? 'User'} declined the reschedule for ${booking.booking_reference}. Booking has been cancelled (no payment to refund).`,
      type: 'info',
      priority: 'normal',
      source_type: 'emergency_request',
      source_id: bookingId,
      action_url: `${appUrl}/admin/building/reservations`,
    })
  }

  void (async () => {
    const [adminEmails, settings] = await Promise.all([
      getBuildingAdminEmails(),
      loadEmergencySettings(supabase),
    ])

    // Email admins
    for (const email of adminEmails) {
      const template = emergencyRescheduleDeclinedAdminEmail({
        adminName: 'Building Admin',
        userName: userName ?? 'User',
        bookingRef: booking.booking_reference,
        facilityName,
        originalDate: booking.booking_date,
        originalStart: formatTime(booking.start_time),
        originalEnd: formatTime(booking.end_time),
        adminPanelUrl: `${appUrl}/admin/building/reservations`,
      })
      await sendBrevoEmail({ to: email, subject: template.subject, htmlBody: template.htmlBody })
    }

    // Email user — booking cancelled confirmation with helpdesk contact
    if (userEmailTo) {
      const template = emergencyRescheduleDeclinedUserEmail({
        userName: userName ?? 'Valued User',
        bookingRef: booking.booking_reference,
        facilityName,
        bookingDate: booking.booking_date,
        startTime: formatTime(booking.start_time),
        endTime: formatTime(booking.end_time),
        helpdeskPhone: settings.helpdeskPhone,
        declineMessage: settings.declineTemplate,
      })
      await sendBrevoEmail({ to: userEmailTo, subject: template.subject, htmlBody: template.htmlBody })
    }
  })()

  if (totalCentavos > 0) {
    return { success: true, message: `Reschedule declined. A refund of ₱${(totalCentavos / 100).toFixed(2)} has been requested for processing.` }
  }
  return { success: true, message: 'Reschedule declined. Your booking has been cancelled.' }
}

// ─── 3. putBookingOnHold ──────────────────────────────────────────────────────
