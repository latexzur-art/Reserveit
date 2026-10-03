import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification, sendNotificationToRoles } from './autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  emergencyRequestSubmittedEmail,
  emergencyRequestApprovedEmail,
  emergencyRequestDeniedEmail,
} from '@/backend/notifications/emailTemplates'
import { getBuildingAdminEmails, resolveUserEmail } from '@/backend/notifications/recipientResolver'
import { creditService } from '@/backend/credits/creditService'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export interface CreateEmergencyRequestInput {
  bookingId: string
  userId: string
  reason: string
  attachmentUrl?: string | null
}

export interface ApproveEmergencyRequestInput {
  requestId: string
  adminUserId: string
  amountCentavos: number
  reviewNotes?: string
}

export interface DenyEmergencyRequestInput {
  requestId: string
  adminUserId: string
  reviewNotes: string
}

export interface EmergencyRequestResult {
  success: boolean
  message: string
  requestId?: string
}

async function loadHelpdeskSettings(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['emergency_helpdesk_phone', 'emergency_helpdesk_email'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    // row.value from JSONB is already parsed by the client
    map[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
  }
  return {
    phone: map['emergency_helpdesk_phone'] ?? '(043) 123-4567',
    email: map['emergency_helpdesk_email'] ?? 'helpdesk@sti-lucena.edu.ph',
  }
}

// ── 1. Create Request (user-initiated) ────────────────────────────────────────

export async function createEmergencyRequest(
  input: CreateEmergencyRequestInput
): Promise<EmergencyRequestResult> {
  const { bookingId, userId, reason, attachmentUrl } = input
  const supabase = createAdminClient()

  // Load booking to ensure it's a paid, active booking owned by user
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

  // requires_payment starts true (payment pending) and becomes false once payment completes.
  // booking_type === 'internal_paid' means the booking requires payment by design.
  // We only allow emergency requests for paid bookings where payment has been completed.
  const isPaidType = ['internal_paid', 'external_paid'].includes((booking as any).booking_type)
  const paymentCompleted = !booking.requires_payment
  if (!isPaidType || !paymentCompleted) {
    return { success: false, message: 'Emergency cancellation requests are only available for bookings with completed payment.' }
  }

  const eligibleStatuses = ['approved', 'auto_approved']
  if (!eligibleStatuses.includes(booking.current_status)) {
    return { success: false, message: `Booking with status '${booking.current_status}' is not eligible for emergency cancellation.` }
  }

  // Insert request (unique index will block duplicates)
  const { data: request, error: insertError } = await supabase
    .from('emergency_cancellation_requests')
    .insert({
      booking_id: bookingId,
      user_id: userId,
      reason,
      attachment_url: attachmentUrl ?? null,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, message: 'You already have a pending emergency cancellation request for this booking.' }
    }
    return { success: false, message: `Failed to submit request: ${insertError.message}` }
  }

  // Mark booking as cancellation requested so the user can see the status change
  await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: 'cancellation_requested',
    p_changed_by_user_id: userId,
    p_changed_by_ai: false,
    p_reason: 'Emergency cancellation request submitted by user',
    p_metadata: { source: 'emergency_cancellation_request', request_id: request!.id },
  })

  const facilityRow = Array.isArray(booking.booking_facilities)
    ? booking.booking_facilities[0]
    : booking.booking_facilities
  const facilityName = (facilityRow?.facilities as { name?: string } | null)?.name ?? 'Facility'

  const { emailTo: userEmailTo, name: userName } = await resolveUserEmail(supabase, userId)

  // Notify building admins (in-app + email) — fire and forget
  void sendNotificationToRoles(supabase, ['building_admin'], {
    title: 'Emergency Cancellation Request Submitted',
    message: `${userName ?? 'A user'} has submitted an emergency cancellation request for booking ${booking.booking_reference} (${facilityName}).`,
    type: 'warning',
    priority: 'urgent',
    source_type: 'emergency_request',
    source_id: request!.id,
    action_url: `${APP_URL}/admin/building/reservations?tab=emergency-requests`,
    metadata: { request_id: request!.id, booking_id: bookingId },
  })

  void (async () => {
    const adminEmails = await getBuildingAdminEmails()
    for (const email of adminEmails) {
      const template = emergencyRequestSubmittedEmail({
        adminName: 'Building Admin',
        userName: userName ?? 'User',
        userEmail: userEmailTo ?? '',
        bookingRef: booking.booking_reference,
        facilityName,
        bookingDate: booking.booking_date,
        bookingTime: `${booking.start_time?.slice(0, 5)} – ${booking.end_time?.slice(0, 5)}`,
        reason,
        hasAttachment: !!attachmentUrl,
        reviewUrl: `${APP_URL}/admin/building/reservations?tab=emergency-requests`,
      })
      await sendBrevoEmail({ to: email, subject: template.subject, htmlBody: template.htmlBody })
        .catch(err => console.error('[emergencyRequestService] admin email failed:', err))
    }
  })()

  return { success: true, message: 'Emergency cancellation request submitted. An admin will review it shortly.', requestId: request!.id }
}

