import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { getErrorMessage, getErrorDetails } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const ExtendSchema = z.object({
  new_end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM or HH:MM:SS').transform(t => t.slice(0, 5)),
})
const idSchema = z.uuid()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { id: rawParentBookingId } = await params
  const idCheck = idSchema.safeParse(rawParentBookingId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }
  const parentBookingId = idCheck.data

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ExtendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { new_end_time } = parsed.data
  const supabase = createAdminClient()

  try {
    // Fetch the parent booking
    const { data: parent, error: parentErr } = await supabase
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
        metadata,
        booking_facilities(facility_id, facility:facilities(id, name, facility_types(name)))
      `)
      .eq('id', parentBookingId)
      .single()

    if (parentErr || !parent) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Must own the booking
    if (parent.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only gym personal/community/commercial bookings can be extended
    const paymentPurposes = ['personal', 'community', 'commercial']
    if (!paymentPurposes.includes(parent.booking_purpose)) {
      return NextResponse.json({ error: 'Only personal, community, or commercial gymnasium bookings can be extended' }, { status: 400 })
    }

    // Cannot extend an extension booking
    if (parent.is_extension) {
      return NextResponse.json({ error: 'Extension bookings cannot be extended further' }, { status: 400 })
    }

    // Parent must be approved
    const approvableStatuses = ['approved', 'auto_approved']
    if (!approvableStatuses.includes(parent.current_status)) {
      return NextResponse.json({ error: 'Only approved bookings can be extended' }, { status: 400 })
    }

    // Parent payment must be completed
    const { data: payment } = await supabase
      .from('payments')
      .select('id, payment_status')
      .eq('booking_id', parentBookingId)
      .eq('payment_type', 'booking')
      .eq('payment_status', 'completed')
      .limit(1)
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'Original booking payment must be completed before extending' }, { status: 400 })
    }

    // new_end_time must be after parent's current end_time
    const currentEnd = parent.end_time.slice(0, 5)
    if (new_end_time <= currentEnd) {
      return NextResponse.json({ error: `New end time must be after the current end time (${currentEnd})` }, { status: 400 })
    }

    // Must not exceed 21:00 (9 PM)
    if (new_end_time > '21:00') {
      return NextResponse.json({ error: 'End time cannot exceed 9:00 PM' }, { status: 400 })
    }

    // Get the facility ID
    const facilityData = Array.isArray(parent.booking_facilities) ? parent.booking_facilities[0] : null
    const facilityId = facilityData?.facility_id
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility information not found for this booking' }, { status: 400 })
    }

    // Availability check: ensure [current_end_time → new_end_time] on the same date is free
    const { data: conflicts } = await supabase
      .from('booking_facilities')
      .select('booking_id, bookings!inner(id, start_time, end_time, current_status, booking_date)')
      .eq('facility_id', facilityId)
      .eq('bookings.booking_date', parent.booking_date)
      .in('bookings.current_status', ['pending', 'approved', 'auto_approved', 'flagged'])
      .neq('bookings.id', parentBookingId) // exclude parent booking

    const hasConflict = (conflicts ?? []).some((row: any) => {
      const existing = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
      if (!existing) return false
      const eStart = existing.start_time.slice(0, 5)
      const eEnd = existing.end_time.slice(0, 5)
      // Conflict if [currentEnd, newEnd) overlaps [eStart, eEnd)
      return eStart < new_end_time && eEnd > currentEnd
    })

    if (hasConflict) {
      return NextResponse.json({ error: 'The gymnasium is not available for the selected extension period. Another booking conflicts with the requested time.' }, { status: 409 })
    }

    // Create extension booking record
    const { data: extensionBooking, error: insertErr } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        booking_reference: '',
        booking_type: parent.booking_type,
        booking_purpose: parent.booking_purpose,
        booking_date: parent.booking_date,
        start_time: currentEnd,
        end_time: new_end_time,
        purpose: `Extension of booking ${parent.booking_reference}`,
        event_name: null,
        current_status: 'pending',
        requires_payment: true,
        is_extension: true,
        extension_of_booking_id: parentBookingId,
        metadata: parent.metadata ?? {},
        internal_notes: `Extension request for booking ${parent.booking_reference}. Awaiting building head approval.`,
      })
      .select('id, booking_reference')
      .single()

    if (insertErr || !extensionBooking) {
      console.error('[API] POST /bookings/[id]/extend insert error:', insertErr?.message)
      throw insertErr ?? new Error('Failed to create extension booking')
    }

    // Link extension booking to the same facility
    await supabase.from('booking_facilities').insert({
      booking_id: extensionBooking.id,
      facility_id: facilityId,
    })

    // Notify building admins
    await sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Booking Extension Request',
      message: `An internal user has requested a time extension for gymnasium booking ${parent.booking_reference} until ${new_end_time}.`,
      type: 'warning',
      source_type: 'booking',
      source_id: extensionBooking.id,
      priority: 'high',
    })

    return NextResponse.json({
      status: 'pending',
      extension_booking_id: extensionBooking.id,
      extension_booking_reference: extensionBooking.booking_reference,
      parent_booking_reference: parent.booking_reference,
      extension_start_time: currentEnd,
      extension_end_time: new_end_time,
      requires_payment: true,
      message: 'Extension request submitted. Building head will review and approve before payment.',
    }, { status: 201 })
  } catch (err: unknown) {
    console.error('[API] POST /bookings/[id]/extend error:', getErrorDetails(err))
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

// GET: return extension bookings for a parent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { id: parentBookingId } = await params
  const supabase = createAdminClient()

  try {
    const { data: extensions, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, booking_reference, start_time, end_time, current_status, created_at')
      .eq('extension_of_booking_id', parentBookingId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchErr) throw fetchErr

    return NextResponse.json({ extensions: extensions ?? [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
