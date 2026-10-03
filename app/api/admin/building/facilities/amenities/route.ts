import { NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilitiesService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

/**
 * GET the full amenity catalog (facility_amenities), enriched with which
 * amenities are equipment-backed. Powers the facility editor's amenity combobox.
 */
export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const amenities = await BuildingFacilitiesService.getAmenityCatalog()
    return NextResponse.json({ amenities })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
