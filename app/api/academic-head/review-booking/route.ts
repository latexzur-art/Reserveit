import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { BookingPaymentService } from '@/backend/booking/paymentService'

/**
 * P2-3: Rejection reason taxonomy.
 * Free-text reason is still required, but supplying a code on reject lets us
 * aggregate rejections by category in admin reporting (e.g., "30% of all
 * rejections are CAPACITY"). Optional on approve since approvals don't need it.
 */
export const REJECTION_REASON_CODES = [
  'capacity',           // expected attendees exceed facility capacity
  'conflict',           // schedule/class conflict not caught by hard constraint
  'purpose_mismatch',   // facility not appropriate for stated purpose
  'documentation',      // missing or insufficient justification
  'duplicate',          // duplicate of an existing booking
  'policy_violation',   // violates school policy (off-hours, restricted area)
  'other',              // catch-all when no category fits
] as const

const ReviewSchema = z.object({
  booking_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
  reason_code: z.enum(REJECTION_REASON_CODES).optional(),
})

const REVIEWABLE_STATUSES = ['pending', 'flagged']

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => r.name === 'academic_head')
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head role required' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { booking_id, action, reason, reason_code } = parsed.data
  const supabase = createAdminClient()

  try {
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, requires_payment, booking_type, booking_purpose, purpose, start_time, end_time, metadata, booking_facilities!inner(facility_id, facility:facilities(name))')
      .eq('id', booking_id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Idempotency: if the booking is already in the target state, return the
    // existing decision without re-running side effects (notifications,
    // status-history insert, payment invoice creation).
    const targetStatus = action === 'approve' ? 'approved' : 'rejected'
    if (booking.current_status === targetStatus) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: `Booking ${booking.booking_reference} is already ${targetStatus}.`,
      })
    }

    // Already decided in the OPPOSITE direction → conflict, not retryable.
    if (booking.current_status === 'approved' || booking.current_status === 'rejected') {
      return NextResponse.json(
        {
          error: `Booking ${booking.booking_reference} has already been ${booking.current_status}; cannot ${action}.`,
        },
        { status: 409 }
      )
    }

    if (!REVIEWABLE_STATUSES.includes(booking.current_status)) {
      return NextResponse.json(
        { error: `Cannot review a booking with status: ${booking.current_status}` },
        { status: 400 }
      )
    }

    // Paid-facility bookings (gymnasium personal/community/commercial) must be
    // approved by the Building Admin — they own the payment collection flow.
    const isPaidBooking = booking.requires_payment || ['internal_paid', 'external_paid'].includes((booking as any).booking_type)
    if (isPaidBooking) {
      return NextResponse.json(
        { error: 'Paid-facility bookings must be reviewed by the Building Admin, not the Academic Head.' },
        { status: 403 }
      )
    }

    const facilityData = Array.isArray(booking.booking_facilities) && booking.booking_facilities.length > 0
      ? booking.booking_facilities[0].facility as any
      : null
    const facilityName = Array.isArray(facilityData)
      ? facilityData[0]?.name ?? null
      : facilityData?.name ?? null

    if (action === 'approve' && booking.requires_payment) {
      const { data: existingPayment, error: existingPaymentError } = await supabase
        .from('payments')
        .select('id, payment_status, payment_reference')
        .eq('booking_id', booking_id)
        .limit(1)
        .single()

      if (existingPaymentError && existingPaymentError.code !== 'PGRST116') {
        console.error('[API] POST /academic-head/review-booking payment query error:', existingPaymentError.message)
        return NextResponse.json({ error: existingPaymentError.message }, { status: 500 })
      }

      let paymentRecord = existingPayment
      if (!existingPayment) {
        const { amount, breakdown } = await BookingPaymentService.calculateAmount(booking as any)
        const insertPayload = {
          booking_id,
          user_id: booking.user_id,
          amount,
          currency: 'PHP',
          payment_method: 'paymongo_card',
          payment_status: 'pending',
          description: `Gymnasium personal booking invoice`,
          metadata: {
            booking_purpose: booking.booking_purpose,
            purpose: booking.purpose,
            facility_name: facilityName,
            cost_breakdown: breakdown,
          },
        }

        const { data, error: paymentError } = await supabase
          .from('payments')
          .insert(insertPayload)
          .select('id, payment_status, payment_reference')
          .single()

        if (paymentError || !data) {
          console.error('[API] POST /academic-head/review-booking payment insert error:', paymentError?.message)
          return NextResponse.json({ error: paymentError?.message ?? 'Failed to create payment invoice' }, { status: 500 })
        }

        paymentRecord = data
      }

      await supabase
        .from('bookings')
        .update({
          current_status: 'approved',
          approved_at: new Date().toISOString(),
          internal_notes: 'Academic Head approved booking for payment; invoice created.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id)

      await sendNotification(supabase, {
        user_id: booking.user_id,
        title: 'Booking Approved for Payment',
        message: `Your booking ${booking.booking_reference} has been approved for payment. Please pay the invoice in your billing history.`,
        type: 'info',
        source_type: 'booking',
        source_id: booking_id,
        priority: 'high',
      })

      return NextResponse.json({
        success: true,
        message: `Booking ${booking.booking_reference} has been approved for payment.`,
        payment_id: paymentRecord?.id,
        payment_reference: paymentRecord?.payment_reference,
      })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // P2-3: include reason_code in audit metadata when rejecting so admin
    // reporting can aggregate "why" without parsing free-text.
    const auditMetadata: Record<string, unknown> = {
      review_type: 'academic_head_review',
      action,
    }
    if (action === 'reject' && reason_code) {
      auditMetadata.reason_code = reason_code
    }

    const { error: rpcError } = await supabase.rpc('update_booking_status', {
      p_booking_id: booking_id,
      p_new_status: newStatus,
      p_changed_by_user_id: user.id,
      p_changed_by_ai: false,
      p_reason: `Academic Head review: ${reason}`,
      p_metadata: auditMetadata,
    })

    if (rpcError) throw rpcError

    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: action === 'approve' ? 'Booking Approved' : 'Booking Rejected',
      message:
        action === 'approve'
          ? `Your booking ${booking.booking_reference} has been approved by the Academic Head.`
          : `Your booking ${booking.booking_reference} has been rejected by the Academic Head. Reason: ${reason}`,
      type: action === 'approve' ? 'success' : 'error',
      source_type: 'booking',
      source_id: booking_id,
      priority: 'high',
    })

    return NextResponse.json({
      success: true,
      message: `Booking ${booking.booking_reference} has been ${newStatus}.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : (typeof err === 'object' && err !== null && 'message' in err)
        ? String((err as any).message)
        : 'Unknown error'
    console.error('[API] POST /academic-head/review-booking error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
