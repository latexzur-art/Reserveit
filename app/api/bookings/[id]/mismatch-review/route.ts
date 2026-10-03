import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { mismatchDecisionEmail, mismatchReviewBroadcastEmail } from '@/backend/notifications/emailTemplates'
import { getBuildingAdminEmails, getAcademicHeadEmail } from '@/backend/notifications/recipientResolver'
import { approveMismatchBooking } from '@/backend/booking/mismatchApproval'

const MismatchReviewSchema = z.object({
  action: z.enum(['approve', 'decline', 'suggest_alternative']),
  alternative_facility_id: z.string().uuid().optional(),
  reviewer_notes: z.string().max(1000).optional(),
  alternative_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  alternative_start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  alternative_end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => ['academic_head', 'building_admin'].includes(r.name))
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head or building_admin role required' }, { status: 403 })
  }

  const { id: rawId } = await params
  const idParse = z.string().uuid().safeParse(rawId)
  if (!idParse.success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }
  const bookingId = idParse.data

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = MismatchReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { action, alternative_facility_id, reviewer_notes, alternative_date, alternative_start_time, alternative_end_time } = parsed.data
  const supabase = createAdminClient()

  // L2: 'approve' is handled by the shared approveMismatchBooking() so the single-
  // booking path and the batch-approve endpoint (app/api/academic-head/mismatch-reviews/
  // batch-approve) can't drift apart. Branch here, before the decline/suggest_alternative
  // setup below (which approve no longer needs — it does its own fetch internally).
  if (action === 'approve') {
    const result = await approveMismatchBooking(supabase, bookingId, user, reviewer_notes)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    }
    return NextResponse.json({ status: 'approved', booking_id: result.booking_id })
  }

  try {
    // Verify booking exists and is a mismatch-flagged booking assigned to academic_head
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, mismatch_flag, assigned_reviewer_role, booking_date, start_time, end_time, booking_facilities(facility_id, facility:facilities(name))')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (!booking.mismatch_flag) {
      return NextResponse.json({ error: 'This booking does not have a mismatch flag' }, { status: 400 })
    }

    // Build rich metadata for notifications
    const bookingFacilities = booking.booking_facilities as Array<{ facility_id: string; facility: { name: string } | Array<{ name: string }> | null }> | null
    const facRaw = bookingFacilities?.[0]?.facility
    const facilityName = facRaw ? (Array.isArray(facRaw) ? facRaw[0]?.name : (facRaw as { name: string }).name) : null
    const { data: requesterData } = await supabase.from('users').select('full_name, email, notification_email').eq('id', booking.user_id).single()
    const fmt12h = (t: string) => { const [hStr, mStr] = t.split(':'); const h = parseInt(hStr, 10); return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const facultyEmail = requesterData?.notification_email ?? null
    if (!facultyEmail) {
      console.warn(`[mismatch-review] User ${booking.user_id} has no notification_email set — skipping faculty email`)
    }
    const formattedDate = new Date((booking as any).booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    const reviewerRole = user.roles?.some((r: { name: string }) => r.name === 'building_admin')
      ? 'building_admin' as const
      : 'academic_head' as const
    const emailBaseData = {
      bookingReference: booking.booking_reference,
      facultyName: requesterData?.full_name ?? 'Faculty',
      facilityName: facilityName ?? 'Unknown Facility',
      bookingDate: formattedDate,
      startTime: fmt12h((booking as any).start_time),
      endTime: fmt12h((booking as any).end_time),
      reviewerNotes: reviewer_notes,
      statusUrl: `${appUrl}/faculty/reservations`,
      reviewerRole,
    }
    const reviewMeta: Record<string, unknown> = {
      booking_reference: booking.booking_reference,
      requester_name: requesterData?.full_name ?? 'Unknown',
      facility_name: facilityName ?? 'Unknown Facility',
      booking_date: new Date((booking as any).booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
      start_time: fmt12h((booking as any).start_time),
      end_time: fmt12h((booking as any).end_time),
      decided_by_name: user.full_name ?? user.email,
      decided_by_role: 'Academic Head',
    }

    // Helper: notify the "other" stakeholders (building admins + academic heads) about a decision,
    // excluding the actor themselves. Used so the mismatch queue is in sync across both roles.
    const broadcastReviewToOtherStaff = async (
      decisionLabel: string,
      inAppMessage: string,
      type: 'success' | 'error' | 'info' | 'warning',
      opts: { alternativeFacilityName?: string } = {},
    ) => {
      try {
        // In-app: fan out to both roles
        await sendNotificationToRoles(supabase, ['building_admin', 'academic_head'], {
          title: decisionLabel,
          message: inAppMessage,
          type,
          source_type: 'booking',
          source_id: bookingId,
          priority: 'normal',
          metadata: { ...reviewMeta, actor_id: user.id, action },
        })
        // Email: fan out to building admins + academic head, skipping the actor's own address
        const [adminEmails, ahEmail] = await Promise.all([
          getBuildingAdminEmails(),
          getAcademicHeadEmail(),
        ])
        const actorEmail = (user as any).email
        const recipients = [...new Set([...(adminEmails ?? []), ...(ahEmail ? [ahEmail] : [])])]
          .filter(e => e && e !== actorEmail)
        if (recipients.length === 0) return
        const actorRoleLabel = user.roles?.some((r: { name: string }) => r.name === 'building_admin')
          ? 'Building Admin' : 'Academic Head'
        const ep = mismatchReviewBroadcastEmail({
          action,
          bookingReference: booking.booking_reference,
          actorName: user.full_name ?? 'A reviewer',
          actorRoleLabel,
          requesterName: requesterData?.full_name ?? 'Unknown',
          originalFacilityName: facilityName ?? 'Unknown Facility',
          alternativeFacilityName: opts.alternativeFacilityName,
          bookingDate: formattedDate,
          startTime: fmt12h((booking as any).start_time),
          endTime: fmt12h((booking as any).end_time),
          reviewerNotes: reviewer_notes,
          reviewUrl: `${appUrl}/admin/building/reservations`,
        })
        await Promise.all(
          recipients.map(to =>
            sendBrevoEmail({ to, subject: ep.subject, htmlBody: ep.htmlBody })
              .catch(err => console.error('[mismatch-review] Cross-role email failed:', err))
          )
        )
      } catch (err) {
        console.error('[mismatch-review] broadcastReviewToOtherStaff failed:', err)
      }
    }

    if (action === 'decline') {
      await supabase
        .from('bookings')
        .update({
          current_status: 'auto_declined',
          mismatch_reviewed_by: user.id,
          internal_notes: reviewer_notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      await sendNotification(supabase, {
        user_id: booking.user_id,
        title: 'Booking Declined',
        message: `Your booking (Ref: ${booking.booking_reference}) has been declined by the Academic Head.${reviewer_notes ? ` Reason: ${reviewer_notes}` : ''}`,
        type: 'error',
        source_type: 'booking',
        source_id: bookingId,
        priority: 'high',
        metadata: { ...reviewMeta, status_to: 'auto_declined', rejection_reason: reviewer_notes },
      })

      await broadcastReviewToOtherStaff(
        'Mismatch Booking Declined',
        `${user.full_name ?? 'A reviewer'} declined mismatch booking ${booking.booking_reference} (${facilityName ?? 'facility'}, ${requesterData?.full_name ?? 'requester'}).${reviewer_notes ? ` Reason: ${reviewer_notes}` : ''}`,
        'warning',
      )

      if (facultyEmail) {
        const ep = mismatchDecisionEmail({ ...emailBaseData, action: 'decline' })
        sendBrevoEmail({ to: facultyEmail, subject: ep.subject, htmlBody: ep.htmlBody })
          .catch(err => console.error('[mismatch-review] Decline email failed:', err))
      }

      return NextResponse.json({ status: 'declined', booking_id: bookingId })
    }

    if (action === 'suggest_alternative') {
      if (!alternative_facility_id) {
        return NextResponse.json({ error: 'alternative_facility_id is required for suggest_alternative' }, { status: 400 })
      }

      // Fetch alternative facility name for the notification
      const { data: altFacility } = await supabase
        .from('facilities')
        .select('name, room_number')
        .eq('id', alternative_facility_id)
        .single()

      const altName = altFacility
        ? `${altFacility.name}${altFacility.room_number ? ` (Room ${altFacility.room_number})` : ''}`
        : 'an alternative facility'

      // F7: give the faculty member a bounded window to respond. Past this deadline
      // with no accept/decline, the SLA cron (pending-approval-sla) auto-declines the
      // booking — owner decision 2026-07-31 — instead of sitting in
      // pending_faculty_response forever with no clock on it.
      const MISMATCH_ALTERNATIVE_RESPONSE_HOURS = 48
      const mismatchAlternativeDeadline = new Date(Date.now() + MISMATCH_ALTERNATIVE_RESPONSE_HOURS * 60 * 60 * 1000).toISOString()

      await supabase
        .from('bookings')
        .update({
          current_status: 'pending_faculty_response',
          mismatch_alternative_facility_id: alternative_facility_id,
          mismatch_alternative_deadline: mismatchAlternativeDeadline,
          mismatch_reviewed_by: user.id,
          internal_notes: reviewer_notes ?? null,
          ...(alternative_date && { booking_date: alternative_date }),
          ...(alternative_start_time && { start_time: `${alternative_start_time}:00` }),
          ...(alternative_end_time && { end_time: `${alternative_end_time}:00` }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      await sendNotification(supabase, {
        user_id: booking.user_id,
        title: 'Alternative Facility Suggested',
        message: `The Academic Head has reviewed your booking (Ref: ${booking.booking_reference}) and suggests using ${altName} instead. Please accept or decline the suggestion in your reservations page.${reviewer_notes ? ` Note: "${reviewer_notes}"` : ''}`,
        type: 'info',
        source_type: 'booking',
        source_id: bookingId,
        priority: 'high',
        metadata: { ...reviewMeta, alternative_facility: altName, reviewer_notes },
      })

      await broadcastReviewToOtherStaff(
        'Alternative Facility Proposed',
        `${user.full_name ?? 'A reviewer'} proposed ${altName} as an alternative for ${booking.booking_reference} (${facilityName ?? 'original facility'}, ${requesterData?.full_name ?? 'requester'}). Awaiting faculty response.${reviewer_notes ? ` Note: ${reviewer_notes}` : ''}`,
        'info',
        { alternativeFacilityName: altName },
      )

      if (facultyEmail) {
        const ep = mismatchDecisionEmail({ ...emailBaseData, action: 'suggest_alternative', alternativeFacilityName: altName })
        console.log(`[mismatch-review] Sending suggest_alternative email to ${facultyEmail}`)
        sendBrevoEmail({ to: facultyEmail, subject: ep.subject, htmlBody: ep.htmlBody })
          .catch(err => console.error('[mismatch-review] Suggest-alternative email failed:', err))
      }

      return NextResponse.json({ status: 'alternative_suggested', booking_id: bookingId, alternative_facility: altFacility })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] PATCH /bookings/[id]/mismatch-review error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
