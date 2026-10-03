/**
 * Building Bookings Service
 *
 * Handles booking queries, approve/reject, cancel, and manual reservation creation.
 * Integrates with booking_decisions, booking_status_history, and notifications.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sanitizeSearch, dbBookingToView, type BookingFilters } from './building.types'
import { BuildingPricingService } from './building-pricing.service'
import { BookingPaymentService } from '@/backend/booking/paymentService'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { creditService } from '@/backend/credits/creditService'
import { ROUTES } from '@/lib/routes'
import {
  bookingApprovalEmail,
  bookingRejectionEmail,
  bookingCancellationEmail,
  bookerPaidBookingSubmittedEmail,
} from '@/backend/notifications/emailTemplates'

/** Batch-fetch reviewer name + role for bookings that have mismatch_reviewed_by set */
async function buildReviewerMap(
  supabase: ReturnType<typeof createAdminClient>,
  rows: any[]
): Promise<Map<string, { name: string; role: string }>> {
  const ids = [...new Set(rows.map(r => r.mismatch_reviewed_by).filter(Boolean))] as string[]
  const map = new Map<string, { name: string; role: string }>()
  if (ids.length === 0) return map

  const { data } = await supabase
    .from('users')
    .select('id, full_name, user_roles!user_roles_user_id_fkey(roles!inner(name))')
    .in('id', ids)

  for (const r of data ?? []) {
    const ur = Array.isArray(r.user_roles) ? r.user_roles[0] : r.user_roles
    const role = (Array.isArray(ur?.roles) ? ur.roles[0] : ur?.roles)?.name ?? 'reviewer'
    map.set(r.id, { name: (r as any).full_name ?? 'Unknown', role })
  }
  return map
}

/** Statuses that the Building Admin can approve */
const APPROVABLE_STATUSES = ['pending', 'flagged', 'auto_approved']
/** Statuses that the Building Admin can reject/decline */
const REJECTABLE_STATUSES = ['pending', 'flagged', 'auto_approved']
/** Statuses that the Building Admin can cancel */
const CANCELLABLE_STATUSES = ['pending', 'approved', 'auto_approved', 'flagged', 'pending_user_response']

