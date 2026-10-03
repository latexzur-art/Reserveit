/**
 * GET /api/schedules/review/[uploadId]/impact
 * Academic Head: preview which bookings would be cancelled if this upload is published.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ uploadId: string }> },
) {
    const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const { uploadId } = await params
    const supabase = createAdminClient()

    // Get upload metadata
    const { data: upload } = await supabase
        .from('schedule_uploads')
        .select('academic_term_id, batch_effective_date, batch_effective_end_date')
        .eq('id', uploadId)
        .single()

    if (!upload) {
        return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }

    const { data: term } = await supabase
        .from('academic_terms')
        .select('start_date, end_date')
        .eq('id', upload.academic_term_id)
        .single()

    // Get all approved entries
    const { data: entries } = await supabase
        .from('schedule_entries_staging')
        .select('*, facilities(name)')
        .eq('schedule_upload_id', uploadId)
        .eq('academic_head_review_status', 'academic_head_approved')
        .not('facility_id', 'is', null)

    if (!entries || entries.length === 0) {
        return NextResponse.json({ total_affected: 0, affected_bookings: [] })
    }

    interface AffectedBooking {
        booking_id: string
        booking_title: string
        booking_date: string
        start_time: string
        end_time: string
        booked_by_name: string
        facility_name: string
        current_status: string
        conflict_course: string
        conflict_section: string
    }

    const affected: AffectedBooking[] = []
    const seen = new Set<string>()

    for (const entry of entries) {
        const effectiveStart = entry.effective_start_date
            ?? upload.batch_effective_date
            ?? term?.start_date
        const effectiveEnd = entry.effective_end_date
            ?? upload.batch_effective_end_date
            ?? term?.end_date

        if (!effectiveStart || !effectiveEnd) continue

        const { data: bookings } = await supabase
            .from('booking_facilities')
            .select(`
        facility_id,
        facilities(name),
        bookings!inner(
          id, booking_title, booking_date, start_time, end_time, current_status,
          users!bookings_user_id_fkey(full_name)
        )
      `)
            .eq('facility_id', entry.facility_id)
            .in('bookings.current_status', ['pending', 'approved'])

        if (!bookings) continue

        for (const bf of bookings) {
            const booking: any = Array.isArray(bf.bookings) ? bf.bookings[0] : bf.bookings
            if (!booking || seen.has(booking.id)) continue

            const bookingDate = new Date(booking.booking_date)
            const dow = bookingDate.getUTCDay()
            if (dow !== entry.day_of_week) continue
            if (booking.booking_date < effectiveStart || booking.booking_date > effectiveEnd) continue
            if (!(booking.start_time < entry.end_time && booking.end_time > entry.start_time)) continue

            const facilityData: any = Array.isArray(bf.facilities) ? bf.facilities[0] : bf.facilities
            const userData: any = Array.isArray(booking.users) ? booking.users[0] : booking.users

            seen.add(booking.id)
            affected.push({
                booking_id: booking.id,
                booking_title: booking.booking_title ?? 'Untitled',
                booking_date: booking.booking_date,
                start_time: booking.start_time,
                end_time: booking.end_time,
                booked_by_name: userData?.full_name ?? 'Unknown',
                facility_name: facilityData?.name ?? 'Unknown',
                current_status: booking.current_status,
                conflict_course: entry.course_code,
                conflict_section: entry.section,
            })
        }
    }

    return NextResponse.json({
        total_affected: affected.length,
        affected_bookings: affected,
    })
}
