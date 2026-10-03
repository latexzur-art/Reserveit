import { NextRequest, NextResponse } from 'next/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHead } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { BookingPaymentService } from '@/backend/booking/paymentService'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAcademicHead()
  if (error) return error

  const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const bookingId = __idParsed.value
  const supabase = createAdminClient()

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        user_id,
        booking_reference,
        current_status,
        requires_payment,
        booking_purpose,
        purpose,
        start_time,
        end_time,
        metadata,
        booking_facilities!inner(facility_id, facility:facilities(name))
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const bookingFacility = Array.isArray(booking.booking_facilities) && booking.booking_facilities.length > 0
      ? booking.booking_facilities[0]
      : (booking.booking_facilities as any)
    const facilityData = bookingFacility?.facility as any
    const facilityName = Array.isArray(facilityData)
      ? facilityData[0]?.name ?? null
      : facilityData?.name ?? null

    if (!booking.requires_payment) {
      return NextResponse.json({ error: 'Booking is not marked for payment approval' }, { status: 400 })
    }

    if (booking.current_status !== 'pending') {
      return NextResponse.json({ error: `Booking must be pending to approve for payment, current status is ${booking.current_status}` }, { status: 400 })
    }

    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from('payments')
      .select('id,payment_status,payment_reference')
      .eq('booking_id', bookingId)
      .limit(1)
      .single()

    if (existingPaymentError && existingPaymentError.code !== 'PGRST116') {
      console.error('[API] PATCH /bookings/[id]/approve existing payment query error:', existingPaymentError.message)
      return NextResponse.json({ error: existingPaymentError.message }, { status: 500 })
    }

    if (existingPayment) {
      return NextResponse.json({
        status: 'already_exists',
        payment_id: existingPayment.id,
        payment_reference: existingPayment.payment_reference,
        payment_status: existingPayment.payment_status,
        message: 'An invoice already exists for this booking.',
      })
    }

    const { amount, breakdown } = await BookingPaymentService.calculateAmount(booking as any)

    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id: bookingId,
        user_id: booking.user_id,
        amount,
        currency: 'PHP',
        payment_method: 'paymongo_card',
        payment_status: 'pending',
        description: 'Gymnasium personal booking invoice',
        metadata: {
          booking_purpose: booking.booking_purpose,
          purpose: booking.purpose,
          facility_name: facilityName,
          cost_breakdown: breakdown,
        },
      })
      .select('id, payment_reference')
      .single()

    if (paymentError || !paymentRecord) {
      console.error('[API] PATCH /bookings/[id]/approve payment insert error:', paymentError?.message)
      return NextResponse.json({ error: paymentError?.message ?? 'Failed to create payment invoice' }, { status: 500 })
    }

    await supabase
      .from('bookings')
      .update({
        approved_at: new Date().toISOString(),
        internal_notes: 'Admin approved payment-required booking; invoice has been created.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Invoice Created — Payment Required',
      message: `An invoice of ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been created for your booking ${booking.booking_reference}. Please complete payment to confirm your reservation.`,
      type: 'warning',
      source_type: 'booking',
      source_id: bookingId,
      priority: 'high',
      metadata: {
        booking_reference: booking.booking_reference,
        facility_name: facilityName ?? 'Unknown Facility',
        purpose: booking.purpose ?? booking.booking_purpose,
        amount: amount,
        status_to: 'pending_payment',
        decided_by_name: user.full_name ?? user.email,
        decided_by_role: 'Academic Head',
      },
    })

    return NextResponse.json({
      success: true,
      payment_id: paymentRecord.id,
      payment_reference: paymentRecord.payment_reference,
      message: 'Booking approved for payment and invoice created.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] PATCH /bookings/[id]/approve error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