export const BuildingBookingsMutations = {
/**
   * Approve a booking (handles pending, flagged, and auto_approved in oversight).
   * Creates booking_decisions record, status history entry, and notifies requester.
   */
  async approve(id: string, adminNotes?: string) {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Fetch the booking first to validate state
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select(`
        id, current_status, user_id, booking_reference, oversight_expires_at,
        decision_score, requires_payment, is_extension, extension_of_booking_id,
        booking_date, start_time, end_time, booking_purpose, booking_type, metadata,
        booking_facilities(facility_id, facility:facilities(id, name))
      `)
      .eq('id', id)
      .single()

    if (fetchErr || !booking) throw new Error('Booking not found')

    if (!APPROVABLE_STATUSES.includes(booking.current_status)) {
      throw new Error(`Cannot approve booking in "${booking.current_status}" status. Expected: ${APPROVABLE_STATUSES.join(', ')}`)
    }

    // For auto_approved bookings, verify oversight window is still open
    if (booking.current_status === 'auto_approved' && booking.oversight_expires_at) {
      if (new Date(booking.oversight_expires_at) < new Date()) {
        throw new Error('Oversight window has expired for this auto-approved booking')
      }
    }

    const previousStatus = booking.current_status

    // Update booking status
    const isPaymentRequired = (booking as any).requires_payment
    const updates: Record<string, any> = {
      current_status: isPaymentRequired ? 'pending_user_response' : 'approved',
    }
    if (!isPaymentRequired) {
      updates.approved_at = now
    }
    if (adminNotes) updates.internal_notes = adminNotes

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .in('current_status', APPROVABLE_STATUSES)
      .select()
      .single()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Booking was already processed by another admin')

    // Record decision in booking_decisions
    await supabase.from('booking_decisions').insert({
      booking_id: id,
      hard_constraints_passed: true,
      decision: 'approved',
      decision_reason: adminNotes || 'Approved by Building Admin',
      final_score: booking.decision_score,
      pipeline_version: 'manual_building_admin',
    })

    // Record status change in booking_status_history
    await supabase.from('booking_status_history').insert({
      booking_id: id,
      previous_status: previousStatus,
      new_status: 'approved',
      reason: adminNotes || 'Approved by Building Admin',
      metadata: { source: 'building_admin' },
    })

    // Handle payment creation for requires_payment bookings (gymnasium personal/community/commercial)
    const facilityData = Array.isArray(booking.booking_facilities)
      ? booking.booking_facilities[0]
      : (booking as any).booking_facilities as any
    const facilityName = (Array.isArray(facilityData?.facility)
      ? facilityData.facility[0]?.name
      : (facilityData?.facility as any)?.name) ?? null

    if ((booking as any).is_extension && (booking as any).extension_of_booking_id) {
      // Extension booking: create extension payment linked to parent booking
      const { amount } = await BookingPaymentService.calculateAmount(booking as any)
      const [sh, sm] = ((booking as any).start_time as string).split(':').map(Number)
      const [eh, em] = ((booking as any).end_time as string).split(':').map(Number)
      const extensionHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60

      // Check if extension payment already exists for this parent booking
      const { data: existingExtPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('booking_id', (booking as any).extension_of_booking_id)
        .eq('payment_type', 'extension')
        .in('payment_status', ['pending', 'completed'])
        .limit(1)
        .single()

      if (!existingExtPayment) {
        await supabase.from('payments').insert({
          booking_id: (booking as any).extension_of_booking_id,
          user_id: booking.user_id,
          amount,
          currency: 'PHP',
          payment_method: 'paymongo_card',
          payment_status: 'pending',
          payment_type: 'extension',
          extension_hours: extensionHours,
          description: `Gymnasium extension — additional ${extensionHours.toFixed(1)} hour(s) (${(booking as any).start_time?.slice(0, 5)} to ${(booking as any).end_time?.slice(0, 5)})`,
          metadata: { extension_booking_id: id, facility_name: facilityName, cost_breakdown: [], ...((booking as any).metadata ?? {}) },
        })
      }

      await sendNotification(supabase, {
        user_id: booking.user_id,
        title: 'Extension Approved — Payment Required',
        message: `Your gymnasium time extension request (${(booking as any).booking_reference}) has been approved. Please pay the invoice in your billing history to confirm the extension.`,
        type: 'info',
        source_type: 'booking',
        source_id: id,
        priority: 'high',
      })
    } else if ((booking as any).requires_payment) {
      // Initial personal gym booking: create payment record
      const { amount, breakdown } = await BookingPaymentService.calculateAmount(booking as any)

      const { data: modeSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'payment_method_mode')
        .single()
      const paymentMode = (modeSetting?.value as string) ?? 'paymongo'

      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('booking_id', id)
        .limit(1)
        .single()

      if (!existingPayment) {
        await supabase.from('payments').insert({
          booking_id: id,
          user_id: booking.user_id,
          amount,
          currency: 'PHP',
          payment_method: paymentMode === 'paymongo' ? 'paymongo_card' : 'qr_manual',
          payment_status: 'pending',
          payment_type: 'booking',
          description: 'Gymnasium personal booking invoice',
          metadata: { booking_purpose: (booking as any).booking_purpose, facility_name: facilityName, cost_breakdown: breakdown },
        })
      }

      await sendNotification(supabase, {
        user_id: booking.user_id,
        title: 'Booking Approved — Payment Required',
        message: `Your gymnasium booking ${booking.booking_reference} has been approved. Please pay the invoice in your billing history to confirm your reservation.`,
        type: 'info',
        source_type: 'booking',
        source_id: id,
        priority: 'high',
      })
    } else {
      // Standard approval notification (no payment)
      await sendNotification(supabase, {
        user_id: booking.user_id,
        title: 'Booking Approved',
        message: `Your booking ${booking.booking_reference} has been approved by the Building Admin.${adminNotes ? ` Note: ${adminNotes}` : ''}`,
        type: 'success',
        source_type: 'booking',
        source_id: id,
        priority: 'high',
      })
    }

    // Send approval email (fire-and-forget)
    void (async () => {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('full_name, email, notification_email')
          .eq('id', booking.user_id)
          .single()
        if (!userRow) return
        const recipient = (userRow.notification_email ?? null) as string | null
        if (!recipient) {
          console.warn(`[building-bookings.mutations] User ${booking.user_id} has no notification_email set — booking email skipped`)
          return
        }
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('roles!inner(name)')
          .eq('user_id', booking.user_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
        const rawRole = (roleRow as any)?.roles?.name ?? ''
        const userRole = rawRole.split('_').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
        const facilityRaw = Array.isArray((booking as any).booking_facilities)
          ? (booking as any).booking_facilities[0]?.facility
          : null
        const facilityName = (Array.isArray(facilityRaw) ? facilityRaw[0]?.name : facilityRaw?.name) ?? 'your facility'
        
        if ((booking as any).requires_payment) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
          const [sh, sm] = ((booking as any).start_time as string).split(':').map(Number)
          const [eh, em] = ((booking as any).end_time as string).split(':').map(Number)
          const durationMins = (eh * 60 + em) - (sh * 60 + sm)
          const durationLabel = durationMins >= 60
            ? `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`
            : `${durationMins}m`

          void sendBrevoEmail({
            to: recipient,
            ...bookerPaidBookingSubmittedEmail({
              userName: (userRow.full_name as string) ?? 'User',
              bookingRef: booking.booking_reference ?? id,
              facilityName,
              bookingDate: (booking as any).booking_date ?? '',
              startTime: (booking as any).start_time ?? '',
              endTime: (booking as any).end_time ?? '',
              duration: durationLabel,
              purpose: (booking as any).booking_purpose ?? '',
              paymentUrl: `${appUrl}${
                rawRole === 'faculty' ? '/faculty/payment'
                : rawRole === 'program_head' ? '/program/payment'
                : rawRole === 'academic_head' ? ROUTES.academic.payment
                : '/client/payment'
              }`,
            }),
          })
        } else {
          void sendBrevoEmail({
            to: recipient,
            ...bookingApprovalEmail({
              userName: (userRow.full_name as string) ?? 'User',
              bookingRef: booking.booking_reference ?? id,
              facilityName,
              bookingDate: (booking as any).booking_date ?? '',
              startTime: (booking as any).start_time ?? '',
              endTime: (booking as any).end_time ?? '',
              approvedBy: 'Building Admin',
              userRole,
            }),
          })
        }
      } catch { /* non-critical */ }
    })()

    return data
  },
/**
   * Reject/decline a booking. Requires a reason.
   * Creates booking_decisions record, status history entry, and notifies requester.
   */
  async reject(id: string, adminNotes?: string) {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    if (!adminNotes || adminNotes.trim().length === 0) {
      throw new Error('A decline reason is required when rejecting a booking')
    }

    // Fetch the booking first to validate state
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select(`
        id, current_status, user_id, booking_reference, oversight_expires_at, decision_score,
        booking_date, start_time, end_time,
        booking_facilities(facility_id, facility:facilities(id, name))
      `)
      .eq('id', id)
      .single()

    if (fetchErr || !booking) throw new Error('Booking not found')

    if (!REJECTABLE_STATUSES.includes(booking.current_status)) {
      throw new Error(`Cannot decline booking in "${booking.current_status}" status. Expected: ${REJECTABLE_STATUSES.join(', ')}`)
    }

    // For auto_approved bookings, verify oversight window is still open
    if (booking.current_status === 'auto_approved' && booking.oversight_expires_at) {
      if (new Date(booking.oversight_expires_at) < new Date()) {
        throw new Error('Oversight window has expired for this auto-approved booking')
      }
    }

    const previousStatus = booking.current_status

    // Update booking status
    const { data, error } = await supabase
      .from('bookings')
      .update({
        current_status: 'rejected',
        rejected_at: now,
        internal_notes: adminNotes,
      })
      .eq('id', id)
      .in('current_status', REJECTABLE_STATUSES)
      .select()
      .single()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Booking was already processed by another admin')

    // Record decision in booking_decisions
    await supabase.from('booking_decisions').insert({
      booking_id: id,
      hard_constraints_passed: true,
      decision: 'rejected',
      decision_reason: adminNotes,
      final_score: booking.decision_score,
      pipeline_version: 'manual_building_admin',
    })

    // Record status change in booking_status_history
    await supabase.from('booking_status_history').insert({
      booking_id: id,
      previous_status: previousStatus,
      new_status: 'rejected',
      reason: adminNotes,
      metadata: { source: 'building_admin' },
    })

    // Notify the requester
    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Declined',
      message: `Your booking ${booking.booking_reference} has been declined by the Building Admin. Reason: ${adminNotes}`,
      type: 'error',
      source_type: 'booking',
      source_id: id,
      priority: 'high',
    })

    // Send rejection email (fire-and-forget)
    void (async () => {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('full_name, email, notification_email')
          .eq('id', booking.user_id)
          .single()
        if (!userRow) return
        const recipient = (userRow.notification_email ?? null) as string | null
        if (!recipient) {
          console.warn(`[building-bookings.mutations] User ${booking.user_id} has no notification_email set — booking email skipped`)
          return
        }
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('roles!inner(name)')
          .eq('user_id', booking.user_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
        const rawRole = (roleRow as any)?.roles?.name ?? ''
        const userRole = rawRole.split('_').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
        const facilityRaw = Array.isArray((booking as any).booking_facilities)
          ? (booking as any).booking_facilities[0]?.facility
          : null
        const facilityName = (Array.isArray(facilityRaw) ? facilityRaw[0]?.name : facilityRaw?.name) ?? 'your facility'
        void sendBrevoEmail({
          to: recipient,
          ...bookingRejectionEmail({
            userName: (userRow.full_name as string) ?? 'User',
            bookingRef: booking.booking_reference ?? id,
            facilityName,
            bookingDate: (booking as any).booking_date ?? '',
            startTime: (booking as any).start_time ?? '',
            endTime: (booking as any).end_time ?? '',
            rejectionReason: adminNotes,
            userRole,
          }),
        })
      } catch { /* non-critical */ }
    })()

    return data
  },
