/**
 * Override Handler
 * Allows building admins to cancel, reschedule, or change facility
 * for bookings within the 48-hour oversight window.
 * @module backend/booking/overrideHandler
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { OverrideInput } from './booking.types'
import { OVERSIGHT_WINDOW_HOURS } from './booking.types'
import { sendNotification } from './autoDecisionRouter'

export interface OverrideResult {
  success: boolean
  message: string
  booking_id?: string
  remaining_window_seconds?: number
}

export async function handleOverride(
  supabase: SupabaseClient,
  input: OverrideInput
): Promise<OverrideResult> {
  const { bookingId, adminUserId, action, reason, newValues } = input

  // Load booking
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id, user_id, booking_reference, current_status, oversight_expires_at,
      booking_date, start_time, end_time,
      booking_facilities(facility_id, facilities(name))
    `)
    .eq('id', bookingId)
    .single()

  if (error || !booking) {
    return { success: false, message: 'Booking not found' }
  }

  // Check if within oversight window
  if (!booking.oversight_expires_at) {
    return { success: false, message: 'Booking has no active oversight window' }
  }

  const expiresAt = new Date(booking.oversight_expires_at)
  const now = new Date()

  if (now > expiresAt) {
    return { success: false, message: 'Oversight window has expired for this booking' }
  }

  const overridableStatuses = ['auto_approved', 'flagged']
  if (!overridableStatuses.includes(booking.current_status)) {
    return {
      success: false,
      message: `Cannot override booking with status: ${booking.current_status}`,
    }
  }

  const remainingWindowSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)

  // Capture original values
  const facilityEntry = (booking.booking_facilities as Array<{ facility_id: string; facilities: { name: string } | Array<{ name: string }> | null }>)?.[0]
  const currentFacilityId = facilityEntry?.facility_id
  const facilityRaw = facilityEntry?.facilities
  const facilityName = facilityRaw ? (Array.isArray(facilityRaw) ? facilityRaw[0]?.name : (facilityRaw as { name: string }).name) : null

  const { data: requesterData } = await supabase.from('users').select('full_name').eq('id', booking.user_id).single()
  const fmt12h = (t: string) => {
    const [hStr, mStr] = t.split(':')
    const h = parseInt(hStr, 10)
    return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }
  const originalValues = {
    status: booking.current_status,
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    facility_id: currentFacilityId,
  }

  let applyError: string | null = null
  const appliedValues: Record<string, string> = {}

  switch (action) {
    case 'cancel': {
      const { error: cancelError } = await supabase.rpc('update_booking_status', {
        p_booking_id: bookingId,
        p_new_status: 'overridden',
        p_changed_by_user_id: adminUserId,
        p_changed_by_ai: false,
        p_reason: `Admin override: ${reason}`,
        p_metadata: { override_action: 'cancel' },
      })
      if (cancelError) applyError = cancelError.message
      appliedValues.status = 'overridden'
      break
    }

    case 'reschedule': {
      if (!newValues?.booking_date || !newValues?.start_time || !newValues?.end_time) {
        return { success: false, message: 'Reschedule requires booking_date, start_time, and end_time' }
      }
      const { error: rescheduleError } = await supabase
        .from('bookings')
        .update({
          booking_date: newValues.booking_date,
          start_time: newValues.start_time,
          end_time: newValues.end_time,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
      if (rescheduleError) applyError = rescheduleError.message
      appliedValues.booking_date = newValues.booking_date
      appliedValues.start_time = newValues.start_time
      appliedValues.end_time = newValues.end_time
      break
    }

    case 'change_facility': {
      if (!newValues?.facility_id) {
        return { success: false, message: 'change_facility requires a new facility_id' }
      }
      const { error: facilityError } = await supabase
        .from('booking_facilities')
        .update({ facility_id: newValues.facility_id })
        .eq('booking_id', bookingId)
        .eq('facility_id', currentFacilityId)
      if (facilityError) applyError = facilityError.message
      appliedValues.facility_id = newValues.facility_id
      break
    }
  }

  if (applyError) {
    return { success: false, message: `Override failed: ${applyError}` }
  }

  // Insert override log
  await supabase.from('booking_overrides').insert({
    booking_id: bookingId,
    override_action: action,
    original_values: originalValues,
    new_values: appliedValues,
    reason,
    overridden_by: adminUserId,
    remaining_window_seconds: remainingWindowSeconds,
  })

  // Notify user
  const notifMessages: Record<string, string> = {
    cancel: `Your booking ${booking.booking_reference} has been cancelled by the administrator. Reason: ${reason}`,
    reschedule: `Your booking ${booking.booking_reference} has been rescheduled to ${appliedValues.booking_date ?? ''} ${appliedValues.start_time ?? ''}–${appliedValues.end_time ?? ''}. Reason: ${reason}`,
    change_facility: `The facility for your booking ${booking.booking_reference} has been changed. Reason: ${reason}`,
  }

  const overrideMeta: Record<string, unknown> = {
    booking_reference: booking.booking_reference,
    requester_name: requesterData?.full_name ?? 'Unknown',
    facility_name: facilityName ?? 'Unknown Facility',
    booking_date: new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    start_time: fmt12h(appliedValues.start_time ?? booking.start_time),
    end_time: fmt12h(appliedValues.end_time ?? booking.end_time),
    override_action: action,
    override_reason: reason,
    status_to: action === 'cancel' ? 'overridden' : undefined,
  }

  await sendNotification(supabase, {
    user_id: booking.user_id,
    title: `Booking ${action === 'cancel' ? 'Cancelled' : action === 'reschedule' ? 'Rescheduled' : 'Facility Changed'} by Admin`,
    message: notifMessages[action],
    type: action === 'cancel' ? 'error' : 'warning',
    source_type: 'booking',
    source_id: bookingId,
    priority: 'high',
    metadata: overrideMeta,
  })

  return {
    success: true,
    message: `Booking successfully overridden: ${action}`,
    booking_id: bookingId,
    remaining_window_seconds: remainingWindowSeconds,
  }
}
