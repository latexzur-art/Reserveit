import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
export async function GET() {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => r.name === 'academic_head')
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head role required' }, { status: 403 })
  }

  const supabase = createAdminClient()

  try {
    // Fetch all bookings flagged for mismatch that need review
    const { data: bookings, error: dbError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        booking_date,
        start_time,
        end_time,
        booking_purpose,
        purpose,
        facility_purpose_category,
        booking_course_code,
        booking_department_code,
        session_type,
        mismatch_justification,
        mismatch_flag,
        mismatch_alternative_facility_id,
        mismatch_reviewed_by,
        current_status,
        created_at,
        users!bookings_user_id_fkey!inner(id, full_name, departments!department_id(id, code, name)),
        booking_facilities!inner(
          facility:facilities!inner(id, name, room_number, floors(floor_number, buildings(name)))
        )
      `)
      // Include all mismatch flags that route to academic_head, not just cross-dept
      .not('mismatch_flag', 'is', null)
      .eq('assigned_reviewer_role', 'academic_head')
      .in('current_status', ['flagged', 'pending_faculty_response'])
      // Paid bookings are routed to Building Admin, not Academic Head.
      .or('requires_payment.is.null,requires_payment.eq.false')
      .order('created_at', { ascending: true })

    if (dbError) throw dbError

    // L4: batch-fetch the scoring breakdown so the AH sees "why flagged" at a
    // glance instead of re-investigating each booking. One row per booking
    // (processBooking inserts exactly one booking_decisions row per pipeline run),
    // but order by created_at desc + take-first defensively in case of a re-run.
    const bookingIds = (bookings ?? []).map((b: { id: string }) => b.id)
    const decisionMap = new Map<string, { baseScore: number | null; finalScore: number | null; adjustments: { code: string; name: string; points: number; reason: string }[]; decisionReason: string | null }>()
    if (bookingIds.length > 0) {
      const { data: decisionRows } = await supabase
        .from('booking_decisions')
        .select('booking_id, base_score, final_score, score_adjustments, decision_reason, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false })
      for (const d of decisionRows ?? []) {
        if (decisionMap.has(d.booking_id)) continue // keep only the most recent
        decisionMap.set(d.booking_id, {
          baseScore: d.base_score ?? null,
          finalScore: d.final_score ?? null,
          adjustments: (d.score_adjustments as { code: string; name: string; points: number; reason: string }[] | null) ?? [],
          decisionReason: d.decision_reason ?? null,
        })
      }
    }

    // Course delivery_mode per booking course — needed so reviewers see the
    // SESSION_* mismatch context (lab session in lecture room, etc.)
    const courseKeys = [...new Set(
      (bookings ?? [])
        .filter((b: any) => b.booking_course_code && b.booking_department_code)
        .map((b: any) => `${b.booking_department_code}::${b.booking_course_code}`)
    )]
    const deliveryModeMap = new Map<string, string>()
    if (courseKeys.length > 0) {
      const { data: courseRows } = await supabase
        .from('courses')
        .select('course_code, department_code, delivery_mode')
        .in('course_code', courseKeys.map(k => k.split('::')[1]))
        .eq('approval_status', 'approved')
      for (const c of courseRows ?? []) {
        deliveryModeMap.set(`${c.department_code}::${c.course_code}`, c.delivery_mode)
      }
    }

    // Fetch available classrooms once to use as general alternatives for all flagged bookings
    const { data: classrooms } = await supabase
      .from('facilities')
      .select('id, name, room_number, is_active, status, facility_types!inner(name)')
      .eq('facility_types.name', 'classroom')
      .eq('is_active', true)
      .eq('status', 'available')
      .limit(10)

    const classroomAlts = (classrooms ?? []).map((f: any) => ({
      id: f.id,
      name: f.name,
      room_number: f.room_number,
      available: true,
    }))

    // Batch-fetch reviewer names + roles for bookings already reviewed by someone
    const reviewerIds = [...new Set((bookings ?? []).map((b: any) => b.mismatch_reviewed_by).filter(Boolean))]
    const reviewerMap = new Map<string, { name: string; role: string }>()
    if (reviewerIds.length > 0) {
      const { data: reviewerRows } = await supabase
        .from('users')
        .select('id, full_name, user_roles!user_roles_user_id_fkey(roles!inner(name))')
        .in('id', reviewerIds)
      for (const r of reviewerRows ?? []) {
        const roleRow = Array.isArray(r.user_roles) ? r.user_roles[0] : r.user_roles
        const roleName = (Array.isArray(roleRow?.roles) ? roleRow.roles[0] : roleRow?.roles)?.name ?? 'reviewer'
        reviewerMap.set(r.id, { name: (r as any).full_name ?? 'Unknown', role: roleName })
      }
    }

    // For each booking, fetch alternative facilities of the same type
    // (same specialized tag as the originally requested facility)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviewItems = await Promise.all((bookings ?? []).map(async (b: any) => {
      const facilityId = b.booking_facilities?.[0]?.facility?.id as string | undefined
      const usersData = Array.isArray(b.users) ? b.users[0] : b.users

      // Fetch alternative facilities with the same purpose tag
      let specializedAlts: Array<{ id: string; name: string; room_number: string; available: boolean }> = []
      if (facilityId) {
        const { data: tags } = await supabase
          .from('facility_purpose_tags')
          .select('tag')
          .eq('facility_id', facilityId)

        const specializedTag = (tags ?? []).find((t: { tag: string }) =>
          ['computer_use', 'science_lab', 'av_studio', 'gym', 'hospitality_lab', 'multipurpose', 'conference'].includes(t.tag)
        )?.tag

        if (specializedTag) {
          const { data: sameFacilities } = await supabase
            .from('facility_purpose_tags')
            .select('facility:facilities!inner(id, name, room_number, is_active, status)')
            .eq('tag', specializedTag)
            .neq('facility_id', facilityId)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          specializedAlts = (sameFacilities ?? []).map((f: any) => {
            const fac = Array.isArray(f.facility) ? f.facility[0] : f.facility
            return fac
          }).filter((f: any) => f?.is_active && f?.status === 'available')
            .map((f: any) => ({ id: f.id, name: f.name, room_number: f.room_number, available: true }))
        }
      }

      // Combine specialized alternatives with general classrooms and de-duplicate
      const combined = [...specializedAlts, ...classroomAlts]
      const seen = new Set()
      const alternativeFacilities = combined.filter(f => {
        if (f.id === facilityId || seen.has(f.id)) return false
        seen.add(f.id)
        return true
      }).slice(0, 15) // Limit to 15 total suggestions for the UI

      // Fetch alternative facility details if one was already suggested
      let alternativeFacility = null
      if (b.mismatch_alternative_facility_id) {
        const { data: altFacility } = await supabase
          .from('facilities')
          .select('id, name, room_number, floors(floor_number, buildings(name))')
          .eq('id', b.mismatch_alternative_facility_id)
          .single()
        alternativeFacility = altFacility
      }

      const bookingFacility = b.booking_facilities?.[0]?.facility
      const facilityRecord = Array.isArray(bookingFacility) ? bookingFacility[0] : bookingFacility

      return {
        bookingId: b.id,
        referenceNumber: b.booking_reference,
        currentStatus: b.current_status,
        facultyName: usersData?.full_name ?? 'Unknown',
        facultyId: usersData?.id ?? null,
        department: usersData?.departments?.name ?? usersData?.departments?.code ?? 'Unknown Department',
        departmentCode: usersData?.departments?.code ?? null,
        facility: facilityRecord ?? null,
        bookingDate: b.booking_date,
        startTime: b.start_time,
        endTime: b.end_time,
        bookingPurpose: b.booking_purpose,
        facilityPurposeCategory: b.facility_purpose_category,
        courseCode: b.booking_course_code ?? null,
        courseDepartmentCode: b.booking_department_code ?? null,
        sessionType: b.session_type ?? null,
        courseDeliveryMode: b.booking_course_code && b.booking_department_code
          ? deliveryModeMap.get(`${b.booking_department_code}::${b.booking_course_code}`) ?? null
          : null,
        mismatchJustification: b.mismatch_justification,
        mismatchFlag: b.mismatch_flag ?? null,
        scoreBreakdown: decisionMap.get(b.id) ?? null,
        submittedAt: b.created_at,
        alternativeFacilities,
        suggestedAlternative: alternativeFacility,
        reviewedBy: b.mismatch_reviewed_by ? (reviewerMap.get(b.mismatch_reviewed_by) ?? null) : null,
      }
    }))

    return NextResponse.json({ reviews: reviewItems })
  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : (typeof err === 'object' && err !== null && 'message' in err)
        ? String((err as any).message)
        : 'Unknown error'
    console.error('[API] GET /academic-head/mismatch-reviews error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
