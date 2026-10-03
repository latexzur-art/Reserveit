import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { checkBookingConflict } from '@/lib/bookings/check-conflict'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { checkFacilityPurposeMismatch } from '@/backend/booking/facilityMismatchChecker'
import { checkTimeSlotAvailability } from '@/backend/booking/availabilityService'
import { matchRescheduleRoom, type RoomCandidate } from '@/backend/schedule-events/rescheduleRoomMatcher'

export const dynamic = 'force-dynamic'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * GET /api/class-schedules/reschedule-offer/[id]
 * [id] = class_schedule_reschedule_offers.id
 * Returns offer details for an instructor whose class was displaced.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id } = await params
  const flexible = request.nextUrl.searchParams.get('flexible') === 'true'
  const supabase = createAdminClient()

  const { data: offer, error } = await supabase
    .from('class_schedule_reschedule_offers')
    .select(`
      id, class_schedule_id, affected_date, status, deadline,
      new_date, new_start_time, new_end_time, new_facility_id,
      class_schedule:class_schedule_id(
        id, course_code, course_name, section, start_time, end_time, instructor_id,
        facility:facilities(id, name, room_number)
      ),
      block_event:block_event_id( event_name )
    `)
    .eq('id', id)
    .single()

  if (error || !offer) {
    return NextResponse.json({ error: 'Offer not found.' }, { status: 404 })
  }

  const cs = Array.isArray(offer.class_schedule) ? offer.class_schedule[0] : offer.class_schedule as any
  if (cs?.instructor_id !== user!.id) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  }
  if (offer.status !== 'pending') {
    return NextResponse.json({ error: 'This offer is no longer active.' }, { status: 400 })
  }
  if (offer.deadline && new Date(offer.deadline) < new Date()) {
    return NextResponse.json({ error: 'The deadline has passed.' }, { status: 410 })
  }

  const facility = Array.isArray(cs?.facility) ? cs.facility[0] : cs?.facility
  const origStart = (cs?.start_time as string)?.slice(0, 5)
  const origEnd = (cs?.end_time as string)?.slice(0, 5)
  const duration = timeToMinutes(origEnd) - timeToMinutes(origStart)
  const blockEvent = Array.isArray(offer.block_event) ? offer.block_event[0] : offer.block_event

  // Find alternative facilities using smart room matcher
  const { data: currentFac } = await supabase
    .from('facilities')
    .select('capacity, floor_id, facility_type_id, facility_type:facility_type_id(name)')
    .eq('id', facility?.id ?? '')
    .single()

  const sessionType = cs?.session_type as 'lecture' | 'lab' | null
  const originalTypeName = (currentFac as any)?.facility_type?.name ?? null

  // Get original room's specialized tag
  const { data: origTags } = await supabase
    .from('facility_purpose_tags')
    .select('tag')
    .eq('facility_id', facility?.id ?? '')
    .limit(1)
  const originalTag = origTags?.[0]?.tag ?? null

  // Query available candidates with type info
  const { data: rawCandidates } = await supabase
    .from('facilities')
    .select(`
      id, name, room_number, capacity, floor_id,
      facility_type:facility_type_id(name),
      facility_purpose_tags(tag)
    `)
    .eq('status', 'available')
    .neq('id', facility?.id ?? '')
    .limit(20)

  const candidates: RoomCandidate[] = (rawCandidates ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    room_number: f.room_number,
    capacity: f.capacity,
    facility_type_name: f.facility_type?.name ?? null,
    specialized_tag: f.facility_purpose_tags?.[0]?.tag ?? null,
  }))

  const originalRoom: RoomCandidate = {
    id: facility?.id ?? '',
    name: facility?.name ?? '',
    room_number: facility?.room_number ?? null,
    capacity: currentFac?.capacity ?? null,
    facility_type_name: originalTypeName,
    specialized_tag: originalTag,
  }

  const matchResult = matchRescheduleRoom(originalRoom, candidates, { session_type: sessionType, flexible })

  // Check availability for top matches (max5)
  const alternatives: { id: string; name: string; room_number: string | null; capacity: number | null; matchScore: number }[] = []
  for (const m of matchResult.matches.slice(0, 5)) {
    const check = await checkTimeSlotAvailability(supabase, m.id, offer.affected_date, origStart, origEnd)
    if (check.available) {
      alternatives.push({ id: m.id, name: m.name, room_number: m.room_number, capacity: m.capacity, matchScore: m.matchScore })
    }
    if (alternatives.length >= 3) break
  }

  return NextResponse.json({
    offer_id: offer.id,
    class_schedule_id: offer.class_schedule_id,
    course_code: cs?.course_code ?? cs?.course_name,
    section: cs?.section,
    affected_date: offer.affected_date,
    original_start: origStart,
    original_end: origEnd,
    duration_minutes: duration,
    original_facility: facility ? { id: facility.id, name: facility.name, room_number: facility.room_number } : null,
    deadline: offer.deadline,
    displaced_by: (blockEvent as any)?.event_name ?? null,
    alternative_facilities: alternatives,
    no_match_reason: matchResult.noMatchReason ?? null,
    can_widen: matchResult.canWiden ?? false,
  })
}

