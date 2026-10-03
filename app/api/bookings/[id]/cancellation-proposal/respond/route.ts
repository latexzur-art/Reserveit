import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { getErrorMessage } from '@/lib/errors'
import { ManualRefundService } from '@/backend/payments/manualRefundService'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'

const BodySchema = z.object({
  action: z.enum(['accept', 'dispute']),
  // Required on accept
  destination_name: z.string().min(1).optional(),
  destination_contact_number: z.string().min(1).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id: bookingId } = await params

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 })

  if (parsed.data.action === 'accept' && (!parsed.data.destination_name || !parsed.data.destination_contact_number)) {
    return NextResponse.json({ error: 'destination_name and destination_contact_number are required when accepting' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    // Load proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('ba_cancellation_proposals')
      .select('id, booking_id, proposed_by, reason, refund_amount_centavos, payment_id, status')
      .eq('booking_id', bookingId)
      .eq('status', 'pending')
      .single()

    if (proposalError || !proposal) return NextResponse.json({ error: 'No pending cancellation proposal found' }, { status: 404 })

    // Verify user owns the booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference')
      .eq('id', bookingId)
      .single()

    if (!booking || booking.user_id !== user!.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (parsed.data.action === 'dispute') {
      await supabase
        .from('ba_cancellation_proposals')
        .update({ status: 'disputed' })
        .eq('id', proposal.id)

      // Revert booking status
      await supabase.rpc('update_booking_status', {
        p_booking_id: bookingId,
        p_new_status: 'approved',
        p_changed_by_user_id: user!.id,
        p_changed_by_ai: false,
        p_reason: 'Booker disputed BA cancellation proposal',
        p_metadata: { proposal_id: proposal.id, action: 'dispute' },
      })

      // Notify BA
      void sendNotification(supabase, {
        user_id: proposal.proposed_by,
        title: 'Cancellation Proposal Disputed',
        message: `The booker disputed the cancellation proposal for booking ${booking.booking_reference}. Contact them directly to resolve.`,
        type: 'warning',
        priority: 'urgent',
        source_type: 'cancellation_proposal',
        source_id: proposal.id,
      })

      return NextResponse.json({ success: true, action: 'disputed' })
    }

    // ACCEPT path
    await supabase
      .from('ba_cancellation_proposals')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        refund_destination_name: parsed.data.destination_name!,
        refund_destination_contact_number: parsed.data.destination_contact_number!,
      })
      .eq('id', proposal.id)

    // Cancel the booking
    await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_new_status: 'cancelled',
      p_changed_by_user_id: user!.id,
      p_changed_by_ai: false,
      p_reason: `Booker accepted BA cancellation proposal: ${proposal.reason}`,
      p_metadata: { proposal_id: proposal.id, action: 'accept' },
    })

    await supabase
      .from('bookings')
      .update({ cancellation_type: 'ba_proposal_confirmed', cancelled_at: new Date().toISOString() })
      .eq('id', bookingId)

    // Create refund record with the BA-proposed amount and mark payment as refund_requested
    if (proposal.payment_id) {
      const refundAmountPesos = proposal.refund_amount_centavos / 100
      try {
        await ManualRefundService.override({
          paymentId: proposal.payment_id,
          amount: refundAmountPesos,
          justificationNote: `BA cancellation proposal accepted — ${proposal.reason}`,
          destinationName: parsed.data.destination_name!,
          destinationContactNumber: parsed.data.destination_contact_number!,
          recordedBy: user!.id,
        })

        await AdminAuditService.log({
          actorId: user!.id,
          action: 'ba_proposal_refund_created',
          targetType: 'payment',
          targetId: proposal.payment_id,
          details: { proposal_id: proposal.id, refund_amount_centavos: proposal.refund_amount_centavos },
        })
      } catch (err) {
        console.error('[cancellation-proposal/respond] refund creation failed:', getErrorMessage(err))
        // Fallback: at least mark the payment so BA can manually create the refund
        await supabase
          .from('payments')
          .update({ payment_status: 'refund_requested', updated_at: new Date().toISOString() })
          .eq('id', proposal.payment_id)
      }
    }

    // Void any pending payments
    await supabase
      .from('payments')
      .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('booking_id', bookingId)
      .in('payment_status', ['pending', 'pending_review'])
      .neq('id', proposal.payment_id ?? '00000000-0000-0000-0000-000000000000')

    // Notify BA to process refund
    void sendNotification(supabase, {
      user_id: proposal.proposed_by,
      title: 'Cancellation Accepted — Process Refund',
      message: `Booker accepted cancellation for booking ${booking.booking_reference}. Process the refund in Payment Management.`,
      type: 'info',
      priority: 'high',
      source_type: 'cancellation_proposal',
      source_id: proposal.id,
    })

    void sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Cancellation Accepted — Refund Owed',
      message: `Booker accepted cancellation for booking ${booking.booking_reference}. Refund of ₱${(proposal.refund_amount_centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })} needs to be processed.`,
      type: 'warning',
      priority: 'high',
      source_type: 'cancellation_proposal',
      source_id: proposal.id,
    })

    return NextResponse.json({ success: true, action: 'accepted' })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
