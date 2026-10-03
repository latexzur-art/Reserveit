import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { createGroup } from '@/backend/schedule-events/scheduleEventGroupActions'
import { getScheduleEventGroups, type ScheduleEventGroupFilters } from '@/backend/schedule-events/getScheduleEventGroups'
import { resolveActorRole } from '@/backend/schedule-events/scheduleEventGroupHelpers'
import type { ScheduleEventMode } from '@/backend/schedule-events/createScheduleEventGroup'

export async function GET(request: NextRequest) {
    const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

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
        const events = await getScheduleEventGroups(supabase, filters, { publicView: false })
        return NextResponse.json({ events })
    } catch (err: any) {
        console.error('School events GET error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const { error, user } = await requireAcademicHeadOrBuildingAdmin()
    if (error) return error

    const supabase = createAdminClient()

    try {
        const body = await request.json()
        const { event_name, mode, start_date, end_date, start_time, end_time, facility_ids, all_facilities } = body
        const dates: string[] = Array.isArray(body.dates) ? body.dates : []

        if (start_date && dates.length === 0) {
            const last = end_date || start_date
            let current = new Date(start_date)
            const lastDate = new Date(last)
            while (current <= lastDate) {
                dates.push(current.toISOString().split('T')[0])
                current.setDate(current.getDate() + 1)
            }
        }

        const hasFacilities = all_facilities === true || (Array.isArray(facility_ids) && facility_ids.length > 0)

        if (!event_name || dates.length === 0 || !hasFacilities) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const actorRole = resolveActorRole(user!)
        const requesterName = user!.full_name ?? user!.email ?? 'User'

        const result = await createGroup(
            supabase,
            {
                mode: (mode as ScheduleEventMode) ?? 'school_event',
                event_name,
                facility_ids: all_facilities ? undefined : facility_ids,
                all_facilities: all_facilities === true,
                dates,
                start_time: start_time || '00:00',
                end_time: end_time || '23:59',
                userId: user!.id,
                actorRole,
            },
            requesterName
        )

        return NextResponse.json({
            success: true,
            group_id: result.group_id,
            eventsCount: result.eventsCount,
            bookingsVoided: result.bookingsVoided,
            schedulesVoided: result.schedulesVoided,
            status: result.status,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
