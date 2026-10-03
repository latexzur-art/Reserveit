import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingDirectoryService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'
import type { PersonCategory } from '@/backend/admin/building/building.types'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { searchParams } = request.nextUrl
    const result = await BuildingDirectoryService.listAll({
      search: searchParams.get('search') || undefined,
      category: (searchParams.get('category') || 'all') as PersonCategory | 'all',
      departmentId: searchParams.get('departmentId') || undefined,
      status: (searchParams.get('status') || 'all') as 'active' | 'inactive' | 'all',
      sortBy: (searchParams.get('sortBy') || 'name') as any,
      sortOrder: (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '50'),
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
