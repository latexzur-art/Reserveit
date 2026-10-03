/**
 * Cancellation Handler
 * Handles user and admin cancellations, tracks consecutive cancellations,
 * and auto-restricts users who reach the threshold.
 * Also handles booking completion (resets cancellation counter).
 * @module backend/booking/cancellationHandler
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CancellationType } from './booking.types'
import { RESTRICTION_THRESHOLD } from './booking.types'
import { sendNotification, sendNotificationToRoles } from './autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { adminFacultyCancelledEmail } from '@/backend/notifications/emailTemplates'

/**
 * Lead-time threshold (hours) below which a cancellation is treated as
 * "same-day" for admin-surfacing purposes. No automatic penalty is applied;
 * we just emit a heads-up notification to building admins.
 */
const SAME_DAY_CANCEL_THRESHOLD_HOURS = 12

export interface CancellationResult {
  success: boolean
  restricted?: boolean
  consecutive_cancellations?: number
  message: string
}

export async function handleCancellation(
  supabase: SupabaseClient,
  bookingId: string,
  type: CancellationType,
  actorUserId: string,
  reason?: string
): Promise<CancellationResult> {
  // Load booking (incl. start datetime so we can compute cancellation lead time)
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, current_status, booking_date, start_time, end_time, booking_facilities(facility_id, facilities(name))')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return { success: false, message: 'Booking not found' }
  }

  const cancellableStatuses = ['pending', 'approved', 'auto_approved', 'flagged', 'pending_faculty_response', 'pending_user_response', 'on_hold', 'cancellation_requested']
  if (!cancellableStatuses.includes(booking.current_status)) {
    return {
      success: false,
      message: `Booking cannot be cancelled from status: ${booking.current_status}`,
    }
  }

  // Compute lead-time hours (booking_start − now, Manila TZ) for admin
  // visibility into same-day cancellations. Stored on the booking row.
  const leadTimeHours = computeLeadTimeHours(booking.booking_date, booking.start_time)
  const isSameDay = leadTimeHours !== null && leadTimeHours < SAME_DAY_CANCEL_THRESHOLD_HOURS

  // Build metadata for rich notifications
  const bkFacilities = (booking as any).booking_facilities as Array<{ facility_id: string; facilities: { name: string } | Array<{ name: string }> | null }> | null
  const facilityEntry = bkFacilities?.[0]
  const facilityRaw = facilityEntry?.facilities
  const facilityName = facilityRaw ? (Array.isArray(facilityRaw) ? facilityRaw[0]?.name : (facilityRaw as { name: string }).name) : null

  const { data: requesterData } = await supabase.from('users').select('full_name').eq('id', booking.user_id).single()
  const fmt12h = (t: string) => {
    const [hStr, mStr] = t.split(':')
    const h = parseInt(hStr, 10)
    return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }
  const cancellMeta: Record<string, unknown> = {
    booking_reference: booking.booking_reference,
    requester_name: requesterData?.full_name ?? 'Unknown',
    facility_name: facilityName ?? 'Unknown Facility',
    booking_date: new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    start_time: fmt12h(booking.start_time),
    end_time: fmt12h((booking as any).end_time ?? booking.start_time),
    cancellation_type: type,
    status_to: 'cancelled',
  }

  // Update booking status using the existing DB function for audit trail
  const { error: updateError } = await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: 'cancelled',
    p_changed_by_user_id: actorUserId,
    p_changed_by_ai: false,
    p_reason: reason ?? `Cancelled by ${type}`,
    p_metadata: { cancellation_type: type, lead_time_hours: leadTimeHours, same_day: isSameDay },
  })

  if (updateError) {
    return { success: false, message: `Failed to cancel booking: ${updateError.message}` }
  }

  // Update cancellation_type column + lead-time
  await supabase
    .from('bookings')
    .update({
      cancellation_type: type,
      cancellation_lead_time_hours: leadTimeHours,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  // Void any pending payment invoice so the transactions list reflects the cancellation
  await supabase
    .from('payments')
    .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .in('payment_status', ['pending', 'pending_review'])

  // Clean up any pending cancellation requests for this booking
  await supabase
    .from('cancellation_requests')
    .update({ status: 'cancelled', review_notes: 'Booking cancelled directly' })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')

  let userBecameRestricted = false
  let newCount = 0

  // Only track consecutive cancellations for user-initiated cancellations
  if (type === 'user_cancelled') {
    const { data: user } = await supabase
      .from('users')
      .select('consecutive_cancellations, account_status')
      .eq('id', booking.user_id)
      .single()

    if (user) {
      newCount = (user.consecutive_cancellations ?? 0) + 1

      await supabase
        .from('users')
        .update({
          consecutive_cancellations: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.user_id)

      // Check if restriction threshold reached
      if (newCount >= RESTRICTION_THRESHOLD && user.account_status === 'active') {
        await applyRestriction(supabase, booking.user_id, newCount)
        userBecameRestricted = true
      }
    }
  }

  // Notify user
  const notifMessage = userBecameRestricted
    ? `Your booking ${booking.booking_reference} was cancelled. Your account has been restricted after ${newCount} consecutive cancellations. Please contact the building administrator.`
    : `Your booking ${booking.booking_reference} has been cancelled.`

  await sendNotification(supabase, {
    user_id: booking.user_id,
    title: userBecameRestricted ? 'Booking Cancelled — Account Restricted' : 'Booking Cancelled',
    message: notifMessage,
    type: userBecameRestricted ? 'error' : 'warning',
    source_type: 'booking',
    source_id: bookingId,
    priority: userBecameRestricted ? 'urgent' : 'normal',
    metadata: { ...cancellMeta, account_restricted: userBecameRestricted, consecutive_cancellations: newCount },
  })

  // Notify all admin roles whenever a user cancels their own booking.
  // Same-day cancellations get a more prominent warning message.
  if (type === 'user_cancelled') {
    const sameDayMsg = isSameDay
      ? `Same-day cancellation — ${leadTimeHours !== null ? leadTimeHours.toFixed(1) : '?'}h before start. `
      : ''
    await sendNotificationToRoles(supabase, ['building_admin', 'academic_head', 'program_head'], {
      title: isSameDay ? 'Same-day Booking Cancellation' : 'Faculty Booking Cancelled',
      message:
        `${sameDayMsg}Booking ${booking.booking_reference} was cancelled by ${cancellMeta.requester_name ?? 'faculty'}.`,
      type: isSameDay ? 'warning' : 'info',
      source_type: 'booking',
      source_id: bookingId,
      priority: isSameDay ? 'high' : 'normal',
      metadata: { ...cancellMeta, lead_time_hours: leadTimeHours },
    })

    // Email all active building_admin / academic_head / program_head users
    void (async () => {
      try {
        const { data: roleUsers } = await supabase
          .from('user_roles')
          .select('user_id, roles!inner(name)')
          .in('roles.name', ['building_admin', 'academic_head', 'program_head'])
          .eq('is_active', true)

        if (!roleUsers || roleUsers.length === 0) return

        const adminIds = [...new Set((roleUsers as Array<{ user_id: string }>).map(r => r.user_id))]
        const { data: adminRows } = await supabase
          .from('users')
          .select('id, full_name, email, notification_email')
          .in('id', adminIds)

        if (!adminRows) return

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        const cancelledAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })

        for (const admin of adminRows as Array<{ id: string; full_name: string; email: string; notification_email?: string | null }>) {
          const recipient = admin.notification_email
          if (!recipient) {
            console.warn(`[cancellationHandler] Admin ${admin.id} has no notification_email set — cancellation email skipped`)
            continue
          }
          void sendBrevoEmail({
            to: recipient,
            ...adminFacultyCancelledEmail({
              adminName: admin.full_name ?? 'Admin',
              facultyName: (cancellMeta.requester_name as string) ?? 'Faculty',
              bookingRef: (cancellMeta.booking_reference as string) ?? bookingId,
              facilityName: (cancellMeta.facility_name as string) ?? 'Unknown Facility',
              bookingDate: (cancellMeta.booking_date as string) ?? booking.booking_date,
              startTime: (cancellMeta.start_time as string) ?? booking.start_time,
              endTime: (cancellMeta.end_time as string) ?? '',
              leadTimeHours,
              adminPanelUrl: `${appUrl}/admin/building/reservations`,
              cancelledAt,
            }),
          })
        }
      } catch (emailErr) {
        console.error('[cancellationHandler] admin email error:', emailErr instanceof Error ? emailErr.message : emailErr)
      }
    })()
  }

  return {
    success: true,
    restricted: userBecameRestricted,
    consecutive_cancellations: newCount,
    message: userBecameRestricted
      ? `Booking cancelled. Account restricted after ${newCount} consecutive cancellations.`
      : 'Booking cancelled successfully.',
  }
}

