import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { handleCancellation } from '@/backend/booking'

const idSchema = z.uuid()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { id: rawId } = await params
  const idCheck = idSchema.safeParse(rawId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }
  const id = idCheck.data

  let body: { reason?: string } = {}
  try {
    body = await request.json()
  } catch {
    // reason is optional
  }

  try {
    const supabase = createAdminClient()

    // Verify booking belongs to user
    const { data: booking } = await supabase
      .from('bookings')
      .select('user_id, current_status')
      .eq('id', id)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // No-strike statuses: faculty reschedule decline or pre-payment cancellation
    const cancellationType = booking.current_status === 'pending_faculty_response'
      ? 'alternative_declined'
      : booking.current_status === 'pending_user_response'
        ? 'admin_cancelled'
        : 'user_cancelled'

    const result = await handleCancellation(supabase, id, cancellationType, user.id, body.reason)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] PATCH /bookings/[id]/cancel error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
