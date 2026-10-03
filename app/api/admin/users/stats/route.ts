import { NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminUsersService } from '@/backend/admin'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const stats = await AdminUsersService.getUserStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[API] GET /admin/users/stats error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
