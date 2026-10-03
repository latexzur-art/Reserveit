/**
 * Entry Validator
 * Validates each staging entry and sets validation_status, errors, warnings.
 * @module backend/schedule/entryValidator
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedEntry, ValidationError, ValidationWarning } from './schedule.types'
import { parseDayOfWeek, parseTime, parseDate } from './csvParser'
import { matchFacility, matchInstructor } from './facilityMatcher'
import type { RawCsvRow } from './schedule.types'

export async function validateAndEnrichEntry(
  supabase: SupabaseClient,
  raw: RawCsvRow,
  options?: { strictInstructorRequirement?: boolean }
): Promise<ParsedEntry> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // --- Required field checks ---
  const courseCode = raw.course_code?.trim() ?? ''
  const courseName = raw.course_name?.trim() ?? ''
  const section = raw.section?.trim() ?? ''
  const facilityNameRaw = raw.facility_name?.trim() ?? ''
  const instructorName = raw.instructor_name?.trim() ?? ''

  if (!courseCode) errors.push({ field: 'course_code', code: 'MISSING_COURSE_CODE', message: 'Course code is required' })
  if (!section) errors.push({ field: 'section', code: 'MISSING_SECTION', message: 'Section is required' })
  if (!facilityNameRaw) errors.push({ field: 'facility_name', code: 'MISSING_FACILITY', message: 'Facility/room is required' })
  if (!courseName) warnings.push({ field: 'course_name', code: 'MISSING_COURSE_NAME', message: 'Course name not provided' })

  // --- Day of week ---
  let dayOfWeek = 0
  if (!raw.day_of_week_raw?.trim()) {
    errors.push({ field: 'day_of_week', code: 'MISSING_DAY', message: 'Day of week is required' })
  } else {
    const parsed = parseDayOfWeek(raw.day_of_week_raw)
    if (parsed === null) {
      errors.push({ field: 'day_of_week', code: 'INVALID_DAY', message: `Cannot parse day: "${raw.day_of_week_raw}"` })
    } else {
      dayOfWeek = parsed
    }
  }

  // --- Times ---
  let startTime: string = '00:00:00'
  let endTime: string = '00:01:00' // Default to 1 min after start to satisfy DB constraint

  if (!raw.start_time_raw?.trim()) {
    errors.push({ field: 'start_time', code: 'MISSING_START_TIME', message: 'Start time is required' })
  } else {
    const parsed = parseTime(raw.start_time_raw)
    if (!parsed) {
      errors.push({ field: 'start_time', code: 'INVALID_START_TIME', message: `Cannot parse time: "${raw.start_time_raw}"` })
    } else {
      startTime = parsed
    }
  }

  if (!raw.end_time_raw?.trim()) {
    errors.push({ field: 'end_time', code: 'MISSING_END_TIME', message: 'End time is required' })
  } else {
    const parsed = parseTime(raw.end_time_raw)
    if (!parsed) {
      errors.push({ field: 'end_time', code: 'INVALID_END_TIME', message: `Cannot parse time: "${raw.end_time_raw}"` })
    } else {
      endTime = parsed
    }
  }

  // End time must be after start time
  if (endTime <= startTime) {
    errors.push({ field: 'end_time', code: 'END_BEFORE_START', message: 'End time must be after start time' })
    
    // Satisfy DB constraint end_time > start_time for staging insert
    // This allows the row to be saved so the user can fix it in the UI.
    if (startTime >= '23:59:00') {
      endTime = '23:59:59'
    } else {
      const [h, m] = startTime.split(':').map(Number)
      const date = new Date()
      date.setHours(h, m + 1, 0)
      endTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`
    }
  }

  // Operating hours enforcement (7:00 AM to 7:00 PM)
  if (startTime < '07:00:00' || endTime > '19:00:00') {
    errors.push({ field: 'start_time', code: 'OUTSIDE_OPERATING_HOURS', message: 'Class schedules must be between 7:00 AM and 7:00 PM.' })
  }

  const startHour = parseInt(startTime.split(':')[0])
  const endHour = parseInt(endTime.split(':')[0])

  const startMins = startHour * 60 + parseInt(startTime.split(':')[1])
  const endMins = endHour * 60 + parseInt(endTime.split(':')[1])

  // --- Facility matching ---
  let facilityId: string | null = null
  let facilityMatchConfidence = 0

  if (facilityNameRaw) {
    const match = await matchFacility(supabase, facilityNameRaw)
    facilityId = match.facility_id
    facilityMatchConfidence = match.confidence

    if (!facilityId) {
      errors.push({ field: 'facility_name', code: 'FACILITY_NOT_FOUND', message: `No matching facility found for "${facilityNameRaw}"` })
    } else if (facilityMatchConfidence < 0.8) {
      warnings.push({ field: 'facility_name', code: 'LOW_FACILITY_CONFIDENCE', message: `Facility match confidence is low (${Math.round(facilityMatchConfidence * 100)}%)` })
    }
  }

  // --- Course catalog check ---
  let sessionType: string | null = null
  if (courseCode) {
    const { data: catalogCourse } = await supabase
      .from('courses')
      .select('delivery_mode, approval_status, lecture_hours, lab_hours, credit_units')
      .ilike('course_code', courseCode)
      .eq('approval_status', 'approved')
      .limit(1)
      .maybeSingle()

    if (!catalogCourse) {
      // Check if it exists but is pending
      const { data: pendingCourse } = await supabase
        .from('courses')
        .select('approval_status')
        .ilike('course_code', courseCode)
        .in('approval_status', ['pending', 'sent_back'])
        .limit(1)
        .maybeSingle()

      if (pendingCourse) {
        warnings.push({
          field: 'course_code',
          code: 'COURSE_PENDING_APPROVAL',
          message: `Course "${courseCode}" exists but is pending approval`,
        })
      } else {
        errors.push({
          field: 'course_code',
          code: 'COURSE_NOT_IN_CATALOG',
          message: `Course "${courseCode}" not found in the course catalog`,
        })
      }
    } else {
      // Check for unit mismatch between file and DB catalog
      if (raw.units_raw && catalogCourse.credit_units !== undefined && catalogCourse.credit_units !== null) {
        const uploadedUnits = parseFloat(raw.units_raw)
        if (!isNaN(uploadedUnits) && uploadedUnits !== catalogCourse.credit_units) {
          warnings.push({
            field: 'units',
            code: 'UNIT_MISMATCH',
            message: `Uploaded units (${uploadedUnits}) does not match catalog units (${catalogCourse.credit_units}) for "${courseCode}"`,
          })
        }
      }

      // 1. Prioritize explicit type from upload file
      const rawType = raw.session_type_raw?.toLowerCase().trim()
      if (rawType) {
        if (rawType.includes('lab')) sessionType = 'lab'
        else if (rawType.includes('lec')) sessionType = 'lecture'
      }

      // 2. Fallback to auto-set session_type from catalog delivery_mode
      if (!sessionType) {
        if (catalogCourse.delivery_mode === 'lecture') sessionType = 'lecture'
        else if (catalogCourse.delivery_mode === 'lab') sessionType = 'lab'
        // 'both' → leave null, needs manual specification if not in file
      }

      // Duration vs expected hours check (only when times are valid)
      if (startTime !== '00:00:00' && endTime !== '00:00:00' && endTime > startTime) {
        const sessionMinutes = endMins - startMins
        const expectedHours =
          sessionType === 'lab' ? catalogCourse.lab_hours :
          sessionType === 'lecture' ? catalogCourse.lecture_hours :
          catalogCourse.delivery_mode === 'lab' ? catalogCourse.lab_hours :
          catalogCourse.delivery_mode === 'lecture' ? catalogCourse.lecture_hours :
          null

        if (expectedHours) {
          const sessionH = Math.floor(sessionMinutes / 60)
          const sessionM = sessionMinutes % 60
          const durationLabel = sessionM > 0 ? `${sessionH}h ${sessionM}m` : `${sessionH}h`

          // --- DURATION VALIDATION DEACTIVATED PER USER REQUEST ---
          // if (sessionMinutes < expectedHours * 60) {
          //   warnings.push({
          //     field: 'end_time',
          //     code: 'DURATION_UNDER_HOURS',
          //     message: `Session duration (${durationLabel}) is less than the course's expected ${expectedHours}h (${catalogCourse.delivery_mode}). Split across sessions if needed.`,
          //   })
          // } else if (sessionMinutes > expectedHours * 60 * 1.5) {
          //   warnings.push({
          //     field: 'end_time',
          //     code: 'DURATION_OVER_HOURS',
          //     message: `Session duration (${durationLabel}) significantly exceeds the course's expected ${expectedHours}h (${catalogCourse.delivery_mode}).`,
          //   })
          // }
        }
      }
    }
  }

  // --- Optional dates ---
  const effectiveStartDate = parseDate(raw.effective_start_date_raw)
  const effectiveEndDate = parseDate(raw.effective_end_date_raw)

  // --- Instructor check ---
  let instructorId: string | null = null
  if (instructorName && instructorName.toUpperCase() !== 'TBD') {
    const matchResult = await matchInstructor(supabase, instructorName)
    instructorId = matchResult.instructor_id
    if (!instructorId) {
      if (matchResult.ambiguous) {
        warnings.push({
          field: 'instructor_name',
          code: 'AMBIGUOUS_INSTRUCTOR_MATCH',
          message: `Multiple instructors match "${instructorName}". Please be more specific.`,
        })
      } else {
        warnings.push({
          field: 'instructor_name',
          code: 'INSTRUCTOR_NOT_FOUND',
          message: `No matching instructor found for "${instructorName}"`,
        })
      }
    }
  }

  // Handle Strict Instructor Requirement
  if (options?.strictInstructorRequirement && !instructorId) {
    errors.push({
      field: 'instructor_name',
      code: 'INSTRUCTOR_REQUIRED',
      message: 'Strict Mode: An official instructor must be assigned to this class.',
    })
  }

  const hasErrors = errors.length > 0
  const hasWarnings = warnings.length > 0

  return {
    row_number: raw.row_number,
    course_code: courseCode,
    course_name: courseName,
    section,
    facility_name_raw: facilityNameRaw,
    facility_id: facilityId,
    facility_match_confidence: facilityMatchConfidence,
    instructor_name: instructorName,
    instructor_id: instructorId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    effective_start_date: effectiveStartDate,
    effective_end_date: effectiveEndDate,
    session_type: sessionType,
    validation_status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'valid',
    validation_errors: errors,
    validation_warnings: warnings,
  }
}

/**
 * Re-validates the total hours for each course/section in an upload.
 * Clears DURATION_UNDER_HOURS warnings if the total hours meet the catalog requirement.
 */
