import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { sanitizeDbError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

interface PreviewBody {
  day_of_week: number
  start_time: string  // HH:MM
  end_time: string    // HH:MM
  room?: string       // facility code or free-text name
  instructor?: string // full name
  section?: string
}

interface ConflictRow {
  source: 'live' | 'pending'
  match: 'room' | 'instructor' | 'section'
  course_code: string
  course_name: string | null
  section: string
  room: string | null
  instructor: string | null
  day_of_week: number
  start_time: string  // HH:MM
  end_time: string    // HH:MM
  department_code?: string | null
}

function overlaps(s1: string, e1: string, s2: string, e2: string) {
  return s1 < e2 && e1 > s2
}

function isMeaningful(v?: string | null) {
  if (!v) return false
  const upper = v.toUpperCase().trim()
  return upper.length > 0 && upper !== 'TBD' && upper !== 'TBA' && upper !== 'NONE'
}

function hhmm(t: string) {
  return t.length >= 5 ? t.slice(0, 5) : t
}

/**
 * POST /api/schedules/conflicts/preview
 *
 * Lightweight pre-submit conflict check for the manual-entry dialog.
 * Reports overlapping rows in live `class_schedules` and in pending
 * `schedule_entries_staging` that share the same day/time window AND
 * match on room (facility code), instructor name, or section.
 *
 * Does NOT write to the database — purely a read-only preview.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireProgramHead()
  if (authError) return authError

  let body: PreviewBody
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const day = Number(body.day_of_week)
  const start = hhmm(body.start_time ?? '')
  const end = hhmm(body.end_time ?? '')
  if (Number.isNaN(day) || !start || !end || start >= end) {
    return NextResponse.json({ conflicts: [] })
  }

  const room = (body.room ?? '').trim()
  const instructor = (body.instructor ?? '').trim()
  const section = (body.section ?? '').trim()

  if (!isMeaningful(room) && !isMeaningful(instructor) && !isMeaningful(section)) {
    return NextResponse.json({ conflicts: [] })
  }

  const supabase = createAdminClient()

  // Resolve the typed room to a facility_id when possible (matches by code or name).
  let facilityId: string | null = null
  if (isMeaningful(room)) {
    const { data: fac } = await supabase
      .from('facilities')
      .select('id, code, name')
      .or(`code.eq.${room},name.eq.${room}`)
      .limit(1)
      .maybeSingle()
    if (fac?.id) facilityId = fac.id as string
  }

  try {
    const [{ data: liveRows, error: liveErr }, { data: stagingRows, error: stagingErr }] = await Promise.all([
      supabase
        .from('class_schedules')
        .select(`
          id, course_code, course_name, section, day_of_week, start_time, end_time,
          instructor_name, facility_id,
          facility:facilities(code, name, room_number),
          department:departments(code)
        `)
        .eq('day_of_week', day)
        .eq('is_active', true),
      supabase
        .from('schedule_entries_staging')
        .select(`
          id, course_code, course_name, section, day_of_week, start_time, end_time,
          instructor_name, facility_id, facility_name_raw,
          facility:facilities(code, name, room_number),
          schedule_uploads!inner(department:departments(code))
        `)
        .eq('day_of_week', day)
        .in('validation_status', ['valid', 'warning']),
    ])

    if (liveErr) throw liveErr
    if (stagingErr) throw stagingErr

    const conflicts: ConflictRow[] = []

    const classify = (row: any, source: 'live' | 'pending'): 'room' | 'instructor' | 'section' | null => {
      const fac = Array.isArray(row.facility) ? row.facility[0] : row.facility
      const facCode = fac?.code ?? null
      const facName = fac?.name ?? null
      if (isMeaningful(room) && (
        (facilityId && row.facility_id === facilityId) ||
        (facCode && facCode === room) ||
        (facName && facName === room) ||
        (source === 'pending' && row.facility_name_raw && row.facility_name_raw === room)
      )) return 'room'
      if (isMeaningful(instructor) && row.instructor_name && row.instructor_name === instructor) return 'instructor'
      if (isMeaningful(section) && row.section && row.section === section) return 'section'
      return null
    }

    const pushIfOverlap = (row: any, source: 'live' | 'pending') => {
      const rs = hhmm(row.start_time ?? '')
      const re = hhmm(row.end_time ?? '')
      if (!rs || !re || !overlaps(start, end, rs, re)) return
      const match = classify(row, source)
      if (!match) return
      const fac = Array.isArray(row.facility) ? row.facility[0] : row.facility
      const deptHolder = source === 'live'
        ? (Array.isArray(row.department) ? row.department[0] : row.department)
        : (Array.isArray(row.schedule_uploads) ? row.schedule_uploads[0]?.department : row.schedule_uploads?.department)
      const dept = Array.isArray(deptHolder) ? deptHolder[0] : deptHolder
      conflicts.push({
        source,
        match,
        course_code: row.course_code ?? '',
        course_name: row.course_name ?? null,
        section: row.section ?? '',
        room: fac?.code ?? fac?.name ?? row.facility_name_raw ?? null,
        instructor: row.instructor_name ?? null,
        day_of_week: row.day_of_week,
        start_time: rs,
        end_time: re,
        department_code: dept?.code ?? null,
      })
    }

    for (const row of liveRows ?? []) pushIfOverlap(row, 'live')
    for (const row of stagingRows ?? []) pushIfOverlap(row, 'pending')

    return NextResponse.json({ conflicts })
  } catch (err) {
    return NextResponse.json({ error: sanitizeDbError(err) }, { status: 500 })
  }
}