// ── 2. Withdraw Request (user-initiated) ──────────────────────────────────────

export async function withdrawEmergencyRequest(
  requestId: string,
  userId: string
): Promise<EmergencyRequestResult> {
  const supabase = createAdminClient()

  const { data: request, error } = await supabase
    .from('emergency_cancellation_requests')
    .select('id, booking_id, user_id, status')
    .eq('id', requestId)
    .single()

  if (error || !request) {
    return { success: false, message: 'Request not found.' }
  }

  if (request.user_id !== userId) {
    return { success: false, message: 'Access denied.' }
  }

  if (request.status !== 'pending') {
    return { success: false, message: `Request cannot be withdrawn (current status: ${request.status}).` }
  }

  const { error: updateError } = await supabase
    .from('emergency_cancellation_requests')
    .update({ status: 'withdrawn' })
    .eq('id', requestId)

  if (updateError) {
    return { success: false, message: `Failed to withdraw request: ${updateError.message}` }
  }

  // Revert booking status to what it was before cancellation_requested
  const { data: historyRow } = await supabase
    .from('booking_status_history')
    .select('previous_status')
    .eq('booking_id', request.booking_id)
    .eq('new_status', 'cancellation_requested')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const revertTo = (historyRow?.previous_status as string) ?? 'approved'
  await supabase.rpc('update_booking_status', {
    p_booking_id: request.booking_id,
    p_new_status: revertTo,
    p_changed_by_user_id: userId,
    p_changed_by_ai: false,
    p_reason: 'Emergency cancellation request withdrawn by user',
    p_metadata: { source: 'emergency_cancellation_request', request_id: requestId },
  })

  return { success: true, message: 'Your emergency cancellation request has been withdrawn.' }
}

// ── 3. Approve Request (admin) ────────────────────────────────────────────────

export async function approveEmergencyRequest(
  input: ApproveEmergencyRequestInput
): Promise<EmergencyRequestResult> {
  const { requestId, adminUserId, amountCentavos, reviewNotes } = input
  const supabase = createAdminClient()

  const { data: request, error } = await supabase
    .from('emergency_cancellation_requests')
    .select('id, booking_id, user_id, status, reason')
    .eq('id', requestId)
    .single()

  if (error || !request) {
    return { success: false, message: 'Request not found.' }
  }

  if (request.status !== 'pending') {
    return { success: false, message: `Request is already ${request.status}.` }
  }

  // Load booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, current_status, booking_date, start_time, end_time, booking_facilities(facility_id, facilities(name))')
    .eq('id', request.booking_id)
    .single()

  if (!booking) {
    return { success: false, message: 'Associated booking not found.' }
  }

  const facilityRow = Array.isArray(booking.booking_facilities)
    ? booking.booking_facilities[0]
    : booking.booking_facilities
  const facilityName = (facilityRow?.facilities as { name?: string } | null)?.name ?? 'Facility'

  // Cancel booking
  await supabase.rpc('update_booking_status', {
    p_booking_id: request.booking_id,
    p_new_status: 'cancelled',
    p_changed_by_user_id: adminUserId,
    p_changed_by_ai: false,
    p_reason: reviewNotes || (amountCentavos > 0 ? 'Approved emergency cancellation request' : 'Emergency cancellation approved — no credit issued'),
    p_metadata: { source: 'emergency_cancellation_request', request_id: requestId },
  })

  await supabase
    .from('bookings')
    .update({ cancellation_type: 'force_majeure', cancelled_at: new Date().toISOString() })
    .eq('id', request.booking_id)

  // Issue credit only when amount > 0
  let creditId: string | undefined
  let newBalance = 0
  if (amountCentavos > 0) {
    const creditResult = await creditService.issueCredit({
      userId: request.user_id,
      amountCentavos,
      source: 'force_majeure',
      sourceBookingId: request.booking_id,
      issuedBy: adminUserId,
      reason: reviewNotes || `Emergency cancellation approved for booking ${booking.booking_reference}`,
      sendNotifications: false,
    })
    creditId = creditResult.creditId
    newBalance = creditResult.newBalance
  }

  // Update request row
  await supabase
    .from('emergency_cancellation_requests')
    .update({
      status: 'approved',
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes ?? null,
      issued_credit_id: creditId,
    })
    .eq('id', requestId)

  const amountPeso = (amountCentavos / 100).toFixed(2)
  const balancePeso = (newBalance / 100).toFixed(2)
  const withCredit = amountCentavos > 0

  // Notify user
  void sendNotification(supabase, {
    user_id: request.user_id,
    title: withCredit ? 'Emergency Request Approved — Credit Issued' : 'Emergency Request Approved — Booking Cancelled',
    message: withCredit
      ? `Your emergency cancellation for booking ${booking.booking_reference} was approved. ₱${amountPeso} session credit added to your account. New balance: ₱${balancePeso}.`
      : `Your emergency cancellation for booking ${booking.booking_reference} was approved. The booking has been cancelled. No credit was issued.`,
    type: 'success',
    priority: 'high',
    source_type: 'emergency_request',
    source_id: requestId,
    action_url: withCredit ? '/client/credits' : '/client/bookings',
    metadata: { credit_id: creditId, amount_centavos: amountCentavos },
  })

  void (async () => {
    if (!withCredit) return
    const { emailTo, name } = await resolveUserEmail(supabase, request.user_id)
    if (!emailTo) return
    const template = emergencyRequestApprovedEmail({
      userName: name ?? 'Valued User',
      bookingRef: booking.booking_reference,
      facilityName,
      creditAmountPeso: amountPeso,
      newBalancePeso: balancePeso,
      reviewNotes,
      applyUrl: '/client/payment',
    })
    await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
      .catch(err => console.error('[emergencyRequestService] approval email failed:', err))
  })()

  return {
    success: true,
    message: withCredit
      ? `Request approved. Booking cancelled and ₱${amountPeso} session credit issued.`
      : 'Request approved. Booking cancelled. No credit was issued.',
  }
}

