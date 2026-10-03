import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilitiesService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

/**
 * GET the current facility_amenity_map rows (manual + inventory) for one
 * facility, for the editor to pre-populate when opening a facility for edit.
 * Writes happen via PATCH /api/admin/building/facilities/[id] (amenities[] in
 * the body), not here — this route is read-only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id: facilityId } = await params
    const amenities = await BuildingFacilitiesService.getFacilityAmenities(facilityId)
    return NextResponse.json({ amenities })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
