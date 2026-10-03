import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { bookingCancellationEmail, adminAcademicHeadCancelledEmail } from '@/backend/notifications/emailTemplates'
import { creditService } from '@/backend/credits/creditService'

const CancelSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().min(20, 'Please provide a detailed reason (min 20 chars)').max(1000),
})

const CANCELLABLE_STATUSES = ['auto_approved', 'approved', 'flagged', 'pending']

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

  const parsed = CancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { booking_id, reason } = parsed.data
  const supabase = createAdminClient()

  try {
    // Load the booking (include facility, date/time for the email notification)
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, booking_date, start_time, end_time, purpose, event_name, booking_purpose, requires_payment, booking_type, booking_facilities(facility_id, facilities(name))')
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

    if (!CANCELLABLE_STATUSES.includes(booking.current_status)) {
      return NextResponse.json(
        { error: `Cannot cancel a booking with status: ${booking.current_status}` },
        { status: 400 }
      )
    }

    // Update status via RPC
    const { error: rpcError } = await supabase.rpc('update_booking_status', {
      p_booking_id: booking_id,
      p_new_status: 'cancelled',
      p_changed_by_user_id: user.id,
      p_changed_by_ai: false,
      p_reason: `Academic Head cancellation: ${reason}`,
      p_metadata: { override_action: 'cancel', academic_head_id: user.id },
    })

    if (rpcError) throw rpcError

    // Stamp cancellation type and reason so the scoring engine can exclude it
    await supabase
      .from('bookings')
      .update({
        cancellation_type: 'admin_cancelled',
        backend_cancellation_reason: reason,
      })
      .eq('id', booking_id)

    // Insert audit log to booking_overrides
    await supabase.from('booking_overrides').insert({
      booking_id,
      override_action: 'cancel',
      original_values: { status: booking.current_status },
      new_values: { status: 'cancelled', cancellation_type: 'admin_cancelled' },
      reason,
      overridden_by: user.id,
      remaining_window_seconds: null,
    })

    // Issue session credit if the booking had a completed payment
    void (async () => {
      try {
        const { data: completedPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('booking_id', booking_id)
          .eq('payment_status', 'completed')

        const amountCentavos = (completedPayments ?? []).reduce(
          (sum: number, p: { amount: number | string }) => sum + Math.round(Number(p.amount) * 100), 0
        )

        if (amountCentavos > 0) {
          await supabase
            .from('bookings')
            .update({ cancellation_type: 'force_majeure' })
            .eq('id', booking_id)

          await creditService.issueCredit({
            userId: booking.user_id,
            amountCentavos,
            source: 'force_majeure',
            sourceBookingId: booking_id,
            issuedBy: user.id,
            reason: `Booking ${booking.booking_reference} cancelled by Academic Head: ${reason}`,
            sendNotifications: true,
          })
        }
      } catch (creditErr) {
        console.error('[cancel-booking] Credit issuance failed:', creditErr instanceof Error ? creditErr.message : creditErr)
      }
    })()

    // Notify the faculty member (in-app)
    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Cancelled by Academic Head',
      message: `Your booking ${booking.booking_reference} has been cancelled by the Academic Head. Reason: ${reason}`,
      type: 'error',
      source_type: 'booking',
      source_id: booking_id,
      priority: 'high',
    })

    // Notify building admins and program heads (in-app)
    void sendNotificationToRoles(supabase, ['building_admin', 'program_head'], {
      title: 'Booking Cancelled by Academic Head',
      message: `Academic Head cancelled booking ${booking.booking_reference}. Reason: ${reason}`,
      type: 'warning',
      source_type: 'booking',
      source_id: booking_id,
      priority: 'high',
    })

    // Send cancellation email to the booker + building admin email
    void (async () => {
      try {
        // Fetch booker details for the email
        const { data: bookerData } = await supabase
          .from('users')
          .select('full_name, email, notification_email')
          .eq('id', booking.user_id)
          .single()

        if (!bookerData) return

        const recipientEmail = bookerData.notification_email ?? null
        if (!recipientEmail) {
          console.warn(`[academic-head/cancel-booking] User ${booking.user_id} has no notification_email set — cancellation email skipped`)
          return
        }

        // Extract facility name from the joined data
        const bkFacilities = (booking as any).booking_facilities as Array<{ facility_id: string; facilities: { name: string } | Array<{ name: string }> | null }> | null
        const facilityEntry = bkFacilities?.[0]
        const facilityRaw = facilityEntry?.facilities
        const facilityName = facilityRaw
          ? (Array.isArray(facilityRaw) ? facilityRaw[0]?.name : (facilityRaw as { name: string }).name)
          : 'Unknown Facility'

        // Format time to 12h
        const fmt12h = (t: string) => {
          const [hStr, mStr] = t.split(':')
          const h = parseInt(hStr, 10)
          return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
        }

        const bookingDateFormatted = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })

        const cancelledAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })

        // Email the faculty
        void sendBrevoEmail({
          to: recipientEmail,
          ...bookingCancellationEmail({
            userName: bookerData.full_name ?? 'Faculty',
            bookingRef: booking.booking_reference,
            facilityName,
            bookingDate: bookingDateFormatted,
            startTime: fmt12h(booking.start_time),
            endTime: fmt12h(booking.end_time),
            cancelledBy: 'Academic Head',
            cancelledAt,
          }),
        })

        // Email all active building_admin and program_head users
        const { data: adminRoleUsers } = await supabase
          .from('user_roles')
          .select('user_id, roles!inner(name)')
          .in('roles.name', ['building_admin', 'program_head'])
          .eq('is_active', true)

        if (adminRoleUsers && adminRoleUsers.length > 0) {
          const adminIds = [...new Set((adminRoleUsers as Array<{ user_id: string }>).map(r => r.user_id))]
          const { data: adminRows } = await supabase
            .from('users')
            .select('full_name, email, notification_email')
            .in('id', adminIds)

          // Fetch the cancelling academic head's name
          const { data: ahRow } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', user.id)
            .single()
          const academicHeadName = (ahRow as any)?.full_name ?? 'Academic Head'

          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

          for (const admin of (adminRows ?? []) as Array<{ full_name: string; email: string; notification_email?: string | null }>) {
            const adminRecipient = admin.notification_email
            if (!adminRecipient) {
              console.warn(`[academic-head/cancel-booking] Admin "${admin.full_name}" has no notification_email set — cancellation email skipped`)
              continue
            }
            void sendBrevoEmail({
              to: adminRecipient,
              ...adminAcademicHeadCancelledEmail({
                adminName: admin.full_name ?? 'Admin',
                facultyName: bookerData.full_name ?? 'Faculty',
                facultyEmail: (bookerData.email as string) ?? '',
                bookingRef: booking.booking_reference,
                facilityName,
                bookingDate: bookingDateFormatted,
                startTime: fmt12h(booking.start_time),
                endTime: fmt12h(booking.end_time),
                eventName: (booking as any).event_name ?? undefined,
                purpose: (booking as any).purpose ?? undefined,
                bookingPurpose: (booking as any).booking_purpose ?? undefined,
                cancelledByName: academicHeadName,
                reason,
                adminPanelUrl: `${appUrl}/admin/building/reservations`,
                cancelledAt,
              }),
            })
          }
        }
      } catch (emailErr) {
        console.error('[cancel-booking] email notification error:', emailErr instanceof Error ? emailErr.message : emailErr)
      }
    })()

    return NextResponse.json({
      success: true,
      booking_id,
      message: `Booking ${booking.booking_reference} has been cancelled.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] POST /academic-head/cancel-booking error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
