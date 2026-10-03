import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingReportsService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { searchParams } = request.nextUrl
    const result = await BuildingReportsService.getSystemLogs({
      search: searchParams.get('search') || undefined,
      action: searchParams.get('action') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
