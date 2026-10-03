import { NextRequest, NextResponse } from 'next/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { checkBookingConflict } from '@/lib/bookings/check-conflict'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  reservationRescheduledInstantEmail,
  downgradeCreditOwedEmail,
} from '@/backend/notifications/emailTemplates'
import { checkFacilityPurposeMismatch } from '@/backend/booking/facilityMismatchChecker'
import { BuildingPricingService } from '@/backend/admin/building/building-pricing.service'
import { computeBookingAmount } from '@/backend/booking/computeBookingAmount'
import { resolveUserPageUrls, getBuildingAdminEmails } from '@/backend/notifications/recipientResolver'

export const dynamic = 'force-dynamic'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * GET /api/bookings/[id]/reschedule-offer
 * Returns the reschedule offer details for an awaiting_reschedule booking owned by the caller.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const id = __idParsed.value
  const supabase = createAdminClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_reference, current_status, reschedule_deadline,
      original_date, original_start_time, original_end_time, original_facility_id,
      booking_date, start_time, end_time, session_type, booking_purpose,
      booking_facilities( facility_id, facilities(id, name, room_number) ),
      block_event:block_event_id( event_name )
    `)
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found or access denied.' }, { status: 404 })
  }
  if (booking.current_status !== 'awaiting_reschedule') {
    return NextResponse.json({ error: 'This booking is not awaiting reschedule.' }, { status: 400 })
  }
  if (booking.reschedule_deadline && new Date(booking.reschedule_deadline) < new Date()) {
    return NextResponse.json({ error: 'The reschedule deadline has passed.' }, { status: 410 })
  }

  const origStart = (booking.original_start_time as string)?.slice(0, 5) ?? (booking.start_time as string)?.slice(0, 5)
  const origEnd = (booking.original_end_time as string)?.slice(0, 5) ?? (booking.end_time as string)?.slice(0, 5)
  const durationMinutes = timeToMinutes(origEnd) - timeToMinutes(origStart)

  const blockEvent = Array.isArray(booking.block_event) ? booking.block_event[0] : booking.block_event

  // Check for completed payment (for refund option)
  const { data: payment } = await supabase
    .from('payments')
    .select('id, total_amount')
    .eq('booking_id', id)
    .eq('payment_status', 'completed')
    .maybeSingle()

  return NextResponse.json({
    id: booking.id,
    booking_reference: booking.booking_reference,
    original_date: booking.original_date ?? booking.booking_date,
    original_start: origStart,
    original_end: origEnd,
    duration_minutes: durationMinutes,
    session_type: booking.session_type,
    deadline: booking.reschedule_deadline,
    displaced_by: (blockEvent as any)?.event_name ?? null,
    original_facility: (() => {
      const bf = Array.isArray(booking.booking_facilities) ? booking.booking_facilities[0] : booking.booking_facilities
      const f = (bf as any)?.facilities
      return f ? { id: f.id, name: f.name, room_number: f.room_number } : null
    })(),
    has_completed_payment: !!payment,
    payment_amount: payment?.total_amount ?? null,
    payment_id: payment?.id ?? null,
  })
}

const PostSchema = z.object({
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  start_time:   z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).transform(t => t.slice(0, 5)),
  end_time:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).transform(t => t.slice(0, 5)),
  facility_id:  z.string().uuid('facility_id must be a UUID'),
})

/**
 * POST /api/bookings/[id]/reschedule-offer
 * Submit the user's chosen new slot for an awaiting_reschedule booking.
 * Instant approval if all checks pass (same duration, no conflict, room suitable).
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error', field: parsed.error.issues[0]?.path[0] }, { status: 400 })
  }

  const { booking_date, start_time, end_time, facility_id } = parsed.data

  if (timeToMinutes(end_time) <= timeToMinutes(start_time)) {
    return NextResponse.json({ error: 'End time must be after start time.', check: 'TIME_ORDER' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  if (booking_date < today) {
    return NextResponse.json({ error: 'Cannot reschedule to a past date.', check: 'PAST_DATE' }, { status: 400 })
  }

  const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const id = __idParsed.value
  const supabase = createAdminClient()

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select(`
      id, user_id, booking_reference, current_status, reschedule_deadline,
      original_date, original_start_time, original_end_time, original_facility_id,
      booking_date, start_time, end_time, session_type, booking_purpose,
      department_id, booking_facilities( facility_id )
    `)
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (bookingErr || !booking) {
    return NextResponse.json({ error: 'Booking not found or access denied.' }, { status: 404 })
  }
  if (booking.current_status !== 'awaiting_reschedule') {
    return NextResponse.json({ error: 'This booking is not awaiting reschedule.', check: 'STATUS' }, { status: 400 })
  }
  if (booking.reschedule_deadline && new Date(booking.reschedule_deadline) < new Date()) {
    return NextResponse.json({ error: 'The reschedule deadline has passed.', check: 'DEADLINE_PASSED' }, { status: 410 })
  }

  // ── Validate same duration ───────────────────────────────────────────────────
  const origStart = (booking.original_start_time as string)?.slice(0, 5) ?? (booking.start_time as string)?.slice(0, 5)
  const origEnd   = (booking.original_end_time as string)?.slice(0, 5) ?? (booking.end_time as string)?.slice(0, 5)
  const origDuration = timeToMinutes(origEnd) - timeToMinutes(origStart)
  const newDuration  = timeToMinutes(end_time) - timeToMinutes(start_time)

  if (newDuration !== origDuration) {
    return NextResponse.json({
      error: `New duration (${newDuration} min) must match original duration (${origDuration} min).`,
      check: 'DURATION_MISMATCH',
      original_duration: origDuration,
    }, { status: 400 })
  }

  // ── Active term check (skip for school_event purpose) ───────────────────────
  if (booking.booking_purpose !== 'school_event' && booking.booking_purpose !== 'personal' && booking.booking_purpose !== 'commercial' && booking.booking_purpose !== 'community') {
    const { data: activeTerm } = await supabase
      .from('academic_terms')
      .select('term_name, start_date, end_date')
      .eq('is_active', true)
      .maybeSingle()

    if (activeTerm && (booking_date < activeTerm.start_date || booking_date > activeTerm.end_date)) {
      return NextResponse.json({
        error: `The new date is outside the active term (${activeTerm.term_name}: ${activeTerm.start_date} to ${activeTerm.end_date}).`,
        check: 'OUTSIDE_TERM',
      }, { status: 400 })
    }
  }

  // ── Facility suitability check ───────────────────────────────────────────────
  if (booking.session_type) {
    const { data: facilityData } = await supabase
      .from('facilities')
      .select('id, primary_department_id')
      .eq('id', facility_id)
      .single()

    if (facilityData) {
      const mismatch = await checkFacilityPurposeMismatch(supabase, {
        facilityId: facility_id,
        departmentId: (booking as any).department_id ?? null,
        facilityPurposeCategory: null,
        justificationText: null,
        sessionType: booking.session_type as 'lecture' | 'lab' | null,
      })

      if (mismatch.flag === 'SESSION_LECTURE_IN_LAB_MISMATCH' && mismatch.forceManualReview) {
        return NextResponse.json({
          error: 'The selected room is a lab facility, but your session type is Lecture. Please choose a lecture-suitable room.',
          check: 'SESSION_LECTURE_IN_LAB_MISMATCH',
        }, { status: 400 })
      }
    }
  }

  // ── Conflict check ───────────────────────────────────────────────────────────
  const conflict = await checkBookingConflict(supabase, {
    facility_id,
    booking_date,
    start_time,
    end_time,
    exclude_booking_id: id,
  })
  if (conflict.conflict) {
    return NextResponse.json({
      error: `That time slot is already booked${(conflict as any).conflicting_booking_reference ? ` (ref: ${(conflict as any).conflicting_booking_reference})` : ''}.`,
      check: 'CONFLICT',
    }, { status: 409 })
  }

  // ── Rate differential check ─────────────────────────────────────────────────
  const currentFacilityId = Array.isArray(booking.booking_facilities)
    ? (booking.booking_facilities[0] as any)?.facility_id
    : (booking.booking_facilities as any)?.facility_id

  const origRates = currentFacilityId ? await BuildingPricingService.getRateConfig(currentFacilityId) : undefined
  const newRates = facility_id !== currentFacilityId
    ? await BuildingPricingService.getRateConfig(facility_id)
    : origRates

  const { amount: origAmount } = computeBookingAmount(origStart, origEnd, undefined, origRates)
  const { amount: newAmount } = computeBookingAmount(start_time, end_time, undefined, newRates)

  if (newAmount > origAmount) {
    const diffCentavos = Math.round((newAmount - origAmount) * 100)
    return NextResponse.json({
      error: `Reschedule to the selected facility would cost ₱${((newAmount - origAmount)).toFixed(2)} more. Please choose a same-tier or lower-tier facility, or contact the helpdesk.`,
      check: 'RATE_DIFFERENTIAL',
      price_difference_centavos: diffCentavos,
      original_amount_centavos: Math.round(origAmount * 100),
      new_amount_centavos: Math.round(newAmount * 100),
    }, { status: 400 })
  }

  // ── Downgrade credit: notify BA when rescheduling to a cheaper slot ────────
  let downgradeCreditCentavos = 0
  if (newAmount < origAmount) {
    downgradeCreditCentavos = Math.round((origAmount - newAmount) * 100)
  }

  // ── All checks passed — apply instant approval ───────────────────────────────
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({
      current_status: 'auto_approved',
      booking_date,
      start_time,
      end_time,
      block_event_id: null,
      reschedule_deadline: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to apply reschedule.', check: 'DB_ERROR' }, { status: 500 })
  }

  // Update facility if changed (currentFacilityId already resolved above)
  if (facility_id !== currentFacilityId) {
    await supabase
      .from('booking_facilities')
      .update({ facility_id })
      .eq('booking_id', id)
  }

  // Audit log
  try {
    await supabase.from('booking_overrides').insert({
      booking_id: id,
      override_type: 'reschedule',
      performed_by: user!.id,
      notes: `Self-rescheduled (reschedule offer) to ${booking_date} ${start_time}–${end_time}`,
    })
  } catch {}

  // Notify Building Admin if downgrade credit is owed
  if (downgradeCreditCentavos > 0) {
    const creditPesos = (downgradeCreditCentavos / 100).toFixed(2)
    await sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Downgrade Credit — Reschedule',
      message: `Booking ${booking.booking_reference} was rescheduled to a cheaper slot (₱${creditPesos} credit owed). Original: ₱${origAmount.toFixed(2)}, New: ₱${newAmount.toFixed(2)}. Please process the partial refund.`,
      type: 'info',
      source_type: 'booking',
      source_id: id,
      priority: 'normal',
    })

    // Email BAs about the downgrade credit
    void (async () => {
      const adminEmails = await getBuildingAdminEmails()
      if (adminEmails.length > 0) {
        const { subject, htmlBody } = downgradeCreditOwedEmail({
          bookingRef: booking.booking_reference,
          originalAmount: `₱${origAmount.toFixed(2)}`,
          newAmount: `₱${newAmount.toFixed(2)}`,
          creditAmount: `₱${creditPesos}`,
        })
        void sendBrevoEmail({ to: adminEmails, subject, htmlBody }).catch(console.error)
      }
    })()
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { bookingsUrl } = await resolveUserPageUrls(supabase, user!.id)

  // In-app confirmation
  await sendNotification(supabase, {
    user_id: user!.id,
    title: 'Booking Rescheduled — Confirmed',
    message: `Your booking (${booking.booking_reference}) has been rescheduled to ${booking_date} ${start_time}–${end_time} and instantly approved.`,
    type: 'success',
    source_type: 'booking',
    source_id: id,
    priority: 'normal',
    action_url: `${baseUrl}${bookingsUrl}`,
  })

  // Email confirmation
  const { data: userRow } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', user!.id)
    .single()

  if (userRow?.email) {
    const { data: facilityRow } = await supabase
      .from('facilities')
      .select('name')
      .eq('id', facility_id)
      .single()

    const { subject, htmlBody } = reservationRescheduledInstantEmail({
      userName: userRow.full_name ?? userRow.email,
      bookingReference: booking.booking_reference ?? id,
      newDate: booking_date,
      newStart: start_time,
      newEnd: end_time,
      newFacility: facilityRow?.name ?? 'N/A',
      dashboardUrl: `${baseUrl}${bookingsUrl}`,
    })
    await sendBrevoEmail({ to: userRow.email, subject, htmlBody })
  }

  return NextResponse.json({
    success: true,
    booking_reference: booking.booking_reference,
    booking_date,
    start_time,
    end_time,
    facility_id,
    message: 'Booking rescheduled and instantly approved.',
  })
}
