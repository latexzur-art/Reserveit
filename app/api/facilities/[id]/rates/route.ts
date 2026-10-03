import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { BuildingPricingService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuthenticatedUser()
  if (error) return error

  try {
    const { id } = await params
    const rates = await BuildingPricingService.getFacilityRatesPublic(id)
    if (!rates) {
      return NextResponse.json({ error: 'No rates configured for this facility' }, { status: 404 })
    }
    return NextResponse.json(rates)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
