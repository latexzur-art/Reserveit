import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { approveEmergencyRequest } from '@/backend/booking/emergencyRequestService'
import { getErrorMessage } from '@/lib/errors'

const Schema = z.object({
  amount_centavos: z.number().int().min(0),
  review_notes: z.string().max(1000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
  }

  try {
    const { id } = await params
    const result = await approveEmergencyRequest({
      requestId: id,
      adminUserId: user!.id,
      amountCentavos: parsed.data.amount_centavos,
      reviewNotes: parsed.data.review_notes,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 422 })
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
