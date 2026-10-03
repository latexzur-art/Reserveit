/**
 * POST /api/schedules/review/[uploadId]/suggest-facility
 * Automatically picks the best available facility for a problematic staging entry
 * (unmatched or low-confidence) and applies it in-place.
 *
 * Scoring:
 *   +2  — facility name/type keyword matches a hint inferred from facility_name_raw
 *   +1  — facility name contains a substring from facility_name_raw
 * Ties broken alphabetically by facility name.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedInternal } from '@/lib/auth/guards'
import { parseUuidParam } from '@/lib/api/validate-uuid'

// ── Type-hint keyword map ────────────────────────────────
// Maps regex patterns on the raw CSV name → keywords to look for in facility names
const TYPE_HINTS: [RegExp, string[]][] = [
    [/\blab\b|computer|cl\d|comp\s*lab/i,       ['computer', 'laboratory', 'lab']],
    [/gym|gymnasium|court|field|outdoor/i,       ['gymnasium', 'gym', 'court', 'field', 'outdoor', 'sports']],
    [/audio|avr|audio.?visual|av\s*room/i,       ['audio', 'visual', 'avr', 'av']],
    [/room|cr\b|classroom|lecture|hall/i,        ['room', 'classroom', 'lecture', 'hall']],
    [/library|lib\b/i,                           ['library', 'lib']],
    [/clinic|infirmary/i,                        ['clinic', 'infirmary', 'health']],
    [/canteen|cafeteria|caf\b/i,                 ['canteen', 'cafeteria']],
    [/chapel|oratory/i,                          ['chapel', 'oratory']],
]

function scoreCandidate(facilityName: string, rawName: string, typeHints: string[]): number {
    const fn = facilityName.toLowerCase()
    const rn = rawName.toLowerCase()
    let score = 0

    // Type-hint match: +2
    if (typeHints.some(kw => fn.includes(kw))) score += 2

    // Substring match: +1
    if (rn.length >= 3 && fn.includes(rn)) score += 1

    return score
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    return toMin(aStart) < toMin(bEnd) && toMin(aEnd) > toMin(bStart)
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ uploadId: string }> }
) {
    const { error: authError } = await requireAuthenticatedInternal()
    if (authError) return authError

    const { uploadId: rawUploadId } = await params
    const idParse = parseUuidParam(rawUploadId, 'upload id')
    if (!idParse.ok) return idParse.response
    const uploadId = idParse.value
    const supabase = createAdminClient()

    const body = await request.json()
    const { entry_id } = body

    if (!entry_id) {
        return NextResponse.json({ error: 'entry_id is required' }, { status: 400 })
    }

    // ── Fetch the staging entry ──────────────────────────
    const { data: entry, error: entryErr } = await supabase
        .from('schedule_entries_staging')
        .select('id, facility_name_raw, day_of_week, start_time, end_time, validation_errors, validation_warnings, validation_status')
        .eq('id', entry_id)
        .eq('schedule_upload_id', uploadId)
        .single()

    if (entryErr || !entry) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const { facility_name_raw, day_of_week, start_time, end_time } = entry

    if (!start_time || !end_time) {
        return NextResponse.json({ error: 'Entry has no time slot — fix times first' }, { status: 400 })
    }

    const startSlice = (start_time as string).slice(0, 5)
    const endSlice = (end_time as string).slice(0, 5)
    const day = day_of_week as number

    // ── Get booked ranges for this day ───────────────────
    const [{ data: classSchedules }, { data: stagingEntries }] = await Promise.all([
        supabase
            .from('class_schedules')
            .select('facility_id, start_time, end_time')
            .eq('day_of_week', day)
            .eq('is_active', true)
            .not('facility_id', 'is', null),
        supabase
            .from('schedule_entries_staging')
            .select('id, facility_id, start_time, end_time')
            .eq('day_of_week', day)
            .not('facility_id', 'is', null)
            .not('start_time', 'is', null)
            .not('end_time', 'is', null)
            .neq('id', entry_id), // exclude self
    ])

    type Range = { facility_id: string; start: string; end: string }
    const bookedRanges: Range[] = [
        ...(classSchedules ?? []).map(r => ({
            facility_id: r.facility_id as string,
            start: (r.start_time as string).slice(0, 5),
            end: (r.end_time as string).slice(0, 5),
        })),
        ...(stagingEntries ?? []).map(r => ({
            facility_id: r.facility_id as string,
            start: (r.start_time as string).slice(0, 5),
            end: (r.end_time as string).slice(0, 5),
        })),
    ].filter(r => r.facility_id && r.start && r.end)

    // ── Fetch all facilities ─────────────────────────────
    const { data: facilities } = await supabase
        .from('facilities')
        .select('id, name, room_number')
        .eq('status', 'available')
        .order('name')

    if (!facilities?.length) {
        return NextResponse.json({ error: 'No facilities found' }, { status: 404 })
    }

    // ── Filter to available at this slot ─────────────────
    const available = facilities.filter(f =>
        !bookedRanges.some(r => r.facility_id === f.id && overlaps(startSlice, endSlice, r.start, r.end))
    )

    if (available.length === 0) {
        return NextResponse.json({ error: 'No available facilities for this time slot' }, { status: 404 })
    }

    // ── Infer type hints from raw name ───────────────────
    const raw = facility_name_raw as string ?? ''
    let typeHints: string[] = []
    for (const [pattern, hints] of TYPE_HINTS) {
        if (pattern.test(raw)) { typeHints = hints; break }
    }

    // ── Score and rank ───────────────────────────────────
    const scored = available
        .map(f => ({ ...f, score: scoreCandidate(f.name as string, raw, typeHints) }))
        .sort((a, b) => b.score - a.score || (a.name as string).localeCompare(b.name as string))

    const pick = scored[0]
    const alternatives = scored.slice(1, 5)

    // ── Patch the staging entry ───────────────────────────
    // Remove facility-related errors/warnings, recompute validation_status
    const prevErrors: any[] = (entry.validation_errors as any[]) ?? []
    const prevWarnings: any[] = (entry.validation_warnings as any[]) ?? []
    const facilityErrorCodes = ['FACILITY_NOT_FOUND', 'LOW_FACILITY_CONFIDENCE']

    const newErrors = prevErrors.filter((e: any) => !facilityErrorCodes.includes(e.code))
    const newWarnings = prevWarnings.filter((w: any) => !facilityErrorCodes.includes(w.code))
    const newStatus = newErrors.length > 0 ? 'error' : newWarnings.length > 0 ? 'warning' : 'valid'

    const { error: patchErr } = await supabase
        .from('schedule_entries_staging')
        .update({
            facility_id: pick.id,
            facility_name_raw: pick.name,
            facility_match_confidence: 1.0,
            validation_errors: newErrors,
            validation_warnings: newWarnings,
            validation_status: newStatus,
        })
        .eq('id', entry_id)

    if (patchErr) {
        console.error('suggest-facility patch error:', patchErr)
        return NextResponse.json({ error: 'Failed to apply suggestion' }, { status: 500 })
    }

    return NextResponse.json({
        facility: { id: pick.id, name: pick.name, room_number: pick.room_number },
        alternatives: alternatives.map(f => ({ id: f.id, name: f.name, room_number: f.room_number })),
        validation_status: newStatus,
    })
}