// ── 4. Deny Request (admin) ───────────────────────────────────────────────────

export async function denyEmergencyRequest(
  input: DenyEmergencyRequestInput
): Promise<EmergencyRequestResult> {
  const { requestId, adminUserId, reviewNotes } = input
  const supabase = createAdminClient()

  const { data: request, error } = await supabase
    .from('emergency_cancellation_requests')
    .select('id, booking_id, user_id, status')
    .eq('id', requestId)
    .single()

  if (error || !request) {
    return { success: false, message: 'Request not found.' }
  }

  if (request.status !== 'pending') {
    return { success: false, message: `Request is already ${request.status}.` }
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_reference, booking_date, start_time, end_time, booking_facilities(facility_id, facilities(name))')
    .eq('id', request.booking_id)
    .single()

  await supabase
    .from('emergency_cancellation_requests')
    .update({
      status: 'denied',
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    })
    .eq('id', requestId)

  // Revert booking status to what it was before cancellation_requested
  const { data: historyRow } = await supabase
    .from('booking_status_history')
    .select('previous_status')
    .eq('booking_id', request.booking_id)
    .eq('new_status', 'cancellation_requested')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const revertTo = (historyRow?.previous_status as string) ?? 'approved'
  await supabase.rpc('update_booking_status', {
    p_booking_id: request.booking_id,
    p_new_status: revertTo,
    p_changed_by_user_id: adminUserId,
    p_changed_by_ai: false,
    p_reason: 'Emergency cancellation request denied',
    p_metadata: { source: 'emergency_cancellation_request', request_id: requestId },
  })

  const facilityRow = Array.isArray(booking?.booking_facilities)
    ? booking?.booking_facilities[0]
    : booking?.booking_facilities
  const facilityName = (facilityRow?.facilities as { name?: string } | null)?.name ?? 'Facility'

  // Notify user
  void sendNotification(supabase, {
    user_id: request.user_id,
    title: 'Emergency Request Denied',
    message: `Your emergency cancellation request for booking ${booking?.booking_reference} was denied. Admin note: "${reviewNotes}"`,
    type: 'error',
    priority: 'high',
    source_type: 'emergency_request',
    source_id: requestId,
    metadata: { review_notes: reviewNotes },
  })

  void (async () => {
    if (!booking) return
    const { emailTo, name } = await resolveUserEmail(supabase, request.user_id)
    if (!emailTo) return
    const helpdesk = await loadHelpdeskSettings(supabase)
    const template = emergencyRequestDeniedEmail({
      userName: name ?? 'Valued User',
      bookingRef: booking.booking_reference,
      facilityName,
      bookingDate: booking.booking_date,
      bookingTime: `${booking.start_time?.slice(0, 5)} – ${booking.end_time?.slice(0, 5)}`,
      reviewNotes,
      helpdeskPhone: helpdesk.phone,
      helpdeskEmail: helpdesk.email,
    })
    await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
      .catch(err => console.error('[emergencyRequestService] denial email failed:', err))
  })()

  return { success: true, message: 'Request denied. User has been notified.' }
}
