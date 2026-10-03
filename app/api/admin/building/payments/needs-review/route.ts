import { NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id, payment_reference, amount, payment_status,
      qr_reference_number, qr_payer_name, qr_payer_contact_number, qr_screenshot_url, qr_submitted_at, qr_code_id,
      qr_payer_account_name, qr_payer_account_number,
      qr_code:payment_qr_codes(label, account_name, account_number),
      booking:bookings!payments_booking_id_fkey(id, booking_reference),
      submissions:payment_qr_submissions(id, payer_name, reference_number, screenshot_url, submitted_at, qr_code:payment_qr_codes(label))
    `)
    .in('payment_status', ['pending_review', 'refund_requested', 'refund_processing', 'disputed'])
    .order('updated_at', { ascending: true })

  if (error) return apiError(500, getErrorMessage(error))
  return NextResponse.json({ payments: data ?? [] })
}
