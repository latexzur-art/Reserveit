/**
 * L2 — shared "approve a mismatch-flagged booking" logic.
 *
 * Extracted verbatim from the 'approve' branch of
 * app/api/bookings/[id]/mismatch-review/route.ts (PATCH) so the single-booking route
 * and the new batch-approve route (app/api/academic-head/mismatch-reviews/batch-approve)
 * share one implementation instead of drifting apart. The single-booking PATCH route
 * calls this too — behavior for that path is unchanged, just moved.
 * @module backend/booking/mismatchApproval
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNotification, sendNotificationToRoles } from './autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { mismatchDecisionEmail, mismatchReviewBroadcastEmail } from '@/backend/notifications/emailTemplates'
import { getBuildingAdminEmails, getAcademicHeadEmail } from '@/backend/notifications/recipientResolver'

export interface ReviewerUser {
  id: string
  full_name?: string | null
  email?: string | null
  roles?: { name: string }[] | null
}

export type ApproveMismatchResult =
  | { ok: true; booking_id: string; booking_reference: string }
  | { ok: false; booking_id: string; error: string; httpStatus: number }

export async function approveMismatchBooking(
  supabase: SupabaseClient,
  bookingId: string,
  reviewerUser: ReviewerUser,
  reviewerNotes: string | undefined
): Promise<ApproveMismatchResult> {
  try {
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, mismatch_flag, assigned_reviewer_role, booking_date, start_time, end_time, booking_facilities(facility_id, facility:facilities(name))')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      return { ok: false, booking_id: bookingId, error: 'Booking not found', httpStatus: 404 }
    }

    if (!booking.mismatch_flag) {
      return { ok: false, booking_id: bookingId, error: 'This booking does not have a mismatch flag', httpStatus: 400 }
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
      console.warn(`[mismatchApproval] User ${booking.user_id} has no notification_email set — skipping faculty email`)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedDate = new Date((booking as any).booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    const reviewerRole = reviewerUser.roles?.some((r) => r.name === 'building_admin')
      ? 'building_admin' as const
      : 'academic_head' as const
    const emailBaseData = {
      bookingReference: booking.booking_reference,
      facultyName: requesterData?.full_name ?? 'Faculty',
      facilityName: facilityName ?? 'Unknown Facility',
      bookingDate: formattedDate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      startTime: fmt12h((booking as any).start_time),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      endTime: fmt12h((booking as any).end_time),
      reviewerNotes,
      statusUrl: `${appUrl}/faculty/reservations`,
      reviewerRole,
    }
    const reviewMeta: Record<string, unknown> = {
      booking_reference: booking.booking_reference,
      requester_name: requesterData?.full_name ?? 'Unknown',
      facility_name: facilityName ?? 'Unknown Facility',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      booking_date: new Date((booking as any).booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      start_time: fmt12h((booking as any).start_time),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      end_time: fmt12h((booking as any).end_time),
      decided_by_name: reviewerUser.full_name ?? reviewerUser.email,
      decided_by_role: 'Academic Head',
    }

    // Academic Head approves → set to auto_approved
    await supabase
      .from('bookings')
      .update({
        current_status: 'auto_approved',
        mismatch_reviewed_by: reviewerUser.id,
        internal_notes: reviewerNotes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Approved',
      message: `Your booking (Ref: ${booking.booking_reference}) has been approved by the Academic Head.${reviewerNotes ? ` Note: ${reviewerNotes}` : ''}`,
      type: 'success',
      source_type: 'booking',
      source_id: bookingId,
      priority: 'high',
      metadata: { ...reviewMeta, status_to: 'auto_approved', reviewer_notes: reviewerNotes },
    })

    // In-app + email broadcast to the other admins/AHs for queue visibility
    try {
      await sendNotificationToRoles(supabase, ['building_admin', 'academic_head'], {
        title: 'Mismatch Booking Approved',
        message: `${reviewerUser.full_name ?? 'A reviewer'} approved mismatch booking ${booking.booking_reference} (${facilityName ?? 'facility'}, ${requesterData?.full_name ?? 'requester'}).${reviewerNotes ? ` Note: ${reviewerNotes}` : ''}`,
        type: 'success',
        source_type: 'booking',
        source_id: bookingId,
        priority: 'normal',
        metadata: { ...reviewMeta, actor_id: reviewerUser.id, action: 'approve' },
      })
      const [adminEmails, ahEmail] = await Promise.all([getBuildingAdminEmails(), getAcademicHeadEmail()])
      const recipients = [...new Set([...(adminEmails ?? []), ...(ahEmail ? [ahEmail] : [])])]
        .filter(e => e && e !== reviewerUser.email)
      if (recipients.length > 0) {
        const actorRoleLabel = reviewerUser.roles?.some((r) => r.name === 'building_admin') ? 'Building Admin' : 'Academic Head'
        const ep = mismatchReviewBroadcastEmail({
          action: 'approve',
          bookingReference: booking.booking_reference,
          actorName: reviewerUser.full_name ?? 'A reviewer',
          actorRoleLabel,
          requesterName: requesterData?.full_name ?? 'Unknown',
          originalFacilityName: facilityName ?? 'Unknown Facility',
          bookingDate: formattedDate,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          startTime: fmt12h((booking as any).start_time),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          endTime: fmt12h((booking as any).end_time),
          reviewerNotes,
          reviewUrl: `${appUrl}/admin/building/reservations`,
        })
        await Promise.all(
          recipients.map(to =>
            sendBrevoEmail({ to, subject: ep.subject, htmlBody: ep.htmlBody })
              .catch(err => console.error('[mismatchApproval] Cross-role email failed:', err))
          )
        )
      }
    } catch (err) {
      console.error('[mismatchApproval] broadcast failed:', err)
    }

    if (facultyEmail) {
      const ep = mismatchDecisionEmail({ ...emailBaseData, action: 'approve' })
      sendBrevoEmail({ to: facultyEmail, subject: ep.subject, htmlBody: ep.htmlBody })
        .catch(err => console.error('[mismatchApproval] Approve email failed:', err))
    }

    return { ok: true, booking_id: bookingId, booking_reference: booking.booking_reference }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[mismatchApproval] approveMismatchBooking error:', message)
    return { ok: false, booking_id: bookingId, error: message, httpStatus: 500 }
  }
}
