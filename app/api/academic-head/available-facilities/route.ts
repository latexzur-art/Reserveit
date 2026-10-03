import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { checkTimeSlotAvailability } from '@/backend/booking'

/**
 * GET /api/academic-head/available-facilities
 * Returns all active facilities with their availability status for a given date + time range.
 * Used by the Propose Changes and Mismatch Review flows so the academic head
 * can only select facilities that are actually free.
 */
export async function GET(request: NextRequest) {
    const { error, user } = await requireAuthenticatedUser()
    if (error) return error

    const hasRole = user.roles?.some((r: { name: string }) => r.name === 'academic_head')
    if (!hasRole) {
        return NextResponse.json({ error: 'Forbidden: academic_head role required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startTime = searchParams.get('start_time')
    const endTime = searchParams.get('end_time')

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'Required: date (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
        return NextResponse.json({ error: 'Required: start_time (HH:MM)' }, { status: 400 })
    }
    if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) {
        return NextResponse.json({ error: 'Required: end_time (HH:MM)' }, { status: 400 })
    }

    const supabase = createAdminClient()

    try {
        // Fetch all active facilities with their location info
        const { data: facilities, error: fetchError } = await supabase
            .from('facilities')
            .select(`
        id, name, room_number, is_active, status,
        floors(floor_number, buildings(name))
      `)
            .eq('is_active', true)
            .eq('status', 'available')
            .order('name')

        if (fetchError) throw fetchError

        // Check availability for each facility in parallel
        const results = await Promise.all(
            (facilities ?? []).map(async (f: any) => {
                const check = await checkTimeSlotAvailability(supabase, f.id, date, startTime, endTime)
                const floor = Array.isArray(f.floors) ? f.floors[0] : f.floors
                const building = floor?.buildings
                    ? (Array.isArray(floor.buildings) ? floor.buildings[0] : floor.buildings)
                    : null

                return {
                    id: f.id,
                    name: f.name,
                    room_number: f.room_number,
                    floor_number: floor?.floor_number ?? null,
                    building_name: building?.name ?? null,
                    is_available: check.available,
                    conflict_reason: check.conflicts?.[0] ?? null,
                }
            })
        )

        return NextResponse.json({ facilities: results })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[API] GET /academic-head/available-facilities error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
