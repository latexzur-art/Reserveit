import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cancellation_requests')
    .select(`
      id, reason, status, refund_window_met, reviewed_at, review_notes, created_at,
      booking:bookings!cancellation_requests_booking_id_fkey(booking_reference, booking_date)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50) // bounded — this result feeds RITA's get_my_cancellation_requests tool (see Edge Cases)

  if (error) return apiError(500, getErrorMessage(error))
  return NextResponse.json({ requests: data ?? [] })
}
