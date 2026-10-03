import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { getScheduleEventGroups, type ScheduleEventGroupFilters } from '@/backend/schedule-events/getScheduleEventGroups'

/**
 * Read-only, any-logged-in-role view of School Events / Exam Period blocks (spec §8's "viewer"
 * tier: faculty, external_client, program_head, it_admin, pamo_officer). Delegates to the same
 * grouped-read function as the privileged endpoint with publicView: true, which strips
 * booking_ids/created_by_name and defaults to auto_approved-only.
 */
export async function GET(request: NextRequest) {
    const { error } = await requireAuthenticatedUser()
    if (error) return error

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const filters: ScheduleEventGroupFilters = {
        status: searchParams.get('status') ?? undefined,
        block_category: searchParams.get('block_category') ?? undefined,
        facility_id: searchParams.get('facility_id') ?? undefined,
        start_date: searchParams.get('start_date') ?? undefined,
        end_date: searchParams.get('end_date') ?? undefined,
    }

    try {
        const events = await getScheduleEventGroups(supabase, filters, { publicView: true })
        return NextResponse.json({ events })
    } catch (err: any) {
        console.error('Upcoming school events GET error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
