/**
 * Conflict Detector
 * Detects internal, cross-department, and external conflicts for staging entries.
 * @module backend/schedule/conflictDetector
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConflictInfo } from './schedule.types'

export function timesOverlap(
  s1: string, e1: string,
  s2: string, e2: string
): boolean {
  return s1 < e2 && e1 > s2
}

/**
 * True when a name field is a real value, not a "no instructor"/"no facility"
 * sentinel. Shared so the availability helper and find-unassigned queries agree
 * with conflict detection on the sentinel set.
 */
export function isValidFallback(val?: string | null) {
  if (!val) return false
  const upper = val.toUpperCase().trim()
  if (upper === 'TBD' || upper === 'TBA' || upper === 'NONE' || upper === '') return false
  return true
}

/** A class_schedules-shaped row is Unassigned when it has no instructor_id and a sentinel name. */
export function isUnassigned(row: { instructor_id?: string | null; instructor_name?: string | null }) {
  return !row.instructor_id && !isValidFallback(row.instructor_name)
}

/**
 * Detect conflicts for a single staging entry against:
 * 1. Other entries in the same upload (internal)
 * 2. Entries in other academic_head_approved uploads (cross_department)
 * 3. Live class_schedules (external)
 */

export async function detectConflicts(
  supabase: SupabaseClient,
  uploadId: string,
  entryId: string,
  facilityId: string | null,
  instructorId: string | null,
  section: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  facilityNameRaw?: string,
  instructorNameRaw?: string
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = []
  const conflictEntryIds: string[] = []
  const conflictScheduleIds: string[] = []

  const stagingOrParts = []
  const liveOrParts = []

  if (facilityId) {
    stagingOrParts.push(`facility_id.eq.${facilityId}`)
    liveOrParts.push(`facility_id.eq.${facilityId}`)
  } else if (isValidFallback(facilityNameRaw)) {
    stagingOrParts.push(`facility_name_raw.eq.${facilityNameRaw}`)
  }

  if (instructorId) {
    stagingOrParts.push(`instructor_id.eq.${instructorId}`)
    liveOrParts.push(`instructor_id.eq.${instructorId}`)
  } else if (isValidFallback(instructorNameRaw)) {
    stagingOrParts.push(`instructor_name.eq.${instructorNameRaw}`)
    liveOrParts.push(`instructor_name.eq.${instructorNameRaw}`)
  }

  if (isValidFallback(section)) {
    stagingOrParts.push(`section.eq.${section}`)
    liveOrParts.push(`section.eq.${section}`)
  }

  const stagingOrCondition = stagingOrParts.join(',')
  const liveOrCondition = liveOrParts.join(',')

  if (!stagingOrCondition && !liveOrCondition) return []

  // 1. Internal conflicts — same upload, same day, overlap
  const { data: internalRows } = await supabase
    .from('schedule_entries_staging')
    .select('id, course_code, section, facility_id, instructor_id, start_time, end_time')
    .eq('schedule_upload_id', uploadId)
    .eq('day_of_week', dayOfWeek)
    .neq('id', entryId)
    .or(stagingOrCondition)

  for (const row of (internalRows ?? [])) {
    if (timesOverlap(startTime, endTime, row.start_time, row.end_time)) {
      conflicts.push({
        entry_id: entryId,
        conflict_type: 'internal',
        conflicting_entry_id: row.id,
        facility_id: facilityId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        course_code: row.course_code,
        section: row.section,
      })
      conflictEntryIds.push(row.id)
    }
  }

  // 2. Cross-department conflicts — other uploads (not this one), academic_head_approved entries, same facility, same day, overlap
  const { data: crossRows } = await supabase
    .from('schedule_entries_staging')
    .select(`
      id,
      course_code,
      section,
      facility_id,
      instructor_id,
      start_time,
      end_time,
      schedule_upload_id,
      schedule_uploads!inner(department_id)
    `)
    .eq('day_of_week', dayOfWeek)
    .neq('schedule_upload_id', uploadId)
    .in('validation_status', ['valid', 'warning'])
    .eq('academic_head_review_status', 'academic_head_approved')
    .or(stagingOrCondition)

  for (const row of (crossRows ?? [])) {
    if (timesOverlap(startTime, endTime, row.start_time, row.end_time)) {
      conflicts.push({
        entry_id: entryId,
        conflict_type: 'cross_department',
        conflicting_entry_id: row.id,
        facility_id: facilityId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        course_code: row.course_code,
        section: row.section,
      })
      conflictEntryIds.push(row.id)
    }
  }

  // 3. External conflicts — live class_schedules table
  const { data: liveRows } = await supabase
    .from('class_schedules')
    .select('id, course_code, section, facility_id, instructor_id, start_time, end_time')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .or(liveOrCondition)

  for (const row of (liveRows ?? [])) {
    if (timesOverlap(startTime, endTime, row.start_time, row.end_time)) {
      conflicts.push({
        entry_id: entryId,
        conflict_type: 'external',
        conflicting_schedule_id: row.id,
        facility_id: facilityId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        course_code: row.course_code,
        section: row.section,
      })
      conflictScheduleIds.push(row.id)
    }
  }

  const hasInternal = conflicts.some((c) => c.conflict_type === 'internal')
  const hasExternal = conflicts.some(
    (c) => c.conflict_type === 'cross_department' || c.conflict_type === 'external'
  )

  // Update the entry's conflict flags
  await supabase
    .from('schedule_entries_staging')
    .update({
      has_internal_conflict: hasInternal,
      has_external_conflict: hasExternal,
      conflict_entry_ids: conflictEntryIds,
      conflict_schedule_ids: conflictScheduleIds,
    })
    .eq('id', entryId)

  return conflicts
}

/**
 * Run conflict detection for all valid/warning entries in an upload.
 */
export async function detectAllConflicts(
  supabase: SupabaseClient,
  uploadId: string
): Promise<{ conflict_count: number }> {
  const { data: entries } = await supabase
    .from('schedule_entries_staging')
    .select('id, facility_id, facility_name_raw, instructor_id, instructor_name, section, day_of_week, start_time, end_time')
    .eq('schedule_upload_id', uploadId)
    .in('validation_status', ['valid', 'warning'])

  let conflictCount = 0

  for (const entry of (entries ?? [])) {
    if (!entry.facility_id && !entry.instructor_id && !entry.facility_name_raw && !entry.instructor_name && !entry.section) continue

    const conflicts = await detectConflicts(
      supabase,
      uploadId,
      entry.id,
      entry.facility_id,
      entry.instructor_id,
      entry.section,
      entry.day_of_week,
      entry.start_time,
      entry.end_time,
      entry.facility_name_raw,
      entry.instructor_name
    )

    if (conflicts.length > 0) {
      conflictCount++
    }
  }

  return { conflict_count: conflictCount }
}
