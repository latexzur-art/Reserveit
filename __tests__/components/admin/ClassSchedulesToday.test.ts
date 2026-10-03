import { describe, it, expect } from 'vitest'
import { getTodaysClassSchedules } from '@/components/admin/dashboard/classSchedulesTodayUtils'
import type { ClassSchedule, Facility } from '@/lib/data-store'

function schedule(overrides: Partial<ClassSchedule> = {}): ClassSchedule {
  return {
    id: `sched-${Math.random().toString(36).slice(2)}`,
    courseCode: 'CS101',
    courseName: 'Intro to CS',
    section: '3A',
    instructorName: 'Prof. Santos',
    dayOfWeek: 1, // Monday
    startTime: '08:00',
    endTime: '09:30',
    facilityId: 'fac-1',
    effectiveStartDate: '2026-08-01',
    effectiveEndDate: '2026-12-31',
    ...overrides,
  }
}

function facility(overrides: Partial<Facility> = {}): Facility {
  return {
    id: 'fac-1',
    name: 'Room 101',
    roomNumber: '101',
    status: 'Available',
    floor: '1st Floor',
    type: 'Classroom',
    capacity: 40,
    deleted: false,
    ...overrides,
  } as Facility
}

// Monday 2026-08-10 — dayOfWeek = 1
const MONDAY = new Date('2026-08-10T12:00:00')
// Tuesday 2026-08-11 — dayOfWeek = 2
const TUESDAY = new Date('2026-08-11T12:00:00')

describe('getTodaysClassSchedules', () => {
  it('returns schedules matching today day-of-week', () => {
    const schedules = [
      schedule({ id: 'mon', dayOfWeek: 1, courseCode: 'CS101' }),
      schedule({ id: 'tue', dayOfWeek: 2, courseCode: 'CS201' }),
    ]
    const facilities = [facility()]

    const result = getTodaysClassSchedules(schedules, facilities, MONDAY)

    expect(result).toHaveLength(1)
    expect(result[0].courseCode).toBe('CS101')
  })

  it('excludes schedules outside effective date range', () => {
    const schedules = [
      schedule({ id: 'active', effectiveStartDate: '2026-08-01', effectiveEndDate: '2026-12-31' }),
      schedule({ id: 'expired', effectiveStartDate: '2026-01-01', effectiveEndDate: '2026-03-01' }),
    ]
    const facilities = [facility()]

    const result = getTodaysClassSchedules(schedules, facilities, MONDAY)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('active')
  })

  it('includes schedule when today is within effective range', () => {
    const schedules = [
      schedule({ effectiveStartDate: '2026-08-01', effectiveEndDate: '2026-12-31' }),
    ]
    const facilities = [facility()]

    const result = getTodaysClassSchedules(schedules, facilities, MONDAY)
    expect(result).toHaveLength(1)
  })

  it('resolves facility name from facilityId', () => {
    const schedules = [schedule({ facilityId: 'fac-2' })]
    const facilities = [
      facility({ id: 'fac-1', name: 'Room 101' }),
      facility({ id: 'fac-2', name: 'Lab 201' }),
    ]

    const result = getTodaysClassSchedules(schedules, facilities, MONDAY)
    expect(result[0].facilityName).toBe('Lab 201')
  })

  it('returns empty array when no schedules match today', () => {
    const schedules = [
      schedule({ dayOfWeek: 2 }), // Tuesday only
      schedule({ dayOfWeek: 3 }), // Wednesday only
    ]
    const facilities = [facility()]

    const result = getTodaysClassSchedules(schedules, facilities, MONDAY)
    expect(result).toHaveLength(0)
  })

  it('sorts results by startTime', () => {
    const schedules = [
      schedule({ id: 'late', startTime: '14:00', endTime: '15:30', courseCode: 'CS301' }),
      schedule({ id: 'early', startTime: '08:00', endTime: '09:30', courseCode: 'CS101' }),
      schedule({ id: 'mid', startTime: '11:00', endTime: '12:30', courseCode: 'CS201' }),
    ]
    const facilities = [facility()]

    const result = getTodaysClassSchedules(schedules, facilities, MONDAY)

    expect(result).toHaveLength(3)
    expect(result[0].courseCode).toBe('CS101')
    expect(result[1].courseCode).toBe('CS201')
    expect(result[2].courseCode).toBe('CS301')
  })

  it('uses fallback name when facility not found', () => {
    const schedules = [schedule({ facilityId: 'nonexistent' })]
    const facilities: Facility[] = []

    const result = getTodaysClassSchedules(schedules, facilities, MONDAY)
    expect(result[0].facilityName).toBe('TBA')
  })
})
