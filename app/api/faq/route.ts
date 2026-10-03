import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFAQService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUserWithRoles()
  if (!user) {
    return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = request.nextUrl
    const role = user.roles?.[0]?.name ?? undefined
    const result = await BuildingFAQService.getAll({
      role,
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const body = await request.json()
    const item = await BuildingFAQService.create({ ...body, created_by: user!.auth_user_id ?? undefined })
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
