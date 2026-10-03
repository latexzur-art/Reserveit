import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { approveRescheduleRequest } from '@/backend/booking/emergencyRescheduleRequestService'
import { getErrorMessage } from '@/lib/errors'

const ApproveSchema = z.object({
  review_notes: z.string().max(1000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine for approve
  }

  const parsed = ApproveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
  }

  try {
    const { id: requestId } = await params
    const result = await approveRescheduleRequest({
      requestId,
      adminUserId: user!.id,
      reviewNotes: parsed.data.review_notes,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      extraPaymentId: result.extraPaymentId,
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
