import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { checkBookingConflict } from '@/lib/bookings/check-conflict'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { bookingChangeProposedEmail } from '@/backend/notifications/emailTemplates'

const ProposeSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
  proposed_date: z.string().optional(),
  proposed_start_time: z.string().optional(),
  proposed_end_time: z.string().optional(),
  proposed_facility_id: z.string().uuid().optional(),
}).refine(
  d => d.proposed_date || d.proposed_start_time || d.proposed_end_time || d.proposed_facility_id,
  { message: 'At least one proposed change is required' }
)

const PROPOSABLE_STATUSES = ['pending', 'flagged', 'auto_approved', 'approved']

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => r.name === 'academic_head')
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head role required' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ProposeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { booking_id, reason, proposed_date, proposed_start_time, proposed_end_time, proposed_facility_id } = parsed.data
  const supabase = createAdminClient()

  try {
    // Load current booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id, user_id, booking_reference, current_status,
        booking_date, start_time, end_time, requires_payment, booking_type,
        booking_facilities(facility_id, facility:facilities(id, name))
      `)
      .eq('id', booking_id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const isPaidBooking = booking.requires_payment || ['internal_paid', 'external_paid'].includes((booking as any).booking_type)
    if (isPaidBooking) {
      return NextResponse.json(
        { error: 'Paid-facility bookings must be managed by Building Admin, not Academic Head.' },
        { status: 403 }
      )
    }

    if (!PROPOSABLE_STATUSES.includes(booking.current_status)) {
      return NextResponse.json(
        { error: `Cannot propose changes for a booking with status: ${booking.current_status}` },
        { status: 400 }
      )
    }

    // Validate proposed facility exists if provided
    if (proposed_facility_id) {
      const { data: facility } = await supabase
        .from('facilities')
        .select('id, name')
        .eq('id', proposed_facility_id)
        .eq('is_active', true)
        .single()
      if (!facility) {
        return NextResponse.json({ error: 'Proposed facility not found or inactive' }, { status: 400 })
      }
    }

    // Capture original values
    const currentFacilityId = (booking.booking_facilities as Array<{ facility_id: string }>)?.[0]?.facility_id
    const originalValues = {
      status: booking.current_status,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      facility_id: currentFacilityId,
    }

    // Conflict check: only run if the proposal would land on a real (date, time, facility) tuple.
    const targetFacilityId = proposed_facility_id ?? currentFacilityId
    const targetDate = proposed_date ?? booking.booking_date
    const targetStart = proposed_start_time ?? booking.start_time
    const targetEnd = proposed_end_time ?? booking.end_time
    if (targetFacilityId) {
      const conflict = await checkBookingConflict(supabase, {
        facility_id: targetFacilityId,
        booking_date: targetDate,
        start_time: targetStart,
        end_time: targetEnd,
        exclude_booking_id: booking_id,
      })
      if (conflict.conflict) {
        return NextResponse.json(
          {
            error: 'Proposed slot conflicts with another booking',
            conflicting_booking_reference: conflict.conflicting_booking_reference,
          },
          { status: 409 }
        )
      }
    }

    // Build proposed new values
    const newValues: Record<string, string> = {}
    if (proposed_date) newValues.booking_date = proposed_date
    if (proposed_start_time) newValues.start_time = proposed_start_time
    if (proposed_end_time) newValues.end_time = proposed_end_time
    if (proposed_facility_id) newValues.facility_id = proposed_facility_id

    // Determine override action
    const hasTimeOrDateChange = proposed_date || proposed_start_time || proposed_end_time
    const overrideAction = proposed_facility_id && !hasTimeOrDateChange ? 'change_facility' : 'reschedule'

    // Store proposal in booking_overrides
    const { data: override, error: insertError } = await supabase
      .from('booking_overrides')
      .insert({
        booking_id,
        override_action: overrideAction,
        original_values: originalValues,
        new_values: newValues,
        reason,
        overridden_by: user.id,
        remaining_window_seconds: null,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    // Set booking to pending_faculty_response
    const { error: rpcError } = await supabase.rpc('update_booking_status', {
      p_booking_id: booking_id,
      p_new_status: 'pending_faculty_response',
      p_changed_by_user_id: user.id,
      p_changed_by_ai: false,
      p_reason: `Academic Head proposed changes: ${reason}`,
      p_metadata: { proposal_type: 'academic_head_proposal', override_id: override.id },
    })

    if (rpcError) throw rpcError

    // Build change summary for notification
    const changes: string[] = []
    if (proposed_date) changes.push(`date to ${proposed_date}`)
    if (proposed_start_time || proposed_end_time) {
      changes.push(`time to ${proposed_start_time ?? booking.start_time}–${proposed_end_time ?? booking.end_time}`)
    }
    if (proposed_facility_id) changes.push('a different facility')

    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Change Proposed',
      message: `The Academic Head proposed changing your booking ${booking.booking_reference}: ${changes.join(', ')}. Reason: ${reason}. Please review and accept or decline.`,
      type: 'warning',
      source_type: 'booking',
      source_id: booking_id,
      priority: 'high',
    })

    // Send proposal email to the faculty (fire-and-forget)
    void (async () => {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('full_name, email, notification_email')
          .eq('id', booking.user_id)
          .single()
        if (!userRow) return
        const recipient = (userRow.notification_email ?? null) as string | null
        if (!recipient) {
          console.warn(`[propose-changes] User ${booking.user_id} has no notification_email set — proposal email skipped`)
          return
        }

        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('roles!inner(name)')
          .eq('user_id', booking.user_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
        const rawRole = (roleRow as any)?.roles?.name ?? ''
        const userRole = rawRole.split('_').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')

        const currentFacilityRaw = Array.isArray((booking as any).booking_facilities)
          ? (booking as any).booking_facilities[0]?.facility
          : null
        const currentFacility =
          (Array.isArray(currentFacilityRaw) ? currentFacilityRaw[0]?.name : currentFacilityRaw?.name) ?? 'your facility'

        let proposedFacility: string | undefined
        if (proposed_facility_id) {
          const { data: facRow } = await supabase
            .from('facilities')
            .select('name')
            .eq('id', proposed_facility_id)
            .single()
          proposedFacility = (facRow as any)?.name ?? undefined
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        await sendBrevoEmail({
          to: recipient,
          ...bookingChangeProposedEmail({
            userName: (userRow.full_name as string) ?? 'User',
            bookingRef: booking.booking_reference ?? booking_id,
            currentFacility,
            currentDate: booking.booking_date ?? '',
            currentStartTime: booking.start_time ?? '',
            currentEndTime: booking.end_time ?? '',
            proposedFacility,
            proposedDate: proposed_date,
            proposedStartTime: proposed_start_time,
            proposedEndTime: proposed_end_time,
            proposedBy: 'Academic Head',
            reason,
            reviewUrl: `${appUrl}/bookings/${booking_id}`,
            userRole,
          }),
        })
      } catch (emailErr) {
        console.error('[propose-changes] email send error:', emailErr instanceof Error ? emailErr.message : emailErr)
      }
    })()

    return NextResponse.json({
      success: true,
      message: `Change proposal sent for booking ${booking.booking_reference}. Awaiting faculty response.`,
      override_id: override.id,
    })
  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : (typeof err === 'object' && err !== null && 'message' in err)
        ? String((err as any).message)
        : 'Unknown error'
    console.error('[API] POST /academic-head/propose-changes error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
