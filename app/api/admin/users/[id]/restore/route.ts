import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService, AdminAuditService } from '@/backend/admin'
import { setEntraUserEnabled } from '@/backend/auth/entra-users.service'
import { createAdminClient } from '@/lib/supabase/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

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

  const supabase = createAdminClient()
  const { data: target } = await supabase
    .from('users')
    .select('entra_object_id')
    .eq('id', id)
    .single()
  const entraObjectId: string | null = target?.entra_object_id ?? null

  try {
    const result = await AdminUsersService.restoreUser(id)

    if (result.success) {
      await AdminAuditService.log({
        actorId: user.id,
        action: 'user.restore',
        targetType: 'user',
        targetId: id,
      })

      if (entraObjectId) {
        await setEntraUserEnabled(entraObjectId, true)
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err) {
    console.error('[API] POST /admin/users/[id]/restore error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
