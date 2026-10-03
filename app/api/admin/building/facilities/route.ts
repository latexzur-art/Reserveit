import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict, requireAuthenticatedUser } from '@/lib/auth/guards'
import { BuildingFacilitiesService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const { searchParams } = request.nextUrl
    const result = await BuildingFacilitiesService.getAll({
      search: searchParams.get('search') || undefined,
      floor: searchParams.get('floor') || undefined,
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '50'),
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const body = await request.json()
    const facility = await BuildingFacilitiesService.create(body)
    return NextResponse.json(facility, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
