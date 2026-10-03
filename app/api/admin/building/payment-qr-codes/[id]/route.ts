import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { QrCodeService } from '@/backend/payments/qrCodeService'

const PatchSchema = z.object({
  label: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().optional(),
  category: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'qr code id')
  if (!idCheck.ok) return idCheck.response

  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return apiError(400, parsed.error.issues.map(i => i.message).join('; '))

  try {
    await QrCodeService.update(idCheck.value, {
      label: parsed.data.label,
      isActive: parsed.data.is_active,
      displayOrder: parsed.data.display_order,
      category: parsed.data.category,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError(500, getErrorMessage(err))
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'qr code id')
  if (!idCheck.ok) return idCheck.response

  try {
    await QrCodeService.remove(idCheck.value)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = getErrorMessage(err)
    if (message === 'has_history') return apiError(409, 'This QR code has payment history — deactivate it instead of deleting.')
    return apiError(500, message)
  }
}
