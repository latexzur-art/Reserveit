import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const BodySchema = z.object({
  facility_ids: z.array(z.uuid()).min(1),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).default('00:00'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).default('23:59'),
})

/**
 * POST /api/academic-head/schedule-events/preview-conflicts
 * Returns the bookings and class schedules that would be displaced by a school event.
 * Read-only — does not create or modify anything.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const { facility_ids, dates, start_time, end_time } = parsed.data
  const eventStartM = timeToMinutes(start_time)
  const eventEndM = timeToMinutes(end_time)
  const supabase = createAdminClient()

  try {
    const allBookings: any[] = []
    const allSchedules: any[] = []

    // Build facility → booking_id links
    const { data: facilityBookingLinks } = await supabase
      .from('booking_facilities')
      .select('booking_id, facility_id')
      .in('facility_id', facility_ids)

    const linkMap = new Map<string, string>()
    for (const l of facilityBookingLinks ?? []) {
      linkMap.set(l.booking_id, l.facility_id)
    }
    const facilityBookingIds = [...linkMap.keys()]

    // Find all active bookings for these facilities (we'll filter by date/time in JS)
    let bookingsData: any[] = []
    if (facilityBookingIds.length > 0) {
      const { data } = await supabase
        .from('bookings')
        .select('id, booking_reference, booking_date, start_time, end_time, purpose, current_status, users(full_name), booking_facilities(facilities(name))')
        .in('id', facilityBookingIds)
        .neq('booking_purpose', 'school_event')
        .in('current_status', ['pending', 'approved', 'auto_approved', 'flagged'])
      bookingsData = data ?? []
    }

    // Find class schedules for these facilities
    const { data: schedulesData } = await supabase
      .from('class_schedules')
      .select('id, day_of_week, start_time, end_time, instructor_name, course_code, course_name, section, facility_id, facilities(name)')
      .in('facility_id', facility_ids)
      .eq('is_active', true)

    for (const date of dates) {
      const dayOfWeek = new Date(`${date}T00:00:00`).getDay()

      // Filter bookings by date and time overlap
      const dateBookings = bookingsData.filter((b: any) => {
        if (b.booking_date !== date) return false
        const bStartM = timeToMinutes(b.start_time)
        const bEndM = timeToMinutes(b.end_time)
        return bStartM < eventEndM && bEndM > eventStartM
      })

      for (const b of dateBookings) {
        allBookings.push({
          id: b.id,
          booking_reference: b.booking_reference,
          user_name: (b.users as any)?.full_name ?? 'Unknown',
          date,
          start_time: b.start_time?.slice(0, 5),
          end_time: b.end_time?.slice(0, 5),
          facility_name: (b.booking_facilities as any)?.[0]?.facilities?.name ?? 'N/A',
          purpose: b.purpose,
          current_status: b.current_status,
        })
      }

      // Filter class schedules by day of week and time overlap
      const dateSchedules = (schedulesData ?? []).filter((cs: any) => {
        const days = Array.isArray(cs.day_of_week) ? cs.day_of_week : [cs.day_of_week]
        if (!days.includes(dayOfWeek)) return false
        const csStartM = timeToMinutes(cs.start_time)
        const csEndM = timeToMinutes(cs.end_time)
        return csStartM < eventEndM && csEndM > eventStartM
      })

      for (const cs of dateSchedules) {
        allSchedules.push({
          id: cs.id,
          course_code: cs.course_code ?? cs.course_name ?? 'N/A',
          section: cs.section ?? '',
          instructor_name: cs.instructor_name ?? 'N/A',
          date,
          start_time: cs.start_time?.slice(0, 5),
          end_time: cs.end_time?.slice(0, 5),
          facility_name: (cs.facilities as any)?.name ?? 'N/A',
        })
      }
    }

    // Deduplicate by id + date
    const uniqueBookings = [...new Map(allBookings.map(b => [`${b.id}-${b.date}`, b])).values()]
    const uniqueSchedules = [...new Map(allSchedules.map(s => [`${s.id}-${s.date}`, s])).values()]

    return NextResponse.json({
      bookings: uniqueBookings,
      class_schedules: uniqueSchedules,
      summary: {
        bookings_count: uniqueBookings.length,
        schedules_count: uniqueSchedules.length,
      },
    })
  } catch (err: any) {
    console.error('[API] POST preview-conflicts error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
