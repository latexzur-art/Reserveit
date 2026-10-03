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
    const { id: bookingId } = await params
    const supabase = createAdminClient()

    const { data, error: queryError } = await supabase
      .from('session_credits')
      .select('id, amount_centavos, event_type, source, reason, expires_at, created_at')
      .or(`source_booking_id.eq.${bookingId},applied_to_booking_id.eq.${bookingId}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    return NextResponse.json({ entries: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
