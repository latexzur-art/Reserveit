import { describe, it, expect } from 'vitest'
import { filterEquipmentGroups } from '@/hooks/admin/building/equipmentFilters'

// Grouped rows exactly as the equipment API returns them (a BuildingEquipment
// view plus quantity/ids/displayCode). These pure-function tests pin the
// client-side filtering that replaced the per-keystroke / per-click server
// round-trips on the equipment inventory page.
const groups = [
  {
    ids: ['a1'], displayCode: 'PC-001', equipmentCode: 'PC-001',
    equipmentName: 'Dell Desktop', brand: 'Dell',
    equipmentTypeId: 't-pc', currentStatusId: 's-available',
    assignedFacilityId: 'f1', assignedFacilityName: 'Lab 1', managedBy: 'it',
  },
  {
    ids: ['b1'], displayCode: 'PROJ-001', equipmentCode: 'PROJ-001',
    equipmentName: 'Epson Projector', brand: 'Epson',
    equipmentTypeId: 't-proj', currentStatusId: 's-inuse',
    assignedFacilityId: 'f2', assignedFacilityName: 'Room 204', managedBy: 'pamo',
  },
  {
    ids: ['c1'], displayCode: 'AC-001', equipmentCode: 'AC-001',
    equipmentName: 'Carrier Aircon', brand: 'Carrier',
    equipmentTypeId: 't-hvac', currentStatusId: 's-available',
    assignedFacilityId: null, assignedFacilityName: null, managedBy: 'building',
  },
]

describe('filterEquipmentGroups', () => {
  it('returns every group when no criteria are given', () => {
    expect(filterEquipmentGroups(groups, {})).toHaveLength(3)
  })

  it('filters by equipment type (category)', () => {
    const result = filterEquipmentGroups(groups, { category: 't-proj' })
    expect(result.map(g => g.displayCode)).toEqual(['PROJ-001'])
  })

  it('filters by status', () => {
    const result = filterEquipmentGroups(groups, { status: 's-available' })
    expect(result.map(g => g.displayCode)).toEqual(['PC-001', 'AC-001'])
  })

  it('filters by ownership scope (managedBy)', () => {
    const result = filterEquipmentGroups(groups, { scope: 'it' })
    expect(result.map(g => g.displayCode)).toEqual(['PC-001'])
  })

  it('filters by assignment state', () => {
    expect(filterEquipmentGroups(groups, { assignment: 'unassigned' }).map(g => g.displayCode))
      .toEqual(['AC-001'])
    expect(filterEquipmentGroups(groups, { assignment: 'assigned' }).map(g => g.displayCode))
      .toEqual(['PC-001', 'PROJ-001'])
  })

  it('treats "all" and empty string as no filter', () => {
    expect(filterEquipmentGroups(groups, { category: 'all', status: '', scope: 'all', assignment: '' }))
      .toHaveLength(3)
  })

  it('matches search against name, code, and location, case-insensitively', () => {
    expect(filterEquipmentGroups(groups, { search: 'dell' }).map(g => g.displayCode)).toEqual(['PC-001'])
    expect(filterEquipmentGroups(groups, { search: 'proj-001' }).map(g => g.displayCode)).toEqual(['PROJ-001'])
    expect(filterEquipmentGroups(groups, { search: 'room 204' }).map(g => g.displayCode)).toEqual(['PROJ-001'])
    expect(filterEquipmentGroups(groups, { search: 'nonexistent' })).toHaveLength(0)
  })

  it('combines multiple criteria with AND', () => {
    // available AND scope=building -> only the aircon
    const result = filterEquipmentGroups(groups, { status: 's-available', scope: 'building' })
    expect(result.map(g => g.displayCode)).toEqual(['AC-001'])
  })
})
