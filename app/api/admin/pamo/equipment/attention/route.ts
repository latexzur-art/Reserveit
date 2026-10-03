import { NextResponse } from 'next/server'
import { requirePamo } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requirePamo()
  if (authError) return authError

  try {
    const supabase = createAdminClient()

    const { data: types, error: typesError } = await supabase
      .from('equipment_types')
      .select('id')
      .eq('managed_by', 'pamo')
    
    if (typesError) throw typesError

    const typeIds = types.map(t => t.id)
    if (typeIds.length === 0) {
      return NextResponse.json({ maintenance: [], warrantyExpiring: [], maintenanceCount: 0, warrantyCount: 0 })
    }

    // Statuses
    const { data: statuses, error: statusesError } = await supabase
      .from('equipment_status_types')
      .select('id, status_code, status_name')

    if (statusesError) throw statusesError

    const attentionStatuses = statuses.filter(s => ['MAINTENANCE', 'BROKEN'].includes(s.status_code))
    const attentionStatusIds = attentionStatuses.map(s => s.id)
    const statusMap = statuses.reduce((acc, s) => { acc[s.id] = s.status_name; return acc }, {} as Record<string, string>)

    // 1. Maintenance items
    const { data: maintenanceData, error: maintError } = await supabase
      .from('equipment')
      .select(`
        id,
        equipment_code,
        current_status_id,
        equipment_type:equipment_types!equipment_equipment_type_id_fkey(type_name),
        facility:facilities!equipment_assigned_facility_id_fkey(name)
      `)
      .in('equipment_type_id', typeIds)
      .in('current_status_id', attentionStatusIds)
      .eq('is_active', true)
      .limit(5)

    if (maintError) throw maintError

    const { count: maintenanceCount, error: maintCountError } = await supabase
      .from('equipment')
      .select('*', { count: 'exact', head: true })
      .in('equipment_type_id', typeIds)
      .in('current_status_id', attentionStatusIds)
      .eq('is_active', true)

    if (maintCountError) throw maintCountError

    const maintenance = maintenanceData.map(item => {
      const typeObj = item.equipment_type as any
      const facilityObj = item.facility as any

      return {
        id: item.id,
        code: item.equipment_code,
        name: typeObj?.type_name || 'Unknown',
        facilityName: facilityObj?.name || 'Unassigned',
        statusName: statusMap[item.current_status_id] || 'Unknown'
      }
    })

    // 2. Warranty expiring within 30 days
    const today = new Date()
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    // Format to YYYY-MM-DD
    const todayStr = today.toISOString().split('T')[0]
    const in30DaysStr = in30Days.toISOString().split('T')[0]

    const { data: warrantyData, error: warrantyError } = await supabase
      .from('equipment')
      .select(`
        id,
        equipment_code,
        warranty_expiry,
        equipment_type:equipment_types!equipment_equipment_type_id_fkey(type_name)
      `)
      .in('equipment_type_id', typeIds)
      .gte('warranty_expiry', todayStr)
      .lte('warranty_expiry', in30DaysStr)
      .eq('is_active', true)
      .order('warranty_expiry', { ascending: true })
      .limit(5)

    if (warrantyError) throw warrantyError

    const { count: warrantyCount, error: warrantyCountError } = await supabase
      .from('equipment')
      .select('*', { count: 'exact', head: true })
      .in('equipment_type_id', typeIds)
      .gte('warranty_expiry', todayStr)
      .lte('warranty_expiry', in30DaysStr)
      .eq('is_active', true)

    if (warrantyCountError) throw warrantyCountError

    const warrantyExpiring = warrantyData.map(item => {
      const typeObj = item.equipment_type as any

      return {
        id: item.id,
        code: item.equipment_code,
        name: typeObj?.type_name || 'Unknown',
        warrantyExpiry: item.warranty_expiry
      }
    })

    return NextResponse.json({
      maintenance,
      warrantyExpiring,
      maintenanceCount: maintenanceCount || 0,
      warrantyCount: warrantyCount || 0
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
