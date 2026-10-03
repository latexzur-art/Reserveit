import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
function computeDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function mapBooking(b: any) {
  const usersData = Array.isArray(b.users) ? b.users[0] : b.users
  const dept = Array.isArray(usersData?.departments) ? usersData.departments[0] : usersData?.departments
  const bookingFacility = b.booking_facilities?.[0]?.facility
  const facility = Array.isArray(bookingFacility) ? bookingFacility[0] : bookingFacility
  const floor = Array.isArray(facility?.floors) ? facility.floors[0] : facility?.floors
  const building = Array.isArray(floor?.buildings) ? floor.buildings[0] : floor?.buildings

  const startTime = b.start_time?.slice(0, 5) ?? ''
  const endTime = b.end_time?.slice(0, 5) ?? ''

  return {
    id: b.id,
    referenceNumber: b.booking_reference,
    bookingDate: b.booking_date,
    startTime,
    endTime,
    durationMinutes: startTime && endTime ? computeDurationMinutes(startTime, endTime) : null,
    status: b.current_status,
    bookingPurpose: b.booking_purpose,
    purpose: b.purpose,
    eventName: b.event_name ?? null,
    expectedAttendees: b.expected_attendees ?? null,
    decisionScore: b.decision_score ?? null,
    createdAt: b.created_at,
    mismatchFlag: b.mismatch_flag ?? null,
    courseCode: b.booking_course_code ?? null,
    courseDepartmentCode: b.booking_department_code ?? null,
    courseName: null as string | null, // populated below
    sessionType: b.session_type ?? null,
    facultyId: usersData?.id ?? null,
    facultyName: usersData?.full_name ?? 'Unknown',
    facultyEmail: usersData?.email ?? null,
    departmentId: dept?.id ?? null,
    department: dept?.name ?? dept?.code ?? 'Unknown',
    departmentCode: dept?.code ?? null,
    facilityId: facility?.id ?? null,
    facilityName: facility?.name ?? 'Unknown Facility',
    roomNumber: facility?.room_number ?? null,
    floorNumber: floor?.floor_number ?? null,
    buildingName: building?.name ?? null,
  }
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => r.name === 'academic_head')
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head role required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'))
  const offset = (page - 1) * pageSize
  const status = searchParams.get('status') ?? ''
  const fromDate = searchParams.get('from_date') ?? ''
  const toDate = searchParams.get('to_date') ?? ''
  const departmentId = searchParams.get('department_id') ?? ''
  const search = searchParams.get('search') ?? ''
  const sortBy = searchParams.get('sort_by') ?? 'date_asc'

  const supabase = createAdminClient()

  try {
    // Auto-complete all past approved bookings (academic head sees all departments)
    await supabase.rpc('auto_complete_past_bookings', {})

    let query = supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        booking_date,
        start_time,
        end_time,
        current_status,
        booking_purpose,
        purpose,
        event_name,
        expected_attendees,
        decision_score,
        created_at,
        mismatch_flag,
        booking_course_code,
        booking_department_code,
        session_type,
        users!bookings_user_id_fkey!inner(id, full_name, email, departments!department_id(id, code, name)),
        booking_facilities!inner(
          facility:facilities!inner(id, name, room_number,
            floors(floor_number, buildings(name)))
        )
      `, { count: 'exact' })
      // Paid bookings are routed to the Building Admin queue, not academic head.
      .or('requires_payment.is.null,requires_payment.eq.false')

    // Status filter — supports comma-separated values (e.g. "auto_approved,approved,overridden")
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        query = query.eq('current_status', statuses[0])
      } else if (statuses.length > 1) {
        query = query.in('current_status', statuses)
      }
    }

    if (fromDate) query = query.gte('booking_date', fromDate)
    if (toDate) query = query.lte('booking_date', toDate)

    // Department filter — applied at DB level via inner join
    if (departmentId) {
      query = query.eq('users.department_id', departmentId)
    }

    // Search filter — applied at DB level using ilike on relevant columns
    if (search) {
      const term = `%${search}%`
      query = query.or(
        `booking_reference.ilike.${term},purpose.ilike.${term},users.full_name.ilike.${term}`
      )
    }

    // Sort. For the `flagged` queue specifically, lowest-score-first by default
    // so reviewers see the most controversial bookings before the easy ones —
    // prevents rubber-stamping in chronological order.
    const explicitSort = searchParams.get('sort_by')
    const effectiveSort = explicitSort
      ? sortBy
      : status === 'flagged' ? 'score_asc' : 'date_asc'

    if (effectiveSort === 'date_desc') {
      query = query.order('booking_date', { ascending: false }).order('start_time', { ascending: false })
    } else if (effectiveSort === 'status') {
      query = query.order('current_status', { ascending: true }).order('booking_date', { ascending: true })
    } else if (effectiveSort === 'score_asc') {
      query = query.order('decision_score', { ascending: true, nullsFirst: false }).order('booking_date', { ascending: true })
    } else if (effectiveSort === 'score_desc') {
      query = query.order('decision_score', { ascending: false, nullsFirst: false }).order('booking_date', { ascending: true })
    } else {
      // date_asc (default), also handles 'department' (sorted in JS post-query)
      query = query.order('booking_date', { ascending: true }).order('start_time', { ascending: true })
    }

    query = query.range(offset, offset + pageSize - 1)

    const { data: bookings, count, error: dbError } = await query
    if (dbError) throw dbError

    let mapped = (bookings ?? []).map(mapBooking)

    // Look up course names for bookings that have a course code
    const courseCodes = [...new Set(mapped.filter(m => m.courseCode).map(m => `${m.courseDepartmentCode}:${m.courseCode}`))]
    if (courseCodes.length > 0) {
      const uniquePairs = courseCodes.map(c => { const [d, cc] = c.split(':'); return { dept: d, code: cc } })
      const { data: courses } = await supabase
        .from('courses')
        .select('course_code, department_code, course_name')
        .eq('approval_status', 'approved')
        .eq('is_active', true)

      if (courses?.length) {
        const courseMap = new Map(courses.map(c => [`${c.department_code}:${c.course_code}`, c.course_name]))
        for (const m of mapped) {
          if (m.courseCode) {
            m.courseName = courseMap.get(`${m.courseDepartmentCode}:${m.courseCode}`) ?? null
          }
        }
      }
    }

    // Department sort (applied in JS since it's a join column)
    if (sortBy === 'department') {
      mapped.sort((a, b) => (a.department ?? '').localeCompare(b.department ?? ''))
    }

    // Fetch distinct departments for the filter dropdown
    const { data: deptData } = await supabase
      .from('departments')
      .select('id, code, name')
      .eq('is_active', true)
      .order('name', { ascending: true })

    // Fetch active booking counts per department
    const { data: activeBookingsRaw } = await supabase
      .from('bookings')
      .select('users!bookings_user_id_fkey!inner(department_id), id')
      .in('current_status', ['pending', 'approved', 'auto_approved'])

    // Fetch distinct facilities per department (primary rooms)
    const { data: facilityBookingsRaw } = await supabase
      .from('bookings')
      .select('users!bookings_user_id_fkey!inner(department_id), booking_facilities(facility_id)')
      .in('current_status', ['pending', 'approved', 'auto_approved', 'completed'])

    // Aggregate counts per department
    const activeCountMap: Record<string, number> = {}
    const facilitySetMap: Record<string, Set<string>> = {}

    for (const b of activeBookingsRaw ?? []) {
      const deptId = (Array.isArray(b.users) ? b.users[0] : b.users)?.department_id
      if (deptId) activeCountMap[deptId] = (activeCountMap[deptId] ?? 0) + 1
    }

    for (const b of facilityBookingsRaw ?? []) {
      const deptId = (Array.isArray(b.users) ? b.users[0] : b.users)?.department_id
      if (!deptId) continue
      if (!facilitySetMap[deptId]) facilitySetMap[deptId] = new Set()
      const bfs = Array.isArray(b.booking_facilities) ? b.booking_facilities : []
      for (const bf of bfs) {
        if (bf.facility_id) facilitySetMap[deptId].add(bf.facility_id)
      }
    }

    const departmentsWithCounts = (deptData ?? []).map(d => ({
      ...d,
      activeBookings: activeCountMap[d.id] ?? 0,
      primaryRooms: facilitySetMap[d.id]?.size ?? 0,
    }))

    return NextResponse.json({
      bookings: mapped,
      total: count ?? 0,
      page,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      departments: departmentsWithCounts,
    })
  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : (typeof err === 'object' && err !== null && 'message' in err)
        ? String((err as any).message)
        : 'Unknown error'
    console.error('[API] GET /academic-head/reservations error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
