import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserManager } from '@/lib/auth/guards'
import { DataWipeService, DEFAULT_PRESERVE_ROLES, AdminAuditService } from '@/backend/admin'
import { checkDataWipeAllowed } from '@/lib/env/data-wipe'
import { parseBody } from '@/lib/api/validate'
import { apiError, apiUnexpectedError } from '@/lib/api/response'

const WipeUsersSchema = z.object({
  // Must be exactly "WIPE USERS".
  confirm: z.string(),
})

/** GET: environment gate + dry-run count of deletable users. */
export async function GET() {
  const { error, user } = await requireUserManager()
  if (error) return error

  const gate = checkDataWipeAllowed()
  if (!gate.allowed) {
    return NextResponse.json({ allowed: false, reason: gate.reason, count: 0, preservedRoles: DEFAULT_PRESERVE_ROLES })
  }

  try {
    const count = await DataWipeService.userCount(user.id)
    return NextResponse.json({ allowed: true, count, preservedRoles: DEFAULT_PRESERVE_ROLES })
  } catch (err) {
    return apiUnexpectedError('GET /api/admin/users/wipe', err)
  }
}

/** POST: permanently delete all non-preserved users. */
export async function POST(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  const gate = checkDataWipeAllowed()
  if (!gate.allowed) return apiError(403, gate.reason)

  const parsed = await parseBody(request, WipeUsersSchema)
  if (!parsed.ok) return parsed.response

  if (parsed.data.confirm.trim() !== 'WIPE USERS') {
    return apiError(400, 'Confirmation phrase must be exactly "WIPE USERS".')
  }

  try {
    const result = await DataWipeService.wipeUsers(user.id)

    await AdminAuditService.log({
      actorId: user.id,
      action: 'users.wipe',
      targetType: 'user',
      details: { deletedCount: result.deleted_count, preservedRoles: DEFAULT_PRESERVE_ROLES },
    })

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    return apiUnexpectedError('POST /api/admin/users/wipe', err)
  }
}
