import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiError, apiUnexpectedError } from '@/lib/api/response'

const ISSUE_CATEGORIES = ['EQUIPMENT', 'AIRCON', 'LIGHTING', 'CLEANLINESS', 'NETWORK', 'FURNITURE', 'SAFETY', 'OTHER']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const { id } = await params
    const reviews = await BuildingFacilityEnhancementService.getPublishedReviews(id)
    return NextResponse.json({ reviews })
  } catch (err) {
    return apiUnexpectedError('GET /api/facilities/[id]/reviews', err)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()

    const rating = Number(body.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return apiError(400, 'rating must be an integer between 1 and 5')
    }
    if (body.issueReported && !ISSUE_CATEGORIES.includes(body.issueCategory)) {
      return apiError(400, 'issueCategory is required and must be a valid category when issueReported is true')
    }

    const review = await BuildingFacilityEnhancementService.createReview({
      facilityId: id,
      userId: user.id,
      bookingId: body.bookingId || null,
      rating,
      comment: body.comment || null,
      issueReported: !!body.issueReported,
      issueCategory: body.issueReported ? body.issueCategory : null,
    })

    return NextResponse.json(review, { status: 201 })
  } catch (err) {
    return apiUnexpectedError('POST /api/facilities/[id]/reviews', err)
  }
}
