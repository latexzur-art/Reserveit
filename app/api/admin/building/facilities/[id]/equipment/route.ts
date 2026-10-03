import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { BA_FACILITY_ASSIGN_SCOPE } from '@/lib/auth/equipment-scope'

// A Building Admin may directly assign/unassign the scopes it owns operationally:
// non-tech (pamo) AND its own HVAC (building). Tech (it) still routes through the
// assignment-request flow. Sourced from the authoritative capability map so this
// can't silently drift back to a pamo-only scope that 403s every aircon move.
const SCOPE = BA_FACILITY_ASSIGN_SCOPE

/**
 * Handle equipment assignments for a specific facility
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id: rawId } = await params
    const parsed = parseUuidParam(rawId, 'facility id')
    if (!parsed.ok) return parsed.response
    const facilityId = parsed.value
    const { assignments } = await request.json()

    // assignments: Array<{ equipmentTypeId: string, quantity: number }>
    const results = []
    for (const assignment of assignments) {
      const ids = await BuildingEquipmentService.assignToFacility(
        facilityId,
        assignment.equipmentTypeId,
        assignment.quantity,
        [...SCOPE]
      )
      results.push({ typeId: assignment.equipmentTypeId, assignedCount: ids.length })
    }

    // Equipment assignment has committed — recompute this facility's
    // inventory-derived amenities to match. A sync failure here must not report
    // the (already-successful) assignment as failed: it's a derived, self-healing
    // recompute-from-scratch that will correct itself on the next equipment
    // mutation for this facility, so we log rather than fail the request — same
    // convention this codebase already uses for other post-commit side effects
    // (e.g. the fire-and-forget notification email in restricted-users/[id]/enforce).
    try {
      await BuildingEquipmentService.syncInventoryAmenities(facilityId)
    } catch (syncErr) {
      console.error('[equipment/assign] inventory amenity sync failed:', getErrorMessage(syncErr))
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    const message = getErrorMessage(err)
    return NextResponse.json({ error: message }, { status: message.startsWith('Forbidden') ? 403 : 500 })
  }
}

/**
 * Handle equipment removal from a specific facility
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id: rawId } = await params
    const parsed = parseUuidParam(rawId, 'facility id')
    if (!parsed.ok) return parsed.response
    const facilityId = parsed.value
    const { assignments } = await request.json()
    // assignments: Array<string> (equipment IDs)

    await BuildingEquipmentService.unassignFromFacility(assignments, [...SCOPE])

    // Equipment unassignment has committed — recompute this facility's
    // inventory-derived amenities to match (see POST handler above for why a sync
    // failure is logged rather than failing the request).
    try {
      await BuildingEquipmentService.syncInventoryAmenities(facilityId)
    } catch (syncErr) {
      console.error('[equipment/unassign] inventory amenity sync failed:', getErrorMessage(syncErr))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = getErrorMessage(err)
    return NextResponse.json({ error: message }, { status: message.startsWith('Forbidden') ? 403 : 500 })
  }
}

/**
 * GET current assigned equipment for a facility
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id: rawId } = await params
    const parsed = parseUuidParam(rawId, 'facility id')
    if (!parsed.ok) return parsed.response

    // `?units=1` returns one row per physical unit (asset code, brand, serial,
    // per-unit status) for the facility editor's per-unit "Managed Assets" list.
    // Without it, callers (e.g. room-availability) keep the grouped shape.
    if (request.nextUrl.searchParams.get('units') === '1') {
      const equipment = await BuildingEquipmentService.getUnitsForFacility(parsed.value)
      return NextResponse.json({ equipment })
    }

    const { equipment } = await BuildingEquipmentService.getAll({ facilityId: parsed.value })
    return NextResponse.json({ equipment })
  } catch (err) {
    const message = getErrorMessage(err)
    return NextResponse.json({ error: message }, { status: message.startsWith('Forbidden') ? 403 : 500 })
  }
}
