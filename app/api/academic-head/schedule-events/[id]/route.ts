import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { voidConflictsForSchoolEvent, timeToMinutes } from '@/backend/schedule-events/voidSchoolEventConflicts'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireAcademicHeadOrBuildingAdmin()
    if (error) return error

    const supabase = createAdminClient()
    const { id } = await params

    const body = await request.json().catch(() => ({}))
    const { action } = body

    if (action !== 'approve' && action !== 'cancel') {
        return NextResponse.json({ error: 'action must be "approve" or "cancel"' }, { status: 400 })
    }

    try {
        // Fetch event details
        const { data: event, error: fetchError } = await supabase
            .from('bookings')
            .select(`
                id, event_name, booking_date, start_time, end_time, current_status,
                booking_facilities ( facility_id )
            `)
            .eq('id', id)
            .eq('booking_type', 'school_event_block')
            .single()

        if (fetchError || !event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        if (action === 'cancel') {
            await supabase
                .from('bookings')
                .update({ current_status: 'cancelled' })
                .eq('id', id)

            return NextResponse.json({ success: true })
        }

        // action === 'approve'
        if (event.current_status !== 'pending') {
            return NextResponse.json({ error: 'Only pending events can be approved' }, { status: 400 })
        }

        await supabase
            .from('bookings')
            .update({ current_status: 'auto_approved' })
            .eq('id', id)

        const facility_ids = (event.booking_facilities ?? []).map((bf: any) => bf.facility_id)

        const { bookingsVoided, schedulesVoided } = await voidConflictsForSchoolEvent(
            supabase,
            facility_ids,
            event.booking_date,
            event.start_time,
            event.end_time,
            event.event_name,
            event.id,
        )

        return NextResponse.json({ success: true, bookingsVoided, schedulesVoided })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireAcademicHeadOrBuildingAdmin()
    if (error) return error

    const supabase = createAdminClient()
    const { id } = await params

    try {
        const { data: event, error: fetchError } = await supabase
            .from('bookings')
            .select(`
                event_name, booking_date, start_time, end_time,
                booking_facilities ( facility_id )
            `)
            .eq('id', id)
            .eq('booking_type', 'school_event_block')
            .single()

        if (fetchError || !event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        // Remove class_schedule_exceptions created by this event.
        // Use facility → schedule_id lookup to avoid matching by reason string,
        // which would incorrectly delete exceptions from other events sharing the same name/date.
        const facilityIds = (event.booking_facilities ?? []).map((bf: any) => bf.facility_id)
        if (facilityIds.length > 0) {
            const eventDate = new Date(event.booking_date)
            const dayOfWeek = eventDate.getDay()
            const eventStartM = timeToMinutes(event.start_time)
            const eventEndM = timeToMinutes(event.end_time)

            const { data: schedules } = await supabase
                .from('class_schedules')
                .select('id, day_of_week, start_time, end_time')
                .in('facility_id', facilityIds)
                .eq('is_active', true)

            const affectedScheduleIds = (schedules ?? [])
                .filter((cs: any) => {
                    const days = Array.isArray(cs.day_of_week) ? cs.day_of_week : [cs.day_of_week]
                    if (!days.includes(dayOfWeek)) return false
                    const csStartM = timeToMinutes(cs.start_time)
                    const csEndM = timeToMinutes(cs.end_time)
                    return csStartM < eventEndM && csEndM > eventStartM
                })
                .map((cs: any) => cs.id)

            if (affectedScheduleIds.length > 0) {
                await supabase
                    .from('class_schedule_exceptions')
                    .delete()
                    .in('schedule_id', affectedScheduleIds)
                    .eq('exception_date', event.booking_date)
            }
        }

        const { error: deleteError } = await supabase
            .from('bookings')
            .delete()
            .eq('id', id)
            .eq('booking_type', 'school_event_block')

        if (deleteError) throw deleteError

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
