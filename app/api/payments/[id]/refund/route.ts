import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'

/**
 * Returns the single refund record for a payment, for the refund receipt
 * download. RLS on payment_refunds already scopes SELECT to the payment's
 * own owner (payments.user_id = auth.uid()) or building_admin/it_admin, so
 * this uses the session-scoped client rather than an admin/service client.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'payment id')
  if (!idCheck.ok) return idCheck.response

  try {
    const supabase = await createClient()
    const { data: refund, error } = await supabase
      .from('payment_refunds')
      .select(
        'amount, reference_number, screenshot_url, destination_name, destination_contact_number, recorded_at, trigger_type, justification_note, recorded_by_user:users!payment_refunds_recorded_by_fkey(full_name), cancellation_request:cancellation_requests(refund_destination_qr_url)',
      )
      .eq('payment_id', idCheck.value)
      .maybeSingle()

    if (error) return apiError(500, getErrorMessage(error))
    if (!refund) return apiError(404, 'No refund found for this payment')

    const recordedByUserRaw = refund.recorded_by_user
    const recordedByUser = Array.isArray(recordedByUserRaw) ? recordedByUserRaw[0] : recordedByUserRaw
    const crRaw = (refund as any)?.cancellation_request
    const cr = Array.isArray(crRaw) ? crRaw[0] : crRaw

    return NextResponse.json({
      refund: {
        amount: refund.amount,
        reference_number: refund.reference_number,
        screenshot_url: refund.screenshot_url,
        destination_name: refund.destination_name,
        destination_contact_number: refund.destination_contact_number,
        destination_qr_url: cr?.refund_destination_qr_url ?? null,
        recorded_at: refund.recorded_at,
        trigger_type: refund.trigger_type,
        justification_note: refund.justification_note,
        recorded_by_name: recordedByUser?.full_name ?? 'Building Admin',
      },
    })
  } catch (err) {
    return apiError(500, getErrorMessage(err))
  }
}
