import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { resolveUserEmail } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'
import { getErrorMessage } from '@/lib/errors'

const BodySchema = z.object({
  message: z.string().max(1000).nullish().transform(s => s && s.trim().length > 0 ? s.trim() : undefined),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'booking id')
  if (!idCheck.ok) return idCheck.response

  const body = await request.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  const adminMessage = parsed.success ? parsed.data.message : undefined

  const supabase = createAdminClient()

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, booking_date, start_time, end_time, reschedule_deadline, original_date, original_start_time, original_end_time, original_facility_id, booking_facilities(facility_id, facilities(name))')
      .eq('id', idCheck.value)
      .single()

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const eligibleStatuses = [
      'approved',
      'auto_approved',
      'awaiting_reschedule',
      'pending_user_response',
      'pending_faculty_response',
      'on_hold'
    ]

    if (!eligibleStatuses.includes(booking.current_status)) {
      return NextResponse.json({ error: `Booking status '${booking.current_status}' is not eligible for reschedule requests` }, { status: 400 })
    }

    const facilityArr = Array.isArray(booking.booking_facilities) ? booking.booking_facilities : [booking.booking_facilities]
    const facilityId = (facilityArr[0] as any)?.facility_id ?? null
    const facilityName = (facilityArr[0]?.facilities as { name?: string } | null)?.name ?? 'Facility'

    const deadline = booking.reschedule_deadline ?? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    const origDate = booking.original_date ?? booking.booking_date
    const origStart = booking.original_start_time ?? booking.start_time
    const origEnd = booking.original_end_time ?? booking.end_time
    const origFacilityId = booking.original_facility_id ?? facilityId

    // Ensure displacement tracking columns are set
    await supabase
      .from('bookings')
      .update({
        reschedule_deadline: deadline,
        original_date: origDate,
        original_start_time: origStart,
        original_end_time: origEnd,
        original_facility_id: origFacilityId,
      })
      .eq('id', booking.id)

    // Create booking_override with request_user_to_pick
    const { data: override, error: overrideError } = await supabase
      .from('booking_overrides')
      .insert({
        booking_id: booking.id,
        override_action: 'reschedule',
        original_values: {
          booking_date: origDate,
          start_time: origStart,
          end_time: origEnd,
        },
        new_values: { request_user_to_pick: true },
        reason: adminMessage ?? 'Building Admin requests you reschedule this booking.',
        overridden_by: user!.id,
        request_user_to_pick: true,
      })
      .select('id')
      .single()

    if (overrideError) return NextResponse.json({ error: overrideError.message }, { status: 500 })

    // Update booking status to awaiting_reschedule if not already
    if (booking.current_status !== 'awaiting_reschedule') {
      await supabase.rpc('update_booking_status', {
        p_booking_id: booking.id,
        p_new_status: 'awaiting_reschedule',
        p_changed_by_user_id: user!.id,
        p_changed_by_ai: false,
        p_reason: adminMessage ?? 'Building Admin requests reschedule',
        p_metadata: { override_id: override?.id, request_user_to_pick: true },
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const rescheduleUrl = `${appUrl}/reservations/reschedule/${booking.id}`

    // Notify user
    void sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Reschedule Requested — Please Pick a New Date',
      message: `Building Admin requests you reschedule booking ${booking.booking_reference} (${facilityName}). Please pick a new date and time.${adminMessage ? ' Note: ' + adminMessage : ''}`,
      type: 'warning',
      priority: 'urgent',
      source_type: 'booking',
      source_id: booking.id,
      action_url: rescheduleUrl,
    })

    // Email user
    void (async () => {
      const { emailTo, name } = await resolveUserEmail(supabase, booking.user_id)
      if (!emailTo) return
      const { askUserToRescheduleEmail } = await import('@/backend/notifications/emailTemplates')
      const template = askUserToRescheduleEmail({
        userName: name ?? 'Valued User',
        bookingRef: booking.booking_reference,
        facilityName,
        message: adminMessage ?? 'Please pick a new date and time for your booking.',
      })
      await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
        .catch(err => console.error('[ask-reschedule] email failed:', err))
    })()

    await AdminAuditService.log({
      actorId: user!.id,
      action: 'ask_user_to_reschedule',
      targetType: 'booking',
      targetId: booking.id,
      details: { override_id: override?.id },
    })

    return NextResponse.json({ success: true, message: 'Reschedule request sent to user.' })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
