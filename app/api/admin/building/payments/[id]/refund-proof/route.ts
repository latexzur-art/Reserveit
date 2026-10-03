import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { ManualRefundService } from '@/backend/payments/manualRefundService'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'
import { getErrorMessage } from '@/lib/errors'

const BodySchema = z.object({
  reference_number: z.string().min(1, 'Reference number is required'),
  screenshot_url: z.string().url('Must be a valid URL'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'payment id')
  if (!idCheck.ok) return idCheck.response

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 })

  try {
    await ManualRefundService.uploadProof(
      idCheck.value,
      parsed.data.reference_number,
      parsed.data.screenshot_url,
      user!.id,
    )

    await AdminAuditService.log({
      actorId: user!.id,
      action: 'refund_proof_uploaded',
      targetType: 'payment',
      targetId: idCheck.value,
      details: { reference_number: parsed.data.reference_number },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message === 'already_confirmed' ? 409 : message === 'refund_not_found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
