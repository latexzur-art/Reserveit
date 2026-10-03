import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { cancelWithRefund } from '@/backend/booking/emergencyRescheduleHandler'
import { getErrorMessage } from '@/lib/errors'

const Schema = z.object({
  refund_reason: z.string().max(1000).optional(),
  credit_amount_centavos: z.number().int().positive().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // body is optional
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
  }

  try {
    const { id } = await params
    const supabase = createAdminClient()
    const result = await cancelWithRefund(supabase, {
      bookingId: id,
      adminUserId: user!.id,
      refundReason: parsed.data.refund_reason,
      creditAmountCentavos: parsed.data.credit_amount_centavos,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 422 })
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
