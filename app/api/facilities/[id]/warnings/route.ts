import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const { id } = await params
    const warnings = await BuildingFacilityEnhancementService.getActiveWarnings(id)
    return NextResponse.json({ warnings })
  } catch (err) {
    return apiUnexpectedError('GET /api/facilities/[id]/warnings', err)
  }
}
