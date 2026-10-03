/**
 * Emergency reschedule — admin proposal creation.
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

export async function proposeEmergencyReschedule(
  supabase: SupabaseClient,
  input: EmergencyProposalInput
): Promise<EmergencyResult> {
  const { bookingId, adminUserId, newDate, newStartTime, newEndTime, newFacilityId, customMessage } = input

  // Load booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, current_status, requires_payment, booking_type, booking_date, start_time, end_time, booking_facilities(facility_id, facilities(name))')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return { success: false, message: 'Booking not found.' }
  }

  const eligibleStatuses = ['approved', 'auto_approved', 'awaiting_reschedule', 'pending_user_response', 'pending_faculty_response']
  if (!eligibleStatuses.includes(booking.current_status)) {
    return { success: false, message: `Booking status '${booking.current_status}' is not eligible for reschedule.` }
  }

  // Internal-booking constraints: no Sundays, strict 07:00–19:00 window
  const isInternal = (booking.booking_type as string ?? '').toLowerCase().startsWith('internal')
  if (isInternal) {
    const dayOfWeek = new Date(newDate + 'T00:00:00').getDay() // 0 = Sunday
    if (dayOfWeek === 0) {
      return { success: false, message: 'Internal bookings cannot be rescheduled to a Sunday.' }
    }
    const [sh, sm] = newStartTime.split(':').map(Number)
    const [eh, em] = newEndTime.split(':').map(Number)
    if (sh < 7 || (sh === 7 && sm < 0)) {
      return { success: false, message: 'Internal bookings must start at 7:00 AM or later.' }
    }
    if (eh > 19 || (eh === 19 && em > 0)) {
      return { success: false, message: 'Internal bookings must end by 7:00 PM (19:00).' }
    }
  }

  // Load facility info
  const facilityRow = Array.isArray(booking.booking_facilities)
    ? booking.booking_facilities[0]
    : booking.booking_facilities
  const originalFacilityId = facilityRow?.facility_id
  const facilityName = (facilityRow?.facilities as { name?: string } | null)?.name ?? 'Facility'

  // Resolve the facility to check conflicts against (use new room if provided)
  const conflictFacilityId = newFacilityId ?? originalFacilityId
  if (conflictFacilityId) {
    const conflict = await checkBookingConflict(supabase, {
      facility_id: conflictFacilityId,
      booking_date: newDate,
      start_time: newStartTime,
      end_time: newEndTime,
      exclude_booking_id: bookingId,
    })
    if (conflict.conflict) {
      const ref = conflict.conflicting_booking_reference
      return { success: false, message: `The proposed time slot conflicts with an existing booking${ref ? ` (${ref})` : ''}.` }
    }
  }

  // Resolve new facility name for notifications
  let newFacilityName: string | undefined
  if (newFacilityId) {
    const { data: facRow } = await supabase.from('facilities').select('name').eq('id', newFacilityId).single()
    newFacilityName = (facRow as any)?.name ?? undefined
  }

  // Load message template if no custom message provided
  let adminMessage = customMessage?.trim()
  if (!adminMessage) {
    const settings = await loadEmergencySettings(supabase)
    adminMessage = settings.rescheduleTemplate
  }

  // Build new_values — include facility_id only when it actually changes
  const newValues: Record<string, string> = {
    booking_date: newDate,
    start_time: newStartTime,
    end_time: newEndTime,
  }
  if (newFacilityId && newFacilityId !== originalFacilityId) {
    newValues.facility_id = newFacilityId
  }

  // Insert booking_overrides record
  const { data: override, error: overrideError } = await supabase
    .from('booking_overrides')
    .insert({
      booking_id: bookingId,
      override_action: newFacilityId && newFacilityId !== originalFacilityId ? 'reschedule' : 'reschedule',
      original_values: {
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        facility_id: originalFacilityId,
      },
      new_values: newValues,
      reason: adminMessage,
      overridden_by: adminUserId,
    })
    .select('id')
    .single()

  if (overrideError || !override) {
    return { success: false, message: 'Failed to create reschedule proposal.' }
  }

  // Update booking status → pending_faculty_response
  const { error: statusError } = await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: 'pending_faculty_response',
    p_changed_by_user_id: adminUserId,
    p_changed_by_ai: false,
    p_reason: 'Building Admin proposed changes',
    p_metadata: {
      proposal_type: 'building_admin_proposal',
      override_id: override.id,
    },
  })

  if (statusError) {
    return { success: false, message: 'Failed to update booking status.' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // In-app notification to user
  const changesSummary = [
    `date to ${newDate}`,
    `time to ${formatTime(newStartTime)}–${formatTime(newEndTime)}`,
    ...(newFacilityName ? [`room to ${newFacilityName}`] : []),
  ].join(', ')

  void sendNotification(supabase, {
    user_id: booking.user_id,
    title: 'Building Admin Proposed Changes',
    message: `The Building Admin proposed changes to your booking ${booking.booking_reference}: ${changesSummary}.${adminMessage ? ' Reason: ' + adminMessage : ''} Please review and respond.`,
    type: 'warning',
    priority: 'urgent',
    source_type: 'booking',
    source_id: bookingId,
    action_url: `${appUrl}/faculty/form`,
    metadata: {
      booking_reference: booking.booking_reference,
      override_id: override.id,
      new_date: newDate,
      new_start: newStartTime,
      new_end: newEndTime,
    },
  })

  // Email to user (fire-and-forget)
  void (async () => {
    try {
      const { emailTo, name } = await resolveUserEmail(supabase, booking.user_id)
      if (!emailTo) {
        console.warn('[proposeEmergencyReschedule] No email address found for user', booking.user_id)
        return
      }
      const template = bookingChangeProposedEmail({
        userName: name ?? 'Valued User',
        bookingRef: booking.booking_reference,
        currentFacility: facilityName,
        currentDate: booking.booking_date,
        currentStartTime: formatTime(booking.start_time),
        currentEndTime: formatTime(booking.end_time),
        proposedFacility: newFacilityName,
        proposedDate: newDate,
        proposedStartTime: formatTime(newStartTime),
        proposedEndTime: formatTime(newEndTime),
        proposedBy: 'Building Admin',
        reason: adminMessage ?? '',
        reviewUrl: `${appUrl}/faculty/form`,
        userRole: 'Faculty',
      })
      await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
    } catch (emailErr) {
      console.error('[proposeEmergencyReschedule] email send error:', emailErr instanceof Error ? emailErr.message : emailErr)
    }
  })()

  return { success: true, message: 'Reschedule proposal sent. Awaiting faculty response.', overrideId: override.id }
}

// ─── 2. respondToEmergencyReschedule ─────────────────────────────────────────