/**
   * Cancel a booking (admin-initiated cancellation).
   * Handles pending, approved, auto_approved, and flagged statuses.
   * Automatically issues session credits when a completed payment exists.
   */
  async cancel(id: string, reason?: string, actorUserId?: string) {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Fetch booking to get user info and validate state
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select(`
        id, current_status, user_id, booking_reference,
        booking_date, start_time, end_time,
        booking_facilities(facility_id, facility:facilities(id, name))
      `)
      .eq('id', id)
      .single()

    if (fetchErr || !booking) throw new Error('Booking not found')

    if (!CANCELLABLE_STATUSES.includes(booking.current_status)) {
      throw new Error(`Cannot cancel booking in "${booking.current_status}" status`)
    }

    const previousStatus = booking.current_status

    const { data, error } = await supabase
      .from('bookings')
      .update({
        current_status: 'cancelled',
        cancelled_at: now,
        cancellation_type: 'admin_cancelled',
      })
      .eq('id', id)
      .in('current_status', CANCELLABLE_STATUSES)
      .select()
      .single()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Booking was already processed by another admin')

    // Void any pending payment for pre-payment bookings
    if (previousStatus === 'pending_user_response') {
      await supabase
        .from('payments')
        .update({ payment_status: 'cancelled' })
        .eq('booking_id', id)
        .in('payment_status', ['pending', 'pending_review'])
    }

    // Clean up any pending cancellation requests for this booking
    await supabase
      .from('cancellation_requests')
      .update({ status: 'cancelled', review_notes: 'Booking cancelled directly by Building Admin' })
      .eq('booking_id', id)
      .eq('status', 'pending')

    // Record status change
    await supabase.from('booking_status_history').insert({
      booking_id: id,
      previous_status: previousStatus,
      new_status: 'cancelled',
      reason: reason || 'Cancelled by Building Admin',
      metadata: { source: 'building_admin' },
    })

    // Notify the requester
    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Cancelled',
      message: `Your booking ${booking.booking_reference} has been cancelled by the Building Admin.${reason ? ` Reason: ${reason}` : ''}`,
      type: 'error',
      source_type: 'booking',
      source_id: id,
      priority: 'high',
    })

    // Send cancellation email (fire-and-forget)
    void (async () => {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('full_name, email, notification_email')
          .eq('id', booking.user_id)
          .single()
        if (!userRow) return
        const recipient = (userRow.notification_email ?? null) as string | null
        if (!recipient) {
          console.warn(`[building-bookings.mutations] User ${booking.user_id} has no notification_email set — booking email skipped`)
          return
        }
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('roles!inner(name)')
          .eq('user_id', booking.user_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
        const rawRole = (roleRow as any)?.roles?.name ?? ''
        const userRole = rawRole.split('_').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
        const facilityRaw = Array.isArray((booking as any).booking_facilities)
          ? (booking as any).booking_facilities[0]?.facility
          : null
        const facilityName = (Array.isArray(facilityRaw) ? facilityRaw[0]?.name : facilityRaw?.name) ?? 'your facility'
        const cancelledAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
        void sendBrevoEmail({
          to: recipient,
          ...bookingCancellationEmail({
            userName: (userRow.full_name as string) ?? 'User',
            bookingRef: booking.booking_reference ?? id,
            facilityName,
            bookingDate: (booking as any).booking_date ?? '',
            startTime: (booking as any).start_time ?? '',
            endTime: (booking as any).end_time ?? '',
            cancelledBy: 'Building Admin',
            cancelledAt,
            userRole,
          }),
        })
      } catch { /* non-critical */ }
    })()

    // Issue session credit if the booking had a completed payment
    if (actorUserId) {
      const { data: completedPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('booking_id', id)
        .eq('payment_status', 'completed')

      const amountCentavos = (completedPayments ?? []).reduce(
        (sum, p) => sum + Math.round(Number(p.amount) * 100), 0
      )

      if (amountCentavos > 0) {
        await supabase
          .from('bookings')
          .update({ cancellation_type: 'force_majeure' })
          .eq('id', id)

        await creditService.issueCredit({
          userId: booking.user_id,
          amountCentavos,
          source: 'force_majeure',
          sourceBookingId: id,
          issuedBy: actorUserId,
          reason: reason
            ? `Booking ${booking.booking_reference} cancelled by Building Admin: ${reason}`
            : `Booking ${booking.booking_reference} cancelled by Building Admin`,
          sendNotifications: true,
        }).catch(err => console.error('[BuildingBookingsService.cancel] Credit issuance failed:', err))

        // Mark the payment as refunded so it's excluded from revenue calculations
        // and prevents double-dipping (credit + completed payment).
        await supabase
          .from('payments')
          .update({ payment_status: 'refunded', updated_at: new Date().toISOString() })
          .eq('booking_id', id)
          .eq('payment_status', 'completed')
      }
    }

    return data
  },
