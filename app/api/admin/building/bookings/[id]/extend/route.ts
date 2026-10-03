import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BookingPaymentService } from '@/backend/booking/paymentService'
import { checkBookingConflict } from '@/lib/bookings/check-conflict'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'
import { getErrorMessage, getErrorDetails } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  new_end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM or HH:MM:SS').transform(t => t.slice(0, 5)),
  record_payment: z.boolean().default(true),
})

const idSchema = z.string().uuid()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id: rawBookingId } = await params
  const idCheck = idSchema.safeParse(rawBookingId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }
  const bookingId = idCheck.data

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { new_end_time, record_payment } = parsed.data
  const supabase = createAdminClient()

  try {
    // 1. Fetch the booking
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select(`
        id,
        user_id,
        booking_reference,
        booking_date,
        start_time,
        end_time,
        booking_purpose,
        booking_type,
        current_status,
        requires_payment,
        is_extension,
        extension_of_booking_id,
        metadata,
        booking_facilities(facility_id, facility:facilities(id, name, facility_types(name)))
      `)
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // 2. Validate: not an extension itself
    if (booking.is_extension) {
      return NextResponse.json({ error: 'Extension bookings cannot be extended further' }, { status: 400 })
    }

    // 3. Validate: must be approved
    const approvableStatuses = ['approved', 'auto_approved']
    if (!approvableStatuses.includes(booking.current_status)) {
      return NextResponse.json({ error: 'Only approved bookings can be extended' }, { status: 400 })
    }

    // 4. Validate: must be personal/community/commercial purpose
    const paymentPurposes = ['personal', 'community', 'commercial']
    if (!paymentPurposes.includes(booking.booking_purpose)) {
      return NextResponse.json({ error: 'Only personal, community, or commercial gymnasium bookings can be extended' }, { status: 400 })
    }

    // 5. Validate: new_end_time > current end_time
    const currentEnd = booking.end_time.slice(0, 5)
    if (new_end_time <= currentEnd) {
      return NextResponse.json({ error: `New end time must be after the current end time (${currentEnd})` }, { status: 400 })
    }

    // 6. Validate: must not exceed 21:00
    if (new_end_time > '21:00') {
      return NextResponse.json({ error: 'End time cannot exceed 9:00 PM' }, { status: 400 })
    }

    // 7. Get facility ID
    const facilityData = Array.isArray(booking.booking_facilities) ? booking.booking_facilities[0] : null
    const facilityId = facilityData?.facility_id
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility information not found for this booking' }, { status: 400 })
    }

    const facilityName = (() => {
      const f = facilityData?.facility
      if (Array.isArray(f)) return f[0]?.name ?? 'Gymnasium'
      return (f as any)?.name ?? 'Gymnasium'
    })()

    // 8. Conflict check on [current_end → new_end_time]
    const conflictResult = await checkBookingConflict(supabase, {
      facility_id: facilityId,
      booking_date: booking.booking_date,
      start_time: currentEnd,
      end_time: new_end_time,
      exclude_booking_id: bookingId,
    })

    if (conflictResult.conflict) {
      return NextResponse.json({
        error: `The gymnasium is not available for the selected extension period. Conflicts with booking ${conflictResult.conflicting_booking_reference ?? 'unknown'}.`,
      }, { status: 409 })
    }

    // 9. Create extension booking record
    const { data: extensionBooking, error: insertErr } = await supabase
      .from('bookings')
      .insert({
        user_id: booking.user_id,
        booking_reference: '',
        booking_type: booking.booking_type,
        booking_purpose: booking.booking_purpose,
        booking_date: booking.booking_date,
        start_time: currentEnd,
        end_time: new_end_time,
        purpose: `Extension of booking ${booking.booking_reference}`,
        event_name: null,
        current_status: 'approved',
        requires_payment: record_payment,
        is_extension: true,
        extension_of_booking_id: bookingId,
        approved_at: new Date().toISOString(),
        metadata: booking.metadata ?? {},
        internal_notes: `Admin-initiated extension for booking ${booking.booking_reference}.`,
      })
      .select('id, booking_reference')
      .single()

    if (insertErr || !extensionBooking) {
      console.error('[API] POST /admin/building/bookings/[id]/extend insert error:', insertErr?.message)
      throw insertErr ?? new Error('Failed to create extension booking')
    }

    // 10. Link extension to same facility
    await supabase.from('booking_facilities').insert({
      booking_id: extensionBooking.id,
      facility_id: facilityId,
    })

    // 11. Update parent booking end_time
    await supabase
      .from('bookings')
      .update({ end_time: new_end_time })
      .eq('id', bookingId)

    // 12. Calculate extension cost & optionally record payment
    let paymentRecorded = false
    if (record_payment) {
      const extensionBookingData = {
        start_time: currentEnd,
        end_time: new_end_time,
        metadata: booking.metadata ?? {},
        booking_facilities: [{ facility_id: facilityId }],
      }
      const { amount } = await BookingPaymentService.calculateAmount(extensionBookingData)

      const [sh, sm] = currentEnd.split(':').map(Number)
      const [eh, em] = new_end_time.split(':').map(Number)
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
        description: `Admin extension — additional ${extensionHours.toFixed(1)} hour(s) (${currentEnd} to ${new_end_time})`,
        metadata: {
          extension_booking_id: extensionBooking.id,
          facility_name: facilityName,
          recorded_by: user!.id,
          cost_breakdown: [],
        },
      })
      paymentRecorded = true
    }

    // 13. Notify user
    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Extended by Admin',
      message: `Your booking ${booking.booking_reference} has been extended until ${new_end_time} by the Building Admin.${paymentRecorded ? ' Cash payment has been recorded.' : ''}`,
      type: 'info',
      source_type: 'booking',
      source_id: extensionBooking.id,
      priority: 'high',
    })

    // 14. Audit log
    await AdminAuditService.log({
      actorId: user!.id,
      action: 'extend_booking',
      targetType: 'booking',
      targetId: bookingId,
      details: {
        extension_booking_id: extensionBooking.id,
        previous_end_time: currentEnd,
        new_end_time,
        payment_recorded: paymentRecorded,
        facility_name: facilityName,
      },
    })

    return NextResponse.json({
      extension_booking_id: extensionBooking.id,
      extension_booking_reference: extensionBooking.booking_reference,
      parent_booking_reference: booking.booking_reference,
      extension_start_time: currentEnd,
      extension_end_time: new_end_time,
      payment_recorded: paymentRecorded,
      message: `Booking successfully extended until ${new_end_time}.${paymentRecorded ? ' Cash payment recorded.' : ''}`,
    }, { status: 201 })
  } catch (err: unknown) {
    console.error('[API] POST /admin/building/bookings/[id]/extend error:', getErrorDetails(err))
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