export async function handleCompletion(
  supabase: SupabaseClient,
  bookingId: string,
  actorUserId: string
): Promise<{ success: boolean; message: string }> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('user_id, booking_reference, current_status')
    .eq('id', bookingId)
    .single()

  if (!booking) return { success: false, message: 'Booking not found' }

  if (!['approved', 'auto_approved'].includes(booking.current_status)) {
    return { success: false, message: `Cannot complete booking with status: ${booking.current_status}` }
  }

  await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: 'completed',
    p_changed_by_user_id: actorUserId,
    p_changed_by_ai: false,
    p_reason: 'Booking marked as completed',
    p_metadata: {},
  })

  // Reset consecutive cancellations for this user
  await supabase
    .from('users')
    .update({
      consecutive_cancellations: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.user_id)

  await sendNotification(supabase, {
    user_id: booking.user_id,
    title: 'Booking Completed',
    message: `Your booking ${booking.booking_reference} has been marked as completed. Thank you!`,
    type: 'success',
    source_type: 'booking',
    source_id: bookingId,
    priority: 'normal',
  })

  return { success: true, message: 'Booking marked as completed.' }
}


// =====================================================
// Bulk Cancellation
// =====================================================

export interface BulkCancellationResult {
  total: number
  success_count: number
  fail_count: number
  results: { booking_id: string; success: boolean; message: string }[]
}

