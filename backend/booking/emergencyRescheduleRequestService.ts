import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification, sendNotificationToRoles } from './autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { isRefundWindowMet, getManilaDateString } from '@/lib/refund-eligibility'
import {
  rescheduleRequestSubmittedEmail,
  rescheduleRequestApprovedNoExtraEmail,
  rescheduleRequestApprovedWithExtraEmail,
  rescheduleRequestDeclinedEmail,
  rescheduleConfirmedAfterPaymentEmail,
} from '@/backend/notifications/emailTemplates'
import { getBuildingAdminEmails, resolveUserEmail, resolveUserPageUrls } from '@/backend/notifications/recipientResolver'
import { computeBookingAmount, type RateConfig, type BookingAddons } from './computeBookingAmount'
import { checkBookingConflict } from '@/lib/bookings/check-conflict'
import { BuildingPricingService } from '@/backend/admin/building/building-pricing.service'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CreateRescheduleRequestInput {
  bookingId: string
  userId: string
  reason: string
  attachmentUrl?: string | null
  proposedDate: string       // YYYY-MM-DD
  proposedStartTime: string  // HH:MM
  proposedEndTime: string    // HH:MM
}

export interface ApproveRescheduleRequestInput {
  requestId: string
  adminUserId: string
  reviewNotes?: string
}

export interface DeclineRescheduleRequestInput {
  requestId: string
  adminUserId: string
  reviewNotes: string
}

export interface RescheduleRequestResult {
  success: boolean
  message: string
  requestId?: string
  extraAmountCentavos?: number
  extraPaymentId?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function loadHelpdeskSettings(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['emergency_helpdesk_phone', 'emergency_helpdesk_email'])

  const map: Record<string, string> = {}
  for (const r of data ?? []) {
    map[r.key] = typeof r.value === 'string' ? r.value : JSON.stringify(r.value)
  }
  return {
    phone: map['emergency_helpdesk_phone'] ?? '(043) 123-4567',
    email: map['emergency_helpdesk_email'] ?? 'helpdesk@sti-lucena.edu.ph',
  }
}

function extractFacilityName(bookingFacilities: unknown): string {
  const arr = Array.isArray(bookingFacilities) ? bookingFacilities : [bookingFacilities]
  const row = arr[0]
  return (row?.facilities as { name?: string } | null)?.name ?? 'Facility'
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60  // crosses midnight
  return mins
}

export function computeExtraCentavos(
  originalStart: string, originalEnd: string,
  proposedStart: string, proposedEnd: string,
  addons?: BookingAddons,
  rates?: RateConfig,
): number {
  const { amount: originalAmount } = computeBookingAmount(originalStart, originalEnd, addons, rates)
  const { amount: proposedAmount } = computeBookingAmount(proposedStart, proposedEnd, addons, rates)
  const extra = proposedAmount - originalAmount
  return extra > 0 ? Math.round(extra * 100) : 0
}

// ─── 1. Create Request (user-initiated) ───────────────────────────────────────

