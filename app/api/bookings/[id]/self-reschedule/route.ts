import { NextRequest, NextResponse } from 'next/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { checkBookingConflict } from '@/lib/bookings/check-conflict'

export const dynamic = 'force-dynamic'

const Schema = z.object({
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  start_time:   z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  end_time:     z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
})

// Building admin can reschedule their own booking directly — no approval queue.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const userRoles = (user!.roles ?? []).map((r: { name: string }) => r.name)
  const isBuildingAdmin = userRoles.includes('building_admin')
  const isAcademicHead = userRoles.includes('academic_head')
  if (!isBuildingAdmin && !isAcademicHead) {
    return NextResponse.json({ error: 'Only building admins and academic heads can self-reschedule.' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
  }

  const { booking_date, start_time, end_time } = parsed.data

  if (end_time <= start_time) {
    return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  if (booking_date < today) {
    return NextResponse.json({ error: 'Cannot reschedule to a past date.' }, { status: 400 })
  }

  try {
    const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const bookingId = __idParsed.value
    const supabase = createAdminClient()

    // Load booking — must exist and belong to this admin
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, booking_date, start_time, end_time, block_event_id, booking_facilities(facility_id)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }

    if (booking.user_id !== user!.id && !isBuildingAdmin && !isAcademicHead) {
      return NextResponse.json({ error: 'You can only reschedule your own bookings.' }, { status: 403 })
    }

    const eligibleStatuses = ['approved', 'auto_approved', 'pending_user_response']
    if (!eligibleStatuses.includes(booking.current_status)) {
      return NextResponse.json(
        { error: `Booking with status '${booking.current_status}' cannot be rescheduled.` },
        { status: 400 }
      )
    }

    // Check no-op
    if (
      booking.booking_date === booking_date &&
      (booking.start_time as string)?.slice(0, 5) === start_time &&
      (booking.end_time   as string)?.slice(0, 5) === end_time
    ) {
      return NextResponse.json({ error: 'New date and time are the same as the current schedule.' }, { status: 400 })
    }

    // Conflict check at new slot
    const facilityRow = Array.isArray(booking.booking_facilities)
      ? booking.booking_facilities[0]
      : booking.booking_facilities
    const facilityId = (facilityRow as any)?.facility_id

    if (facilityId) {
      const conflict = await checkBookingConflict(supabase, {
        facility_id: facilityId,
        booking_date,
        start_time,
        end_time,
        exclude_booking_id: bookingId,
      })
      if (conflict.conflict) {
        return NextResponse.json(
          { error: `The selected time slot is already taken${(conflict as any).conflicting_booking_reference ? ` by booking ${(conflict as any).conflicting_booking_reference}` : ''}.` },
          { status: 409 }
        )
      }
    }

    // Apply reschedule directly — no approval needed for building admin
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        booking_date,
        start_time,
        end_time,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (updateError) throw updateError

    // Audit entry — best-effort; failures here must not break the reschedule response
    try {
      const adminRole = isAcademicHead ? 'academic head' : 'building admin'
      const hasBlockEvent = !!(booking as any).block_event_id
      await supabase.from('booking_overrides').insert({
        booking_id: bookingId,
        override_type: hasBlockEvent ? 'admin_reschedule_post_block' : 'reschedule',
        performed_by: user!.id,
        notes: `Rescheduled by ${adminRole} from ${booking.booking_date} ${(booking.start_time as string)?.slice(0, 5)}–${(booking.end_time as string)?.slice(0, 5)} to ${booking_date} ${start_time}–${end_time}`,
      })
    } catch {}

    // Self-notification — best-effort
    try {
      await supabase.from('notifications').insert({
        user_id: user!.id,
        title: 'Booking Rescheduled',
        message: `Your booking ${booking.booking_reference} has been rescheduled to ${booking_date} (${start_time}–${end_time}).`,
        type: 'success',
        source_type: 'booking',
        source_id: bookingId,
        priority: 'normal',
        read: false,
        metadata: { booking_reference: booking.booking_reference, new_date: booking_date, new_start: start_time, new_end: end_time },
      })
    } catch {}

    return NextResponse.json({
      success: true,
      booking_reference: booking.booking_reference,
      booking_date,
      start_time,
      end_time,
      message: 'Booking rescheduled successfully.',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    console.error('[self-reschedule]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
