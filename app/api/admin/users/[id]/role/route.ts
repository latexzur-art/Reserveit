import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService, AdminAuditService } from '@/backend/admin'
import { parseBody } from '@/lib/api/validate'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

const bodySchema = z.object({ roleId: z.string().min(1, 'roleId is required') })

export async function POST(
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
    const result = await AdminUsersService.assignRole(id, parsed.data.roleId, user.id)

    if (result.success) {
      await AdminAuditService.log({
        actorId: user.id,
        action: 'role.assign',
        targetType: 'user',
        targetId: id,
        details: { roleId: parsed.data.roleId },
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[API] POST /admin/users/[id]/role error:', err)
    return apiError(500, getErrorMessage(err))
  }
}

export async function DELETE(
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
    const result = await AdminUsersService.removeRole(id, parsed.data.roleId)

    if (result.success) {
      await AdminAuditService.log({
        actorId: user.id,
        action: 'role.remove',
        targetType: 'user',
        targetId: id,
        details: { roleId: parsed.data.roleId },
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[API] DELETE /admin/users/[id]/role error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
