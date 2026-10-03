import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService, AdminAuditService } from '@/backend/admin'
import { parseBody } from '@/lib/api/validate'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

const bodySchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'inactive']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireUserManager()
  if (error) return error

  const { id: rawId } = await params
  const idParsed = parseUuidParam(rawId, 'user id')
  if (!idParsed.ok) return idParsed.response
  const id = idParsed.value

  const parsed = await parseBody(request, bodySchema)
  if (!parsed.ok) return parsed.response

  try {
    const result = await AdminUsersService.updateAccountStatus(id, parsed.data.status)

    if (result.success) {
      await AdminAuditService.log({
        actorId: user.id,
        action: 'status.change',
        targetType: 'user',
        targetId: id,
        details: { newStatus: parsed.data.status },
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[API] PATCH /admin/users/[id]/status error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
