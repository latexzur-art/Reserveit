import { NextResponse } from 'next/server'
import { requirePamo } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requirePamo()
  if (authError) return authError

  try {
    const supabase = createAdminClient()

    // 1. Get Pamo types
    const { data: types, error: typesError } = await supabase
      .from('equipment_types')
      .select('id')
      .eq('managed_by', 'pamo')
    
    if (typesError) throw typesError

    const typeIds = types.map(t => t.id)
    if (typeIds.length === 0) {
      return NextResponse.json({ facilities: [] })
    }

    // 2. Query active equipment and join facilities
    const { data: equipment, error: eqError } = await supabase
      .from('equipment')
      .select(`
        id,
        assigned_facility_id,
        facility:facilities!equipment_assigned_facility_id_fkey(id, name)
      `)
      .in('equipment_type_id', typeIds)
      .eq('is_active', true)

    if (eqError) throw eqError

    // Group by facility
    const facilityMap = new Map()

    equipment.forEach(item => {
      const facilityId = item.assigned_facility_id
      const facilityObj = item.facility as any
      const facilityName = facilityId ? (facilityObj?.name || 'Unknown Facility') : 'Unassigned (Storage)'

      if (!facilityMap.has(facilityId)) {
        facilityMap.set(facilityId, {
          facilityId,
          facilityName,
          count: 0
        })
      }
      
      const group = facilityMap.get(facilityId)
      group.count += 1
    })

    const facilities = Array.from(facilityMap.values())
    // Sort by count desc
    facilities.sort((a, b) => b.count - a.count)

    return NextResponse.json({ facilities })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
