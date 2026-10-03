'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface ClassSchedule {
  id: string
  course_code: string
  course_name: string
  section: string
  instructor_name: string
  day_of_week: number // 0=Sun … 6=Sat
  start_time: string  // HH:MM:SS
  end_time: string
  effective_start_date: string
  effective_end_date: string
  facility: { id: string; name: string; room_number: string; building: string }
  department: { id: string; name: string; code: string }
}

export interface ScheduleEvent {
  id: string
  type: 'class' | 'reservation'
  title: string            // course_code+section or facility name
  subtitle: string         // facility / purpose
  day_of_week: number      // 0-6
  start_time: string       // HH:MM
  end_time: string         // HH:MM
  date?: string            // YYYY-MM-DD (only for reservations or expanded class instances)
  facility: string
  building: string
  room: string
  department?: string
  departmentCode?: string
  courseCode?: string
  section?: string
  courseName?: string
  instructor?: string
  status?: string
  effectiveStart?: string
  effectiveEnd?: string
  raw: ClassSchedule | ReservationItem
}

export interface ReservationItem {
  id: string
  facility_name: string
  building_name: string
  booking_date: string
  start_time: string
  end_time: string
  current_status: string
  purpose: string
  booking_reference: string
  [key: string]: unknown
}

interface DepartmentMeta { id: string; name: string; code: string }