export async function createRescheduleRequest(
  input: CreateRescheduleRequestInput
): Promise<RescheduleRequestResult> {
  const { bookingId, userId, reason, attachmentUrl, proposedDate, proposedStartTime, proposedEndTime } = input
  const supabase = createAdminClient()

  // Validate booking: must exist, belong to user, paid and approved
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, current_status, requires_payment, booking_type, booking_date, start_time, end_time, booking_facilities(facility_id, facilities(name))')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return { success: false, message: 'Booking not found.' }
  }

  if (booking.user_id !== userId) {
    return { success: false, message: 'Access denied.' }
  }

  const isPaidType = ['internal_paid', 'external_paid'].includes((booking as any).booking_type)
  const paymentCompleted = !booking.requires_payment
  if (!isPaidType || !paymentCompleted) {
    return { success: false, message: 'Emergency reschedule requests are only available for bookings with completed payment.' }
  }

  if (!['approved', 'auto_approved'].includes(booking.current_status)) {
    return { success: false, message: `Booking with status '${booking.current_status}' is not eligible for a reschedule request.` }
  }

  // 2-day cutoff: reschedule requests must be made at least 2 days before the booking
  if (!isRefundWindowMet(booking.booking_date, getManilaDateString())) {
    return { success: false, message: 'Reschedule requests must be made at least 2 days before the booking date. Contact the helpdesk for assistance.' }
  }

  // Validate proposed times
  const proposedDuration = durationMinutes(proposedStartTime, proposedEndTime)
  if (proposedDuration <= 0) {
    return { success: false, message: 'Proposed end time must be after proposed start time.' }
  }

  // Check for scheduling conflicts (exclude the current booking)
  const facilityArr = Array.isArray(booking.booking_facilities) ? booking.booking_facilities : [booking.booking_facilities]
  const facilityId = facilityArr[0]?.facility_id

  if (facilityId) {
    const conflict = await checkBookingConflict(supabase, {
      facility_id: facilityId,
      booking_date: proposedDate,
      start_time: proposedStartTime,
      end_time: proposedEndTime,
      exclude_booking_id: bookingId,
    })
    if (conflict.conflict) {
      return { success: false, message: `The proposed time slot conflicts with another booking (${conflict.conflicting_booking_reference ?? 'unknown'}). Please choose a different time.` }
    }
  }

  // Compute extra charge using facility-specific rates when available
  const facilityRates = facilityId ? await BuildingPricingService.getRateConfig(facilityId) : undefined
  const extraAmountCentavos = computeExtraCentavos(
    booking.start_time?.slice(0, 5) ?? '00:00',
    booking.end_time?.slice(0, 5) ?? '00:00',
    proposedStartTime,
    proposedEndTime,
    undefined,
    facilityRates,
  )

  // Insert request
  const { data: request, error: insertError } = await supabase
    .from('emergency_reschedule_requests')
    .insert({
      booking_id: bookingId,
      user_id: userId,
      reason,
      attachment_url: attachmentUrl ?? null,
      proposed_date: proposedDate,
      proposed_start_time: proposedStartTime,
      proposed_end_time: proposedEndTime,
      original_date: booking.booking_date,
      original_start_time: booking.start_time?.slice(0, 5),
      original_end_time: booking.end_time?.slice(0, 5),
      extra_amount_centavos: extraAmountCentavos,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, message: 'You already have an active reschedule request for this booking.' }
    }
    return { success: false, message: `Failed to submit request: ${insertError.message}` }
  }

  const facilityName = extractFacilityName(booking.booking_facilities)
  const { emailTo: userEmailTo, name: userName } = await resolveUserEmail(supabase, userId)
  const extraAmountPeso = (extraAmountCentavos / 100).toFixed(2)

  // Notify building admins in-app
  void sendNotificationToRoles(supabase, ['building_admin'], {
    title: 'Reschedule Request Submitted',
    message: `${userName ?? 'A user'} has submitted an emergency reschedule request for booking ${booking.booking_reference} (${facilityName}).${extraAmountCentavos > 0 ? ` Extra charge: ₱${extraAmountPeso}` : ''}`,
    type: 'warning',
    priority: 'urgent',
    source_type: 'reschedule_request',
    source_id: request!.id,
    action_url: `${APP_URL}/admin/building/reservations?tab=reschedule-requests`,
    metadata: { request_id: request!.id, booking_id: bookingId, extra_amount_centavos: extraAmountCentavos },
  })

  // Email admins
  void (async () => {
    const adminEmails = await getBuildingAdminEmails()
    for (const email of adminEmails) {
      const template = rescheduleRequestSubmittedEmail({
        adminName: 'Building Admin',
        userName: userName ?? 'User',
        userEmail: userEmailTo ?? '',
        bookingRef: booking.booking_reference,
        facilityName,
        originalDate: booking.booking_date,
        originalTime: `${booking.start_time?.slice(0, 5)} – ${booking.end_time?.slice(0, 5)}`,
        proposedDate,
        proposedTime: `${proposedStartTime} – ${proposedEndTime}`,
        extraAmountPeso,
        reason,
        hasAttachment: !!attachmentUrl,
        reviewUrl: `${APP_URL}/admin/building/reservations?tab=reschedule-requests`,
      })
      await sendBrevoEmail({ to: email, subject: template.subject, htmlBody: template.htmlBody })
        .catch(err => console.error('[rescheduleRequestService] admin email failed:', err))
    }
  })()

  return {
    success: true,
    message: 'Emergency reschedule request submitted. An admin will review it shortly.',
    requestId: request!.id,
    extraAmountCentavos,
  }
}

