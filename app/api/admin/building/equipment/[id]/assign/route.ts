import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/errors'

/**
 * Building Admin assigns/moves a NON-TECH (pamo-scoped) item to a facility.
 * Tech items must go through the assignment-request flow instead.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const { toFacilityId, reason } = await request.json()

    const supabase = createAdminClient()
    const { data: eq } = await supabase
      .from('equipment')
      .select('equipment_type:equipment_types!equipment_equipment_type_id_fkey(managed_by)')
      .eq('id', id)
      .single()
    if (!eq) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })

    const managedBy = (eq.equipment_type as any)?.managed_by
    if (managedBy !== 'pamo') {
      return NextResponse.json(
        { error: 'Building Admin can only assign non-tech equipment. Tech requires an assignment request.' },
        { status: 403 },
      )
    }

    const { error: rpcErr } = await supabase.rpc('assign_equipment_facility', {
      p_equipment_id: id,
      p_to_facility_id: toFacilityId || null,
      p_user_id: user!.id,
      p_reason: reason || 'Moved by building admin',
    })
    if (rpcErr) throw new Error(rpcErr.message)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
