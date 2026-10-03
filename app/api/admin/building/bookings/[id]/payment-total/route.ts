import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { getErrorMessage } from '@/lib/errors'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireBuildingAdminStrict()
  if (error) return error

  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data, error: queryError } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', id)
      .eq('payment_status', 'completed')

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    const totalCentavos = (data ?? []).reduce(
      (sum, p) => sum + Math.round(Number(p.amount) * 100),
      0
    )

    return NextResponse.json({ totalCentavos })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