// ─── 2. Withdraw Request (user-initiated) ─────────────────────────────────────

export async function withdrawRescheduleRequest(
  requestId: string,
  userId: string
): Promise<RescheduleRequestResult> {
  const supabase = createAdminClient()

  const { data: request, error } = await supabase
    .from('emergency_reschedule_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .single()

  if (error || !request) {
    return { success: false, message: 'Request not found.' }
  }

  if ((request as any).user_id !== userId) {
    return { success: false, message: 'Access denied.' }
  }

  if ((request as any).status !== 'pending') {
    return { success: false, message: `Request cannot be withdrawn (current status: ${(request as any).status}).` }
  }

  const { error: updateError } = await supabase
    .from('emergency_reschedule_requests')
    .update({ status: 'withdrawn' })
    .eq('id', requestId)

  if (updateError) {
    return { success: false, message: `Failed to withdraw request: ${updateError.message}` }
  }

  return { success: true, message: 'Your reschedule request has been withdrawn.' }
}

// ─── 3. Approve Request (admin) ───────────────────────────────────────────────

export async function approveRescheduleRequest(
  input: ApproveRescheduleRequestInput
): Promise<RescheduleRequestResult> {
  const { requestId, adminUserId, reviewNotes } = input
  const supabase = createAdminClient()

  const { data: req, error } = await supabase
    .from('emergency_reschedule_requests')
    .select('id, booking_id, user_id, status, extra_amount_centavos, proposed_date, proposed_start_time, proposed_end_time, original_date, original_start_time, original_end_time')
    .eq('id', requestId)
    .single()

  if (error || !req) {
    return { success: false, message: 'Request not found.' }
  }

  if ((req as any).status !== 'pending') {
    return { success: false, message: `Request is already ${(req as any).status}.` }
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, booking_date, start_time, end_time, booking_facilities(facility_id, facilities(name))')
    .eq('id', (req as any).booking_id)
    .single()

  if (!booking) {
    return { success: false, message: 'Associated booking not found.' }
  }

  const facilityName = extractFacilityName(booking.booking_facilities)
  const extraAmountCentavos: number = (req as any).extra_amount_centavos ?? 0
  const proposedDate: string = (req as any).proposed_date
  const proposedStart: string = (req as any).proposed_start_time?.slice(0, 5)
  const proposedEnd: string = (req as any).proposed_end_time?.slice(0, 5)

  // No extra payment needed — apply reschedule immediately
  if (extraAmountCentavos === 0) {
    // Re-check for conflicts at approval time (another booking may have claimed the slot)
    const approvalFacilityArr = Array.isArray(booking.booking_facilities) ? booking.booking_facilities : [booking.booking_facilities]
    const approvalFacilityId = approvalFacilityArr[0]?.facility_id
    if (approvalFacilityId) {
      const recheckConflict = await checkBookingConflict(supabase, {
        facility_id: approvalFacilityId,
        booking_date: proposedDate,
        start_time: proposedStart,
        end_time: proposedEnd,
        exclude_booking_id: (req as any).booking_id,
      })
      if (recheckConflict.conflict) {
        return {
          success: false,
          message: `Cannot approve reschedule: the proposed time slot is now occupied by another booking (${recheckConflict.conflicting_booking_reference ?? 'unknown'}). The request will remain pending for a different slot.`,
        }
      }
    }

    const { data: applied } = await supabase.rpc('apply_user_emergency_reschedule', {
      p_booking_id: (req as any).booking_id,
      p_request_id: requestId,
      p_new_date: proposedDate,
      p_new_start: proposedStart,
      p_new_end: proposedEnd,
    })

    if (!applied) {
      return { success: false, message: 'Failed to apply reschedule. Please try again.' }
    }

    // Ensure booking status stays approved
    await supabase.rpc('update_booking_status', {
      p_booking_id: (req as any).booking_id,
      p_new_status: 'approved',
      p_changed_by_user_id: adminUserId,
      p_changed_by_ai: false,
      p_reason: reviewNotes ?? 'Emergency reschedule request approved by admin',
      p_metadata: { source: 'reschedule_request_approved', request_id: requestId },
    })

    // Update request with review info
    await supabase
      .from('emergency_reschedule_requests')
      .update({ reviewed_by: adminUserId, reviewed_at: new Date().toISOString(), review_notes: reviewNotes ?? null })
      .eq('id', requestId)

    // Notify user
    void (async () => {
      const { bookingsUrl, paymentUrl: _p } = await resolveUserPageUrls(supabase, (req as any).user_id)
      await sendNotification(supabase, {
        user_id: (req as any).user_id,
        title: 'Reschedule Request Approved',
        message: `Your reschedule request for booking ${booking.booking_reference} has been approved. New schedule: ${proposedDate} ${proposedStart}–${proposedEnd}.`,
        type: 'success',
        priority: 'high',
        source_type: 'reschedule_request',
        source_id: requestId,
        action_url: bookingsUrl,
      })
      const { emailTo, name } = await resolveUserEmail(supabase, (req as any).user_id)
      if (!emailTo) return
      const template = rescheduleRequestApprovedNoExtraEmail({
        userName: name ?? 'Valued User',
        bookingRef: booking.booking_reference,
        facilityName,
        newDate: proposedDate,
        newTime: `${proposedStart} – ${proposedEnd}`,
        reviewNotes,
        bookingsUrl: `${APP_URL}${bookingsUrl}`,
      })
      await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
        .catch(err => console.error('[rescheduleRequestService] approval email failed:', err))
    })()

    return { success: true, message: 'Reschedule approved and applied to booking.' }
  }

  // Extra payment needed — create payment record, set status to pending_extra_payment
  const extraAmountPeso = (extraAmountCentavos / 100).toFixed(2)

  const { data: newPayment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      booking_id: (req as any).booking_id,
      user_id: (req as any).user_id,
      amount: extraAmountCentavos / 100,
      currency: 'PHP',
      payment_method: 'paymongo_card',
      payment_status: 'pending',
      payment_type: 'reschedule_extra',
      description: `Reschedule extra charge for booking ${booking.booking_reference}`,
      metadata: {
        reschedule_request_id: requestId,
        label: 'extra',
        facility_name: facilityName,
        proposed_date: proposedDate,
        proposed_start_time: proposedStart,
        proposed_end_time: proposedEnd,
      },
    })
    .select('id')
    .single()

  if (paymentError || !newPayment) {
    return { success: false, message: `Failed to create extra payment: ${paymentError?.message}` }
  }

  await supabase
    .from('emergency_reschedule_requests')
    .update({
      status: 'pending_extra_payment',
      extra_payment_id: newPayment.id,
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes ?? null,
    })
    .eq('id', requestId)

  // Notify user to pay
  void (async () => {
    const { bookingsUrl: _b, paymentUrl } = await resolveUserPageUrls(supabase, (req as any).user_id)
    await sendNotification(supabase, {
      user_id: (req as any).user_id,
      title: 'Reschedule Approved — Extra Payment Required',
      message: `Your reschedule request for booking ${booking.booking_reference} was approved! Please pay the extra charge of ₱${extraAmountPeso} to confirm the new schedule.`,
      type: 'info',
      priority: 'high',
      source_type: 'reschedule_request',
      source_id: requestId,
      action_url: paymentUrl,
    })
    const { emailTo, name } = await resolveUserEmail(supabase, (req as any).user_id)
    if (!emailTo) return
    const template = rescheduleRequestApprovedWithExtraEmail({
      userName: name ?? 'Valued User',
      bookingRef: booking.booking_reference,
      facilityName,
      proposedDate,
      proposedTime: `${proposedStart} – ${proposedEnd}`,
      extraAmountPeso,
      reviewNotes,
      paymentUrl: `${APP_URL}${paymentUrl}`,
    })
    await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
      .catch(err => console.error('[rescheduleRequestService] extra payment email failed:', err))
  })()

  return {
    success: true,
    message: `Reschedule approved. User notified to pay extra charge of ₱${extraAmountPeso}.`,
    extraPaymentId: newPayment.id,
    extraAmountCentavos,
  }
}

// ─── 4. Decline Request (admin) ───────────────────────────────────────────────

export async function declineRescheduleRequest(
  input: DeclineRescheduleRequestInput
): Promise<RescheduleRequestResult> {
  const { requestId, adminUserId, reviewNotes } = input
  const supabase = createAdminClient()

  const { data: req, error } = await supabase
    .from('emergency_reschedule_requests')
    .select('id, booking_id, user_id, status')
    .eq('id', requestId)
    .single()

  if (error || !req) {
    return { success: false, message: 'Request not found.' }
  }

  if ((req as any).status !== 'pending') {
    return { success: false, message: `Request is already ${(req as any).status}.` }
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_reference, booking_date, start_time, end_time, booking_facilities(facility_id, facilities(name))')
    .eq('id', (req as any).booking_id)
    .single()

  await supabase
    .from('emergency_reschedule_requests')
    .update({
      status: 'declined',
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    })
    .eq('id', requestId)

  const facilityName = extractFacilityName(booking?.booking_facilities)

  // Notify user
  void (async () => {
    const { bookingsUrl } = await resolveUserPageUrls(supabase, (req as any).user_id)
    await sendNotification(supabase, {
      user_id: (req as any).user_id,
      title: 'Reschedule Request Declined',
      message: `Your reschedule request for booking ${booking?.booking_reference} was declined. Admin note: "${reviewNotes}"`,
      type: 'error',
      priority: 'high',
      source_type: 'reschedule_request',
      source_id: requestId,
      action_url: bookingsUrl,
      metadata: { review_notes: reviewNotes },
    })
    if (!booking) return
    const { emailTo, name } = await resolveUserEmail(supabase, (req as any).user_id)
    if (!emailTo) return
    const helpdesk = await loadHelpdeskSettings(supabase)
    const template = rescheduleRequestDeclinedEmail({
      userName: name ?? 'Valued User',
      bookingRef: booking.booking_reference,
      facilityName,
      bookingDate: booking.booking_date,
      bookingTime: `${booking.start_time?.slice(0, 5)} – ${booking.end_time?.slice(0, 5)}`,
      reviewNotes,
      helpdeskPhone: helpdesk.phone,
      helpdeskEmail: helpdesk.email,
      bookingsUrl: `${APP_URL}${bookingsUrl}`,
    })
    await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
      .catch(err => console.error('[rescheduleRequestService] decline email failed:', err))
  })()

  return { success: true, message: 'Request declined. User has been notified.' }
}

// ─── 5. Apply Reschedule After Extra Payment ───────────────────────────────────

export async function applyRescheduleOnPayment(
  paymentId: string
): Promise<{ applied: boolean; message: string }> {
  const supabase = createAdminClient()

  // Fetch payment
  const { data: payment } = await supabase
    .from('payments')
    .select('id, booking_id, user_id, amount, payment_type, payment_status, metadata')
    .eq('id', paymentId)
    .single()

  if (!payment || (payment as any).payment_type !== 'reschedule_extra') {
    return { applied: false, message: 'Not a reschedule_extra payment.' }
  }

  if ((payment as any).payment_status !== 'completed') {
    return { applied: false, message: 'Payment not yet completed.' }
  }

  const requestId = ((payment as any).metadata as any)?.reschedule_request_id
  if (!requestId) {
    return { applied: false, message: 'No reschedule_request_id in payment metadata.' }
  }

  // Fetch reschedule request
  const { data: req } = await supabase
    .from('emergency_reschedule_requests')
    .select('id, booking_id, user_id, status, proposed_date, proposed_start_time, proposed_end_time')
    .eq('id', requestId)
    .single()

  if (!req) {
    return { applied: false, message: 'Reschedule request not found.' }
  }

  // Idempotent: already completed
  if ((req as any).status === 'completed') {
    return { applied: true, message: 'Reschedule already applied.' }
  }

  if ((req as any).status !== 'pending_extra_payment') {
    return { applied: false, message: `Reschedule request is in unexpected state: ${(req as any).status}` }
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_reference, booking_facilities(facility_id, facilities(name))')
    .eq('id', (req as any).booking_id)
    .single()

  const proposedDate: string = (req as any).proposed_date
  const proposedStart: string = (req as any).proposed_start_time?.slice(0, 5)
  const proposedEnd: string = (req as any).proposed_end_time?.slice(0, 5)

  // Re-check for conflicts at apply time (another booking may have claimed the slot since approval)
  const applyFacilityArr = Array.isArray(booking?.booking_facilities) ? booking.booking_facilities : [booking?.booking_facilities]
  const applyFacilityId = applyFacilityArr[0]?.facility_id
  if (applyFacilityId) {
    const recheckConflict = await checkBookingConflict(supabase, {
      facility_id: applyFacilityId,
      booking_date: proposedDate,
      start_time: proposedStart,
      end_time: proposedEnd,
      exclude_booking_id: (req as any).booking_id,
    })
    if (recheckConflict.conflict) {
      return {
        applied: false,
        message: `Cannot apply reschedule: the proposed time slot is now occupied by another booking (${recheckConflict.conflicting_booking_reference ?? 'unknown'}). Payment will be refunded.`,
      }
    }
  }

  // Atomic reschedule via RPC
  const { data: applied } = await supabase.rpc('apply_user_emergency_reschedule', {
    p_booking_id: (req as any).booking_id,
    p_request_id: requestId,
    p_new_date: proposedDate,
    p_new_start: proposedStart,
    p_new_end: proposedEnd,
  })

  if (!applied) {
    return { applied: false, message: 'RPC apply_user_emergency_reschedule returned false.' }
  }

  // Ensure booking status is approved
  await supabase.rpc('update_booking_status', {
    p_booking_id: (req as any).booking_id,
    p_new_status: 'approved',
    p_changed_by_user_id: (req as any).user_id,
    p_changed_by_ai: false,
    p_reason: 'Emergency reschedule confirmed after extra payment',
    p_metadata: { source: 'reschedule_request_payment', payment_id: paymentId, request_id: requestId },
  })

  const facilityName = extractFacilityName(booking?.booking_facilities)
  const paidAmountPeso = ((payment as any).amount ?? 0).toFixed(2)

  // In-app notification + email
  void (async () => {
    const { bookingsUrl } = await resolveUserPageUrls(supabase, (req as any).user_id)
    await sendNotification(supabase, {
      user_id: (req as any).user_id,
      title: 'Reschedule Confirmed',
      message: `Your booking ${booking?.booking_reference} has been successfully rescheduled to ${proposedDate} ${proposedStart}–${proposedEnd}.`,
      type: 'success',
      priority: 'high',
      source_type: 'reschedule_request',
      source_id: requestId,
      action_url: bookingsUrl,
    })
    const { emailTo, name } = await resolveUserEmail(supabase, (req as any).user_id)
    if (!emailTo) return
    const template = rescheduleConfirmedAfterPaymentEmail({
      userName: name ?? 'Valued User',
      bookingRef: booking?.booking_reference ?? '',
      facilityName,
      newDate: proposedDate,
      newTime: `${proposedStart} – ${proposedEnd}`,
      paidAmountPeso,
      bookingsUrl: `${APP_URL}${bookingsUrl}`,
    })
    await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
      .catch(err => console.error('[rescheduleRequestService] confirmed email failed:', err))
  })()

  return { applied: true, message: 'Reschedule applied successfully.' }
}

// ─── Extra Charge Estimate (used by API route) ────────────────────────────────

export function estimateExtraCentavos(
  originalStart: string, originalEnd: string,
  proposedStart: string, proposedEnd: string,
  addons?: BookingAddons,
  rates?: RateConfig,
): { extraAmountCentavos: number; breakdown: import('./computeBookingAmount').CostLineItem[] } {
  const { amount: originalAmount } = computeBookingAmount(originalStart, originalEnd, addons, rates)
  const { amount: proposedAmount, breakdown } = computeBookingAmount(proposedStart, proposedEnd, addons, rates)
  const extra = proposedAmount - originalAmount
  return {
    extraAmountCentavos: extra > 0 ? Math.round(extra * 100) : 0,
    breakdown,
  }
}
