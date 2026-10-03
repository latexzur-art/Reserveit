import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiError, apiUnexpectedError } from '@/lib/api/response'

const STATUSES = ['published', 'under_review', 'archived']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()

    if (!STATUSES.includes(body.status)) {
      return apiError(400, 'status must be one of: published, under_review, archived')
    }

    const review = await BuildingFacilityEnhancementService.moderateReview(id, body.status)
    return NextResponse.json(review)
  } catch (err) {
    return apiUnexpectedError('PATCH /api/admin/building/reviews/[id]', err)
  }
}
