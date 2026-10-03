import { NextResponse, type NextRequest } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { EquipmentAssignmentRequestsService } from '@/backend/equipment/assignment-requests.service'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireUserManager()
  if (authError) return authError

  try {
    const { id: rawId } = await params
    const idParsed = parseUuidParam(rawId, 'request id')
    if (!idParsed.ok) return idParsed.response
    const id = idParsed.value
    const body = await request.json()
    if (!body?.status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }
    const req = await EquipmentAssignmentRequestsService.updateStatus(id, {
      status: body.status,
      statusNote: body.statusNote,
      handledByUserId: user!.id,
    })
    return NextResponse.json(req)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
