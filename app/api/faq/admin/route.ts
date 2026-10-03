import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFAQService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

// Building admin only — returns ALL FAQs including inactive for management UI
export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { searchParams } = request.nextUrl
    const result = await BuildingFAQService.getAll({
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      includeInactive: true,
      pageSize: 500,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