export async function revalidateUploadHours(supabase: SupabaseClient, uploadId: string) {
  // 1. Fetch all entries for this upload
  const { data: entries, error: fetchErr } = await supabase
    .from('schedule_entries_staging')
    .select('*')
    .eq('schedule_upload_id', uploadId)

  if (fetchErr || !entries) return

  // 2. Group by course_code, section, and session_type
  const courseCodes = Array.from(new Set(entries.map(e => e.course_code).filter(Boolean)))
  const { data: coursesData } = await supabase
    .from('courses')
    .select('course_code, lecture_hours, lab_hours, delivery_mode')
    .in('course_code', courseCodes)
    .eq('approval_status', 'approved')

  const courseMap = new Map(coursesData?.map(c => [c.course_code, c]) || [])
  const groups: Record<string, { totalMins: number; expectedMins: number; entries: any[] }> = {}

  const timeToMins = (t: string) => {
    if (!t) return 0
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  for (const entry of entries) {
    if (!entry.course_code || !entry.section || entry.validation_status === 'error') continue
    if (!entry.start_time || !entry.end_time) continue

    const course = courseMap.get(entry.course_code)
    if (!course) continue

    const type = entry.session_type || (course.delivery_mode === 'lab' ? 'lab' : 'lecture')
    const expectedHours = type === 'lab' ? course.lab_hours : course.lecture_hours
    if (!expectedHours) continue

    const key = `${entry.course_code}|${entry.section}|${type}`
    if (!groups[key]) {
      groups[key] = { totalMins: 0, expectedMins: expectedHours * 60, entries: [] }
    }

    const duration = timeToMins(entry.end_time) - timeToMins(entry.start_time)
    groups[key].totalMins += duration
    groups[key].entries.push(entry)
  }

  // 3. Update entries that now meet the requirement
  for (const key in groups) {
    const group = groups[key]
    const meetsTotal = group.totalMins >= group.expectedMins

    for (const entry of group.entries) {
      const currentWarnings = (entry.validation_warnings || []) as any[]
      const hasUnderHoursWarning = currentWarnings.some(w => w.code === 'DURATION_UNDER_HOURS')

      if (meetsTotal && hasUnderHoursWarning) {
        // Clear the warning
        const newWarnings = currentWarnings.filter(w => w.code !== 'DURATION_UNDER_HOURS')
        const newStatus = (entry.validation_errors || []).length > 0 ? 'error' : (newWarnings.length > 0 ? 'warning' : 'valid')

        await supabase
          .from('schedule_entries_staging')
          .update({
            validation_warnings: newWarnings,
            validation_status: newStatus
          })
          .eq('id', entry.id)
      } else if (!meetsTotal && !hasUnderHoursWarning) {
        // We could theoretically add it back here, but let's stick to clearing for now 
        // as the individual validator usually adds it.
      }
    }
  }
}



