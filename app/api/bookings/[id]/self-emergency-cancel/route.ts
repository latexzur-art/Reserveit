import { NextRequest, NextResponse } from 'next/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { creditService } from '@/backend/credits/creditService'

export const dynamic = 'force-dynamic'

const Schema = z.object({
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)').max(2000),
})

// Building admin emergency-cancels their own paid booking and receives a session credit
// equal to the completed payment amount — no admin review required.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const isBuildingAdmin = (user!.roles ?? []).some((r: { name: string }) => r.name === 'building_admin')
  if (!isBuildingAdmin) {
    return NextResponse.json({ error: 'Only building admins can use this endpoint.' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
  }

  const { reason } = parsed.data

  try {
    const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const bookingId = __idParsed.value
    const supabase = createAdminClient()

    // Load booking — must exist, belong to this admin, be a paid type with completed payment
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, booking_type, requires_payment, booking_facilities(facility_id, facilities(name))')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }

    if (booking.user_id !== user!.id) {
      return NextResponse.json({ error: 'You can only cancel your own bookings.' }, { status: 403 })
    }

    const isPaidType = ['internal_paid', 'external_paid'].includes((booking as any).booking_type)
    const paymentCompleted = !(booking as any).requires_payment
    if (!isPaidType || !paymentCompleted) {
      return NextResponse.json(
        { error: 'Emergency cancellation with credit is only available for bookings with a completed payment.' },
        { status: 400 }
      )
    }

    const eligibleStatuses = ['approved', 'auto_approved']
    if (!eligibleStatuses.includes(booking.current_status)) {
      return NextResponse.json(
        { error: `Booking with status '${booking.current_status}' is not eligible for emergency cancellation.` },
        { status: 400 }
      )
    }

    // Find the completed payment to determine credit amount
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, amount, payment_status, payment_type')
      .eq('booking_id', bookingId)
      .eq('payment_status', 'completed')
      .eq('payment_type', 'booking')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: 'No completed payment found for this booking.' },
        { status: 400 }
      )
    }

    const amountCentavos = Math.round(Number((payment as any).amount) * 100)
    if (amountCentavos <= 0) {
      return NextResponse.json({ error: 'Payment amount is invalid.' }, { status: 400 })
    }

    const facilityRow = Array.isArray(booking.booking_facilities)
      ? booking.booking_facilities[0]
      : booking.booking_facilities
    const facilityName = (facilityRow?.facilities as { name?: string } | null)?.name ?? 'Facility'

    // Cancel the booking
    await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_new_status: 'cancelled',
      p_changed_by_user_id: user!.id,
      p_changed_by_ai: false,
      p_reason: `Emergency cancellation by building admin: ${reason}`,
      p_metadata: { source: 'self_emergency_cancel', cancellation_type: 'admin_cancelled' },
    })

    await supabase
      .from('bookings')
      .update({
        cancellation_type: 'admin_cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    // Issue session credit equal to full payment amount
    await creditService.issueCredit({
      userId: user!.id,
      amountCentavos,
      source: 'force_majeure',
      sourceBookingId: bookingId,
      issuedBy: user!.id,
      reason: `Emergency cancellation credit for booking ${booking.booking_reference} (${facilityName}): ${reason}`,
      sendNotifications: true,
    })

    return NextResponse.json({
      success: true,
      booking_reference: (booking as any).booking_reference,
      credit_issued_centavos: amountCentavos,
      message: `Booking cancelled. A session credit of ₱${(amountCentavos / 100).toFixed(2)} has been added to your account.`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[self-emergency-cancel]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
