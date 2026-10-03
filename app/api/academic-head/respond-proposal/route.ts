import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { BookingPaymentService } from '@/backend/booking/paymentService'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { proposalResponseEmail } from '@/backend/notifications/emailTemplates'
import { creditService } from '@/backend/credits/creditService'

async function notifyProposerOfResponse(
  supabase: SupabaseClient,
  args: {
    proposerId: string
    facultyId: string
    bookingId: string
    bookingRef: string
    facilityName: string
    bookingDate: string
    startTime: string
    endTime: string
    action: 'accepted' | 'declined'
  }
): Promise<void> {
  try {
    const { data: proposerRow } = await supabase
      .from('users')
      .select('full_name, email, notification_email')
      .eq('id', args.proposerId)
      .single()
    if (!proposerRow) return
    const recipient = (proposerRow.notification_email ?? null) as string | null
    if (!recipient) {
      console.warn(`[respond-proposal] User ${args.proposerId} has no notification_email set — response email skipped`)
      return
    }

    const { data: facultyRow } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', args.facultyId)
      .single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const respondedAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })

    await sendBrevoEmail({
      to: recipient,
      ...proposalResponseEmail({
        proposerName: (proposerRow.full_name as string) ?? 'Academic Head',
        facultyName: (facultyRow?.full_name as string) ?? 'Faculty',
        bookingRef: args.bookingRef,
        facilityName: args.facilityName,
        bookingDate: args.bookingDate,
        startTime: args.startTime,
        endTime: args.endTime,
        action: args.action,
        adminPanelUrl: `${appUrl}/admin/building/reservations`,
        respondedAt,
      }),
    })
  } catch (err) {
    console.error('[respond-proposal] proposer email error:', err instanceof Error ? err.message : err)
  }
}

