import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService, AdminAuditService } from '@/backend/admin'
import { parseBody } from '@/lib/api/validate'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

const bodySchema = z.object({
  action: z.enum(['suspend', 'activate', 'delete']),
  userIds: z.array(z.string().min(1)).min(1, 'action and userIds[] are required'),
})

export async function POST(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  const parsed = await parseBody(request, bodySchema)
  if (!parsed.ok) return parsed.response
  const { action, userIds } = parsed.data

  try {
    let result

    switch (action) {
      case 'suspend':
        result = await AdminUsersService.bulkUpdateStatus(userIds, 'suspended')
        break
      case 'activate':
        result = await AdminUsersService.bulkUpdateStatus(userIds, 'active')
        break
      case 'delete':
        result = await AdminUsersService.bulkDelete(userIds)
        break
    }

    if (result.success) {
      await AdminAuditService.log({
        actorId: user.id,
        action: `bulk.${action}`,
        targetType: 'user',
        details: { userIds, count: userIds.length },
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[API] POST /admin/users/bulk error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
