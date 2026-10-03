import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fake Supabase client ────────────────────────────────────────────────────
//
// syncManualAmenities()/getFacilityAmenities()/getAmenityCatalog() issue several
// sequential queries across facilities/facility_amenities/facility_amenity_map/
// equipment_types with real filter semantics (source-scoped deletes in
// particular). A simple call-sequence mock can't prove the scoping is correct,
// so this is a small in-memory fake Postgrest client: `.from(table)` returns a
// chainable builder that filters/mutates a shared in-memory table array, close
// enough to real Supabase behavior to exercise the service's actual logic.

type Row = Record<string, any>

function createFakeSupabase(initialTables: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {}
  for (const [name, rows] of Object.entries(initialTables)) {
    tables[name] = rows.map(r => ({ ...r }))
  }
  let idCounter = 1000
  const makeId = () => `fake-${idCounter++}`

  function from(table: string) {
    if (!tables[table]) tables[table] = []

    const filters: Array<(row: Row) => boolean> = []
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let insertPayload: Row[] | null = null
    let updatePayload: Row | null = null
    let selectCols: string | null = null
    let orderCol: string | null = null
    let orderAsc = true

    function applyFilters(list: Row[]) {
      return list.filter(r => filters.every(f => f(r)))
    }

    function resolveEmbeds(row: Row): Row {
      if (selectCols && selectCols.includes('amenity:facility_amenities')) {
        const amenity = (tables['facility_amenities'] || []).find(a => a.id === row.amenity_id)
        return { ...row, amenity: amenity ? { id: amenity.id, name: amenity.name } : null }
      }
      return row
    }

    function execute(): { data: any; error: any } {
      const rows = tables[table]

      if (mode === 'insert') {
        // Emulate the real UNIQUE(name) constraint on facility_amenities (case-sensitive,
        // exactly like Postgres' default TEXT UNIQUE — app-level normalization is what
        // actually prevents case-variant duplicates, not the DB constraint itself).
        if (table === 'facility_amenities') {
          for (const candidate of insertPayload!) {
            if (rows.some(r => r.name === candidate.name)) {
              return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint "facility_amenities_name_key"` } }
            }
          }
        }
        const created = insertPayload!.map(p => ({
          id: p.id || makeId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          quantity: 1,
          notes: null,
          ...p,
        }))
        rows.push(...created)
        return { data: created, error: null }
      }

      if (mode === 'update') {
        const matched = applyFilters(rows)
        matched.forEach(r => Object.assign(r, updatePayload))
        return { data: matched, error: null }
      }

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
      insert(payload: Row | Row[]) { mode = 'insert'; insertPayload = Array.isArray(payload) ? payload : [payload]; return builder },
      update(payload: Row) { mode = 'update'; updatePayload = payload; return builder },
      delete() { mode = 'delete'; return builder },
      eq(col: string, val: any) { filters.push(r => r[col] === val); return builder },
      neq(col: string, val: any) { filters.push(r => r[col] !== val); return builder },
      in(col: string, vals: any[]) { filters.push(r => vals.includes(r[col])); return builder },
      not(col: string, op: string, val: any) {
        if (op === 'is' && val === null) filters.push(r => r[col] !== null && r[col] !== undefined)
        return builder
      },
      ilike(col: string, val: string) {
        const pattern = String(val).toLowerCase()
        filters.push(r => String(r[col] ?? '').toLowerCase() === pattern)
        return builder
      },
      order(col: string, opts?: { ascending?: boolean }) { orderCol = col; orderAsc = opts?.ascending !== false; return builder },
      range() { return builder },
      limit() { return builder },
      single() {
        const res = execute()
        if (res.error) return Promise.resolve(res)
        const data = res.data
        const row = Array.isArray(data) ? data[0] : data
        if (!row) return Promise.resolve({ data: null, error: { message: 'No rows found', code: 'PGRST116' } })
        return Promise.resolve({ data: row, error: null })
      },
      maybeSingle() {
        const res = execute()
        if (res.error) return Promise.resolve(res)
        const data = res.data
        return Promise.resolve({ data: Array.isArray(data) ? (data[0] ?? null) : data, error: null })
      },
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

import { BuildingFacilitiesService } from '@/backend/admin/building/building-facilities.service'
import { isAmenityQuantityLocked } from '@/backend/admin/building/building.types'
import { cacheGet, cacheSet } from '@/lib/cache'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BuildingFacilitiesService.syncManualAmenities', () => {
  const facilityId = 'facility-1'

  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase({
      facilities: [{ id: facilityId, code: 'R101', name: 'Room 101' }],
      facility_amenities: [
        { id: 'amenity-projector', name: 'projector', category: 'AV', icon: 'videocam', is_active: true },
      ],
      facility_amenity_map: [],
      equipment_types: [
        { id: 'eqtype-1', type_code: 'PROJECTOR', type_name: 'Projector', amenity_id: 'amenity-projector' },
      ],
    })
  })

  it('writes exactly 3 source=manual rows for 3 amenities', async () => {
    await BuildingFacilitiesService.syncManualAmenities(facilityId, [
      { name: 'wifi', quantity: 2 },
      { name: 'whiteboard', quantity: 1, notes: 'Ceiling-mounted' },
      { name: 'air conditioning', quantity: 1 },
    ])

    const rows = fakeClientBox.current.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.source === 'manual'
    )
    expect(rows).toHaveLength(3)
    expect(rows.every((r: any) => r.source === 'manual')).toBe(true)
  })

  it('a subsequent sync with 2 amenities leaves exactly 2 manual rows (third is deleted, not dangling)', async () => {
    await BuildingFacilitiesService.syncManualAmenities(facilityId, [
      { name: 'wifi', quantity: 2 },
      { name: 'whiteboard', quantity: 1 },
      { name: 'air conditioning', quantity: 1 },
    ])

    await BuildingFacilitiesService.syncManualAmenities(facilityId, [
      { name: 'wifi', quantity: 2 },
      { name: 'whiteboard', quantity: 1 },
    ])

    const rows = fakeClientBox.current.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId
    )
    expect(rows).toHaveLength(2)
    expect(rows.map((r: any) => r.source)).toEqual(['manual', 'manual'])
  })

  it('never touches a pre-existing source=inventory row across multiple sync calls', async () => {
    // Seed an inventory-owned row directly, as Phase 4's (not-yet-built) bridge would.
    const client = fakeClientBox.current
    client.tables.facility_amenity_map.push({
      id: 'map-inventory-1',
      facility_id: facilityId,
      amenity_id: 'amenity-projector',
      quantity: 4,
      notes: 'Synced from inventory',
      source: 'inventory',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    const snapshotBefore = { ...client.tables.facility_amenity_map.find((r: any) => r.id === 'map-inventory-1') }

    // First manual sync (3 amenities) — does not include 'projector'.
    await BuildingFacilitiesService.syncManualAmenities(facilityId, [
      { name: 'wifi', quantity: 2 },
      { name: 'whiteboard', quantity: 1 },
      { name: 'air conditioning', quantity: 1 },
    ])

    let inventoryRow = client.tables.facility_amenity_map.find((r: any) => r.id === 'map-inventory-1')
    expect(inventoryRow).toEqual(snapshotBefore)

    // Second manual sync (2 amenities) — also does not include 'projector'.
    await BuildingFacilitiesService.syncManualAmenities(facilityId, [
      { name: 'wifi', quantity: 2 },
      { name: 'whiteboard', quantity: 1 },
    ])

    inventoryRow = client.tables.facility_amenity_map.find((r: any) => r.id === 'map-inventory-1')
    expect(inventoryRow).toEqual(snapshotBefore)
    expect(inventoryRow.source).toBe('inventory')
    expect(inventoryRow.quantity).toBe(4)
    expect(inventoryRow.notes).toBe('Synced from inventory')

    // The manual rows created alongside it must still total exactly 2, and no
    // extra 'projector' row should have been created on the manual side.
    const manualRows = client.tables.facility_amenity_map.filter((r: any) => r.source === 'manual')
    expect(manualRows).toHaveLength(2)
  })

  it('skips writing a manual row when the same amenity is already inventory-owned for this facility', async () => {
    const client = fakeClientBox.current
    client.tables.facility_amenity_map.push({
      id: 'map-inventory-1',
      facility_id: facilityId,
      amenity_id: 'amenity-projector',
      quantity: 2,
      notes: null,
      source: 'inventory',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    // Admin tries to manually set "projector" quantity to 5 for the same facility.
    await BuildingFacilitiesService.syncManualAmenities(facilityId, [
      { name: 'projector', quantity: 5 },
    ])

    const projectorRows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === 'amenity-projector'
    )
    // Still exactly one row for (facility, projector) — the inventory one — untouched.
    expect(projectorRows).toHaveLength(1)
    expect(projectorRows[0].source).toBe('inventory')
    expect(projectorRows[0].quantity).toBe(2)

    // And no manual rows were created at all (the only submitted amenity was skipped).
    const manualRows = client.tables.facility_amenity_map.filter((r: any) => r.source === 'manual')
    expect(manualRows).toHaveLength(0)
  })

  it('persists notes via a notes-only update for an inventory-owned row, without touching quantity or source', async () => {
    // Fix for review finding #2: notes must not be silently dropped for a
    // source='inventory' row — only quantity/source are off-limits, per the plan's
    // ownership rule ("still lets the admin add a note").
    const client = fakeClientBox.current
    client.tables.facility_amenity_map.push({
      id: 'map-inventory-1',
      facility_id: facilityId,
      amenity_id: 'amenity-projector',
      quantity: 3,
      notes: 'Old note',
      source: 'inventory',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    await BuildingFacilitiesService.syncManualAmenities(facilityId, [
      // A malicious/careless caller submitting a different quantity must never
      // have it land — only notes may change on an inventory-owned row.
      { name: 'projector', quantity: 99, notes: 'Ceiling-mounted, needs bulb replacement' },
    ])

    const projectorRows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === 'amenity-projector'
    )
    // Still exactly one row for (facility, projector) — no competing manual row was created.
    expect(projectorRows).toHaveLength(1)
    expect(projectorRows[0].source).toBe('inventory')
    expect(projectorRows[0].quantity).toBe(3)
    expect(projectorRows[0].notes).toBe('Ceiling-mounted, needs bulb replacement')
  })

  it('a source=manual row on a catalog-linked (equipment-backed) amenity is left alone by the inventory exclusion', async () => {
    // Today (pre-Phase 4) most existing facilities already have a source='manual'
    // row for a catalog-linked amenity like projector (Phase 0 backfilled every
    // pre-existing row, including the ones the original facility-creation
    // migration seeded per facility type). Syncing must treat it like any other
    // manual row — delete + reinsert — NOT skip it as if it were inventory-owned.
    const client = fakeClientBox.current
    client.tables.facility_amenity_map.push({
      id: 'map-manual-projector',
      facility_id: facilityId,
      amenity_id: 'amenity-projector',
      quantity: 1,
      notes: null,
      source: 'manual',
    })

    await BuildingFacilitiesService.syncManualAmenities(facilityId, [
      { name: 'projector', quantity: 4, notes: 'Ceiling-mounted' },
    ])

    const projectorRows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === 'amenity-projector'
    )
    expect(projectorRows).toHaveLength(1)
    expect(projectorRows[0].source).toBe('manual')
    expect(projectorRows[0].quantity).toBe(4)
    expect(projectorRows[0].notes).toBe('Ceiling-mounted')
  })

  it('rejects a quantity of 0', async () => {
    await expect(
      BuildingFacilitiesService.syncManualAmenities(facilityId, [{ name: 'wifi', quantity: 0 }])
    ).rejects.toThrow(/quantity must be a whole number of at least 1/i)

    expect(fakeClientBox.current.tables.facility_amenity_map).toHaveLength(0)
  })

  it('rejects a blank/NaN quantity instead of silently writing it', async () => {
    await expect(
      BuildingFacilitiesService.syncManualAmenities(facilityId, [{ name: 'wifi', quantity: Number('') }])
    ).rejects.toThrow(/quantity must be a whole number of at least 1/i)

    await expect(
      BuildingFacilitiesService.syncManualAmenities(facilityId, [{ name: 'wifi', quantity: NaN }])
    ).rejects.toThrow(/quantity must be a whole number of at least 1/i)

    expect(fakeClientBox.current.tables.facility_amenity_map).toHaveLength(0)
  })

  it('rejects a non-integer quantity', async () => {
    await expect(
      BuildingFacilitiesService.syncManualAmenities(facilityId, [{ name: 'wifi', quantity: 1.5 }])
    ).rejects.toThrow(/quantity must be a whole number of at least 1/i)
  })

  it('rejects notes over the max length', async () => {
    await expect(
      BuildingFacilitiesService.syncManualAmenities(facilityId, [
        { name: 'wifi', quantity: 1, notes: 'x'.repeat(501) },
      ])
    ).rejects.toThrow(/notes must be/i)
  })

  it('does not create a second facility_amenities row for a case/format-variant duplicate name', async () => {
    await BuildingFacilitiesService.syncManualAmenities(facilityId, [{ name: 'WiFi', quantity: 1 }])
    await BuildingFacilitiesService.syncManualAmenities(facilityId, [{ name: 'Wi-Fi', quantity: 2 }])
    await BuildingFacilitiesService.syncManualAmenities(facilityId, [{ name: 'wifi', quantity: 3 }])

    const wifiRows = fakeClientBox.current.tables.facility_amenities.filter(
      (r: any) => r.name.toLowerCase().replace(/[\s_-]+/g, '') === 'wifi'
    )
    expect(wifiRows).toHaveLength(1)

    // The manual map row should have been updated in place to the latest quantity,
    // still pointing at the same single facility_amenities row.
    const mapRows = fakeClientBox.current.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId
    )
    expect(mapRows).toHaveLength(1)
    expect(mapRows[0].quantity).toBe(3)
    expect(mapRows[0].amenity_id).toBe(wifiRows[0].id)
  })

  it('de-dupes case-variant names submitted within the same call', async () => {
    await BuildingFacilitiesService.syncManualAmenities(facilityId, [
      { name: 'WiFi', quantity: 1 },
      { name: 'wifi', quantity: 9 },
    ])

    const wifiCatalogRows = fakeClientBox.current.tables.facility_amenities.filter(
      (r: any) => r.name.toLowerCase() === 'wifi'
    )
    expect(wifiCatalogRows).toHaveLength(1)

    const mapRows = fakeClientBox.current.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId
    )
    expect(mapRows).toHaveLength(1)
    expect(mapRows[0].quantity).toBe(9) // last one in the submitted array wins
  })

  it('rejects a blank/whitespace-only name', async () => {
    await expect(
      BuildingFacilitiesService.syncManualAmenities(facilityId, [{ name: '   ', quantity: 1 }])
    ).rejects.toThrow(/name is required/i)
  })

  it('clears all manual rows and leaves inventory rows alone when given an empty list', async () => {
    const client = fakeClientBox.current
    // Two distinct amenities (facility_amenity_map has a UNIQUE(facility_id, amenity_id)
    // constraint in the real schema, so the same amenity can't have both a manual and an
    // inventory row for one facility at once).
    client.tables.facility_amenities.push({ id: 'amenity-wifi', name: 'wifi', is_active: true })
    client.tables.facility_amenity_map.push(
      { id: 'm1', facility_id: facilityId, amenity_id: 'amenity-wifi', quantity: 1, notes: null, source: 'manual' },
      { id: 'inv1', facility_id: facilityId, amenity_id: 'amenity-projector', quantity: 1, notes: null, source: 'inventory' },
    )

    await BuildingFacilitiesService.syncManualAmenities(facilityId, [])

    const remaining = client.tables.facility_amenity_map.filter((r: any) => r.facility_id === facilityId)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].source).toBe('inventory')
  })
})

describe('BuildingFacilitiesService.getAmenityCatalog / getFacilityAmenities', () => {
  const facilityId = 'facility-1'

  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase({
      facilities: [{ id: facilityId, code: 'R101', name: 'Room 101' }],
      facility_amenities: [
        { id: 'amenity-projector', name: 'projector', category: 'AV', icon: 'videocam', is_active: true },
        { id: 'amenity-wifi', name: 'wifi', category: 'Technology', icon: 'wifi', is_active: true },
      ],
      facility_amenity_map: [
        { id: 'm1', facility_id: facilityId, amenity_id: 'amenity-wifi', quantity: 2, notes: 'Guest network', source: 'manual' },
        { id: 'm2', facility_id: facilityId, amenity_id: 'amenity-projector', quantity: 1, notes: null, source: 'inventory' },
      ],
      equipment_types: [
        { id: 'eqtype-1', type_code: 'PROJECTOR', type_name: 'Projector', amenity_id: 'amenity-projector' },
      ],
    })
  })

  it('flags projector as equipment-backed and wifi as not', async () => {
    const catalog = await BuildingFacilitiesService.getAmenityCatalog()
    const projector = catalog.find(c => c.name === 'projector')
    const wifi = catalog.find(c => c.name === 'wifi')
    expect(projector?.isEquipmentBacked).toBe(true)
    expect(wifi?.isEquipmentBacked).toBe(false)
  })

  it('returns this facility rows with source and equipment-backed flag intact', async () => {
    const rows = await BuildingFacilitiesService.getFacilityAmenities(facilityId)
    expect(rows).toHaveLength(2)

    const wifiRow = rows.find(r => r.name === 'wifi')
    expect(wifiRow?.source).toBe('manual')
    expect(wifiRow?.quantity).toBe(2)
    expect(wifiRow?.notes).toBe('Guest network')
    expect(wifiRow?.isEquipmentBacked).toBe(false)

    const projectorRow = rows.find(r => r.name === 'projector')
    expect(projectorRow?.source).toBe('inventory')
    expect(projectorRow?.isEquipmentBacked).toBe(true)
  })

  it('reports source=manual (not inventory) for a catalog-linked amenity whose row is still manual', async () => {
    // Fix for review finding #1: getFacilityAmenities must report the row's real
    // source, since isEquipmentBacked alone is not a safe signal for locking the
    // quantity field — a catalog-linked amenity can absolutely have a
    // source='manual' row (the common case today, pre-Phase 4).
    const client = fakeClientBox.current
    client.tables.facility_amenity_map = client.tables.facility_amenity_map.map((r: any) =>
      r.id === 'm2' ? { ...r, source: 'manual' } : r
    )

    const rows = await BuildingFacilitiesService.getFacilityAmenities(facilityId)
    const projectorRow = rows.find(r => r.name === 'projector')

    expect(projectorRow?.source).toBe('manual')
    expect(projectorRow?.isEquipmentBacked).toBe(true) // still catalog-linked...
    expect(isAmenityQuantityLocked({ ...projectorRow!, hasExistingRow: true })).toBe(false) // ...but NOT locked
  })
})

describe('isAmenityQuantityLocked', () => {
  it('locks only a row that both already exists and is source=inventory', () => {
    expect(isAmenityQuantityLocked({ hasExistingRow: true, source: 'inventory' })).toBe(true)
  })

  it('does not lock an existing source=manual row, even for a catalog-linked amenity', () => {
    expect(isAmenityQuantityLocked({ hasExistingRow: true, source: 'manual' })).toBe(false)
  })

  it('does not lock a brand-new row that has no existing facility_amenity_map entry yet', () => {
    expect(isAmenityQuantityLocked({ hasExistingRow: false, source: undefined })).toBe(false)
    // Even if a caller mistakenly stamped a source on a not-yet-persisted row, hasExistingRow
    // is the gate — it can't be locked before Phase 4 has actually written the row.
    expect(isAmenityQuantityLocked({ hasExistingRow: false, source: 'inventory' })).toBe(false)
  })

  it('does not lock when source is missing entirely', () => {
    expect(isAmenityQuantityLocked({ hasExistingRow: true })).toBe(false)
  })
})

describe('BuildingFacilitiesService.create / update wiring', () => {
  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase({
      facilities: [],
      facility_amenities: [],
      facility_amenity_map: [],
      equipment_types: [],
    })
  })

  it('create() syncs amenities for the newly created facility', async () => {
    const created = await BuildingFacilitiesService.create({
      code: 'R201',
      name: 'Room 201',
      floorId: 'floor-1',
      facilityTypeId: 'type-1',
      capacity: 30,
      amenities: [{ name: 'wifi', quantity: 1 }, { name: 'projector', quantity: 1 }],
    } as any)

    const rows = fakeClientBox.current.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === (created as any).id
    )
    expect(rows).toHaveLength(2)
    expect(rows.every((r: any) => r.source === 'manual')).toBe(true)
  })

  it('update() syncs amenities when amenities[] is present in the update payload', async () => {
    fakeClientBox.current.tables.facilities.push({ id: 'facility-9', code: 'R301', name: 'Room 301' })

    await BuildingFacilitiesService.update('facility-9', {
      name: 'Room 301 Renamed',
      amenities: [{ name: 'wifi', quantity: 4, notes: 'Mesh network' }],
    })

    const rows = fakeClientBox.current.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === 'facility-9'
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(4)
    expect(rows[0].notes).toBe('Mesh network')
    expect(rows[0].source).toBe('manual')
  })

  it('update() does not touch facility_amenity_map when amenities is omitted from the payload', async () => {
    fakeClientBox.current.tables.facilities.push({ id: 'facility-10', code: 'R302', name: 'Room 302' })
    fakeClientBox.current.tables.facility_amenities.push({ id: 'amenity-wifi', name: 'wifi', is_active: true })
    fakeClientBox.current.tables.facility_amenity_map.push({
      id: 'm1', facility_id: 'facility-10', amenity_id: 'amenity-wifi', quantity: 1, notes: null, source: 'manual',
    })

    await BuildingFacilitiesService.update('facility-10', { name: 'Room 302 Renamed' })

    const rows = fakeClientBox.current.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === 'facility-10'
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(1)
  })
})

// Phase 5 — cache invalidation. GET /api/facilities caches its default query
// under 'ref:facilities:default' (10m TTL, see lib/cache.ts + app/api/facilities/route.ts).
// create()/update() must bust it so a new/renamed room appears in the booking-form
// dropdown promptly; syncManualAmenities (Phase 1, amenity-only edits) and
// syncInventoryAmenities (Phase 4, equipment assign/unassign) must NOT, since the
// cached list carries no amenities data and the catalog endpoint that does is uncached.
describe('BuildingFacilitiesService cache invalidation (Phase 5)', () => {
  const CACHE_KEY = 'ref:facilities:default'

  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase({
      facilities: [],
      facility_amenities: [],
      facility_amenity_map: [],
      equipment_types: [],
    })
    // Seed the cache exactly as GET /api/facilities would after a real request.
    cacheSet(CACHE_KEY, [{ id: 'stale-facility', name: 'Stale' }], 10 * 60 * 1000)
  })

  it('create() busts the ref:facilities:default cache', async () => {
    expect(cacheGet(CACHE_KEY)).toBeDefined()

    await BuildingFacilitiesService.create({
      code: 'R401',
      name: 'Room 401',
      floorId: 'floor-1',
      facilityTypeId: 'type-1',
      capacity: 20,
    } as any)

    expect(cacheGet(CACHE_KEY)).toBeUndefined()
  })

  it('update() busts the ref:facilities:default cache', async () => {
    fakeClientBox.current.tables.facilities.push({ id: 'facility-20', code: 'R402', name: 'Room 402' })
    expect(cacheGet(CACHE_KEY)).toBeDefined()

    await BuildingFacilitiesService.update('facility-20', { name: 'Room 402 Renamed' })

    expect(cacheGet(CACHE_KEY)).toBeUndefined()
  })

  it('syncManualAmenities() (amenity-only edit) does NOT bust the cache when called directly', async () => {
    fakeClientBox.current.tables.facilities.push({ id: 'facility-21', code: 'R403', name: 'Room 403' })
    expect(cacheGet(CACHE_KEY)).toBeDefined()

    await BuildingFacilitiesService.syncManualAmenities('facility-21', [{ name: 'wifi', quantity: 1 }])

    expect(cacheGet(CACHE_KEY)).toBeDefined()
  })

  // Final-review fix (Finding 2): delete() soft-deletes a facility by setting
  // status='unavailable', and GET /api/facilities' cached query filters
  // .eq('status', 'available') — without busting the cache here, a deleted
  // facility could linger in the booking-form dropdown for up to the 10-minute
  // TTL, same gap create()/update() were already fixed for in Phase 5.
  it('delete() busts the ref:facilities:default cache', async () => {
    fakeClientBox.current.tables.facilities.push({ id: 'facility-22', code: 'R404', name: 'Room 404', status: 'available' })
    expect(cacheGet(CACHE_KEY)).toBeDefined()

    await BuildingFacilitiesService.delete('facility-22')

    expect(cacheGet(CACHE_KEY)).toBeUndefined()
  })

  it('delete() still soft-deletes (status=unavailable) even though it now also busts the cache', async () => {
    fakeClientBox.current.tables.facilities.push({ id: 'facility-23', code: 'R405', name: 'Room 405', status: 'available' })

    await BuildingFacilitiesService.delete('facility-23')

    const facility = fakeClientBox.current.tables.facilities.find((f: any) => f.id === 'facility-23')
    expect(facility.status).toBe('unavailable')
  })
})
