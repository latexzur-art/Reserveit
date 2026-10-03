/**
 * Pure helpers backing the "Report schedule issue" dialog.
 *
 * Schedule issue reports let faculty flag problems with class or exam
 * schedules — wrong room, time conflicts, missing sessions, etc.
 * The payload is sent to the API to create a schedule_issue ticket.
 */

/** All valid schedule issue categories. */
export const SCHEDULE_ISSUE_CATEGORIES = [
  'wrong_room',
  'time_conflict',
  'missing_session',
  'incorrect_time',
  'instructor_mismatch',
  'not_updated',
  'equipment_issue',
  'other',
] as const

export type ScheduleReportCategory = (typeof SCHEDULE_ISSUE_CATEGORIES)[number]

/** Shape of the form state collected from the dialog. */
export interface ScheduleReportFormState {
  scheduleType: string
  scheduleId: string
  category: ScheduleReportCategory | string
  whatHappened: string
  whatToCorrect?: string
  noticedAt?: string
  /** Snapshot fields from the event (optional). */
  facilityId?: string
  facilityName?: string
  courseCode?: string
  section?: string
  startTime?: string
  endTime?: string
  dayOfWeek?: string
  scheduleDate?: string
  equipmentType?: string
}

/** Maps equipment types to tech (IT-managed) vs non-tech (PAMO-managed). */
export const EQUIPMENT_TYPE_TECH: Record<string, boolean> = {
  projector: true,
  tv: true,
  computer: true,
  laptop: true,
  microphone: true,
  whiteboard: true,
  printer: true,
  network: true,
  aircon: false,
  lighting: false,
  other_equipment: false,
}

/** Equipment types that are HVAC-related. */
export const HVAC_EQUIPMENT_TYPES = new Set(['aircon'])

/** Shape of the payload sent to the API. */
export interface ScheduleReportPayload {
  schedule_type: string
  schedule_id: string
  category: string
  what_happened: string
  what_to_correct?: string
  noticed_at?: string
  facility_id?: string
  facility_name?: string
  course_code?: string
  section?: string
  start_time?: string
  end_time?: string
  day_of_week?: string
  schedule_date?: string
  equipment_type?: string
  is_tech?: boolean
  is_hvac?: boolean
}

/**
 * Build the POST body for the schedule issue report API.
 *
 * Maps camelCase form state to snake_case API fields. Snapshot fields
 * (facility context, course info) are only included when present.
 */
export function buildScheduleReportPayload(
  state: ScheduleReportFormState,
): ScheduleReportPayload {
  const payload: ScheduleReportPayload = {
    schedule_type: state.scheduleType,
    schedule_id: state.scheduleId,
    category: state.category,
    what_happened: state.whatHappened,
  }

  if (state.whatToCorrect) payload.what_to_correct = state.whatToCorrect
  if (state.noticedAt) payload.noticed_at = state.noticedAt

  // Snapshot fields — only include when provided
  if (state.facilityId) payload.facility_id = state.facilityId
  if (state.facilityName) payload.facility_name = state.facilityName
  if (state.courseCode) payload.course_code = state.courseCode
  if (state.section) payload.section = state.section
  if (state.startTime) payload.start_time = state.startTime
  if (state.endTime) payload.end_time = state.endTime
  if (state.dayOfWeek) payload.day_of_week = state.dayOfWeek
  if (state.scheduleDate) payload.schedule_date = state.scheduleDate
  if (state.equipmentType) payload.equipment_type = state.equipmentType

  // Set is_tech when category is equipment_issue and equipment type is known
  if (state.category === 'equipment_issue' && state.equipmentType) {
    payload.is_tech = EQUIPMENT_TYPE_TECH[state.equipmentType] ?? false
    payload.is_hvac = HVAC_EQUIPMENT_TYPES.has(state.equipmentType)
  }

  return payload
}
