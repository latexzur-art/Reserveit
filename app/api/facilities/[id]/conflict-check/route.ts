import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { checkTimeSlotAvailability } from '@/backend/booking'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const startTime = searchParams.get('start_time')
  const endTime = searchParams.get('end_time')
  const excludeBookingId = searchParams.get('exclude_booking_id') ?? undefined

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: 'Required: date, start_time, end_time' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const result = await checkTimeSlotAvailability(supabase, id, date, startTime, endTime, excludeBookingId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /facilities/[id]/conflict-check error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
