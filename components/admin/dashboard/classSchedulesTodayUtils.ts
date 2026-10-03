import type { ClassSchedule, Facility } from '@/lib/data-store'

export interface TodaysClassSchedule {
  id: string
  courseCode: string
  courseName: string
  section: string
  instructorName: string
  startTime: string
  endTime: string
  facilityName: string
}

const COURSE_NAME_MAP: Record<string, string> = {
  COSC1003: 'Object-Oriented Programming',
  CITE1004: 'Data Structures & Algorithms',
  CITE1003: 'Computer Programming 2',
  COSC1001: 'Introduction to Computing',
  COSC1006: 'Discrete Mathematics',
  GEDC1002: 'World Literature',
  GEDC1006: 'Readings in Philippine History',
  GEDC1016: 'Art Appreciation',
  GEDC1014: 'Ethics',
  GEDC1008: 'Purposive Communication',
  STIC1002: 'STI Corporate Culture & Values',
  PHED1007: 'Physical Fitness & Self-Defense',
  PHED1005: 'Rhythmic Activities',
  NSTP1008: 'National Service Training Program 2',
  CITE1010: 'Database Management Systems 1',
}

/**
 * Pure helper — filters and enriches class schedules for today.
 * Extracted from the component so it can be unit-tested without React.
 */
export function getTodaysClassSchedules(
  classSchedules: ClassSchedule[],
  facilities: Facility[],
  today: Date,
): TodaysClassSchedule[] {
  const dayOfWeek = today.getDay()
  const todayStr = today.toISOString().split('T')[0]

  const facilityMap = new Map(facilities.map(f => [f.id, f.name]))

  return classSchedules
    .filter(s => {
      if (s.dayOfWeek !== dayOfWeek) return false
      if (todayStr < s.effectiveStartDate) return false
      if (todayStr > s.effectiveEndDate) return false
      return true
    })
    .map(s => {
      const resolvedCourseName =
        s.courseName && s.courseName.trim() !== '' && s.courseName !== s.courseCode
          ? s.courseName
          : COURSE_NAME_MAP[s.courseCode] || s.courseName || s.courseCode

      return {
        id: s.id,
        courseCode: s.courseCode,
        courseName: resolvedCourseName,
        section: s.section,
        instructorName: s.instructorName,
        startTime: s.startTime,
        endTime: s.endTime,
        facilityName: facilityMap.get(s.facilityId) ?? 'TBA',
      }
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
