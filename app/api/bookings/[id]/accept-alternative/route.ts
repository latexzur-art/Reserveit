import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { handleCancellation } from '@/backend/booking'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { getErrorMessage, getErrorDetails } from '@/lib/errors'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { facultyAlternativeResponseEmail, facultyAlternativeResponseConfirmationEmail } from '@/backend/notifications/emailTemplates'
import { resolveUserEmail, getBuildingAdminEmails, getAcademicHeadEmail } from '@/backend/notifications/recipientResolver'

const AcceptAlternativeSchema = z.object({
  accept: z.boolean(),
})
const idSchema = z.uuid()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { id: rawBookingId } = await params
  const idCheck = idSchema.safeParse(rawBookingId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }
  const bookingId = idCheck.data

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AcceptAlternativeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { accept } = parsed.data
  const supabase = createAdminClient()

  try {
    // Verify booking belongs to this user and is pending faculty response
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, booking_date, start_time, end_time, current_status, mismatch_alternative_facility_id, mismatch_reviewed_by, booking_facilities(facility:facilities(name))')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.current_status !== 'pending_faculty_response') {
      return NextResponse.json({ error: 'Booking is not pending faculty response' }, { status: 400 })
    }

    // Check if booking date has already passed
    const today = new Date().toISOString().slice(0, 10)
    if (booking.booking_date < today) {
      const { success, message } = await handleCancellation(
        supabase,
        bookingId,
        'schedule_conflict',
        user.id,
        'Booking date has already passed and alternative was not accepted in time'
      )

      if (!success) {
        return NextResponse.json({ error: message }, { status: 400 })
      }

      return NextResponse.json(
        { status: 'cancelled', message: 'This booking\'s date has already passed, so it has been automatically cancelled.' },
        { status: 200 }
      )
    }

    if (!accept) {
      // Faculty declines → cancel the booking.
      // Use 'alternative_declined' so audit logs correctly reflect a user choice
      // rather than a system failure.  The cancellation handler does NOT increment
      // consecutive_cancellations for this type, preserving fairness (the user
      // never chose the facility that triggered the mismatch).
      const { success, message } = await handleCancellation(
        supabase,
        bookingId,
        'alternative_declined',
        user.id,
        'Declined alternative facility suggestion'
      )

      if (!success) {
        return NextResponse.json({ error: message }, { status: 400 })
      }

      // Notify reviewer in-app (whoever proposed the alternative)
      const reviewedById = (booking as any).mismatch_reviewed_by
      if (reviewedById) {
        const facRawSync = (booking as any).booking_facilities?.[0]?.facility
        const origFacNameSync = facRawSync ? (Array.isArray(facRawSync) ? facRawSync[0]?.name : facRawSync.name) : 'Unknown'
        await sendNotification(supabase, {
          user_id: reviewedById,
          title: 'Alternative Declined by Faculty',
          message: `${user.full_name ?? 'The faculty member'} declined your proposed alternative for booking ${booking.booking_reference} (${origFacNameSync}). The booking has been cancelled.`,
          type: 'warning',
          source_type: 'booking',
          source_id: bookingId,
          priority: 'high',
          metadata: { booking_reference: booking.booking_reference, declined_by: user.id },
        })
      }

      // Notify reviewer + faculty via email (fire-and-forget)
      void (async () => {
        try {
          const facRaw = (booking as any).booking_facilities?.[0]?.facility
          const origFacName = facRaw ? (Array.isArray(facRaw) ? facRaw[0]?.name : facRaw.name) : 'Unknown'
          const { data: altFac } = await supabase.from('facilities').select('name').eq('id', booking.mismatch_alternative_facility_id!).single()
          const { data: facultyData } = await supabase.from('users').select('full_name, email, notification_email').eq('id', user.id).single()
          const formattedDate = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
          const fmt = (t: string) => { const [h, m] = (t ?? '').split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
          const altName = altFac?.name ?? 'Suggested Alternative'
          const facName = facultyData?.full_name ?? user.full_name ?? 'Faculty'
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

          // Email to the reviewer (AH or Building Admin — whoever suggested the alternative).
          // If the specific reviewer has no resolvable email, fall back to their role group.
          if (reviewedById) {
            const { emailTo: reviewerEmail } = await resolveUserEmail(supabase, reviewedById)
            const { data: roleRow } = await supabase.from('user_roles').select('roles!inner(name)').eq('user_id', reviewedById).eq('is_active', true).limit(1).maybeSingle()
            const reviewerRole = (roleRow as any)?.roles?.name ?? 'academic_head'
            const reviewUrl = reviewerRole === 'building_admin' ? `${appUrl}/admin/building/reservations` : `${appUrl}/academic/dashboard`
            let recipients: string[] = reviewerEmail ? [reviewerEmail] : []
            if (recipients.length === 0) {
              if (reviewerRole === 'building_admin') {
                recipients = await getBuildingAdminEmails()
              } else {
                const ah = await getAcademicHeadEmail()
                if (ah) recipients = [ah]
              }
              console.warn('[accept-alternative] Decline → reviewer has no resolvable email; falling back to role group:', { reviewedById, reviewerRole, fallbackCount: recipients.length })
            } else {
              console.log('[accept-alternative] Decline → reviewer email lookup:', { reviewedById, reviewerEmail, reviewerRole })
            }
            if (recipients.length > 0) {
              const ep = facultyAlternativeResponseEmail({ bookingReference: booking.booking_reference, facultyName: facName, originalFacilityName: origFacName, alternativeFacilityName: altName, bookingDate: formattedDate, accepted: false, reviewUrl })
              await Promise.all(recipients.map(to => sendBrevoEmail({ to, subject: ep.subject, htmlBody: ep.htmlBody })))
            } else {
              console.warn('[accept-alternative] Decline → no reviewer recipients resolvable, skipping')
            }
          } else {
            console.warn('[accept-alternative] Decline → booking has no mismatch_reviewed_by, skipping reviewer email')
          }

          // Confirmation email to faculty themselves
          const facultyEmail = facultyData?.notification_email ?? null
          if (!facultyEmail) {
            console.warn(`[accept-alternative] User ${user.id} has no notification_email set — confirmation email skipped`)
          } else {
            const ep = facultyAlternativeResponseConfirmationEmail({ bookingReference: booking.booking_reference, facultyName: facName, originalFacilityName: origFacName, alternativeFacilityName: altName, bookingDate: formattedDate, startTime: fmt((booking as any).start_time), endTime: fmt((booking as any).end_time), accepted: false, statusUrl: `${appUrl}/faculty/reservations` })
            await sendBrevoEmail({ to: facultyEmail, subject: ep.subject, htmlBody: ep.htmlBody })
          }
        } catch (err) { console.error('[accept-alternative] Decline email failed:', err) }
      })()

      return NextResponse.json({ status: 'cancelled', booking_id: bookingId })
    }

    // Faculty accepts → swap facility and directly approve.
    // The Academic Head already reviewed this booking — no pipeline re-run needed.
    const newFacilityId = booking.mismatch_alternative_facility_id
    if (!newFacilityId) {
      return NextResponse.json({ error: 'No alternative facility set on this booking' }, { status: 400 })
    }

    console.log('[accept-alternative] Starting alternative acceptance:', {
      bookingId,
      userId: user.id,
      oldBooking: booking.current_status,
      newFacilityId,
    })

    // Swap facility link
    const { error: deleteError } = await supabase
      .from('booking_facilities')
      .delete()
      .eq('booking_id', bookingId)
    if (deleteError) { console.error('[accept-alternative] Failed to delete old facility link:', deleteError); throw deleteError }
    console.log('[accept-alternative] Deleted old facility link')

    const { error: insertError } = await supabase
      .from('booking_facilities')
      .insert({ booking_id: bookingId, facility_id: newFacilityId })
    if (insertError) { console.error('[accept-alternative] Failed to insert new facility link:', insertError); throw insertError }
    console.log('[accept-alternative] Inserted new facility link')

    // Directly approve — AH suggestion is the approval, scoring is irrelevant
    const { error: approveError } = await supabase
      .from('bookings')
      .update({
        current_status: 'overridden',
        mismatch_flag: null,
        mismatch_alternative_facility_id: null,
        mismatch_alternative_deadline: null,
        assigned_reviewer_role: null,
        internal_notes: 'Faculty accepted reviewer-suggested alternative facility.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
    if (approveError) { console.error('[accept-alternative] Failed to approve booking:', approveError); throw approveError }
    console.log('[accept-alternative] Booking confirmed as overridden (AH alternative accepted)')

    // Record the decision without scoring — it was a manual AH decision
    try {
      await supabase.from('booking_decisions').insert({
        booking_id: bookingId,
        hard_constraints_passed: true,
        base_score: null,
        score_adjustments: null,
        final_score: null,
        decision: 'overridden',
        decision_reason: 'REVIEWER_ALTERNATIVE_ACCEPTED',
        pipeline_version: '1.0',
      })
    } catch (err) {
      console.warn('[accept-alternative] booking_decisions insert skipped:', err)
    }

    // Notify faculty in-app
    await sendNotification(supabase, {
      user_id: user.id,
      title: 'Booking Confirmed — Alternative Facility',
      message: `Your booking (Ref: ${booking.booking_reference}) has been confirmed with the alternative facility.`,
      type: 'success',
      source_type: 'booking',
      source_id: bookingId,
      priority: 'high',
      metadata: { booking_reference: booking.booking_reference, new_facility_id: newFacilityId },
    })

    // Notify reviewer in-app (whoever proposed the alternative)
    const acceptReviewedById = (booking as any).mismatch_reviewed_by
    if (acceptReviewedById) {
      const facRawAccept = (booking as any).booking_facilities?.[0]?.facility
      const origFacNameAccept = facRawAccept ? (Array.isArray(facRawAccept) ? facRawAccept[0]?.name : facRawAccept.name) : 'Unknown'
      await sendNotification(supabase, {
        user_id: acceptReviewedById,
        title: 'Alternative Accepted by Faculty',
        message: `${user.full_name ?? 'The faculty member'} accepted your proposed alternative for booking ${booking.booking_reference} (originally ${origFacNameAccept}). The booking is now confirmed.`,
        type: 'success',
        source_type: 'booking',
        source_id: bookingId,
        priority: 'high',
        metadata: { booking_reference: booking.booking_reference, accepted_by: user.id, new_facility_id: newFacilityId },
      })
    }

    // Notify reviewer + faculty via email (fire-and-forget)
    void (async () => {
      try {
        const facRaw = (booking as any).booking_facilities?.[0]?.facility
        const origFacName = facRaw ? (Array.isArray(facRaw) ? facRaw[0]?.name : facRaw.name) : 'Unknown'
        const { data: altFac } = await supabase.from('facilities').select('name').eq('id', newFacilityId).single()
        const { data: facultyData } = await supabase.from('users').select('full_name, email, notification_email').eq('id', user.id).single()
        const formattedDate = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        const fmt = (t: string) => { const [h, m] = (t ?? '').split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
        const altName = altFac?.name ?? 'Suggested Alternative'
        const facName = facultyData?.full_name ?? user.full_name ?? 'Faculty'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

        // Email to the reviewer (AH or Building Admin — whoever suggested the alternative).
        // If the specific reviewer has no resolvable email, fall back to their role group.
        if (acceptReviewedById) {
          const { emailTo: reviewerEmail } = await resolveUserEmail(supabase, acceptReviewedById)
          const { data: roleRow } = await supabase.from('user_roles').select('roles!inner(name)').eq('user_id', acceptReviewedById).eq('is_active', true).limit(1).maybeSingle()
          const reviewerRole = (roleRow as any)?.roles?.name ?? 'academic_head'
          const reviewUrl = reviewerRole === 'building_admin' ? `${appUrl}/admin/building/reservations` : `${appUrl}/academic/dashboard`
          let recipients: string[] = reviewerEmail ? [reviewerEmail] : []
          if (recipients.length === 0) {
            if (reviewerRole === 'building_admin') {
              recipients = await getBuildingAdminEmails()
            } else {
              const ah = await getAcademicHeadEmail()
              if (ah) recipients = [ah]
            }
            console.warn('[accept-alternative] Accept → reviewer has no resolvable email; falling back to role group:', { reviewedById: acceptReviewedById, reviewerRole, fallbackCount: recipients.length })
          } else {
            console.log('[accept-alternative] Accept → reviewer email lookup:', { reviewedById: acceptReviewedById, reviewerEmail, reviewerRole })
          }
          if (recipients.length > 0) {
            const ep = facultyAlternativeResponseEmail({ bookingReference: booking.booking_reference, facultyName: facName, originalFacilityName: origFacName, alternativeFacilityName: altName, bookingDate: formattedDate, accepted: true, reviewUrl })
            await Promise.all(recipients.map(to => sendBrevoEmail({ to, subject: ep.subject, htmlBody: ep.htmlBody })))
          } else {
            console.warn('[accept-alternative] Accept → no reviewer recipients resolvable, skipping')
          }
        } else {
          console.warn('[accept-alternative] Accept → booking has no mismatch_reviewed_by, skipping reviewer email')
        }

        // Confirmation email to faculty themselves
        const facultyEmail = facultyData?.notification_email || facultyData?.email
        if (facultyEmail) {
          const ep = facultyAlternativeResponseConfirmationEmail({ bookingReference: booking.booking_reference, facultyName: facName, originalFacilityName: origFacName, alternativeFacilityName: altName, bookingDate: formattedDate, startTime: fmt((booking as any).start_time), endTime: fmt((booking as any).end_time), accepted: true, statusUrl: `${appUrl}/faculty/reservations` })
          await sendBrevoEmail({ to: facultyEmail, subject: ep.subject, htmlBody: ep.htmlBody })
        }
      } catch (err) { console.error('[accept-alternative] Accept email failed:', err) }
    })()

    return NextResponse.json({
      status: 'overridden',
      booking_id: bookingId,
      booking_reference: booking.booking_reference,
      message: 'Booking confirmed with the alternative facility.',
    })
  } catch (err: unknown) {
    const message = getErrorMessage(err)
    console.error('[API] POST /bookings/[id]/accept-alternative error:', {
      ...getErrorDetails(err),
      bookingId,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
