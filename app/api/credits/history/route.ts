import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser, requireBuildingAdminStrict } from '@/lib/auth/guards'
import { creditService } from '@/backend/credits/creditService'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get('userId')
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
  const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0)

  // Admin path: can query any user's credits
  if (targetUserId) {
    const { error } = await requireBuildingAdminStrict()
    if (error) return error
    try {
      const result = await creditService.getCreditHistory(targetUserId, { limit, offset })
      return NextResponse.json(result)
    } catch (err) {
      return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
    }
  }

  // User path: own credits only
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  try {
    const result = await creditService.getCreditHistory(user!.id, { limit, offset })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
