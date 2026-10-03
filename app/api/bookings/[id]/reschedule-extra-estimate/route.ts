import { NextRequest, NextResponse } from 'next/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { estimateExtraCentavos } from '@/backend/booking/emergencyRescheduleRequestService'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const bookingId = __idParsed.value
  const { searchParams } = request.nextUrl
  const proposedStart = searchParams.get('proposed_start_time')
  const proposedEnd = searchParams.get('proposed_end_time')

  if (!proposedStart || !proposedEnd) {
    return NextResponse.json({ error: 'proposed_start_time and proposed_end_time are required' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, start_time, end_time')
      .eq('id', bookingId)
      .eq('user_id', user!.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const originalStart = booking.start_time?.slice(0, 5) ?? '00:00'
    const originalEnd = booking.end_time?.slice(0, 5) ?? '00:00'

    const { extraAmountCentavos, breakdown } = estimateExtraCentavos(
      originalStart, originalEnd,
      proposedStart, proposedEnd,
    )

    const extraAmountPeso = (extraAmountCentavos / 100).toFixed(2)

    return NextResponse.json({
      extraAmountCentavos,
      extraAmountPeso,
      breakdown,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