/**
 * Cancels multiple bookings in a single operation.
 * Used by administrators for maintenance blocks, closures, etc.
 */
export async function handleBulkCancellation(
  supabase: SupabaseClient,
  bookingIds: string[],
  type: CancellationType,
  actorUserId: string,
  reason: string
): Promise<BulkCancellationResult> {
  const results: { booking_id: string; success: boolean; message: string }[] = []
  let successCount = 0

  // We process them sequentially to ensure proper notification and audit trails
  // For very large sets (100+), this might need to be optimized to batch updates,
  // but for admin manual bulk actions, safety and audit trail are priority.
  for (const id of bookingIds) {
    try {
      const result = await handleCancellation(supabase, id, type, actorUserId, reason)
      results.push({ booking_id: id, success: result.success, message: result.message })
      if (result.success) successCount++
    } catch (err: any) {
      results.push({ booking_id: id, success: false, message: err.message || 'Internal error' })
    }
  }

  // Send a summary notification to the admin
  await sendNotification(supabase, {
    user_id: actorUserId,
    title: 'Bulk Cancellation Completed',
    message: `Processed ${bookingIds.length} cancellations. Success: ${successCount}, Failed: ${bookingIds.length - successCount}.`,
    type: successCount === bookingIds.length ? 'success' : 'warning',
    priority: 'high',
  })

  return {
    total: bookingIds.length,
    success_count: successCount,
    fail_count: bookingIds.length - successCount,
    results,
  }
}

// =====================================================
// Internal: apply restriction to user
// =====================================

async function applyRestriction(
  supabase: SupabaseClient,
  userId: string,
  cancellationCount: number
): Promise<void> {
  const reason = `Automatically restricted after ${cancellationCount} consecutive booking cancellations.`

  await supabase
    .from('users')
    .update({
      account_status: 'restricted',
      restricted_at: new Date().toISOString(),
      restricted_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  // Log restriction
  await supabase.from('restriction_logs').insert({
    user_id: userId,
    action: 'auto_restricted',
    actor_id: null, // system action
    cancellation_count: cancellationCount,
    reason,
  })

  // Notify building admins
  await sendNotificationToRoles(supabase, ['building_admin', 'academic_head'], {
    title: 'User Auto-Restricted',
    message: `A user account has been automatically restricted after ${cancellationCount} consecutive booking cancellations.`,
    type: 'warning',
    source_type: 'user',
    source_id: userId,
    priority: 'high',
  })
}

// =====================================================
// Internal: compute lead time between now and booking start (Manila TZ)
// =====================================================

function computeLeadTimeHours(bookingDate: string, startTime: string): number | null {
  if (!bookingDate || !startTime) return null
  // Bookings store date + time-of-day in Manila local time. Build an explicit
  // ISO with +08:00 so Date.parse yields the correct UTC instant regardless of
  // server TZ. Compare against Date.now() (also UTC) so the delta is correct.
  const startIso = `${bookingDate}T${startTime.length === 5 ? `${startTime}:00` : startTime}+08:00`
  const startMs = Date.parse(startIso)
  if (Number.isNaN(startMs)) return null
  const hours = (startMs - Date.now()) / (1000 * 60 * 60)
  return Math.round(hours * 100) / 100
}
