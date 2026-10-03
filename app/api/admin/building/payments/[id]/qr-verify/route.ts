import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { sendPaymentCompletionNotifications } from '@/backend/booking/paymentNotifier'
import { applyRescheduleOnPayment } from '@/backend/booking/emergencyRescheduleRequestService'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'payment id')
  if (!idCheck.ok) return idCheck.response
  const paymentId = idCheck.value

  const supabase = createAdminClient()
  const { data: payment, error: paymentError } = await supabase.from('payments').select('id, payment_status').eq('id', paymentId).single()
  if (paymentError || !payment) return apiError(404, 'Payment not found')
  if (payment.payment_status !== 'pending_review') return apiError(400, `Cannot verify a payment in "${payment.payment_status}" status`)

  const { data: completed, error: rpcError } = await supabase.rpc('complete_payment', {
    p_payment_id: paymentId, p_paymongo_data: null, p_amount_centavos: null,
  })
  if (rpcError) return apiError(500, rpcError.message)
  if (!completed) return apiError(409, 'Payment was already processed by another reviewer')

  const { error: qrReviewUpdateError } = await supabase.from('payments').update({
    qr_reviewed_by: user.id, qr_reviewed_at: new Date().toISOString(),
  }).eq('id', paymentId)
  if (qrReviewUpdateError) {
    console.error('[qr-verify] qr_reviewed update error:', qrReviewUpdateError.message)
  }

  // Check if this is a reschedule extra payment — apply the reschedule and skip booking notifications
  const { data: paymentTypRow } = await supabase
    .from('payments')
    .select('payment_type')
    .eq('id', paymentId)
    .single()

  if ((paymentTypRow as any)?.payment_type === 'reschedule_extra') {
    try {
      const { applied, message: applyMsg } = await applyRescheduleOnPayment(paymentId)
      if (!applied) {
        console.error('[qr-verify] applyRescheduleOnPayment failed:', applyMsg)
      }
    } catch (err) {
      console.error('[qr-verify] applyRescheduleOnPayment error:', err)
    }
  } else {
    // The payment already completed above (complete_payment RPC) — a failure here
    // must never look like the verification failed, so it's logged, not thrown.
    try {
      await sendPaymentCompletionNotifications(supabase, paymentId)
    } catch (err) {
      console.error('[qr-verify] post-verify completion notification failed:', err)
    }
  }

  return NextResponse.json({ success: true })
}
