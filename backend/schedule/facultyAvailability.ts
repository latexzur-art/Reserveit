/**
 * Faculty availability for the conflict-aware professor picker.
 * Pure-read composition over existing tables — no writes, no conflict flags.
 * @module backend/schedule/facultyAvailability
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { timesOverlap, isValidFallback } from './conflictDetector'

const FACULTY_ROLES = new Set(['faculty', 'program_head', 'teacher', 'professor'])

export interface BusyBlock {
  schedule_id?: string
  day_of_week: number
  start_time: string
  end_time: string
  label: string
  source: 'teaching' | 'booking' | 'proposed'
}

export interface Subject {
  code: string
  name: string
}

export interface FacultyAvailability {
  id: string
  full_name: string
  employee_id: string | null
  department_id: string | null
  department_code: string | null
  department_name: string | null
  /** Distinct courses this professor currently teaches (active schedules). */
  subjects: Subject[]
  busy_blocks: BusyBlock[]
  /** Only meaningful when a day/start/end slot is supplied; otherwise null. */
  is_available: boolean | null
}

interface Slot {
  dayOfWeek?: number
  start?: string
  end?: string
  departmentId?: string
}

/**
 * Returns every faculty member with their department and busy blocks
 * (other teaching, room bookings, other in-flight proposed assignments).
 * When a slot {dayOfWeek,start,end} is supplied, also computes is_available.
 */
export async function getFacultyAvailability(
  supabase: SupabaseClient,
  slot: Slot = {}
): Promise<FacultyAvailability[]> {
  // 1. Faculty + department (lifted from /api/instructors, with department_id)
  const { data: users } = await supabase
    .from('users')
    .select(`
      id, full_name, employee_id, department_id,
      department:departments!users_department_id_fkey(code, name),
      user_roles!user_roles_user_id_fkey(is_active, role:roles(name))
    `)
    .eq('is_active', true)
    .order('full_name')

  let faculty = (users ?? []).filter((u: any) =>
    (Array.isArray(u.user_roles) ? u.user_roles : []).some(
      (ur: any) => ur?.is_active !== false && ur?.role?.name && FACULTY_ROLES.has(ur.role.name)
    )
  )
  if (slot.departmentId) faculty = faculty.filter((u: any) => u.department_id === slot.departmentId)

  const ids = faculty.map((u: any) => u.id)
  if (ids.length === 0) return []

  // 2. Teaching busy blocks + subjects — active live schedules taught by these faculty
  const { data: teaching } = await supabase
    .from('class_schedules')
    .select('id, instructor_id, course_code, course_name, section, day_of_week, start_time, end_time')
    .eq('is_active', true)
    .in('instructor_id', ids)

  // 3. Booking busy blocks — pending/approved reservations by these users
  const { data: bookings } = await supabase
    .from('bookings')
    .select('user_id, booking_date, start_time, end_time, current_status')
    .in('user_id', ids)
    .in('current_status', ['pending', 'approved'])

  // 4. In-flight busy blocks — proposed items in pending lineups
  const { data: inflight } = await supabase
    .from('professor_assignment_items')
    .select(`
      proposed_instructor_id,
      class_schedules!class_schedule_id(id, course_code, section, day_of_week, start_time, end_time),
      lineup:professor_assignment_lineups!lineup_id(status)
    `)
    .in('proposed_instructor_id', ids)
    .eq('status', 'pending')

  const byUser = new Map<string, BusyBlock[]>()
  const push = (uid: string | null, b: BusyBlock) => {
    if (!uid) return
    const arr = byUser.get(uid) ?? []
    arr.push(b)
    byUser.set(uid, arr)
  }

  // Distinct subjects per professor (by course_code).
  const subjectsByUser = new Map<string, Map<string, Subject>>()
  const addSubject = (uid: string | null, code?: string | null, name?: string | null) => {
    if (!uid || !code) return
    const m = subjectsByUser.get(uid) ?? new Map<string, Subject>()
    if (!m.has(code)) m.set(code, { code, name: name ?? code })
    subjectsByUser.set(uid, m)
  }

  for (const r of teaching ?? []) {
    push(r.instructor_id, {
      schedule_id: r.id,
      day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time,
      label: `${r.course_code} ${r.section}`.trim(), source: 'teaching',
    })
    addSubject(r.instructor_id, r.course_code, r.course_name)
  }
  for (const b of bookings ?? []) {
    // booking_date is a one-off DATE; derive its weekday so it lines up with
    // recurring schedule slots (same approach as check_affected_bookings).
    const dow = new Date(`${b.booking_date}T00:00:00`).getDay()
    push(b.user_id, {
      day_of_week: dow, start_time: b.start_time, end_time: b.end_time,
      label: 'Room booking', source: 'booking',
    })
  }
  for (const it of inflight ?? []) {
    const cs: any = Array.isArray(it.class_schedules) ? it.class_schedules[0] : it.class_schedules
    const ln: any = Array.isArray(it.lineup) ? it.lineup[0] : it.lineup
    if (!cs || ln?.status !== 'pending') continue
    push(it.proposed_instructor_id, {
      day_of_week: cs.day_of_week, start_time: cs.start_time, end_time: cs.end_time,
      label: `Proposed: ${cs.course_code} ${cs.section}`.trim(), source: 'proposed',
    })
  }

  const checkSlot = slot.dayOfWeek != null && slot.start && slot.end

  return faculty.map((u: any) => {
    const dept = Array.isArray(u.department) ? u.department[0] : u.department
    const blocks = byUser.get(u.id) ?? []
    let isAvailable: boolean | null = null
    if (checkSlot) {
      isAvailable = !blocks.some(
        (b) => b.day_of_week === slot.dayOfWeek && timesOverlap(slot.start!, slot.end!, b.start_time, b.end_time)
      )
    }
    return {
      id: u.id,
      full_name: u.full_name,
      employee_id: u.employee_id ?? null,
      department_id: u.department_id ?? null,
      department_code: dept?.code ?? null,
      department_name: dept?.name ?? null,
      subjects: Array.from((subjectsByUser.get(u.id) ?? new Map<string, Subject>()).values())
        .sort((a, b) => a.code.localeCompare(b.code)),
      busy_blocks: blocks,
      is_available: isAvailable,
    }
  })
}

// ponytail: self-check — overlap + sentinel agree with conflictDetector.
// run: npx tsx backend/schedule/facultyAvailability.ts
if (process.argv[1]?.endsWith('facultyAvailability.ts')) {
  console.assert(timesOverlap('09:00', '10:00', '09:30', '11:00') === true, 'overlap')
  console.assert(timesOverlap('09:00', '10:00', '10:00', '11:00') === false, 'touch = no overlap')
  console.assert(isValidFallback('TBD') === false && isValidFallback('Dr. Cruz') === true, 'sentinel')
  console.log('facultyAvailability self-check ok')
}