interface MySchedulesData {
  classes: ClassSchedule[]
  reservations: ReservationItem[]
  events: ScheduleEvent[]
  loading: boolean
  error: string | null
  // Meta
  totalClasses: number
  uniqueCourses: number
  departments: DepartmentMeta[]
  classesToday: number
  activeToday: number        // classes today + active reservations today
  // Filters
  departmentFilter: string
  setDepartmentFilter: (v: string) => void
  courseFilter: string
  setCourseFilter: (v: string) => void
  sectionFilter: string
  setSectionFilter: (v: string) => void
  dayFilter: string
  setDayFilter: (v: string) => void
  monthFilter: string // YYYY-MM
  setMonthFilter: (v: string) => void
  showReservations: boolean
  setShowReservations: (v: boolean) => void
  // Derived filter options
  courseOptions: string[]
  sectionOptions: string[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function timeSlice(t: string) { return t?.slice(0, 5) ?? '--:--' }

function todayDow() { return new Date().getDay() }

function todayStr() { return new Date().toISOString().slice(0, 10) }

function classToEvent(c: ClassSchedule): ScheduleEvent {
  return {
    id: c.id,
    type: 'class',
    title: `${c.course_code} — ${c.section}`,
    subtitle: c.course_name,
    day_of_week: c.day_of_week,
    start_time: timeSlice(c.start_time),
    end_time: timeSlice(c.end_time),
    facility: c.facility.name,
    building: c.facility.building,
    room: c.facility.room_number,
    department: c.department.name,
    departmentCode: c.department.code,
    courseCode: c.course_code,
    section: c.section,
    courseName: c.course_name,
    instructor: c.instructor_name,
    effectiveStart: c.effective_start_date,
    effectiveEnd: c.effective_end_date,
    raw: c,
  }
}

function reservationToEvent(r: ReservationItem): ScheduleEvent {
  const dow = new Date(r.booking_date + 'T00:00:00').getDay()
  return {
    id: r.id,
    type: 'reservation',
    title: r.facility_name,
    subtitle: r.purpose || 'Reservation',
    day_of_week: dow,
    start_time: timeSlice(r.start_time),
    end_time: timeSlice(r.end_time),
    date: r.booking_date,
    facility: r.facility_name,
    building: r.building_name ?? '',
    room: '',
    status: r.current_status,
    raw: r,
  }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */
export function useMySchedules(): MySchedulesData {
  const [classes, setClasses] = useState<ClassSchedule[]>([])
  const [reservations, setReservations] = useState<ReservationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [showReservations, setShowReservations] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch classes and first page of bookings in parallel
      const [classRes, firstBookRes] = await Promise.all([
        fetch('/api/schedules/my-classes?scope=all'),
        fetch('/api/bookings?pageSize=50&page=1'),
      ])

      if (classRes.ok) {
        const data = await classRes.json()
        setClasses(data.classes ?? [])
      } else {
        console.error('[useMySchedules] class fetch failed', classRes.status)
      }

      if (firstBookRes.ok) {
        const firstData = await firstBookRes.json()
        const total: number = firstData.total ?? 0
        const pageSize = 50
        let allBookings: any[] = firstData.bookings ?? []

        // If there are more pages, fetch them all in parallel
        if (total > pageSize) {
          const totalPages = Math.ceil(total / pageSize)
          const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
          for (const page of remainingPages) {
            const r = await fetch(`/api/bookings?pageSize=50&page=${page}`)
            if (r.ok) {
              const pageData = await r.json()
              allBookings = allBookings.concat(pageData.bookings ?? [])
            }
          }
        }

        const bookings = allBookings.map((b: any) => {
          const fac = b.booking_facilities?.[0]?.facility
          return {
            id: b.id,
            facility_name: fac?.name ?? 'Unknown',
            building_name: fac?.floors?.buildings?.name ?? '',
            booking_date: b.booking_date,
            start_time: b.start_time,
            end_time: b.end_time,
            current_status: b.current_status,
            purpose: b.purpose ?? '',
            booking_reference: b.booking_reference,
          } as ReservationItem
        })
        setReservations(bookings)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Meta
  const departments = useMemo(() => {
    const map = new Map<string, DepartmentMeta>()
    for (const c of classes) {
      if (!map.has(c.department.id)) map.set(c.department.id, c.department)
    }
    return Array.from(map.values())
  }, [classes])

  const uniqueCourses = useMemo(() => new Set(classes.map(c => c.course_code)).size, [classes])

  const dow = todayDow()
  const today = todayStr()

  const classesToday = useMemo(() =>
    classes.filter(c => c.day_of_week === dow).length
  , [classes, dow])

  const activeReservationsToday = useMemo(() =>
    reservations.filter(r =>
      r.booking_date === today &&
      ['auto_approved', 'approved', 'overridden'].includes(r.current_status)
    ).length
  , [reservations, today])

  const activeToday = classesToday + activeReservationsToday

  // Filter options
  useEffect(() => {
    setCourseFilter('')
    setSectionFilter('')
  }, [departmentFilter])
  const courseOptions = useMemo(() => {
    const codes = new Set<string>()
    let filtered = classes
    if (departmentFilter) filtered = filtered.filter(c => c.department.id === departmentFilter)
    filtered.forEach(c => codes.add(c.course_code))
    return Array.from(codes).sort()
  }, [classes, departmentFilter])

  const sectionOptions = useMemo(() => {
    const secs = new Set<string>()
    let filtered = classes
    if (departmentFilter) filtered = filtered.filter(c => c.department.id === departmentFilter)
    if (courseFilter) filtered = filtered.filter(c => c.course_code === courseFilter)
    filtered.forEach(c => secs.add(c.section))
    return Array.from(secs).sort()
  }, [classes, departmentFilter, courseFilter])

  // Apply filters to produce events
  const events = useMemo(() => {
    let filteredClasses = classes
    if (departmentFilter) filteredClasses = filteredClasses.filter(c => c.department.id === departmentFilter)
    if (courseFilter) filteredClasses = filteredClasses.filter(c => c.course_code === courseFilter)
    if (sectionFilter) filteredClasses = filteredClasses.filter(c => c.section === sectionFilter)
    if (dayFilter) filteredClasses = filteredClasses.filter(c => c.day_of_week === parseInt(dayFilter))

    if (monthFilter) {
      const [year, month] = monthFilter.split('-').map(Number)
      filteredClasses = filteredClasses.filter(c => {
        const start = new Date(c.effective_start_date)
        const end = new Date(c.effective_end_date)
        const targetStart = new Date(year, month - 1, 1)
        const targetEnd = new Date(year, month, 0)
        return start <= targetEnd && end >= targetStart
      })
    }

    const classEvents = filteredClasses.map(classToEvent)

    let resEvents: ScheduleEvent[] = []
    if (showReservations) {
      let filteredRes = reservations
      if (dayFilter) filteredRes = filteredRes.filter(r => {
        const d = new Date(r.booking_date + 'T00:00:00').getDay()
        return d === parseInt(dayFilter)
      })
      if (monthFilter) {
        filteredRes = filteredRes.filter(r => r.booking_date.startsWith(monthFilter))
      }
      resEvents = filteredRes.map(reservationToEvent)
    }

    return [...classEvents, ...resEvents]
  }, [classes, reservations, departmentFilter, courseFilter, sectionFilter, dayFilter, monthFilter, showReservations])

  return {
    classes,
    reservations,
    events,
    loading,
    error,
    totalClasses: classes.length,
    uniqueCourses,
    departments,
    classesToday,
    activeToday,
    departmentFilter, setDepartmentFilter,
    courseFilter, setCourseFilter,
    sectionFilter, setSectionFilter,
    dayFilter, setDayFilter,
    monthFilter, setMonthFilter,
    showReservations, setShowReservations,
    courseOptions,
    sectionOptions,
  }
}
