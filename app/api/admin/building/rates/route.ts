import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingPricingService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { searchParams } = request.nextUrl
    const isAddon = searchParams.get('isAddon')
    const isActive = searchParams.get('isActive')

    const result = await BuildingPricingService.getAll({
      facilityId: searchParams.get('facilityId') || undefined,
      isAddon: isAddon !== null ? isAddon === 'true' : undefined,
      isActive: isActive !== null ? isActive === 'true' : undefined,
      feeCategory: (searchParams.get('feeCategory') as any) || undefined,
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
    const rate = await BuildingPricingService.create(body)
    return NextResponse.json(rate, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
