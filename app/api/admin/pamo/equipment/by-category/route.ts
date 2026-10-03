import { NextResponse } from 'next/server'
import { requirePamo } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requirePamo()
  if (authError) return authError

  try {
    const supabase = createAdminClient()

    // 1. Get all equipment_types where managed_by = 'pamo'
    const { data: types, error: typesError } = await supabase
      .from('equipment_types')
      .select('id, type_name')
      .eq('managed_by', 'pamo')
    
    if (typesError) throw typesError

    const typeIds = types.map(t => t.id)
    if (typeIds.length === 0) {
      return NextResponse.json({ categories: [] })
    }

    // 2. Get all equipment_status_types to map status codes to ids
    const { data: statuses, error: statusesError } = await supabase
      .from('equipment_status_types')
      .select('id, status_code')

    if (statusesError) throw statusesError

    const statusMap = statuses.reduce((acc, s) => {
      acc[s.id] = s.status_code // AVAILABLE, IN_USE, MAINTENANCE, BROKEN, etc.
      return acc
    }, {} as Record<string, string>)

    // 3. Get all active equipment where equipment_type_id is in the pamo type ids
    const { data: equipment, error: eqError } = await supabase
      .from('equipment')
      .select('id, equipment_type_id, current_status_id')
      .in('equipment_type_id', typeIds)
      .eq('is_active', true)

    if (eqError) throw eqError

    // 4. Group in JS by type, counting per status
    const categories = types.map(type => {
      const typeEquipment = equipment.filter(e => e.equipment_type_id === type.id)
      return {
        id: type.id,
        name: type.type_name,
        count: typeEquipment.length,
        available: typeEquipment.filter(e => statusMap[e.current_status_id] === 'AVAILABLE').length,
        inUse: typeEquipment.filter(e => statusMap[e.current_status_id] === 'IN_USE').length,
        maintenance: typeEquipment.filter(e => 
          statusMap[e.current_status_id] === 'MAINTENANCE' || statusMap[e.current_status_id] === 'BROKEN'
        ).length,
      }
    })

    // Sort categories by count descending for better UI presentation
    categories.sort((a, b) => b.count - a.count)

    return NextResponse.json({ categories })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