/**
   * Create a manual reservation (admin-initiated).
   * Creates audit records for traceability.
   */
  async createManual(booking: {
    userId: string
    bookingType: string
    bookingPurpose: string
    bookingDate: string
    startTime: string
    endTime: string
    purpose: string
    eventName?: string
    expectedAttendees?: number
    facilityIds: string[]
    specialRequests?: string
    requiresPayment?: boolean
    paymentAmount?: number
    paymentMethod?: 'cashier' | 'qr_manual'
  }) {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Create the booking (auto-approved since admin is creating it)
    const { data: newBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: booking.userId,
        booking_type: booking.bookingType,
        booking_purpose: booking.bookingPurpose,
        booking_date: booking.bookingDate,
        start_time: booking.startTime,
        end_time: booking.endTime,
        purpose: booking.purpose,
        event_name: booking.eventName || null,
        expected_attendees: booking.expectedAttendees || null,
        current_status: 'approved',
        approved_at: now,
        requires_payment: booking.requiresPayment ?? false,
        special_requests: booking.specialRequests || null,
      })
      .select()
      .single()

    if (bookingError) throw new Error(bookingError.message)

    // Link facilities
    if (booking.facilityIds.length > 0) {
      const facilityLinks = booking.facilityIds.map(fid => ({
        booking_id: newBooking.id,
        facility_id: fid,
      }))

      const { error: linkError } = await supabase
        .from('booking_facilities')
        .insert(facilityLinks)

      if (linkError) throw new Error(linkError.message)
    }

    // Record decision for audit trail
    await supabase.from('booking_decisions').insert({
      booking_id: newBooking.id,
      hard_constraints_passed: true,
      decision: 'approved',
      decision_reason: 'Manual reservation created by Building Admin',
      pipeline_version: 'manual_building_admin',
    })

    // Record status history
    await supabase.from('booking_status_history').insert({
      booking_id: newBooking.id,
      previous_status: null,
      new_status: 'approved',
      reason: 'Manual reservation created by Building Admin',
      metadata: { source: 'building_admin_manual' },
    })

    // Create payment record if payment_amount is provided (walk-in cash/QR payment)
    if (booking.paymentAmount && booking.paymentAmount > 0) {
      await supabase.from('payments').insert({
        booking_id: newBooking.id,
        user_id: booking.userId,
        amount: booking.paymentAmount,
        currency: 'PHP',
        payment_method: booking.paymentMethod ?? 'cashier',
        payment_status: 'completed',
        payment_type: 'booking',
        description: 'Walk-in payment recorded by Building Admin',
      })
    }

    // Notify the booking user
    await sendNotification(supabase, {
      user_id: booking.userId,
      title: 'Reservation Created',
      message: `A reservation (${newBooking.booking_reference}) has been created for you by the Building Admin.`,
      type: 'info',
      source_type: 'booking',
      source_id: newBooking.id,
    })

    return newBooking
  },

  /**
   * Admin-initiated booking extension.
   * Directly extends a booking's end time and optionally records a cash payment.
   */
  async extendByAdmin(
    bookingId: string,
    newEndTime: string,
    recordPayment: boolean,
    adminUserId: string,
  ) {
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Fetch the parent booking
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select(`
        id, user_id, booking_reference, booking_date, start_time, end_time,
        booking_purpose, booking_type, current_status, requires_payment,
        is_extension, extension_of_booking_id, metadata,
        booking_facilities(facility_id, facility:facilities(id, name, facility_types(name)))
      `)
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) throw new Error('Booking not found')

    // Validate: not an extension
    if (booking.is_extension) {
      throw new Error('Extension bookings cannot be extended further')
    }

    // Validate: must be approved
    const approvableStatuses = ['approved', 'auto_approved']
    if (!approvableStatuses.includes(booking.current_status)) {
      throw new Error(`Only approved bookings can be extended. Current status: ${booking.current_status}`)
    }

    // Validate: must be personal/community/commercial
    const paymentPurposes = ['personal', 'community', 'commercial']
    if (!paymentPurposes.includes(booking.booking_purpose)) {
      throw new Error('Only personal, community, or commercial gymnasium bookings can be extended')
    }

    // Validate: new_end_time > current end_time
    const currentEnd = booking.end_time.slice(0, 5)
    if (newEndTime <= currentEnd) {
      throw new Error(`New end time (${newEndTime}) must be after the current end time (${currentEnd})`)
    }

    // Validate: must not exceed 21:00
    if (newEndTime > '21:00') {
      throw new Error('End time cannot exceed 9:00 PM')
    }

    // Get facility
    const facilityData = Array.isArray(booking.booking_facilities)
      ? booking.booking_facilities[0]
      : null
    const facilityId = facilityData?.facility_id
    if (!facilityId) throw new Error('Facility information not found for this booking')

    const facilityName = (() => {
      const f = facilityData?.facility
      if (Array.isArray(f)) return f[0]?.name ?? 'Gymnasium'
      return (f as any)?.name ?? 'Gymnasium'
    })()

    // Import checkBookingConflict
    const { checkBookingConflict } = await import('@/lib/bookings/check-conflict')

    // Conflict check on extension window [currentEnd → newEndTime]
    const conflictResult = await checkBookingConflict(supabase, {
      facility_id: facilityId,
      booking_date: booking.booking_date,
      start_time: currentEnd,
      end_time: newEndTime,
      exclude_booking_id: bookingId,
    })

    if (conflictResult.conflict) {
      throw new Error(
        `The gymnasium is not available for the selected extension period. Conflicts with booking ${conflictResult.conflicting_booking_reference ?? 'unknown'}.`
      )
    }

    // Create extension booking record
    const { data: extensionBooking, error: insertErr } = await supabase
      .from('bookings')
      .insert({
        user_id: booking.user_id,
        booking_reference: '',
        booking_type: booking.booking_type,
        booking_purpose: booking.booking_purpose,
        booking_date: booking.booking_date,
        start_time: currentEnd,
        end_time: newEndTime,
        purpose: `Extension of booking ${booking.booking_reference}`,
        event_name: null,
        current_status: 'approved',
        requires_payment: recordPayment,
        is_extension: true,
        extension_of_booking_id: bookingId,
        approved_at: now,
        metadata: booking.metadata ?? {},
        internal_notes: `Admin-initiated extension for booking ${booking.booking_reference}.`,
      })
      .select('id, booking_reference')
      .single()

    if (insertErr || !extensionBooking) {
      throw insertErr ?? new Error('Failed to create extension booking')
    }

    // Link extension to same facility
    await supabase.from('booking_facilities').insert({
      booking_id: extensionBooking.id,
      facility_id: facilityId,
    })

    // Update parent booking end_time
    await supabase
      .from('bookings')
      .update({ end_time: newEndTime })
      .eq('id', bookingId)

    // Calculate extension cost & optionally record payment
    let paymentRecorded = false
    if (recordPayment) {
      const extensionBookingData = {
        start_time: currentEnd,
        end_time: newEndTime,
        metadata: booking.metadata ?? {},
        booking_facilities: [{ facility_id: facilityId }],
      }
      const { amount } = await BookingPaymentService.calculateAmount(extensionBookingData)

      const [sh, sm] = currentEnd.split(':').map(Number)
      const [eh, em] = newEndTime.split(':').map(Number)
      const extensionHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60

      await supabase.from('payments').insert({
        booking_id: bookingId,
        user_id: booking.user_id,
        amount,
        currency: 'PHP',
        payment_method: 'cashier',
        payment_status: 'completed',
        payment_type: 'extension',
        extension_hours: extensionHours,
        description: `Admin extension — additional ${extensionHours.toFixed(1)} hour(s) (${currentEnd} to ${newEndTime})`,
        metadata: {
          extension_booking_id: extensionBooking.id,
          facility_name: facilityName,
          recorded_by: adminUserId,
          cost_breakdown: [],
        },
      })
      paymentRecorded = true
    }

    // Record status history
    await supabase.from('booking_status_history').insert({
      booking_id: bookingId,
      previous_status: booking.current_status,
      new_status: booking.current_status,
      reason: `Booking extended by admin until ${newEndTime}`,
      metadata: { source: 'building_admin', extension_booking_id: extensionBooking.id },
    })

    // Notify user
    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Extended by Admin',
      message: `Your booking ${booking.booking_reference} has been extended until ${newEndTime} by the Building Admin.${paymentRecorded ? ' Cash payment has been recorded.' : ''}`,
      type: 'info',
      source_type: 'booking',
      source_id: extensionBooking.id,
      priority: 'high',
    })

    // Audit log
    await AdminAuditService.log({
      actorId: adminUserId,
      action: 'extend_booking',
      targetType: 'booking',
      targetId: bookingId,
      details: {
        extension_booking_id: extensionBooking.id,
        previous_end_time: currentEnd,
        new_end_time: newEndTime,
        payment_recorded: paymentRecorded,
        facility_name: facilityName,
      },
    })

    return {
      extensionBookingId: extensionBooking.id,
      extensionBookingReference: extensionBooking.booking_reference,
      parentBookingReference: booking.booking_reference,
      extensionStartTime: currentEnd,
      extensionEndTime: newEndTime,
      paymentRecorded,
    }
  },
}
