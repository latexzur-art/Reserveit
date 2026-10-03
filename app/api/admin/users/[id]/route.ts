import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService, AdminAuditService } from '@/backend/admin'
import { deleteEntraUser, setEntraUserEnabled } from '@/backend/auth/entra-users.service'
import { createAdminClient } from '@/lib/supabase/server'
import { parseBody } from '@/lib/api/validate'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  email: z.string().email().optional(),
  notificationEmail: z.string().email().nullable().optional().or(z.literal('')),
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

  const parsed = await parseBody(request, updateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const result = await AdminUsersService.updateUser(id, {
      fullName: body.fullName,
      phone: body.phone ?? undefined,
      departmentId: body.departmentId ?? undefined,
      email: body.email,
      notificationEmail: body.notificationEmail as string | undefined,
    })

    if (result.success) {
      await AdminAuditService.log({
        actorId: user.id,
        action: 'user.update',
        targetType: 'user',
        targetId: id,
        details: body,
      })
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err) {
    console.error('[API] PATCH /admin/users/[id] error:', err)
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

  const { searchParams } = new URL(request.url)
  const permanent = searchParams.get('permanent') === 'true'

  // Fetch entra_object_id before deleting — the permanent-delete RPC may remove the row
  const supabase = createAdminClient()
  const { data: target } = await supabase
    .from('users')
    .select('entra_object_id')
    .eq('id', id)
    .single()
  const entraObjectId: string | null = target?.entra_object_id ?? null

  try {
    const result = permanent
      ? await AdminUsersService.permanentDeleteUser(id)
      : await AdminUsersService.deleteUser(id)

    if (result.success) {
      await AdminAuditService.log({
        actorId: user.id,
        action: permanent ? 'user.permanent_delete' : 'user.delete',
        targetType: 'user',
        targetId: id,
      })

      if (entraObjectId) {
        if (permanent) {
          try {
            await deleteEntraUser(entraObjectId)
          } catch (entraErr) {
            console.error(
              `[API] DELETE /admin/users/${id} — Entra permanent delete failed for objectId=${entraObjectId}. Manual cleanup may be required.`,
              entraErr,
            )
          }
        } else {
          await setEntraUserEnabled(entraObjectId, false)
        }
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 409 })
  } catch (err) {
    console.error('[API] DELETE /admin/users/[id] error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
