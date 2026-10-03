import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

export async function GET(_request: NextRequest) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const bookings = await BuildingFacilityEnhancementService.getUnreviewedBookings(user.id)
    return NextResponse.json({ bookings })
  } catch (err) {
    return apiUnexpectedError('GET /api/bookings/unreviewed', err)
  }
}
