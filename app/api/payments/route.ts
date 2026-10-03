import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  try {
    const url = new URL(request.url)
    const scopeSelf = url.searchParams.get('scope') === 'self'

    const roles = (user.roles ?? []).map((r: { name: string }) => r.name)
    const isAdminViewer = roles.some((r: string) => ['building_admin', 'it_admin'].includes(r))
    // When scope=self, always filter to the requesting user's own payments regardless of role
    const filterByUser = !isAdminViewer || scopeSelf

    const supabase = createAdminClient()
    let query = supabase
      .from('payments')
      .select(`
        id,
        user_id,
        payment_reference,
        amount,
        currency,
        total_amount,
        payment_method,
        payment_status,
        description,
        metadata,
        paymongo_checkout_url,
        paymongo_source_id,
        paymongo_webhook_data,
        qr_reference_number,
        qr_review_notes,
        qr_payer_name,
        qr_payer_contact_number,
        created_at,
        updated_at,
        booking:bookings(
          id,
          user_id,
          booking_reference,
          booking_purpose,
          purpose,
          current_status,
          organization_name,
          contact_number,
          user:users!bookings_user_id_fkey(full_name, email)
        ),
        payment_refunds:payment_refunds(amount, reference_number, destination_name, recorded_at)
      `)
      .order('created_at', { ascending: false })

    if (filterByUser) {
      query = query.eq('user_id', user.id)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      console.error('[API] GET /payments error:', queryError.message)
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    // payment_refunds is a join, so Supabase returns it as an array — but the
    // Task 14 unique index (one refund row per payment) guarantees at most one
    // entry. Collapse it to a singular `refund` field for callers (RITA's
    // get_my_payments tool included) so they don't need join-shape knowledge.
    const shaped = (data ?? []).map((p: any) => {
      const { payment_refunds, ...rest } = p
      return {
        ...rest,
        refund: Array.isArray(payment_refunds) && payment_refunds.length > 0 ? payment_refunds[0] : null,
      }
    })

    return NextResponse.json({ payments: shaped })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /payments error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
