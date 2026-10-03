import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { resolveUserEmail } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'
import { getErrorMessage } from '@/lib/errors'

const BodySchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
  refund_amount_centavos: z.number().int().nonnegative(),
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

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 })

  const supabase = createAdminClient()

  try {
    // Load booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, current_status, booking_date, booking_facilities(facility_id, facilities(name))')
      .eq('id', idCheck.value)
      .single()

    if (bookingError || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    // Only for paid bookings with completed payment
    const { data: payment } = await supabase
      .from('payments')
      .select('id, total_amount')
      .eq('booking_id', booking.id)
      .eq('payment_status', 'completed')
      .maybeSingle()

    if (!payment) return NextResponse.json({ error: 'No completed payment found. Use direct cancel for unpaid bookings.' }, { status: 400 })

    // Check for existing pending proposal
    const { data: existing } = await supabase
      .from('ba_cancellation_proposals')
      .select('id')
      .eq('booking_id', booking.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'A cancellation proposal is already pending for this booking' }, { status: 409 })

    // Create proposal
    const { data: proposal, error: insertError } = await supabase
      .from('ba_cancellation_proposals')
      .insert({
        booking_id: booking.id,
        proposed_by: user!.id,
        reason: parsed.data.reason,
        refund_amount_centavos: parsed.data.refund_amount_centavos,
        payment_id: payment.id,
      })
      .select('id')
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Update booking status
    await supabase.rpc('update_booking_status', {
      p_booking_id: booking.id,
      p_new_status: 'cancellation_proposed',
      p_changed_by_user_id: user!.id,
      p_changed_by_ai: false,
      p_reason: `Building Admin proposed cancellation: ${parsed.data.reason}`,
      p_metadata: { proposal_id: proposal!.id },
    })

    const facilityArr = Array.isArray(booking.booking_facilities) ? booking.booking_facilities : [booking.booking_facilities]
    const facilityName = (facilityArr[0]?.facilities as { name?: string } | null)?.name ?? 'Facility'
    const amountLabel = `₱${(parsed.data.refund_amount_centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    // Notify booker
    void sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Cancellation Proposed — Action Required',
      message: `Building Admin proposes cancelling your booking ${booking.booking_reference} (${facilityName}). A cash refund of ${amountLabel} will be processed if you accept. Please review and respond.`,
      type: 'warning',
      priority: 'urgent',
      source_type: 'cancellation_proposal',
      source_id: proposal!.id,
      action_url: `${appUrl}/client/bookings`,
    })

    // Email booker
    void (async () => {
      const { emailTo, name } = await resolveUserEmail(supabase, booking.user_id)
      if (!emailTo) return
      const { cancellationProposedToBookerEmail } = await import('@/backend/notifications/emailTemplates')
      const template = cancellationProposedToBookerEmail({
        userName: name ?? 'Valued User',
        bookingRef: booking.booking_reference,
        facilityName,
        amount: amountLabel,
        reason: parsed.data.reason,
      })
      await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
        .catch(err => console.error('[propose-cancellation] email failed:', err))
    })()

    await AdminAuditService.log({
      actorId: user!.id,
      action: 'ba_cancellation_proposed',
      targetType: 'booking',
      targetId: booking.id,
      details: { proposal_id: proposal!.id, refund_amount_centavos: parsed.data.refund_amount_centavos },
    })

    return NextResponse.json({ success: true, proposal_id: proposal!.id })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
