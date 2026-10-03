import { describe, it, expect, beforeEach, vi } from 'vitest'

// Fake Supabase tailored to the issue-reports service call chains:
//   create():                  from('equipment').select().eq('id',x).single()
//                              then from('equipment_issue_reports').insert().select().single()
//   listEquipmentForFacility(): from('equipment').select().eq('assigned_facility_id',x)  (awaited, no .single)
const box: { current: any } = { current: null }

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => box.current,
}))

interface FakeConfig {
  equipmentById?: Record<string, { equipment_code: string; managed_by: string }>
  equipmentByFacility?: Record<
    string,
    Array<{ id: string; equipment_code: string; equipment_name: string; managed_by: string }>
  >
}

function makeFake(config: FakeConfig) {
  const client = {
    from(table: string) {
      const state: { insert?: any; eqs: Array<{ col: string; val: any }> } = { eqs: [] }
      const builder: any = {
        select: () => builder,
        insert: (payload: any) => {
          state.insert = payload
          return builder
        },
        eq: (col: string, val: any) => {
          state.eqs.push({ col, val })
          return builder
        },
        single: async () => {
          if (table === 'equipment_issue_reports' && state.insert) {
            return { data: { id: 'rep-1', ...state.insert }, error: null }
          }
          if (table === 'equipment') {
            const id = state.eqs.find((e) => e.col === 'id')?.val
            const row = config.equipmentById?.[id]
            if (!row) return { data: null, error: null }
            return {
              data: { equipment_code: row.equipment_code, equipment_type: { managed_by: row.managed_by } },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        // thenable so `await from('equipment').select().eq(...)` resolves the list case
        then: (resolve: any) => {
          const fid = state.eqs.find((e) => e.col === 'assigned_facility_id')?.val
          const rows = (config.equipmentByFacility?.[fid] ?? []).map((r) => ({
            id: r.id,
            equipment_code: r.equipment_code,
            equipment_name: r.equipment_name,
            equipment_type: { managed_by: r.managed_by },
          }))
          resolve({ data: rows, error: null })
        },
      }
      return builder
    },
  }
  return client
}

import { EquipmentIssueReportsService } from '@/backend/equipment/issue-reports.service'

describe('EquipmentIssueReportsService.create — is_tech routing contract', () => {
  beforeEach(() => {
    box.current = null
  })

  it('marks the report tech when the item is IT-managed (routes to IT Admin)', async () => {
    box.current = makeFake({ equipmentById: { 'eq-tv': { equipment_code: 'TV-001', managed_by: 'it' } } })
    const report = await EquipmentIssueReportsService.create({
      equipmentId: 'eq-tv',
      facilityId: 'fac-1',
      category: 'broken',
      description: 'No display',
      reportedByUserId: 'prof-1',
    })
    expect(report.isTech).toBe(true)
    expect(report.equipmentCode).toBe('TV-001')
  })

  it('marks the report non-tech for PAMO-managed items (routes to PAMO)', async () => {
    box.current = makeFake({ equipmentById: { 'eq-proj': { equipment_code: 'PROJ-002', managed_by: 'pamo' } } })
    const report = await EquipmentIssueReportsService.create({
      equipmentId: 'eq-proj',
      facilityId: 'fac-1',
      category: 'malfunction',
      description: 'Flickering',
      reportedByUserId: 'prof-1',
    })
    expect(report.isTech).toBe(false)
  })

  it('defaults to non-tech when no equipment item is attached', async () => {
    box.current = makeFake({})
    const report = await EquipmentIssueReportsService.create({
      category: 'other',
      description: 'General note',
      reportedByUserId: 'prof-1',
    })
    expect(report.isTech).toBe(false)
  })
})

describe('EquipmentIssueReportsService.listEquipmentForFacility', () => {
  beforeEach(() => {
    box.current = null
  })

  it('returns the items assigned to a facility with isTech derived from managed_by', async () => {
    box.current = makeFake({
      equipmentByFacility: {
        'fac-1': [
          { id: 'eq-tv', equipment_code: 'TV-001', equipment_name: 'Smart TV', managed_by: 'it' },
          { id: 'eq-proj', equipment_code: 'PROJ-002', equipment_name: 'Projector', managed_by: 'pamo' },
        ],
      },
    })
    const items = await EquipmentIssueReportsService.listEquipmentForFacility('fac-1')
    expect(items).toHaveLength(2)
    const tv = items.find((i) => i.id === 'eq-tv')!
    const proj = items.find((i) => i.id === 'eq-proj')!
    expect(tv.isTech).toBe(true)
    expect(tv.equipmentName).toBe('Smart TV')
    expect(proj.isTech).toBe(false)
  })

  it('returns an empty list for a facility with no equipment', async () => {
    box.current = makeFake({ equipmentByFacility: {} })
    const items = await EquipmentIssueReportsService.listEquipmentForFacility('fac-empty')
    expect(items).toEqual([])
  })
})
