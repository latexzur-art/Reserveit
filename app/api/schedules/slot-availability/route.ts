import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
function timeToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
}

function minutesToTime(minutes: number) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Standard 30-min slots from 07:00 to 21:00 */
function generateStartSlots(): string[] {
    const slots: string[] = []
    for (let min = 7 * 60; min < 21 * 60; min += 30) {
        slots.push(minutesToTime(min))
    }
    return slots
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return timeToMinutes(aStart) < timeToMinutes(bEnd) &&
        timeToMinutes(aEnd) > timeToMinutes(bStart)
}

/**
 * GET /api/schedules/slot-availability
 *
 * Returns facility availability for a given day+time, or time slot availability for a day+facility.
 *
 * Mode A — facilities for a time slot:
 *   ?day_of_week=2&start_time=10:30&end_time=13:30&exclude_entry_id=xxx
 *   → { facilities: [{ id, name, room_number, available }] }
 *
 * Mode B — time slots for a facility:
 *   ?day_of_week=2&facility_id=xxx&exclude_entry_id=xxx
 *   → { slots: [{ start_time, available }] }
 */
export async function GET(req: NextRequest) {
    const { error: authError } = await requireProgramHead()
    if (authError) return authError

    const { searchParams } = new URL(req.url)
    const dayOfWeek = searchParams.get('day_of_week')
    const startTime = searchParams.get('start_time')   // HH:MM
    const endTime = searchParams.get('end_time')       // HH:MM
    const facilityId = searchParams.get('facility_id')
    const excludeEntryId = searchParams.get('exclude_entry_id')

    const instructorId = searchParams.get('instructor_id')
    const instructorName = searchParams.get('instructor_name_raw')
    const section = searchParams.get('section')

    if (dayOfWeek === null) {
        return NextResponse.json({ error: 'day_of_week is required' }, { status: 400 })
    }

    const day = parseInt(dayOfWeek)
    const supabase = createAdminClient()

    // Collect all booked ranges for the given day
    const [{ data: classSchedules }, { data: stagingEntries }] = await Promise.all([
        supabase
            .from('class_schedules')
            .select('facility_id, start_time, end_time, section, instructor_id, instructor_name')
            .eq('day_of_week', day)
            .eq('is_active', true), // Ensure we only check active live schedules
        (() => {
            let q = supabase
                .from('schedule_entries_staging')
                .select('id, facility_id, start_time, end_time, section, instructor_id, instructor_name')
                .eq('day_of_week', day)
                .not('start_time', 'is', null)
                .not('end_time', 'is', null)
            if (excludeEntryId) q = q.neq('id', excludeEntryId)
            return q
        })(),
    ])

    type BookedRange = { 
        facility_id: string | null; 
        start: string; 
        end: string;
        section: string | null;
        instructor_id: string | null;
        instructor_name: string | null;
    }
    
    const bookedRanges: BookedRange[] = [
        ...(classSchedules ?? []),
        ...(stagingEntries ?? [])
    ].filter(r => r.start_time && r.end_time).map(r => ({
        facility_id: r.facility_id as string | null,
        start: (r.start_time as string).slice(0, 5),
        end: (r.end_time as string).slice(0, 5),
        section: r.section as string | null,
        instructor_id: r.instructor_id as string | null,
        instructor_name: r.instructor_name as string | null,
    }))

    // Helper to check if a specific time slot is blocked by section or instructor
    const isSlotBlockedByEntity = (start: string, end: string) => {
        return bookedRanges.some(r => {
            if (!overlaps(start, end, r.start, r.end)) return false
            
            if (section && r.section === section) return true
            
            if (instructorId && r.instructor_id === instructorId) return true
            
            if (instructorName && r.instructor_name === instructorName) return true
            
            return false
        })
    }

    // Mode A: return facilities with availability for a given time range
    if (startTime && endTime && !facilityId) {
        // If the section or instructor is busy, NO facilities are available for this specific entity
        if (isSlotBlockedByEntity(startTime, endTime)) {
            return NextResponse.json({ facilities: [] })
        }

        const { data: facilities } = await supabase
            .from('facilities')
            .select('id, name, room_number, code')
            .eq('status', 'available')

        const floorPriority = (code: string) => {
            if (code.startsWith('GF-')) return 0
            const m = code.match(/^(\d+)F-/)
            return m ? parseInt(m[1]) : 99
        }

        const sorted = (facilities ?? []).slice().sort((a, b) => {
            const fp = floorPriority(a.code) - floorPriority(b.code)
            if (fp !== 0) return fp
            const na = parseInt(a.room_number) || 9999
            const nb = parseInt(b.room_number) || 9999
            if (na !== nb) return na - nb
            return a.name.localeCompare(b.name)
        })

        const result = sorted.map(f => ({
            id: f.id as string,
            name: f.name as string,
            room_number: f.room_number as string,
            available: !bookedRanges.some(r => r.facility_id === f.id && overlaps(startTime, endTime, r.start, r.end)),
        }))

        return NextResponse.json({ facilities: result })
    }

    // Mode B: return time slot availability for a given facility
    if (facilityId) {
        const facilityRanges = bookedRanges.filter(r => r.facility_id === facilityId)
        const startSlots = generateStartSlots()

        const slots = startSlots.map(start => {
            const endMins = timeToMinutes(start) + 30 // Rough assumption, though this API is usually called just for start times
            const end = minutesToTime(endMins)

            // A start slot overlaps a booked range if it falls within it
            const facilityAvailable = !facilityRanges.some(r => {
                const slotMin = timeToMinutes(start)
                const rangeStart = timeToMinutes(r.start)
                const rangeEnd = timeToMinutes(r.end)
                return slotMin >= rangeStart && slotMin < rangeEnd
            })

            // If we're looking for a specific section/instructor's availability, check them too
            // Note: Since Mode B just checks 30min slots, we check the exact 30min block
            const entityAvailable = !isSlotBlockedByEntity(start, end)

            return {
                start_time: start,
                available: facilityAvailable && entityAvailable,
            }
        })

        return NextResponse.json({ slots })
    }

    return NextResponse.json({ error: 'Provide start_time+end_time or facility_id' }, { status: 400 })
}
