import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const minCapacity = searchParams.get('minCapacity')

    const facilities = await BuildingFacilityEnhancementService.getCatalog({
      floorId: searchParams.get('floorId') || undefined,
      typeId: searchParams.get('typeId') || undefined,
      minCapacity: minCapacity ? Number(minCapacity) : undefined,
      search: searchParams.get('search') || undefined,
      rentalOnly: searchParams.get('rental') === 'true',
    })

    return NextResponse.json({ facilities })
  } catch (err) {
    return apiUnexpectedError('GET /api/facilities/catalog', err)
  }
}
