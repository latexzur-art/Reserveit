import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { resolveUserEmail, resolveUserPageUrls, getBuildingAdminEmails } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { bookerRefundProofEmail, refundDisputedEmail } from '@/backend/notifications/emailTemplates'

interface ConfirmEntitlementInput {
  cancellationRequestId: string
  destinationName?: string
  destinationContactNumber?: string
  recordedBy: string
  /** If provided, caps the refund to this amount instead of the full payment. */
  amount?: number
}

interface OverrideInput {
  paymentId: string
  amount: number
  justificationNote: string
  destinationName: string
  destinationContactNumber: string
  recordedBy: string
}

const APPROVED_CANCELLATION_STATUSES = ['approved_no_strike', 'approved_with_strike', 'auto_approved']

export const ManualRefundService = {
  async confirmEntitlement(input: ConfirmEntitlementInput): Promise<{ paymentId: string; amount: number }> {
    const supabase = createAdminClient()

    const { data: cr, error: crError } = await supabase
      .from('cancellation_requests')
      .select('id, booking_id, status, refund_destination_name, refund_destination_contact_number')
      .eq('id', input.cancellationRequestId)
      .single()
    if (crError || !cr) throw new Error('cancellation_request_not_found')
    if (!APPROVED_CANCELLATION_STATUSES.includes(cr.status)) throw new Error('cancellation_not_approved')

    const { data: payments, error: paymentError } = await supabase
      .from('payments').select('id, total_amount, payment_status, booking_id')
      .eq('booking_id', cr.booking_id).eq('payment_status', 'refund_requested').limit(1)
    const payment = payments?.[0] ?? null
    if (paymentError || !payment) throw new Error('no_refund_owed')

    const { data: existing } = await supabase.from('payment_refunds').select('id').eq('payment_id', payment.id).limit(1)
    if (existing && existing.length > 0) throw new Error('already_refunded')

    const refundAmount = input.amount != null ? input.amount : payment.total_amount
    if (refundAmount > payment.total_amount) throw new Error('amount_exceeds_total')

    const { error: insertError } = await supabase.from('payment_refunds').insert({
      payment_id: payment.id,
      booking_id: payment.booking_id,
      trigger_type: 'cancellation_request_entitlement',
      cancellation_request_id: cr.id,
      amount: refundAmount,
      destination_name: input.destinationName ?? cr.refund_destination_name,
      destination_contact_number: input.destinationContactNumber ?? cr.refund_destination_contact_number,
      recorded_by: input.recordedBy,
      status: 'pending_proof',
    })
    if (insertError) throw new Error(insertError.message)

    return { paymentId: payment.id, amount: refundAmount }
  },

  async override(input: OverrideInput): Promise<void> {
    const supabase = createAdminClient()

    const { data: payment, error: paymentError } = await supabase
      .from('payments').select('id, total_amount, payment_status, booking_id').eq('id', input.paymentId).single()
    if (paymentError || !payment) throw new Error('payment_not_found')
    if (payment.payment_status === 'refunded') throw new Error('already_refunded')
    if (payment.payment_status !== 'completed') throw new Error('not_refundable')
    if (input.amount <= 0 || input.amount > payment.total_amount) throw new Error('amount_exceeds_total')

    const { data: existing } = await supabase.from('payment_refunds').select('id').eq('payment_id', payment.id).limit(1)
    if (existing && existing.length > 0) throw new Error('already_refunded')

    const { error: insertError } = await supabase.from('payment_refunds').insert({
      payment_id: payment.id,
      booking_id: payment.booking_id,
      trigger_type: 'ba_override',
      amount: input.amount,
      justification_note: input.justificationNote,
      destination_name: input.destinationName,
      destination_contact_number: input.destinationContactNumber,
      recorded_by: input.recordedBy,
      status: 'pending_proof',
    })
    if (insertError) throw new Error(insertError.message)

    // Mark payment as refund_requested so BA can upload proof next
    await supabase.from('payments')
      .update({ payment_status: 'refund_requested', updated_at: new Date().toISOString() })
      .eq('id', payment.id)
  },

  async uploadProof(paymentId: string, referenceNumber: string, screenshotUrl: string, recordedBy: string): Promise<void> {
    const supabase = createAdminClient()

    const { data: refund, error } = await supabase
      .from('payment_refunds')
      .select('id, booking_id, status')
      .eq('payment_id', paymentId)
      .single()
    if (error || !refund) throw new Error('refund_not_found')
    if (refund.status === 'confirmed') throw new Error('already_confirmed')

    const { error: updateError } = await supabase
      .from('payment_refunds')
      .update({
        reference_number: referenceNumber,
        screenshot_url: screenshotUrl,
        status: 'proof_uploaded',
        proof_uploaded_at: new Date().toISOString(),
      })
      .eq('id', refund.id)
    if (updateError) throw new Error(updateError.message)

    // Notify client
    const { data: payment } = await supabase
      .from('payments').select('user_id, amount, booking_id').eq('id', paymentId).single()
    if (payment?.user_id) {
      const { data: booking } = await supabase
        .from('bookings').select('booking_reference').eq('id', payment.booking_id).single()

      const pageUrls = await resolveUserPageUrls(supabase, payment.user_id)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const paymentActionUrl = `${appUrl}${pageUrls.paymentUrl}`

      void sendNotification(supabase, {
        user_id: payment.user_id,
        title: 'Refund Processed — Please Confirm',
        message: `Your refund of ₱${Number(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for booking ${booking?.booking_reference ?? ''} has been processed. Please confirm receipt in your payment page.`,
        type: 'info',
        priority: 'high',
        source_type: 'payment',
        source_id: paymentId,
        action_url: paymentActionUrl,
      })

      void (async () => {
        const { emailTo, name } = await resolveUserEmail(supabase, payment.user_id)
        if (!emailTo) return
        const template = bookerRefundProofEmail({
          userName: name ?? 'Valued User',
          bookingRef: booking?.booking_reference ?? '',
          amount: `₱${Number(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
          referenceNumber,
          receiptUrl: paymentActionUrl,
        })
        await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
          .catch(err => console.error('[ManualRefundService] proof email failed:', err))
      })()
    }
  },

  async clientConfirm(paymentId: string, userId: string): Promise<void> {
    const supabase = createAdminClient()

    const { data: refund, error } = await supabase
      .from('payment_refunds')
      .select('id, status, booking_id')
      .eq('payment_id', paymentId)
      .single()
    if (error || !refund) throw new Error('refund_not_found')
    if (refund.status !== 'proof_uploaded') throw new Error('not_awaiting_confirmation')

    // Verify the user owns this payment
    const { data: payment } = await supabase
      .from('payments').select('user_id').eq('id', paymentId).single()
    if (!payment || payment.user_id !== userId) throw new Error('forbidden')

    const { error: updateError } = await supabase
      .from('payment_refunds')
      .update({ status: 'confirmed', client_confirmed_at: new Date().toISOString() })
      .eq('id', refund.id)
    if (updateError) throw new Error(updateError.message)
    // Trigger handles: payment_status → 'refunded'

    // Notify BA
    const { data: booking } = await supabase
      .from('bookings').select('booking_reference').eq('id', refund.booking_id).single()

    void sendNotification(supabase, {
      user_id: null as any, // ponytail: sendNotificationToRoles below
      title: 'Refund Confirmed',
      message: `Client confirmed refund receipt for booking ${booking?.booking_reference ?? ''}.`,
      type: 'success',
      priority: 'normal',
      source_type: 'payment',
      source_id: paymentId,
    })
    // sendNotificationToRoles for building_admin
    const { sendNotificationToRoles } = await import('@/backend/booking/autoDecisionRouter')
    void sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Refund Confirmed by Client',
      message: `Client confirmed receipt of refund for booking ${booking?.booking_reference ?? ''}. Refund finalized.`,
      type: 'success',
      priority: 'normal',
      source_type: 'payment',
      source_id: paymentId,
    })
  },

  async resolveDispute(paymentId: string, referenceNumber: string, screenshotUrl: string, recordedBy: string): Promise<void> {
    const supabase = createAdminClient()

    const { data: refund, error } = await supabase
      .from('payment_refunds')
      .select('id, status, booking_id')
      .eq('payment_id', paymentId)
      .single()
    if (error || !refund) throw new Error('refund_not_found')
    if (refund.status !== 'disputed') throw new Error('not_disputed')

    const { error: updateError } = await supabase
      .from('payment_refunds')
      .update({
        reference_number: referenceNumber,
        screenshot_url: screenshotUrl,
        status: 'proof_uploaded',
        proof_uploaded_at: new Date().toISOString(),
        client_disputed_at: null,
      })
      .eq('id', refund.id)
    if (updateError) throw new Error(updateError.message)

    // Notify client that the refund has been re-sent
    const { data: payment } = await supabase
      .from('payments').select('user_id, amount, booking_id').eq('id', paymentId).single()
    if (payment?.user_id) {
      const { data: booking } = await supabase
        .from('bookings').select('booking_reference').eq('id', payment.booking_id).single()

      const pageUrls = await resolveUserPageUrls(supabase, payment.user_id)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const paymentActionUrl = `${appUrl}${pageUrls.paymentUrl}`

      void sendNotification(supabase, {
        user_id: payment.user_id,
        title: 'Refund Re-Sent — Please Confirm',
        message: `Your refund of ₱${Number(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for booking ${booking?.booking_reference ?? ''} has been re-sent. Please confirm receipt in your payment page.`,
        type: 'info',
        priority: 'high',
        source_type: 'payment',
        source_id: paymentId,
        action_url: paymentActionUrl,
      })

      void (async () => {
        const { emailTo, name } = await resolveUserEmail(supabase, payment.user_id)
        if (!emailTo) return
        const template = bookerRefundProofEmail({
          userName: name ?? 'Valued User',
          bookingRef: booking?.booking_reference ?? '',
          amount: `₱${Number(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
          referenceNumber,
          receiptUrl: paymentActionUrl,
        })
        await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
          .catch(err => console.error('[ManualRefundService] resolve-dispute email failed:', err))
      })()
    }
  },

  async clientDispute(paymentId: string, userId: string): Promise<void> {
    const supabase = createAdminClient()

    const { data: refund, error } = await supabase
      .from('payment_refunds')
      .select('id, status, booking_id')
      .eq('payment_id', paymentId)
      .single()
    if (error || !refund) throw new Error('refund_not_found')
    if (refund.status !== 'proof_uploaded') throw new Error('not_awaiting_confirmation')

    const { data: payment } = await supabase
      .from('payments').select('user_id, amount').eq('id', paymentId).single()
    if (!payment || payment.user_id !== userId) throw new Error('forbidden')

    const { error: updateError } = await supabase
      .from('payment_refunds')
      .update({ status: 'disputed', client_disputed_at: new Date().toISOString() })
      .eq('id', refund.id)
    if (updateError) throw new Error(updateError.message)

    const { sendNotificationToRoles } = await import('@/backend/booking/autoDecisionRouter')
    const { data: booking } = await supabase
      .from('bookings').select('booking_reference').eq('id', refund.booking_id).single()

    void sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Refund Disputed by Client',
      message: `Client reports they did not receive the refund for booking ${booking?.booking_reference ?? ''}. Please contact them directly.`,
      type: 'warning',
      priority: 'urgent',
      source_type: 'payment',
      source_id: paymentId,
    })

    // Email BAs about the dispute
    void (async () => {
      const adminEmails = await getBuildingAdminEmails()
      if (adminEmails.length > 0) {
        const { subject, htmlBody } = refundDisputedEmail({
          bookingRef: booking?.booking_reference ?? '',
          amount: `₱${Number(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
          userName: payment.user_id ? 'Client' : 'Unknown',
        })
        void sendBrevoEmail({ to: adminEmails, subject, htmlBody }).catch(console.error)
      }
    })()
  },
}