const PostSchema = z.object({
  new_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  new_start:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).transform(t => t.slice(0, 5)),
  new_end:       z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).transform(t => t.slice(0, 5)),
  new_facility_id: z.string().uuid('facility_id must be a UUID'),
})

/**
 * POST /api/class-schedules/reschedule-offer/[id]
 * Instructor selects a new date/room for the displaced class session.
 * Instantly creates a one-off class session booking + adds a class_schedule_exception.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error', check: 'VALIDATION' }, { status: 400 })
  }

  const { new_date, new_start, new_end, new_facility_id } = parsed.data

  if (timeToMinutes(new_end) <= timeToMinutes(new_start)) {
    return NextResponse.json({ error: 'End time must be after start time.', check: 'TIME_ORDER' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  if (new_date < today) {
    return NextResponse.json({ error: 'Cannot reschedule to a past date.', check: 'PAST_DATE' }, { status: 400 })
  }

  const { id } = await params
  const supabase = createAdminClient()

  const { data: offer, error: offerErr } = await supabase
    .from('class_schedule_reschedule_offers')
    .select(`
      id, class_schedule_id, affected_date, status, deadline, block_event_id,
      class_schedule:class_schedule_id(
        id, course_code, course_name, section, start_time, end_time, instructor_id,
        department_id, session_type
      )
    `)
    .eq('id', id)
    .single()

  if (offerErr || !offer) {
    return NextResponse.json({ error: 'Offer not found.' }, { status: 404 })
  }

  const cs = (Array.isArray(offer.class_schedule) ? offer.class_schedule[0] : offer.class_schedule) as any
  if (cs?.instructor_id !== user!.id) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  }
  if (offer.status !== 'pending') {
    return NextResponse.json({ error: 'This offer is no longer active.', check: 'STATUS' }, { status: 400 })
  }
  if (offer.deadline && new Date(offer.deadline) < new Date()) {
    return NextResponse.json({ error: 'The deadline has passed.', check: 'DEADLINE' }, { status: 410 })
  }

  // Duration check
  const origStart = (cs?.start_time as string)?.slice(0, 5)
  const origEnd = (cs?.end_time as string)?.slice(0, 5)
  const origDuration = timeToMinutes(origEnd) - timeToMinutes(origStart)
  const newDuration = timeToMinutes(new_end) - timeToMinutes(new_start)
  if (newDuration !== origDuration) {
    return NextResponse.json({
      error: `New duration (${newDuration} min) must match original duration (${origDuration} min).`,
      check: 'DURATION_MISMATCH',
    }, { status: 400 })
  }

  // Smart room type validation — hard constraint: lab rooms must match by specialized_tag
  const { data: origFacility } = await supabase
    .from('facilities')
    .select('facility_type:facility_type_id(name)')
    .eq('id', cs?.facility_id ?? '')
    .single()
  const { data: origTagRows } = await supabase
    .from('facility_purpose_tags').select('tag').eq('facility_id', cs?.facility_id ?? '').limit(1)
  const origTag = origTagRows?.[0]?.tag ?? null
  const origTypeName = (origFacility as any)?.facility_type?.name ?? null

  const { data: newFacRow } = await supabase
    .from('facilities')
    .select('facility_type:facility_type_id(name)')
    .eq('id', new_facility_id)
    .single()
  const { data: newTagRows } = await supabase
    .from('facility_purpose_tags').select('tag').eq('facility_id', new_facility_id).limit(1)
  const newTag = newTagRows?.[0]?.tag ?? null
  const newTypeName = (newFacRow as any)?.facility_type?.name ?? null

  const LAB_TAGS = new Set(['computer_use', 'science_lab', 'hospitality_lab', 'av_studio'])
  const origIsLab = (origTag && LAB_TAGS.has(origTag)) || (origTypeName?.toLowerCase().includes('lab') ?? false)

  if (origIsLab && origTag) {
    if (newTag !== origTag) {
      const tagLabels: Record<string, string> = {
        computer_use: 'Computer Lab',
        science_lab: 'Science Lab',
        hospitality_lab: 'Hospitality Lab',
        av_studio: 'AV Studio',
      }
      return NextResponse.json({
        error: `This class requires a ${tagLabels[origTag] ?? origTag} room. The selected room is a ${newTag ? (tagLabels[newTag] ?? newTag) : (newTypeName ?? 'general')} room.`,
        check: 'ROOM_TYPE_MISMATCH',
      }, { status: 400 })
    }
  }

  // Conflict check at new slot
  const conflict = await checkBookingConflict(supabase, {
    facility_id: new_facility_id,
    booking_date: new_date,
    start_time: new_start,
    end_time: new_end,
  })
  if (conflict.conflict) {
    return NextResponse.json({
      error: `That slot is already booked${(conflict as any).conflicting_booking_reference ? ` (ref: ${(conflict as any).conflicting_booking_reference})` : ''}.`,
      check: 'CONFLICT',
    }, { status: 409 })
  }

  // ── Apply: update offer + ensure exception for original date + create one-off booking ─
  await supabase
    .from('class_schedule_reschedule_offers')
    .update({
      status: 'rescheduled',
      new_date,
      new_start_time: new_start,
      new_end_time: new_end,
      new_facility_id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id)

  // Ensure class_schedule_exception for original date
  await supabase
    .from('class_schedule_exceptions')
    .upsert({
      schedule_id: offer.class_schedule_id,
      exception_date: offer.affected_date,
      reason: 'Rescheduled by instructor (school event displacement)',
    }, { onConflict: 'schedule_id,exception_date' })

  // Get facility data for the new facility
  const { data: newFacility } = await supabase
    .from('facilities')
    .select('name, room_number')
    .eq('id', new_facility_id)
    .single()

  // Create a one-off booking for the new session
  // Check auto-approve toggle
  const { data: autoApproveSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'reschedule_auto_approve')
    .single()
  const autoApprove = autoApproveSetting?.value !== 'false'

  const { data: newBooking } = await supabase
    .from('bookings')
    .insert({
      user_id: user!.id,
      booking_reference: '',
      booking_type: 'class_makeup',
      booking_purpose: 'academic',
      booking_date: new_date,
      start_time: new_start,
      end_time: new_end,
      purpose: `Class makeup: ${cs?.course_code ?? cs?.course_name} ${cs?.section} (rescheduled from ${offer.affected_date})`,
      current_status: autoApprove ? 'auto_approved' : 'pending',
      class_schedule_id: offer.class_schedule_id,
      block_event_id: offer.block_event_id,
    })
    .select('id, booking_reference')
    .single()

  if (newBooking) {
    await supabase.from('booking_facilities').insert({
      booking_id: newBooking.id,
      facility_id: new_facility_id,
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // In-app notification to instructor
  const statusLabel = autoApprove ? 'Confirmed' : 'Pending Admin Approval'
  await sendNotification(supabase, {
    user_id: user!.id,
    title: `Class Session Rescheduled — ${statusLabel}`,
    message: `Your class ${cs?.course_code ?? cs?.course_name} ${cs?.section} has been rescheduled to ${new_date} (${new_start}–${new_end})${newFacility ? ` at ${newFacility.name}` : ''}.${autoApprove ? '' : ' Awaiting Building Admin approval.'}`,
    type: autoApprove ? 'success' : 'warning',
    source_type: 'special_event',
    priority: 'normal',
    action_url: `${baseUrl}/faculty/schedule`,
  })

  // Email
  const { data: instrUser } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', user!.id)
    .single()

  if (instrUser?.email) {
    await sendBrevoEmail({
      to: instrUser.email,
      subject: `[ReserveIT] Class Session Rescheduled — ${cs?.course_code ?? cs?.course_name} (${new_date})`,
      htmlBody: `<p>Hi ${instrUser.full_name ?? instrUser.email},</p>
        <p>Your class <strong>${cs?.course_code ?? cs?.course_name} ${cs?.section}</strong> has been rescheduled to <strong>${new_date}</strong> (${new_start}–${new_end})${newFacility ? ` at <strong>${newFacility.name}</strong>` : ''}.</p>
        <p>The new session has been added to your calendar and instantly approved.</p>`,
    })
  }

  return NextResponse.json({
    success: true,
    offer_id: id,
    new_date,
    new_start,
    new_end,
    new_facility_id,
    one_off_booking_id: newBooking?.id ?? null,
    message: 'Class session rescheduled and confirmed.',
  })
}
