import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { ManualRefundService } from '@/backend/payments/manualRefundService'
import { getErrorMessage } from '@/lib/errors'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id: bookingId } = await params

  try {
    const supabase = await createClient()
    const { data: payment } = await supabase
      .from('payments')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('payment_status', 'refund_processing')
      .maybeSingle()

    if (!payment) return NextResponse.json({ error: 'No refund awaiting confirmation' }, { status: 404 })

    await ManualRefundService.clientConfirm(payment.id, user!.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
