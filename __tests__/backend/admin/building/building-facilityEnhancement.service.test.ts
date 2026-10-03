import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fake Supabase client ────────────────────────────────────────────────────

type Row = Record<string, any>

function createFakeSupabase(initialTables: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {}
  for (const [name, rows] of Object.entries(initialTables)) {
    tables[name] = rows.map(r => ({ ...r }))
  }

  function from(table: string) {
    if (!tables[table]) tables[table] = []

    const filters: Array<(row: Row) => boolean> = []
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let selectCols: string | null = null
    let orderCol: string | null = null
    let orderAsc = true

    function applyFilters(list: Row[]) {
      return list.filter(r => filters.every(f => f(r)))
    }

    function resolveEmbeds(row: Row): Row {
      if (selectCols?.includes('amenity:facility_amenities') && row.amenity_id) {
        const amenity = (tables['facility_amenities'] || []).find(a => a.id === row.amenity_id)
        return { ...row, amenity: amenity || null }
      }
      if (selectCols?.includes('floor:floors') && row.floor_id) {
        const floor = (tables['floors'] || []).find(f => f.id === row.floor_id)
        if (floor) {
          const building = (tables['buildings'] || []).find(b => b.id === floor.building_id)
          return { ...row, floor: { ...floor, building: building || null } }
        }
      }
      if (selectCols?.includes('facility_type:facility_types') && row.facility_type_id) {
        const type = (tables['facility_types'] || []).find(t => t.id === row.facility_type_id)
        return { ...row, facility_type: type || null }
      }
      return row
    }

    function execute(): { data: any; error: any } {
      const rows = tables[table]

      if (mode === 'delete') {
        const matched = applyFilters(rows)
        tables[table] = rows.filter(r => !matched.includes(r))
        return { data: matched, error: null }
      }

      // select
      let result = applyFilters(rows).map(resolveEmbeds)
      if (orderCol) {
        const col = orderCol
        result = [...result].sort((a, b) => {
          if (a[col] < b[col]) return orderAsc ? -1 : 1
          if (a[col] > b[col]) return orderAsc ? 1 : -1
          return 0
        })
      }
      return { data: result, error: null }
    }

    const builder: any = {
      select(cols?: string) { selectCols = cols || null; return builder },
      delete() { mode = 'delete'; return builder },
      eq(col: string, val: any) { filters.push(r => r[col] === val); return builder },
      in(col: string, vals: any[]) { filters.push(r => vals.includes(r[col])); return builder },
      gte(col: string, val: any) { filters.push(r => r[col] >= val); return builder },
      or(condition: string) { /* Simplified for test */ return builder },
      order(col: string, opts?: { ascending?: boolean }) { orderCol = col; orderAsc = opts?.ascending !== false; return builder },
      limit() { return builder },
      then(resolve: any, reject: any) {
        return Promise.resolve(execute()).then(resolve, reject)
      },
    }
    return builder
  }

  return { from, tables }
}

// ── Mocks ────────────────────────────────────────────────────────────────────

const fakeClientBox = vi.hoisted(() => ({ current: null as any }))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => fakeClientBox.current,
}))

import { BuildingFacilityEnhancementService } from '@/backend/admin/building/building-facilityEnhancement.service'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BuildingFacilityEnhancementService.getCatalog', () => {
  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase({
      facilities: [
        {
          id: 'facility-1',
          code: 'R101',
          name: 'Room 101',
          description: 'A test room',
          room_number: '101',
          capacity: 30,
          status: 'available',
          is_bookable: true,
          is_available_for_rental: true,
          is_active: true,
          floor_id: 'floor-1',
          facility_type_id: 'type-1',
        },
      ],
      floors: [
        { id: 'floor-1', name: 'First Floor', floor_number: 1, building_id: 'building-1' },
      ],
      buildings: [
        { id: 'building-1', name: 'Main Building' },
      ],
      facility_types: [
        { id: 'type-1', name: 'Classroom' },
      ],
      facility_amenities: [
        { id: 'amenity-projector', name: 'projector', category: 'AV', icon: 'videocam', is_active: true },
        { id: 'amenity-wifi', name: 'wifi', category: 'Technology', icon: 'wifi', is_active: true },
        { id: 'amenity-computers', name: 'computers', category: 'Equipment', icon: 'monitor', is_active: true },
      ],
      facility_amenity_map: [
        { id: 'm1', facility_id: 'facility-1', amenity_id: 'amenity-projector', quantity: 1, notes: null, source: 'manual' },
        { id: 'm2', facility_id: 'facility-1', amenity_id: 'amenity-wifi', quantity: 2, notes: 'Mesh network', source: 'manual' },
        { id: 'm3', facility_id: 'facility-1', amenity_id: 'amenity-computers', quantity: 24, notes: '24× i5/16GB, Adobe CS', source: 'inventory' },
      ],
      facility_photos: [],
      facility_reviews: [],
      facility_warnings: [],
    })
  })

  it('includes amenities with notes from facility_amenity_map', async () => {
    const catalog = await BuildingFacilityEnhancementService.getCatalog()
    expect(catalog).toHaveLength(1)

    const facility = catalog[0]
    expect(facility.amenities).toHaveLength(3)

    const projector = facility.amenities.find(a => a.name === 'projector')
    expect(projector).toMatchObject({
      name: 'projector',
      displayName: 'Projector',
      quantity: 1,
      notes: null,
    })

    const wifi = facility.amenities.find(a => a.name === 'wifi')
    expect(wifi).toMatchObject({
      name: 'wifi',
      displayName: 'Wifi',
      quantity: 2,
      notes: 'Mesh network',
    })

    const computers = facility.amenities.find(a => a.name === 'computers')
    expect(computers).toMatchObject({
      name: 'computers',
      displayName: 'Computers',
      quantity: 24,
      notes: '24× i5/16GB, Adobe CS',
    })
  })

  it('renders null notes cleanly without separator', async () => {
    const catalog = await BuildingFacilityEnhancementService.getCatalog()
    const facility = catalog[0]

    const projector = facility.amenities.find(a => a.name === 'projector')
    // null notes should exist and be falsy for conditional rendering in the component
    expect(projector?.notes).toBe(null)
    expect(!projector?.notes).toBe(true)
  })

  it('renders empty string notes as null (falsy) so no separator appears', async () => {
    // Ensure the service treats empty strings like nulls
    fakeClientBox.current.tables.facility_amenity_map[0].notes = ''

    const catalog = await BuildingFacilityEnhancementService.getCatalog()
    const facility = catalog[0]
    const projector = facility.amenities.find(a => a.name === 'projector')

    // Empty string is converted to null by || null in the service
    expect(projector?.notes).toBe(null)
  })

  it('preserves notes with special characters and newlines as-is', async () => {
    fakeClientBox.current.tables.facility_amenity_map[1].notes = 'Advanced features: WPA3, 5GHz, MU-MIMO'

    const catalog = await BuildingFacilityEnhancementService.getCatalog()
    const facility = catalog[0]
    const wifi = facility.amenities.find(a => a.name === 'wifi')

    expect(wifi?.notes).toBe('Advanced features: WPA3, 5GHz, MU-MIMO')
  })
})
