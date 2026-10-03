import { describe, it, expect } from 'vitest'
import {
  buildScheduleReportPayload,
  SCHEDULE_ISSUE_CATEGORIES,
} from '@/lib/schedule/report-form'

describe('SCHEDULE_ISSUE_CATEGORIES', () => {
  it('contains all 8 expected categories', () => {
    expect(SCHEDULE_ISSUE_CATEGORIES).toEqual([
      'wrong_room',
      'time_conflict',
      'missing_session',
      'incorrect_time',
      'instructor_mismatch',
      'not_updated',
      'equipment_issue',
      'other',
    ])
  })
})

describe('buildScheduleReportPayload', () => {
  it('includes schedule_type, schedule_id, category, and what_happened', () => {
    const payload = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 'sched-42',
      category: 'wrong_room',
      whatHappened: 'The room listed does not match the actual room used.',
    })

    expect(payload.schedule_type).toBe('class_schedule')
    expect(payload.schedule_id).toBe('sched-42')
    expect(payload.category).toBe('wrong_room')
    expect(payload.what_happened).toBe(
      'The room listed does not match the actual room used.',
    )
  })

  it('snapshots facility context from the event when provided', () => {
    const payload = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 'sched-7',
      category: 'incorrect_time',
      whatHappened: 'Start time is wrong.',
      facilityId: 'fac-3',
      facilityName: 'Room 302',
      courseCode: 'CS101',
      section: 'A',
    })

    expect(payload.facility_id).toBe('fac-3')
    expect(payload.facility_name).toBe('Room 302')
    expect(payload.course_code).toBe('CS101')
    expect(payload.section).toBe('A')
  })

  it('omits snapshot fields when not provided', () => {
    const payload = buildScheduleReportPayload({
      scheduleType: 'exam_schedule',
      scheduleId: 'sched-99',
      category: 'missing_session',
      whatHappened: 'Session not listed.',
    })

    expect(payload.facility_id).toBeUndefined()
    expect(payload.facility_name).toBeUndefined()
    expect(payload.course_code).toBeUndefined()
    expect(payload.section).toBeUndefined()
  })

  it('includes noticed_at and what_to_correct when provided', () => {
    const payload = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 'sched-10',
      category: 'wrong_room',
      whatHappened: 'Wrong room assigned.',
      noticedAt: '2026-08-10T09:00:00Z',
      whatToCorrect: 'Please change the room to Lab B.',
    })

    expect(payload.noticed_at).toBe('2026-08-10T09:00:00Z')
    expect(payload.what_to_correct).toBe('Please change the room to Lab B.')
  })

  it('omits noticed_at and what_to_correct when not provided', () => {
    const payload = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 'sched-10',
      category: 'wrong_room',
      whatHappened: 'Wrong room assigned.',
    })

    expect(payload.noticed_at).toBeUndefined()
    expect(payload.what_to_correct).toBeUndefined()
  })

  it('includes equipment_type when category is equipment_issue', () => {
    const payload = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 'sched-20',
      category: 'equipment_issue',
      whatHappened: 'Projector not working.',
      equipmentType: 'projector',
    })

    expect(payload.category).toBe('equipment_issue')
    expect(payload.equipment_type).toBe('projector')
  })

  it('omits equipment_type when not provided', () => {
    const payload = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 'sched-21',
      category: 'equipment_issue',
      whatHappened: 'Something is broken.',
    })

    expect(payload.equipment_type).toBeUndefined()
  })

  it('marks projector as tech equipment', () => {
    const result = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 's1',
      category: 'equipment_issue',
      whatHappened: 'broken',
      equipmentType: 'projector',
    })
    expect(result.is_tech).toBe(true)
  })

  it('marks aircon as non-tech equipment', () => {
    const result = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 's1',
      category: 'equipment_issue',
      whatHappened: 'broken',
      equipmentType: 'aircon',
    })
    expect(result.is_tech).toBe(false)
  })

  it('omits is_tech when category is not equipment_issue', () => {
    const result = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 's1',
      category: 'wrong_room',
      whatHappened: 'wrong',
    })
    expect(result.is_tech).toBeUndefined()
  })

  it('marks aircon as HVAC equipment', () => {
    const result = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 's1',
      category: 'equipment_issue',
      whatHappened: 'AC not working',
      equipmentType: 'aircon',
    })
    expect(result.is_hvac).toBe(true)
  })

  it('does not mark projector as HVAC', () => {
    const result = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 's1',
      category: 'equipment_issue',
      whatHappened: 'projector broken',
      equipmentType: 'projector',
    })
    expect(result.is_hvac).toBe(false)
  })

  it('omits is_hvac when category is not equipment_issue', () => {
    const result = buildScheduleReportPayload({
      scheduleType: 'class_schedule',
      scheduleId: 's1',
      category: 'wrong_room',
      whatHappened: 'wrong',
    })
    expect(result.is_hvac).toBeUndefined()
  })
})
