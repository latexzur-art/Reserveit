import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const supabase = createAdminClient()

  // Bounded by design (LLM10 — unbounded consumption): a growing institution
  // could accumulate thousands of refund rows over years, and this endpoint
  // is a RITA tool result that lands directly in model context, not just a
  // paginated UI table. Cap the row payload; compute the total separately
  // (unbounded aggregate, `amount` only — cheap) so "how much have we
  // refunded" stays accurate even though the row LIST is capped.
  const pageSize = Math.min(Number(searchParams.get('pageSize')) || 20, 50)
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const offset = (page - 1) * pageSize

  const applyFilters = <T extends { eq: Function; gte: Function; lte: Function }>(q: T): T => {
    const triggerType = searchParams.get('trigger_type')
    if (triggerType) q = q.eq('trigger_type', triggerType)
    const dateFrom = searchParams.get('date_from')
    if (dateFrom) q = q.gte('recorded_at', dateFrom)
    const dateTo = searchParams.get('date_to')
    if (dateTo) q = q.lte('recorded_at', dateTo)
    return q
  }

  let listQuery = supabase
    .from('payment_refunds')
    .select(`
      id, amount, trigger_type, reference_number, destination_name, recorded_at,
      payment:payments!payment_refunds_payment_id_fkey(payment_reference),
      booking:bookings!payment_refunds_booking_id_fkey(booking_reference),
      recorded_by_user:users!payment_refunds_recorded_by_fkey(full_name)
    `)
    .order('recorded_at', { ascending: false })
    .range(offset, offset + pageSize - 1)
  listQuery = applyFilters(listQuery)

  let sumQuery = supabase.from('payment_refunds').select('amount')
  sumQuery = applyFilters(sumQuery)

  const [{ data, error }, { data: sumRows, error: sumError }] = await Promise.all([listQuery, sumQuery])
  if (error) return apiError(500, getErrorMessage(error))
  if (sumError) return apiError(500, getErrorMessage(sumError))

  const totalAmount = (sumRows ?? []).reduce((sum: number, r: any) => sum + Number(r.amount), 0)
  return NextResponse.json({ refunds: data ?? [], totalAmount, page, pageSize })
}
