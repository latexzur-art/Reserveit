import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'

/**
 * Single-payment fact source for RITA's confirm-card system: lets the
 * Building Admin (or the payment's own owner) see real server-fetched facts
 * before confirming a refund/verify/reject action, rather than trusting
 * model-claimed values. Uses the admin client because access is scoped
 * manually below (owner or building_admin/it_admin) instead of via RLS.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'payment id')
  if (!idCheck.ok) return idCheck.response

  try {
    const supabase = createAdminClient()
    const { data: payment, error } = await supabase
      .from('payments')
      .select(
        'id, payment_reference, amount, total_amount, payment_status, user_id, qr_payer_name, qr_reference_number, booking:bookings!payments_booking_id_fkey(booking_reference)',
      )
      .eq('id', idCheck.value)
      .single()

    if (error || !payment) return apiError(404, 'Payment not found')

    const roles = (user.roles ?? []).map((r: { name: string }) => r.name)
    const isAdmin = roles.some((r: string) => ['building_admin', 'it_admin'].includes(r))
    if (payment.user_id !== user.id && !isAdmin) return apiError(403, 'Forbidden')

    return NextResponse.json({ payment })
  } catch (err) {
    console.error('Error fetching payment:', err)
    return apiError(500, getErrorMessage(err))
  }
}
