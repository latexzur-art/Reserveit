import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const rating = searchParams.get('rating')
    const hasIssue = searchParams.get('hasIssue')

    const { reviews, total } = await BuildingFacilityEnhancementService.adminListReviews({
      facilityId: searchParams.get('facilityId') || undefined,
      rating: rating ? Number(rating) : undefined,
      status: (searchParams.get('status') as any) || undefined,
      hasIssue: hasIssue === null ? undefined : hasIssue === 'true',
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
    })

    return NextResponse.json({ reviews, total })
  } catch (err) {
    return apiUnexpectedError('GET /api/admin/building/reviews', err)
  }
}
