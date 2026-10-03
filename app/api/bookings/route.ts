import { NextRequest, NextResponse, after } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { processBooking, getSuggestions } from '@/backend/booking'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { getBuildingAdminEmails } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { adminPendingBookingEmail, bookingConfirmationEmail } from '@/backend/notifications/emailTemplates'
import { getErrorMessage, getErrorDetails } from '@/lib/errors'
import { checkRateLimitAsync, RATE_LIMITS } from '@/lib/rate-limit'
import type { BookingStatus } from '@/backend/booking/booking.types'
import { BookingPaymentService } from '@/backend/booking/paymentService'

export const dynamic = 'force-dynamic'

const CreateBookingSchema = z.object({
  facility_id: z.string().uuid(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM or HH:MM:SS').transform(t => t.slice(0, 5)),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM or HH:MM:SS').transform(t => t.slice(0, 5)),
  time_slot_id: z.string().uuid().optional(),
  purpose: z.string().min(1).max(500),
  booking_purpose: z.enum(['academic', 'school_event', 'department_use', 'personal', 'commercial', 'community']),
  event_name: z.string().max(200).optional(),
  expected_attendees: z.number().int().positive().optional(),
  special_requests: z.string().max(1000).optional(),
  booking_course_code: z.string().max(20).optional(),
  booking_department_code: z.string().max(20).optional(),
  session_type: z.enum(['lecture', 'lab']).nullable().optional(),
  equipment_ids: z.array(z.string().uuid()).optional(),
  self_facilitation_confirmed: z.boolean().optional(),
  facilitator_name: z.string().max(200).optional(),
  facility_purpose_category: z.string().max(100).optional(),
  mismatch_justification: z.string().max(2000).optional(),
  // External client fields
  organization_name: z.string().max(200).optional(),
  contact_number: z.string().max(50).optional(),
  addon_sound: z.boolean().optional(),
  addon_led: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const dateFrom = searchParams.get('dateFrom')
  const scope = searchParams.get('scope')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20'), 50)
  const offset = (page - 1) * pageSize

  const PRIVILEGED_ROLES = new Set(['academic_head', 'admin', 'it_administrator', 'building_admin'])
  const isPrivileged = (user.roles ?? []).some((r: { name: string }) => PRIVILEGED_ROLES.has(r.name))
  const wantAll = scope === 'all' && isPrivileged

  try {
    const supabase = createAdminClient()

    // Auto-complete past approved bookings for this user
    await supabase.rpc('auto_complete_past_bookings', { p_user_id: user.id })

    let query = supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        booking_date,
        start_time,
        end_time,
        booking_purpose,
        booking_type,
        purpose,
        current_status,
        decision_score,
        oversight_expires_at,
        created_at,
        expected_attendees,
        mismatch_flag,
        mismatch_alternative_facility_id,
        mismatch_reviewed_by,
        requires_payment,
        is_extension,
        extension_of_booking_id,
        metadata,
        booking_course_code,
        booking_department_code,
        session_type,
        booking_facilities(
          facility:facilities(id, name, room_number, floors(floor_number, buildings(name)))
        ),
        booking_overrides(
          id, override_action, original_values, new_values, reason, created_at
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (!wantAll) {
      query = query.eq('user_id', user.id)
    }

    if (status) {
      const VALID_STATUSES: BookingStatus[] = [
        'pending', 'approved', 'rejected', 'cancelled', 'completed',
        'auto_approved', 'auto_declined', 'flagged', 'overridden', 'pending_faculty_response',
        'pending_user_response', 'on_hold', 'cancellation_requested', 'awaiting_reschedule',
      ]
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      const invalid = statuses.filter(s => !VALID_STATUSES.includes(s as BookingStatus))
      if (invalid.length > 0) {
        return NextResponse.json({ error: `Invalid status value(s): ${invalid.join(', ')}` }, { status: 400 })
      }
      if (statuses.length === 1) {
        query = query.eq('current_status', statuses[0])
      } else if (statuses.length > 1) {
        query = query.in('current_status', statuses)
      }
    }

    if (dateFrom) {
      query = query.gte('booking_date', dateFrom)
    }

    const { data, count, error: queryError } = await query

    if (queryError) throw queryError

    let bookingsData = data ?? []

    // Enrich bookings with course names + elective info
    const courseCodes = [...new Set(
      bookingsData
        .filter((b: any) => b.booking_course_code)
        .map((b: any) => `${b.booking_department_code}:${b.booking_course_code}`)
    )]
    let courseInfoMap = new Map<string, { course_name: string; is_elective: boolean; elective_type: string | null }>()
    if (courseCodes.length > 0) {
      const { data: courses } = await supabase
        .from('courses')
        .select('course_code, department_code, course_name, is_elective, elective_type')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
      if (courses?.length) {
        courseInfoMap = new Map(courses.map(c => [`${c.department_code}:${c.course_code}`, {
          course_name: c.course_name,
          is_elective: c.is_elective,
          elective_type: c.elective_type,
        }]))
      }
    }

    const enrichedBase = bookingsData.map((b: any) => {
      const courseInfo = b.booking_course_code
        ? courseInfoMap.get(`${b.booking_department_code}:${b.booking_course_code}`)
        : undefined
      return {
        ...b,
        course_name: courseInfo?.course_name ?? null,
        is_elective: courseInfo?.is_elective ?? false,
        elective_type: courseInfo?.elective_type ?? null,
      }
    })

    // Enrich paid bookings with payment status and emergency request state
    const paidBookingIds = enrichedBase
      .filter((b: any) => b.requires_payment || b.booking_type === 'internal_paid' || b.booking_type === 'external_paid')
      .map((b: any) => b.id)

    let completedPaymentSet = new Set<string>()
    let pendingRequestMap = new Map<string, { id: string; created_at: string }>()
    let lastDeniedMap = new Map<string, { id: string; reviewed_at: string; review_notes: string | null }>()
    let pendingRescheduleMap = new Map<string, {
      id: string; status: string
      proposed_date: string; proposed_start_time: string; proposed_end_time: string
      extra_amount_centavos: number; extra_payment_id: string | null; created_at: string
    }>()
    let lastDeclinedRescheduleMap = new Map<string, {
      id: string; reviewed_at: string; review_notes: string | null
      proposed_date: string; proposed_start_time: string; proposed_end_time: string
    }>()
    let cancellationProposalMap = new Map<string, {
      id: string; reason: string; refund_amount_centavos: number; created_at: string
    }>()

    if (paidBookingIds.length > 0) {
      const [paymentsResult, requestsResult, rescheduleResult, proposalResult] = await Promise.all([
        supabase
          .from('payments')
          .select('booking_id')
          .in('booking_id', paidBookingIds)
          .eq('payment_status', 'completed'),
        supabase
          .from('emergency_cancellation_requests')
          .select('id, booking_id, status, created_at, reviewed_at, review_notes')
          .in('booking_id', paidBookingIds)
          .in('status', ['pending', 'denied'])
          .order('created_at', { ascending: false }),
        supabase
          .from('emergency_reschedule_requests')
          .select('id, booking_id, status, proposed_date, proposed_start_time, proposed_end_time, extra_amount_centavos, extra_payment_id, created_at, reviewed_at, review_notes')
          .in('booking_id', paidBookingIds)
          .in('status', ['pending', 'pending_extra_payment', 'declined'])
          .order('created_at', { ascending: false }),
        supabase
          .from('ba_cancellation_proposals')
          .select('id, booking_id, reason, refund_amount_centavos, created_at')
          .in('booking_id', paidBookingIds)
          .eq('status', 'pending'),
      ])

      for (const p of paymentsResult.data ?? []) {
        completedPaymentSet.add(p.booking_id)
      }

      for (const req of requestsResult.data ?? []) {
        if (req.status === 'pending' && !pendingRequestMap.has(req.booking_id)) {
          pendingRequestMap.set(req.booking_id, { id: req.id, created_at: req.created_at })
        }
        if (req.status === 'denied' && !lastDeniedMap.has(req.booking_id)) {
          lastDeniedMap.set(req.booking_id, {
            id: req.id,
            reviewed_at: req.reviewed_at,
            review_notes: req.review_notes,
          })
        }
      }

      for (const req of (rescheduleResult.data ?? []) as any[]) {
        if (['pending', 'pending_extra_payment'].includes(req.status) && !pendingRescheduleMap.has(req.booking_id)) {
          pendingRescheduleMap.set(req.booking_id, {
            id: req.id,
            status: req.status,
            proposed_date: req.proposed_date,
            proposed_start_time: req.proposed_start_time,
            proposed_end_time: req.proposed_end_time,
            extra_amount_centavos: req.extra_amount_centavos,
            extra_payment_id: req.extra_payment_id,
            created_at: req.created_at,
          })
        }
        if (req.status === 'declined' && !lastDeclinedRescheduleMap.has(req.booking_id)) {
          lastDeclinedRescheduleMap.set(req.booking_id, {
            id: req.id,
            reviewed_at: req.reviewed_at,
            review_notes: req.review_notes,
            proposed_date: req.proposed_date,
            proposed_start_time: req.proposed_start_time,
            proposed_end_time: req.proposed_end_time,
          })
        }
      }

      for (const prop of (proposalResult.data ?? []) as any[]) {
        if (!cancellationProposalMap.has(prop.booking_id)) {
          cancellationProposalMap.set(prop.booking_id, {
            id: prop.id,
            reason: prop.reason,
            refund_amount_centavos: prop.refund_amount_centavos,
            created_at: prop.created_at,
          })
        }
      }
    }

    // Enrich with alternative facility + reviewer info for bookings with a mismatch proposal
    const altFacilityIds = [...new Set(
      enrichedBase.map((b: any) => b.mismatch_alternative_facility_id).filter(Boolean)
    )] as string[]
    const reviewerIds = [...new Set(
      enrichedBase.map((b: any) => b.mismatch_reviewed_by).filter(Boolean)
    )] as string[]

    const altFacilityMap = new Map<string, { id: string; name: string; room_number: string | null }>()
    if (altFacilityIds.length > 0) {
      const { data: altFacs } = await supabase
        .from('facilities')
        .select('id, name, room_number')
        .in('id', altFacilityIds)
      for (const f of altFacs ?? []) {
        altFacilityMap.set(f.id, { id: f.id, name: f.name, room_number: f.room_number })
      }
    }

    const reviewerMap = new Map<string, { id: string; name: string; role: string | null }>()
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from('users')
        .select('id, full_name, user_roles!user_roles_user_id_fkey(roles!inner(name))')
        .in('id', reviewerIds)
      for (const r of (reviewers ?? []) as any[]) {
        const roleNames: string[] = (r.user_roles ?? [])
          .map((ur: any) => Array.isArray(ur.roles) ? ur.roles[0]?.name : ur.roles?.name)
          .filter(Boolean)
        const preferred = ['building_admin', 'academic_head'].find(rn => roleNames.includes(rn)) ?? roleNames[0] ?? null
        reviewerMap.set(r.id, { id: r.id, name: r.full_name, role: preferred })
      }
    }

    let enriched = enrichedBase.map((b: any) => ({
      ...b,
      has_completed_payment: completedPaymentSet.has(b.id),
      pending_emergency_request: pendingRequestMap.get(b.id) ?? null,
      last_denied_emergency_request: lastDeniedMap.get(b.id) ?? null,
      pending_reschedule_request: pendingRescheduleMap.get(b.id) ?? null,
      last_declined_reschedule_request: lastDeclinedRescheduleMap.get(b.id) ?? null,
      cancellation_proposal: cancellationProposalMap.get(b.id) ?? null,
      mismatch_alternative_facility: b.mismatch_alternative_facility_id
        ? altFacilityMap.get(b.mismatch_alternative_facility_id) ?? null
        : null,
      mismatch_reviewer: b.mismatch_reviewed_by
        ? reviewerMap.get(b.mismatch_reviewed_by) ?? null
        : null,
    }))


    return NextResponse.json({ bookings: enriched, total: count ?? 0, page, pageSize })
  } catch (err: unknown) {
    const message = getErrorMessage(err)
    console.error('[API] GET /bookings error:', getErrorDetails(err))
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const rateLimited = await checkRateLimitAsync(`booking:${user.id}`, RATE_LIMITS.BOOKING_CREATE)
  if (rateLimited) return rateLimited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data

  // Course-related validation
  if (input.booking_course_code && !input.booking_department_code) {
    return NextResponse.json({ error: 'booking_department_code is required when booking_course_code is provided' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Auto-set session_type for single delivery mode courses
  if (input.booking_course_code && input.booking_department_code) {
    const { data: course } = await supabase
      .from('courses')
      .select('delivery_mode')
      .eq('course_code', input.booking_course_code)
      .eq('department_code', input.booking_department_code)
      .eq('approval_status', 'approved')
      .single()

    if (course) {
      if (course.delivery_mode === 'lecture') {
        input.session_type = 'lecture'
      } else if (course.delivery_mode === 'lab') {
        input.session_type = 'lab'
      } else if (course.delivery_mode === 'both' && !input.session_type) {
        return NextResponse.json({ error: 'session_type is required when course delivery mode is "both"' }, { status: 400 })
      }
    }
  }

  try {
    const { data: facility, error: facilityFetchError } = await supabase
      .from('facilities')
      .select('id, name, is_available_for_rental, facility_types(name)')
      .eq('id', input.facility_id)
      .single()

    if (facilityFetchError || !facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 400 })
    }

    const facilityNameNormalized = facility.name?.trim().toLowerCase() ?? ''
    const ftRaw = facility.facility_types as unknown
    const facilityTypeName = (Array.isArray(ftRaw) ? (ftRaw[0] as { name?: string })?.name : (ftRaw as { name?: string } | null)?.name)?.toLowerCase() ?? ''
    const isGymFacility =
      facilityNameNormalized.includes('gym') ||
      facilityTypeName.includes('gym')

    const paymentPurposes = ['personal', 'community', 'commercial']
    const isRentable = isGymFacility || facility.is_available_for_rental
    const requiresPayment =
      isRentable &&
      paymentPurposes.includes(input.booking_purpose)

    const bookingType = user.user_type === 'internal'
      ? requiresPayment ? 'internal_paid' : 'internal_free'
      : 'external_paid'

    // Execute entire booking creation (deduplication, conflict check, header, facility, equipment) atomically in a single DB transaction
    const { data: rpcRows, error: rpcError } = await supabase.rpc('create_booking_transactional', {
      p_user_id: user.id,
      p_facility_id: input.facility_id,
      p_booking_purpose: input.booking_purpose,
      p_booking_type: bookingType,
      p_booking_date: input.booking_date,
      p_start_time: input.start_time,
      p_end_time: input.end_time,
      p_time_slot_id: input.time_slot_id ?? null,
      p_purpose: input.purpose,
      p_event_name: input.event_name ?? null,
      p_expected_attendees: input.expected_attendees ?? null,
      p_special_requests: input.special_requests ?? null,
      p_self_facilitation_confirmed: input.self_facilitation_confirmed ?? false,
      p_facilitator_name: input.facilitator_name ?? null,
      p_facility_purpose_category: input.facility_purpose_category ?? null,
      p_mismatch_justification: input.mismatch_justification ?? null,
      p_booking_course_code: input.booking_course_code ?? null,
      p_booking_department_code: input.booking_department_code ?? null,
      p_session_type: input.session_type ?? null,
      p_organization_name: input.organization_name ?? null,
      p_contact_number: input.contact_number ?? null,
      p_requires_payment: requiresPayment,
      p_metadata: (input.addon_sound || input.addon_led)
        ? { addon_sound: input.addon_sound ?? false, addon_led: input.addon_led ?? false }
        : {},
      p_internal_notes: requiresPayment
        ? 'Payment required for Gymnasium booking; pending payment review.'
        : null,
      p_equipment_ids: input.equipment_ids ?? [],
    })

    if (rpcError) throw rpcError

    const rpcResult = rpcRows?.[0]

    if (!rpcResult || rpcResult.out_conflict_found) {
      const isDuplicate = rpcResult?.out_error_message?.includes('active booking')
      return NextResponse.json(
        {
          error: rpcResult?.out_error_message ?? 'Time slot already booked for this facility',
          ...(isDuplicate
            ? { booking_reference: rpcResult?.out_conflict_reference }
            : { conflicting_booking_reference: rpcResult?.out_conflict_reference }
          )
        },
        { status: 409 }
      )
    }

    const newBooking = {
      id: rpcResult.out_booking_id,
      booking_reference: rpcResult.out_booking_reference,
    }

    if (requiresPayment) {
      // Institution-wide payment method toggle. Applies to every payment-required booking
      // regardless of which role's flow created the invoice (spec: qr-manual-payments-design.md L13).
      const { data: modeSetting } = await supabase
        .from('system_settings').select('value').eq('key', 'payment_method_mode').single()
      const paymentMode = (modeSetting?.value as string) ?? 'paymongo'

      // Building admin self-booking: skip admin approval gate since they are the admin.
      // Create the payment record immediately and move to pending_user_response.
      const isBuildingAdminBooker = (user.roles ?? []).some(
        (r: { name: string }) => r.name === 'building_admin'
      )

      if (isBuildingAdminBooker) {
        const { amount, breakdown } = await BookingPaymentService.calculateAmount({
          start_time: input.start_time,
          end_time: input.end_time,
          booking_facilities: { facility_id: input.facility_id },
          metadata: (input.addon_sound || input.addon_led)
            ? { addon_sound: input.addon_sound ?? false, addon_led: input.addon_led ?? false }
            : undefined,
        })

        const { data: paymentRecord } = await supabase.from('payments').insert({
          booking_id: newBooking.id,
          user_id: user.id,
          amount,
          currency: 'PHP',
          payment_method: paymentMode === 'paymongo' ? 'paymongo_card' : 'qr_manual',
          payment_status: 'pending',
          payment_type: 'booking',
          description: `Gymnasium ${input.booking_purpose} booking — self-reservation by Building Admin`,
          metadata: {
            booking_purpose: input.booking_purpose,
            facility_name: facility.name,
            cost_breakdown: breakdown,
          },
        }).select('id').single()

        await supabase.from('bookings').update({
          current_status: 'pending_user_response',
          internal_notes: 'Building Admin self-reservation — payment required to confirm.',
          updated_at: new Date().toISOString(),
        }).eq('id', newBooking.id)

        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Gymnasium Booking — Payment Required',
          message: `Your booking (${newBooking.booking_reference}) for ${facility.name} is ready for payment. Go to My Payments to complete your reservation.`,
          type: 'info',
          source_type: 'booking',
          source_id: newBooking.id,
          priority: 'high',
          read: false,
          metadata: {
            booking_reference: newBooking.booking_reference,
            facility_name: facility.name,
            status_to: 'pending_user_response',
          },
        })

        return NextResponse.json({
          status: 'pending_user_response',
          booking_id: newBooking.id,
          booking_reference: newBooking.booking_reference,
          requires_payment: true,
          payment_id: paymentRecord?.id ?? null,
          message: 'Booking created. Complete payment to confirm your reservation.',
        }, { status: 201 })
      }

      // qr_at_submission mode: create the invoice immediately so the renter can pay and
      // submit proof in parallel with the BA's conflict review (spec L16). All other modes
      // (paymongo, qr_after_approval) are unchanged — no payment created until BA approval,
      // handled by a different route.
      let submissionPaymentId: string | null = null
      if (paymentMode === 'qr_at_submission') {
        const { amount, breakdown } = await BookingPaymentService.calculateAmount({
          start_time: input.start_time,
          end_time: input.end_time,
          booking_facilities: { facility_id: input.facility_id },
          metadata: (input.addon_sound || input.addon_led)
            ? { addon_sound: input.addon_sound ?? false, addon_led: input.addon_led ?? false }
            : undefined,
        })

        const { data: paymentRecord } = await supabase.from('payments').insert({
          booking_id: newBooking.id,
          user_id: user.id,
          amount,
          currency: 'PHP',
          payment_method: 'qr_manual',
          payment_status: 'pending',
          payment_type: 'booking',
          description: `${facility.name} ${input.booking_purpose} booking — QR payment invoice`,
          metadata: {
            booking_purpose: input.booking_purpose,
            facility_name: facility.name,
            cost_breakdown: breakdown,
          },
        }).select('id').single()

        submissionPaymentId = paymentRecord?.id ?? null
      }

      const fmt12h = (t: string) => {
        const [hStr, mStr] = t.split(':')
        const h = parseInt(hStr, 10)
        return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
      }
      const bookingDateLabel = new Date(input.booking_date + 'T00:00:00').toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
      const [sh, sm] = input.start_time.split(':').map(Number)
      const [eh, em] = input.end_time.split(':').map(Number)
      const durationMins = (eh * 60 + em) - (sh * 60 + sm)
      const durationLabel = durationMins >= 60
        ? `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`
        : `${durationMins}m`
      const requesterRole = (user.roles ?? []).map((r: { name: string }) => r.name)[0] ?? ''
      const roleMap: Record<string, string> = {
        faculty: 'Faculty', program_head: 'Program Head', academic_head: 'Academic Head',
        building_admin: 'Building Admin', external_client: 'External Client', it_admin: 'IT Admin',
      }
      const paymentMeta: Record<string, unknown> = {
        booking_reference: newBooking.booking_reference,
        requester_name: user.full_name,
        requester_role: roleMap[requesterRole] ?? 'Faculty',
        facility_name: facility.name,
        booking_date: bookingDateLabel,
        start_time: fmt12h(input.start_time),
        end_time: fmt12h(input.end_time),
        duration: durationLabel,
        purpose: input.purpose ?? input.booking_purpose,
        expected_attendees: input.expected_attendees ?? null,
      }

      const approvalNote = paymentMode === 'qr_at_submission'
        ? 'A QR payment invoice has already been created — the renter can pay now while you review for conflicts.'
        : 'Requires your approval before payment can be collected.'

      await sendNotificationToRoles(supabase, ['building_admin'], {
        title: 'Booking Needs Your Approval',
        message: `${user.full_name} submitted a gymnasium booking for ${facility.name} on ${bookingDateLabel} (${fmt12h(input.start_time)} – ${fmt12h(input.end_time)}, ${durationLabel}). ${approvalNote}`,
        type: 'warning',
        source_type: 'booking',
        source_id: newBooking.id,
        priority: 'high',
        metadata: paymentMeta,
      })

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Booking Pending Review',
        message: `Your booking for ${facility.name} on ${bookingDateLabel} (${fmt12h(input.start_time)} – ${fmt12h(input.end_time)}) has been received and is pending admin approval. You will be notified when it is approved and ready for payment.`,
        type: 'info',
        source_type: 'booking',
        source_id: newBooking.id,
        priority: 'high',
        read: false,
        metadata: { ...paymentMeta, status_to: 'pending' },
      })

      // Email all building admins about the pending paid booking
      const adminEmails = await getBuildingAdminEmails()
      if (adminEmails.length > 0) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        const { subject, htmlBody } = adminPendingBookingEmail({
          bookingRef: newBooking.booking_reference,
          submittedBy: user.full_name,
          userEmail: user.email ?? '',
          userRole: roleMap[requesterRole] ?? 'Faculty',
          facilityName: facility.name,
          bookingDate: bookingDateLabel,
          startTime: fmt12h(input.start_time),
          endTime: fmt12h(input.end_time),
          duration: durationLabel,
          purpose: String(input.purpose ?? input.booking_purpose ?? ''),
          eventName: input.event_name ?? undefined,
          adminPanelUrl: `${appUrl}/admin/building/reservations`,
          submittedAt: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
        })
        await sendBrevoEmail({ to: adminEmails, subject, htmlBody }).catch(err =>
          console.error('[bookings] Failed to email building admins about paid booking:', err)
        )
      }

      // Email the booker that their booking is pending approval
      if (user.email) {
        const { subject, htmlBody } = bookingConfirmationEmail({
          userName: user.full_name,
          bookingRef: newBooking.booking_reference,
          facilityName: facility.name,
          bookingDate: bookingDateLabel,
          startTime: fmt12h(input.start_time),
          endTime: fmt12h(input.end_time),
          duration: durationLabel,
          purpose: String(input.purpose ?? input.booking_purpose ?? ''),
          eventName: input.event_name ?? undefined,
          status: 'flagged',
          userRole: roleMap[requesterRole] ?? 'Faculty',
        })
        await sendBrevoEmail({ to: user.email, subject, htmlBody }).catch(err =>
          console.error('[bookings] Failed to email booker about pending review:', err)
        )
      }

      return NextResponse.json({
        status: 'pending',
        booking_id: newBooking.id,
        booking_reference: newBooking.booking_reference,
        requires_payment: true,
        ...(submissionPaymentId ? { payment_id: submissionPaymentId } : {}),
        message: 'Booking requires payment and is pending manual review.',
      }, { status: 201 })
    }

    // For external_paid bookings that don't require gym payment, create a payment
    // record so the booking appears in the Payment page for the user to pay.
    if (bookingType === 'external_paid' && !requiresPayment) {
      const { amount, breakdown } = await BookingPaymentService.calculateAmount({
        start_time: input.start_time,
        end_time: input.end_time,
        booking_facilities: { facility_id: input.facility_id },
        metadata: (input.addon_sound || input.addon_led)
          ? { addon_sound: input.addon_sound ?? false, addon_led: input.addon_led ?? false }
          : undefined,
      })

      await supabase.from('payments').insert({
        booking_id: newBooking.id,
        user_id: user.id,
        amount,
        currency: 'PHP',
        payment_method: 'qr_manual',
        payment_status: 'pending',
        payment_type: 'booking',
        description: `${facility.name} ${input.booking_purpose} booking — payment required`,
        metadata: {
          booking_purpose: input.booking_purpose,
          facility_name: facility.name,
          cost_breakdown: breakdown,
        },
      })

      // Update booking to reflect payment is required
      await supabase.from('bookings').update({
        requires_payment: true,
        internal_notes: 'External booking — payment required to confirm.',
        updated_at: new Date().toISOString(),
      }).eq('id', newBooking.id)
    }

    // Async backend: return 201 immediately, then run the decision pipeline server-side
    // via after(). Unlike the previous client fire-and-forget, this is GUARANTEED to run
    // on the server after the response is flushed — closing tabs / dropped requests can no
    // longer orphan a booking in 'pending'. The pipeline is idempotent (see the
    // pipeline_processed_at claim in processBooking), so the cron sweeper is a pure safety
    // net and can never double-process. The client resolves the outcome over realtime.
    after(async () => {
      console.log(`[bookings] after() callback triggered for ${newBooking.id}`)
      try {
        const result = await processBooking(supabase, newBooking.id)
        console.log(`[bookings] Pipeline completed for ${newBooking.id}:`, result.status)
      } catch (err) {
        console.error(`[bookings] Background pipeline failed for ${newBooking.id}:`, getErrorDetails(err))
        // Left as 'pending' with pipeline_processed_at still NULL → the sweeper will retry.
      }
    })

    return NextResponse.json(
      {
        status: 'processing',
        booking_id: newBooking.id,
        booking_reference: newBooking.booking_reference,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = getErrorMessage(err)
    console.error('[API] POST /bookings error:', getErrorDetails(err))
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