const RespondSchema = z.object({
  booking_id: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
})

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RespondSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { booking_id, action } = parsed.data
  const supabase = createAdminClient()

  try {
    // Verify booking belongs to this user and is pending_faculty_response
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, requires_payment, booking_purpose, purpose, booking_date, start_time, end_time, metadata, booking_facilities!inner(facility_id, facility:facilities(name))')
      .eq('id', booking_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found or not yours' }, { status: 404 })
    }

    if (booking.current_status !== 'pending_faculty_response') {
      return NextResponse.json({ error: 'Booking is not pending your response' }, { status: 400 })
    }

    const facilityData = Array.isArray(booking.booking_facilities) && booking.booking_facilities.length > 0
      ? booking.booking_facilities[0].facility as any
      : null
    const facilityName = Array.isArray(facilityData)
      ? facilityData[0]?.name ?? null
      : facilityData?.name ?? null

    // Get the most recent proposal from booking_overrides
    const { data: override, error: overrideError } = await supabase
      .from('booking_overrides')
      .select('id, original_values, new_values, override_action, overridden_by')
      .eq('booking_id', booking_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (overrideError || !override) {
      return NextResponse.json({ error: 'No pending proposal found for this booking' }, { status: 404 })
    }

    const originalValues = override.original_values as Record<string, string>
    const newValues = override.new_values as Record<string, string>

    if (action === 'accept') {
      // Apply the proposed changes atomically: bookings row + booking_facilities swap
      // happen under a single FOR UPDATE lock inside apply_booking_proposal RPC.
      const { error: applyError } = await supabase.rpc('apply_booking_proposal', {
        p_booking_id: booking_id,
        p_new_date: newValues.booking_date ?? null,
        p_new_start: newValues.start_time ?? null,
        p_new_end: newValues.end_time ?? null,
        p_old_facility_id: originalValues.facility_id ?? null,
        p_new_facility_id: newValues.facility_id ?? null,
      })
      if (applyError) throw applyError

      if (booking.requires_payment) {
        const { data: existingPayment, error: existingPaymentError } = await supabase
          .from('payments')
          .select('id, payment_status, payment_reference')
          .eq('booking_id', booking_id)
          .limit(1)
          .single()

        if (existingPaymentError && existingPaymentError.code !== 'PGRST116') {
          console.error('[API] POST /academic-head/respond-proposal payment query error:', existingPaymentError.message)
          return NextResponse.json({ error: existingPaymentError.message }, { status: 500 })
        }

        let paymentRecord = existingPayment

        // Recalculate the amount whenever the proposal changes date/time,
        // regardless of whether the new slot falls on a day or night rate.
        // Only recalculate for pending payments — completed payments are left intact.
        const resolvedStart = newValues.start_time ?? booking.start_time
        const resolvedEnd = newValues.end_time ?? booking.end_time
        const hasTimeChange = !!(newValues.start_time || newValues.end_time || newValues.booking_date)

        // Resolve the facility that will be active after the proposal is applied.
        // apply_booking_proposal already ran above, so booking_facilities in the DB
        // reflects the new state; pass the resolved facility_id explicitly.
        const resolvedFacilityId = newValues.facility_id
          ?? (Array.isArray(booking.booking_facilities) && booking.booking_facilities[0]?.facility_id)
          ?? null
        const resolvedFacilityForCalc = resolvedFacilityId
          ? [{ facility_id: resolvedFacilityId }]
          : booking.booking_facilities

        if (!existingPayment) {
          // No payment yet — create one with the recalculated amount
          const { amount, breakdown } = await BookingPaymentService.calculateAmount({
            ...booking,
            start_time: resolvedStart,
            end_time: resolvedEnd,
            booking_facilities: resolvedFacilityForCalc,
          } as any)
          const insertPayload = {
            booking_id,
            user_id: booking.user_id,
            amount,
            currency: 'PHP',
            payment_method: 'paymongo_card',
            payment_status: 'pending',
            description: `Gymnasium personal booking invoice`,
            metadata: {
              booking_purpose: booking.booking_purpose,
              purpose: booking.purpose,
              facility_name: facilityName,
              cost_breakdown: breakdown,
            },
          }

          const { data, error: paymentError } = await supabase
            .from('payments')
            .insert(insertPayload)
            .select('id, payment_status, payment_reference')
            .single()

          // Postgres 23505 = unique_violation. The payments_one_active_per_booking
          // partial unique index turns a duplicate insert (caused by a network-retry
          // race) into a recoverable error: re-fetch the row that won the race.
          if (paymentError?.code === '23505') {
            const { data: existing, error: refetchError } = await supabase
              .from('payments')
              .select('id, payment_status, payment_reference')
              .eq('booking_id', booking_id)
              .in('payment_status', ['pending', 'completed'])
              .limit(1)
              .single()
            if (refetchError || !existing) {
              console.error('[API] POST /academic-head/respond-proposal payment refetch error:', refetchError?.message)
              return NextResponse.json({ error: 'Failed to create payment invoice' }, { status: 500 })
            }
            paymentRecord = existing
          } else if (paymentError || !data) {
            console.error('[API] POST /academic-head/respond-proposal payment insert error:', paymentError?.message)
            return NextResponse.json({ error: paymentError?.message ?? 'Failed to create payment invoice' }, { status: 500 })
          } else {
            paymentRecord = data
          }
        } else if (existingPayment.payment_status === 'pending' && hasTimeChange) {
          // Payment exists but hasn't been paid yet — recalculate amount for the new timeslot
          // so that day-rate / night-rate differences are correctly reflected.
          try {
            const { amount, breakdown } = await BookingPaymentService.calculateAmount({
              ...booking,
              start_time: resolvedStart,
              end_time: resolvedEnd,
              booking_facilities: resolvedFacilityForCalc,
            } as any)
            await supabase
              .from('payments')
              .update({
                amount,
                updated_at: new Date().toISOString(),
                metadata: {
                  booking_purpose: booking.booking_purpose,
                  purpose: booking.purpose,
                  facility_name: facilityName,
                  cost_breakdown: breakdown,
                  recalculated_on_proposal_accept: true,
                },
              })
              .eq('id', existingPayment.id)
            console.log(`[respond-proposal] Recalculated pending payment ${existingPayment.id} → ₱${amount}`)
          } catch (calcErr) {
            console.error('[respond-proposal] Failed to recalculate payment amount:', calcErr)
            // Non-fatal: continue with the existing amount rather than blocking acceptance
          }
        }

        await supabase
          .from('bookings')
          .update({
            approved_at: new Date().toISOString(),
            internal_notes: 'Faculty accepted proposed changes for payment-required booking; invoice created.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking_id)

        await sendNotificationToRoles(supabase, ['academic_head', 'building_admin', 'program_head'], {
          title: 'Proposal Accepted',
          message: `Faculty accepted the proposed changes for booking ${booking.booking_reference}.`,
          type: 'success',
          source_type: 'booking',
          source_id: booking_id,
          priority: 'normal',
        })

        void notifyProposerOfResponse(supabase, {
          proposerId: override.overridden_by as string,
          facultyId: booking.user_id as string,
          bookingId: booking_id,
          bookingRef: booking.booking_reference ?? booking_id,
          facilityName: facilityName ?? 'your facility',
          bookingDate: (newValues.booking_date ?? booking.booking_date) as string,
          startTime: (newValues.start_time ?? booking.start_time) as string,
          endTime: (newValues.end_time ?? booking.end_time) as string,
          action: 'accepted',
        })

        return NextResponse.json({
          success: true,
          message: `Changes accepted. Booking ${booking.booking_reference} has been approved for payment.`,
          payment_id: paymentRecord?.id,
          payment_reference: paymentRecord?.payment_reference,
        })
      }

      // Set status to approved
      const { error: rpcError } = await supabase.rpc('update_booking_status', {
        p_booking_id: booking_id,
        p_new_status: 'approved',
        p_changed_by_user_id: user.id,
        p_changed_by_ai: false,
        p_reason: 'Faculty accepted proposed changes',
        p_metadata: { proposal_response: 'accepted', override_id: override.id },
      })
      if (rpcError) throw rpcError

      // Notify all admin roles
      await sendNotificationToRoles(supabase, ['academic_head', 'building_admin', 'program_head'], {
        title: 'Proposal Accepted',
        message: `Faculty accepted the proposed changes for booking ${booking.booking_reference}.`,
        type: 'success',
        source_type: 'booking',
        source_id: booking_id,
        priority: 'normal',
      })

      void notifyProposerOfResponse(supabase, {
        proposerId: override.overridden_by as string,
        facultyId: booking.user_id as string,
        bookingId: booking_id,
        bookingRef: booking.booking_reference ?? booking_id,
        facilityName: facilityName ?? 'your facility',
        bookingDate: (newValues.booking_date ?? booking.booking_date) as string,
        startTime: (newValues.start_time ?? booking.start_time) as string,
        endTime: (newValues.end_time ?? booking.end_time) as string,
        action: 'accepted',
      })

      return NextResponse.json({
        success: true,
        message: `Changes accepted. Booking ${booking.booking_reference} has been approved.`,
      })
    } else {
      // Faculty declines — cancel the booking outright
      const { error: rpcError } = await supabase.rpc('update_booking_status', {
        p_booking_id: booking_id,
        p_new_status: 'cancelled',
        p_changed_by_user_id: user.id,
        p_changed_by_ai: false,
        p_reason: 'Faculty declined proposed changes — booking cancelled',
        p_metadata: { proposal_response: 'declined', override_id: override.id },
      })
      if (rpcError) throw rpcError

      // Check for completed payment and issue credit if applicable
      let creditAmountCentavos = 0
      try {
        const { data: completedPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('booking_id', booking_id)
          .eq('payment_status', 'completed')

        creditAmountCentavos = (completedPayments ?? []).reduce(
          (sum: number, p: { amount: number | string }) => sum + Math.round(Number(p.amount) * 100), 0
        )
      } catch { /* non-critical */ }

      if (creditAmountCentavos > 0) {
        // Stamp cancellation type as alternative_declined when credit is issued
        await supabase
          .from('bookings')
          .update({
            cancellation_type: 'alternative_declined',
            backend_cancellation_reason: 'Faculty declined proposed changes — credit issued',
          })
          .eq('id', booking_id)

        void creditService.issueCredit({
          userId: user.id,
          amountCentavos: creditAmountCentavos,
          source: 'alternative_declined',
          sourceBookingId: booking_id,
          issuedBy: user.id,
          reason: `Declined proposed changes for booking ${booking.booking_reference}`,
          sendNotifications: true,
        }).catch(err => console.error('[respond-proposal] Credit issuance failed:', err instanceof Error ? err.message : err))
      } else {
        // Stamp cancellation type
        await supabase
          .from('bookings')
          .update({
            cancellation_type: 'admin_cancelled',
            backend_cancellation_reason: 'Faculty declined proposed changes',
          })
          .eq('id', booking_id)
      }

      // Notify all admin roles
      await sendNotificationToRoles(supabase, ['academic_head', 'building_admin', 'program_head'], {
        title: 'Proposal Declined — Booking Cancelled',
        message: `Faculty declined the proposed changes for booking ${booking.booking_reference}. The booking has been cancelled.${creditAmountCentavos > 0 ? ` ₱${(creditAmountCentavos / 100).toFixed(2)} session credit issued.` : ' Faculty will need to create a new reservation.'}`,
        type: 'warning',
        source_type: 'booking',
        source_id: booking_id,
        priority: 'high',
      })

      // Notify faculty (credit notification sent separately by creditService if applicable)
      await sendNotification(supabase, {
        user_id: user.id,
        title: 'Booking Cancelled',
        message: creditAmountCentavos > 0
          ? `You declined the proposed changes for booking ${booking.booking_reference}. ₱${(creditAmountCentavos / 100).toFixed(2)} session credit has been added to your account.`
          : `You declined the proposed changes for booking ${booking.booking_reference}. The booking has been cancelled. Please create a new reservation if needed.`,
        type: 'error',
        source_type: 'booking',
        source_id: booking_id,
        priority: 'high',
      })

      void notifyProposerOfResponse(supabase, {
        proposerId: override.overridden_by as string,
        facultyId: booking.user_id as string,
        bookingId: booking_id,
        bookingRef: booking.booking_reference ?? booking_id,
        facilityName: facilityName ?? 'your facility',
        bookingDate: booking.booking_date as string,
        startTime: booking.start_time as string,
        endTime: booking.end_time as string,
        action: 'declined',
      })

      return NextResponse.json({
        success: true,
        message: creditAmountCentavos > 0
          ? `Changes declined. Booking ${booking.booking_reference} has been cancelled. ₱${(creditAmountCentavos / 100).toFixed(2)} session credit issued.`
          : `Changes declined. Booking ${booking.booking_reference} has been cancelled. Please create a new reservation.`,
      })
    }
  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : (typeof err === 'object' && err !== null && 'message' in err)
        ? String((err as any).message)
        : 'Unknown error'
    console.error('[API] POST /academic-head/respond-proposal error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
