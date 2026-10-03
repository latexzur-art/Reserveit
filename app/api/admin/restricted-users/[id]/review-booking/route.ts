import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUserManager } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking'
import { BookingPaymentService } from '@/backend/booking/paymentService'

const ReviewSchema = z.object({
  booking_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().min(1).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user: admin } = await requireUserManager()
  if (error) return error

  const { id: targetUserId } = await params

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

  const { booking_id, action, reason } = parsed.data

  try {
    const supabase = createAdminClient()

    // Verify booking belongs to this user and is pending
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, requires_payment, booking_purpose, purpose, start_time, end_time, metadata, booking_facilities!inner(facility_id, facility:facilities(name))')
      .eq('id', booking_id)
      .eq('user_id', targetUserId)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found for this user' }, { status: 404 })
    }

    if (!['pending', 'flagged'].includes(booking.current_status)) {
      return NextResponse.json(
        { error: `Cannot review booking with status: ${booking.current_status}` },
        { status: 400 }
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
        console.error('[API] POST /admin/restricted-users/[id]/review-booking payment query error:', existingPaymentError.message)
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
          console.error('[API] POST /admin/restricted-users/[id]/review-booking payment insert error:', paymentError?.message)
          return NextResponse.json({ error: paymentError?.message ?? 'Failed to create payment invoice' }, { status: 500 })
        }

        paymentRecord = data
      }

      await supabase
        .from('bookings')
        .update({
          current_status: 'approved',
          approved_at: new Date().toISOString(),
          internal_notes: 'Admin approved booking for payment; invoice created.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id)

      await sendNotification(supabase, {
        user_id: targetUserId,
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

    await supabase.rpc('update_booking_status', {
      p_booking_id: booking_id,
      p_new_status: newStatus,
      p_changed_by_user_id: admin.id,
      p_changed_by_ai: false,
      p_reason: `Manual review by admin: ${reason}`,
      p_metadata: { review_type: 'restricted_user_review' },
    })

    await sendNotification(supabase, {
      user_id: targetUserId,
      title: action === 'approve' ? 'Booking Approved' : 'Booking Rejected',
      message:
        action === 'approve'
          ? `Your booking ${booking.booking_reference} has been approved by the administrator.`
          : `Your booking ${booking.booking_reference} has been rejected. Reason: ${reason}`,
      type: action === 'approve' ? 'success' : 'error',
      source_type: 'booking',
      source_id: booking_id,
      priority: 'high',
    })

    return NextResponse.json({
      success: true,
      message: `Booking ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] POST /admin/restricted-users/[id]/review-booking error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
