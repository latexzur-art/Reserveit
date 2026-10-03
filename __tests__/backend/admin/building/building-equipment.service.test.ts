import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Fake Supabase client ────────────────────────────────────────────────────
//
// Same in-memory fake Postgrest client as
// __tests__/backend/admin/building/building-facilities.service.test.ts (Phase 1's
// reference implementation for this table). syncInventoryAmenities() issues several
// sequential queries across equipment/equipment_types/equipment_status_types/
// facility_amenity_map with real filter semantics (source-scoped delete in
// particular), so a simple call-sequence mock can't prove the scoping is correct —
// this fake filters/mutates a shared in-memory table array close enough to real
// Supabase behavior to exercise the service's actual logic.

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
    let limitCount: number | null = null

    function applyFilters(list: Row[]) {
      return list.filter(r => filters.every(f => f(r)))
    }

    function execute(): { data: any; error: any } {
      const rows = tables[table]

      if (mode === 'insert') {
        const created = insertPayload!.map(p => ({
          id: p.id || makeId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          quantity: 1,
          notes: null,
          // Mirrors the real `equipment.is_active BOOLEAN DEFAULT true` column
          // default — BuildingEquipmentService.create()'s insert payload never
          // sets is_active explicitly, relying on the DB default exactly like
          // production does. Without this, a freshly-created row would fail
          // syncInventoryAmenities's `.eq('is_active', true)` live-count filter.
          is_active: true,
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

      // select — clone rows so a later update()/delete() in the same test
      // can't retroactively mutate data already handed back by an earlier
      // select() (real Supabase always deserializes a fresh copy per query;
      // this fake previously returned live row references, which let
      // updateBulk's "before" snapshot get silently overwritten in place by
      // the mutation that ran after it).
      let result = applyFilters(rows).map(r => ({ ...r }))
      if (orderCol) {
        const col = orderCol
        result = [...result].sort((a, b) => {
          if (a[col] < b[col]) return orderAsc ? -1 : 1
          if (a[col] > b[col]) return orderAsc ? 1 : -1
          return 0
        })
      }
      // Real Postgrest truly caps rows server-side on .limit(n); mirror that
      // here so tests can't accidentally pass by relying on an over-wide
      // result set the real DB would never return (e.g. assignToFacility's
      // "find N available units" query trusting .limit() to cap candidates).
      if (limitCount !== null) result = result.slice(0, limitCount)
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
      is(col: string, val: any) { filters.push(r => (val === null ? r[col] === null || r[col] === undefined : r[col] === val)); return builder },
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
      limit(n: number) { limitCount = n; return builder },
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

import { BuildingEquipmentService } from '@/backend/admin/building/building-equipment.service'
import { BA_FACILITY_ASSIGN_SCOPE } from '@/lib/auth/equipment-scope'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const STATUS_AVAILABLE = 'status-available'
const STATUS_IN_USE = 'status-in-use'
const STATUS_BROKEN = 'status-broken'
const STATUS_RETIRED = 'status-retired'
const STATUS_MAINTENANCE = 'status-maintenance'

const STATUS_TYPES: Row[] = [
  { id: STATUS_AVAILABLE, status_code: 'AVAILABLE' },
  { id: STATUS_IN_USE, status_code: 'IN_USE' },
  { id: STATUS_BROKEN, status_code: 'BROKEN' },
  { id: STATUS_RETIRED, status_code: 'RETIRED' },
  { id: STATUS_MAINTENANCE, status_code: 'MAINTENANCE' },
]

const TYPE_PROJECTOR = 'eqtype-projector'
const TYPE_MIC_WIRED = 'eqtype-mic-wired'
const TYPE_MIC_WIRELESS = 'eqtype-mic-wireless'
const TYPE_HDMI = 'eqtype-hdmi' // never linked to an amenity

const AMENITY_PROJECTOR = 'amenity-projector'
const AMENITY_MICROPHONE = 'amenity-microphone'
const AMENITY_WIFI = 'amenity-wifi'

function equipmentRow(overrides: Partial<Row>): Row {
  return {
    id: `eq-${Math.random().toString(36).slice(2)}`,
    equipment_type_id: TYPE_PROJECTOR,
    current_status_id: STATUS_AVAILABLE,
    assigned_facility_id: null,
    is_active: true,
    ...overrides,
  }
}

function baseTables(facilityId: string): Record<string, Row[]> {
  return {
    equipment_status_types: STATUS_TYPES,
    equipment_types: [
      { id: TYPE_PROJECTOR, type_code: 'PROJECTOR', type_name: 'Projector', amenity_id: AMENITY_PROJECTOR },
      { id: TYPE_MIC_WIRED, type_code: 'MIC_WIRED', type_name: 'Wired Mic', amenity_id: AMENITY_MICROPHONE },
      { id: TYPE_MIC_WIRELESS, type_code: 'MIC_WIRELESS', type_name: 'Wireless Mic', amenity_id: AMENITY_MICROPHONE },
      { id: TYPE_HDMI, type_code: 'HDMI_CABLE', type_name: 'HDMI Cable', amenity_id: null },
    ],
    equipment: [],
    facility_amenity_map: [],
    facilities: [{ id: facilityId, code: 'R101', name: 'Room 101' }],
  }
}

describe('BuildingEquipmentService.syncInventoryAmenities', () => {
  const facilityId = 'facility-1'

  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase(baseTables(facilityId))
  })

  it('creates a new source=inventory row with quantity=3 for 3 assigned projector units, no prior row', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'p3', assigned_facility_id: facilityId }),
    )

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(3)
    expect(rows[0].source).toBe('inventory')
  })

  it('unassigning 1 of 3 drops quantity to 2 and keeps source=inventory', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'p3', assigned_facility_id: facilityId }),
    )
    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    // Simulate unassignFromFacility(['p3']): clears assigned_facility_id.
    const p3 = client.tables.equipment.find((e: any) => e.id === 'p3')
    p3.assigned_facility_id = null
    p3.current_status_id = STATUS_AVAILABLE

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(2)
    expect(rows[0].source).toBe('inventory')
  })

  it('unassigning all 3 deletes the row entirely (not left at quantity=0)', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'p3', assigned_facility_id: facilityId }),
    )
    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    for (const e of client.tables.equipment) {
      e.assigned_facility_id = null
      e.current_status_id = STATUS_AVAILABLE
    }

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(0)
  })

  it('precedence flip: a stale source=manual projector row is taken over once real inventory exists, notes preserved', async () => {
    const client = fakeClientBox.current
    client.tables.facility_amenity_map.push({
      id: 'map-manual-projector',
      facility_id: facilityId,
      amenity_id: AMENITY_PROJECTOR,
      quantity: 1,
      notes: "admin's own unit",
      source: 'manual',
    })
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityId }),
    )

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('inventory')
    expect(rows[0].quantity).toBe(2)
    expect(rows[0].notes).toBe("admin's own unit")
  })

  it('a manual row for an equipment-backed amenity with zero currently-assigned units is left untouched', async () => {
    // Equipment-backed amenity, but no equipment is actually assigned to this
    // facility right now — the precedence flip only fires when the live count is >= 1.
    const client = fakeClientBox.current
    client.tables.facility_amenity_map.push({
      id: 'map-manual-projector',
      facility_id: facilityId,
      amenity_id: AMENITY_PROJECTOR,
      quantity: 1,
      notes: 'pre-bridge seed data',
      source: 'manual',
    })

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('manual')
    expect(rows[0].quantity).toBe(1)
    expect(rows[0].notes).toBe('pre-bridge seed data')
  })

  it('never touches an unrelated source=manual row for a non-equipment-backed amenity (wifi), across assign/unassign', async () => {
    const client = fakeClientBox.current
    const wifiSnapshot = {
      id: 'map-manual-wifi',
      facility_id: facilityId,
      amenity_id: AMENITY_WIFI,
      quantity: 2,
      notes: 'Guest network: RESERVE-GUEST',
      source: 'manual',
    }
    client.tables.facility_amenity_map.push({ ...wifiSnapshot })

    // Assign.
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: facilityId }))
    await BuildingEquipmentService.syncInventoryAmenities(facilityId)
    let wifiRow = client.tables.facility_amenity_map.find((r: any) => r.id === 'map-manual-wifi')
    expect(wifiRow).toEqual(wifiSnapshot)

    // Assign more.
    client.tables.equipment.push(equipmentRow({ id: 'p2', assigned_facility_id: facilityId }))
    await BuildingEquipmentService.syncInventoryAmenities(facilityId)
    wifiRow = client.tables.facility_amenity_map.find((r: any) => r.id === 'map-manual-wifi')
    expect(wifiRow).toEqual(wifiSnapshot)

    // Unassign everything.
    for (const e of client.tables.equipment) e.assigned_facility_id = null
    await BuildingEquipmentService.syncInventoryAmenities(facilityId)
    wifiRow = client.tables.facility_amenity_map.find((r: any) => r.id === 'map-manual-wifi')
    expect(wifiRow).toEqual(wifiSnapshot)
  })

  it('is idempotent: calling twice with no equipment change in between yields the same final row set both times', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'm1', equipment_type_id: TYPE_MIC_WIRED, assigned_facility_id: facilityId }),
    )

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)
    const snapshot1 = client.tables.facility_amenity_map
      .filter((r: any) => r.facility_id === facilityId)
      .map((r: any) => ({ amenity_id: r.amenity_id, quantity: r.quantity, source: r.source, notes: r.notes }))
      .sort((a: any, b: any) => a.amenity_id.localeCompare(b.amenity_id))

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)
    const snapshot2 = client.tables.facility_amenity_map
      .filter((r: any) => r.facility_id === facilityId)
      .map((r: any) => ({ amenity_id: r.amenity_id, quantity: r.quantity, source: r.source, notes: r.notes }))
      .sort((a: any, b: any) => a.amenity_id.localeCompare(b.amenity_id))

    expect(snapshot2).toEqual(snapshot1)
    expect(snapshot1).toHaveLength(2) // projector + microphone
  })

  it('equipment types with amenity_id IS NULL never produce a facility_amenity_map row, regardless of unit count', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'h1', equipment_type_id: TYPE_HDMI, assigned_facility_id: facilityId }),
      equipmentRow({ id: 'h2', equipment_type_id: TYPE_HDMI, assigned_facility_id: facilityId }),
      equipmentRow({ id: 'h3', equipment_type_id: TYPE_HDMI, assigned_facility_id: facilityId }),
      equipmentRow({ id: 'h4', equipment_type_id: TYPE_HDMI, assigned_facility_id: facilityId }),
      equipmentRow({ id: 'h5', equipment_type_id: TYPE_HDMI, assigned_facility_id: facilityId }),
    )

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter((r: any) => r.facility_id === facilityId)
    expect(rows).toHaveLength(0)
  })

  it('merges multiple equipment types that link to the same amenity (wired + wireless mics -> microphone)', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'm1', equipment_type_id: TYPE_MIC_WIRED, assigned_facility_id: facilityId }),
      equipmentRow({ id: 'm2', equipment_type_id: TYPE_MIC_WIRED, assigned_facility_id: facilityId }),
      equipmentRow({ id: 'm3', equipment_type_id: TYPE_MIC_WIRELESS, assigned_facility_id: facilityId }),
    )

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_MICROPHONE
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(3)
  })

  it('excludes BROKEN and RETIRED units from the live count', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityId, current_status_id: STATUS_AVAILABLE }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityId, current_status_id: STATUS_BROKEN }),
      equipmentRow({ id: 'p3', assigned_facility_id: facilityId, current_status_id: STATUS_RETIRED }),
    )

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(1)
  })

  it('still counts MAINTENANCE and IN_USE units (only BROKEN/RETIRED are excluded)', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityId, current_status_id: STATUS_IN_USE }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityId, current_status_id: STATUS_MAINTENANCE }),
    )

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(2)
  })

  it('ignores inactive (soft-deleted) equipment even if still assigned_facility_id-tagged', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityId, is_active: true }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityId, is_active: false }),
    )

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(1)
  })

  it('ignores equipment assigned to a different facility', async () => {
    const client = fakeClientBox.current
    client.tables.facilities.push({ id: 'facility-2', code: 'R102', name: 'Room 102' })
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityId }),
      equipmentRow({ id: 'p2', assigned_facility_id: 'facility-2' }),
    )

    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(1)

    // Nothing was written for the other facility.
    const otherRows = client.tables.facility_amenity_map.filter((r: any) => r.facility_id === 'facility-2')
    expect(otherRows).toHaveLength(0)
  })

  it('no-ops cleanly when the facility has no assigned equipment and no existing rows', async () => {
    await BuildingEquipmentService.syncInventoryAmenities(facilityId)

    const rows = fakeClientBox.current.tables.facility_amenity_map.filter((r: any) => r.facility_id === facilityId)
    expect(rows).toHaveLength(0)
  })
})

// Final-review fix (Finding 1): the bulk equipment endpoints (updateBulk,
// deleteBulk, importBulk) must recompute source='inventory' amenities for every
// distinct facility they touch, exactly like the single assign/unassign call
// sites in app/api/admin/building/facilities/[id]/equipment/route.ts already do.
// Real recompute-from-scratch runs underneath (vi.spyOn calls through by
// default), so these tests prove both the call-dedup contract *and* that the
// end-state facility_amenity_map rows actually reflect the bulk change.
describe('BuildingEquipmentService bulk endpoints wire syncInventoryAmenities (Finding 1)', () => {
  const facilityA = 'facility-A'
  const facilityB = 'facility-B'

  beforeEach(() => {
    const tables = baseTables(facilityA)
    tables.facilities.push({ id: facilityB, code: 'R102', name: 'Room 102' })
    fakeClientBox.current = createFakeSupabase(tables)
  })

  // Belt-and-suspenders: if an assertion throws before a test's own
  // `syncSpy.mockRestore()` line runs, an un-restored spy would otherwise leak
  // into the next test and inflate its call count. vi.spyOn's default
  // call-through behavior means the leaked spy still functions correctly, so
  // this was silently corrupting call-count assertions in later tests rather
  // than failing loudly at the leak site.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updateBulk: marking 2 assigned units BROKEN via ids syncs facilityA exactly once, and the amenity row is cleared', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityA }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityA }),
    )
    await BuildingEquipmentService.syncInventoryAmenities(facilityA)
    expect(
      client.tables.facility_amenity_map.filter((r: any) => r.facility_id === facilityA && r.amenity_id === AMENITY_PROJECTOR)
    ).toHaveLength(1)

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')

    await BuildingEquipmentService.updateBulk({ currentStatusId: STATUS_BROKEN }, ['p1', 'p2'])

    // Both mutated units share facilityA — sync must fire exactly once, not twice.
    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith(facilityA)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityA && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(0) // both units now BROKEN -> excluded -> stale row deleted

    syncSpy.mockRestore()
  })

  it('updateBulk: reassigning a unit from facilityA to facilityB syncs both, distinct facilities only', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: facilityA }))
    await BuildingEquipmentService.syncInventoryAmenities(facilityA)

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')

    await BuildingEquipmentService.updateBulk({ assignedFacilityId: facilityB }, ['p1'])

    expect(syncSpy).toHaveBeenCalledTimes(2)
    const calledWith = syncSpy.mock.calls.map(c => c[0]).sort()
    expect(calledWith).toEqual([facilityA, facilityB].sort())

    // facilityA's projector row must be gone (unit left); facilityB's must now exist.
    expect(
      client.tables.facility_amenity_map.filter((r: any) => r.facility_id === facilityA && r.amenity_id === AMENITY_PROJECTOR)
    ).toHaveLength(0)
    const bRows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityB && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(bRows).toHaveLength(1)
    expect(bRows[0].quantity).toBe(1)

    syncSpy.mockRestore()
  })

  it('updateBulk: does not call syncInventoryAmenities when the update touches no assigned equipment', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: null }))

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')
    await BuildingEquipmentService.updateBulk({ currentStatusId: STATUS_MAINTENANCE }, ['p1'])

    expect(syncSpy).not.toHaveBeenCalled()
    syncSpy.mockRestore()
  })

  it('deleteBulk: soft-deleting 3 assigned units sharing a facility syncs that facility exactly once, and the row is cleared', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityA }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityA }),
      equipmentRow({ id: 'p3', assigned_facility_id: facilityA }),
    )
    await BuildingEquipmentService.syncInventoryAmenities(facilityA)

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')
    await BuildingEquipmentService.deleteBulk(['p1', 'p2', 'p3'])

    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith(facilityA)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityA && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(0)
    // Soft-delete actually took effect.
    expect(client.tables.equipment.filter((e: any) => e.is_active === false)).toHaveLength(3)

    syncSpy.mockRestore()
  })

  it('deleteBulk: syncs each distinct facility once when deleting units spread across two facilities', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', assigned_facility_id: facilityA }),
      equipmentRow({ id: 'p2', assigned_facility_id: facilityB }),
    )

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')
    await BuildingEquipmentService.deleteBulk(['p1', 'p2'])

    expect(syncSpy).toHaveBeenCalledTimes(2)
    const calledWith = syncSpy.mock.calls.map(c => c[0]).sort()
    expect(calledWith).toEqual([facilityA, facilityB].sort())

    syncSpy.mockRestore()
  })

  it('deleteBulk: does not call syncInventoryAmenities when deleting unassigned equipment', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: null }))

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')
    await BuildingEquipmentService.deleteBulk(['p1'])

    expect(syncSpy).not.toHaveBeenCalled()
    syncSpy.mockRestore()
  })

  it('importBulk: never calls syncInventoryAmenities today, since imported units are always created unassigned', async () => {
    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')

    const count = await BuildingEquipmentService.importBulk([
      // 'Projector' matches the existing equipment_types row by name (ilike), so
      // this never falls through to the createType()/upsert path.
      { equipmentName: 'Test Projector', equipmentType: 'Projector', quantity: 2 },
    ])

    expect(count).toBe(2)
    expect(syncSpy).not.toHaveBeenCalled()
    syncSpy.mockRestore()
  })

  it('updateBulk propagates a sync failure as a log, not a thrown error (mutation already committed)', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: facilityA }))

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities').mockRejectedValue(new Error('boom'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      BuildingEquipmentService.updateBulk({ currentStatusId: STATUS_MAINTENANCE }, ['p1'])
    ).resolves.toBeUndefined()

    // The equipment mutation itself still committed despite the sync failure.
    const updated = client.tables.equipment.find((e: any) => e.id === 'p1')
    expect(updated.current_status_id).toBe(STATUS_MAINTENANCE)
    expect(errorSpy).toHaveBeenCalledWith(
      '[equipment/updateBulk] inventory amenity sync failed:',
      'boom'
    )

    syncSpy.mockRestore()
    errorSpy.mockRestore()
  })
})

// Single-item update()/delete() wire syncInventoryAmenities the same way the
// bulk endpoints and the assign/unassign route already do. These are the paths
// the admin UI's Edit dialog and single-item Decommission action actually call
// (updateBulk/deleteBulk are only reachable via the multi-select bulk actions
// bar) — before this fix, reassigning, status-flipping, or deleting a single
// unit via the Edit dialog left the affected facility's inventory-derived
// amenity count silently stale.
describe('BuildingEquipmentService.update / .delete wire syncInventoryAmenities', () => {
  const facilityA = 'facility-A'
  const facilityB = 'facility-B'

  beforeEach(() => {
    const tables = baseTables(facilityA)
    tables.facilities.push({ id: facilityB, code: 'R102', name: 'Room 102' })
    fakeClientBox.current = createFakeSupabase(tables)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('update(): reassigning a unit from facilityA to facilityB syncs both facilities', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: facilityA }))
    await BuildingEquipmentService.syncInventoryAmenities(facilityA)

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')

    await BuildingEquipmentService.update('p1', { assignedFacilityId: facilityB })

    expect(syncSpy).toHaveBeenCalledTimes(2)
    const calledWith = syncSpy.mock.calls.map(c => c[0]).sort()
    expect(calledWith).toEqual([facilityA, facilityB].sort())

    expect(
      client.tables.facility_amenity_map.filter((r: any) => r.facility_id === facilityA && r.amenity_id === AMENITY_PROJECTOR)
    ).toHaveLength(0)
    const bRows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityB && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(bRows).toHaveLength(1)
    expect(bRows[0].quantity).toBe(1)

    syncSpy.mockRestore()
  })

  it('update(): flipping a unit to BROKEN (no facility change) still syncs its facility and drops the stale row', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: facilityA }))
    await BuildingEquipmentService.syncInventoryAmenities(facilityA)
    expect(
      client.tables.facility_amenity_map.filter((r: any) => r.facility_id === facilityA && r.amenity_id === AMENITY_PROJECTOR)
    ).toHaveLength(1)

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')

    await BuildingEquipmentService.update('p1', { currentStatusId: STATUS_BROKEN })

    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith(facilityA)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityA && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(0)

    syncSpy.mockRestore()
  })

  it('update(): editing an unassigned unit never calls syncInventoryAmenities', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: null }))

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')
    await BuildingEquipmentService.update('p1', { equipmentName: 'Renamed Projector' })

    expect(syncSpy).not.toHaveBeenCalled()
    syncSpy.mockRestore()
  })

  it('update() propagates a sync failure as a log, not a thrown error (mutation already committed)', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: facilityA }))

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities').mockRejectedValue(new Error('boom'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const updated = await BuildingEquipmentService.update('p1', { currentStatusId: STATUS_MAINTENANCE })

    expect(updated.currentStatusId).toBe(STATUS_MAINTENANCE)
    expect(errorSpy).toHaveBeenCalledWith(
      '[equipment/update] inventory amenity sync failed:',
      'boom'
    )

    syncSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('delete(): soft-deleting the last assigned unit syncs its facility and drops the stale row', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: facilityA }))
    await BuildingEquipmentService.syncInventoryAmenities(facilityA)

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')
    await BuildingEquipmentService.delete('p1')

    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith(facilityA)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityA && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(0)
    expect(client.tables.equipment.find((e: any) => e.id === 'p1').is_active).toBe(false)

    syncSpy.mockRestore()
  })

  it('delete(): deleting an unassigned unit never calls syncInventoryAmenities', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: null }))

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')
    await BuildingEquipmentService.delete('p1')

    expect(syncSpy).not.toHaveBeenCalled()
    syncSpy.mockRestore()
  })

  it('delete() propagates a sync failure as a log, not a thrown error (mutation already committed)', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', assigned_facility_id: facilityA }))

    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities').mockRejectedValue(new Error('boom'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(BuildingEquipmentService.delete('p1')).resolves.toBeUndefined()

    expect(client.tables.equipment.find((e: any) => e.id === 'p1').is_active).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(
      '[equipment/delete] inventory amenity sync failed:',
      'boom'
    )

    syncSpy.mockRestore()
    errorSpy.mockRestore()
  })
})

describe('BuildingEquipmentService.updateBulk equipmentName mapping', () => {
  const facilityId = 'facility-A'

  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase(baseTables(facilityId))
  })

  it('renames every targeted unit — the EquipmentTable "Edit" dialog on a grouped row relies on this to rename the whole group, not just one representative unit', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1', equipment_name: 'Wired Microphone' }),
      equipmentRow({ id: 'p2', equipment_name: 'Wired Microphone' }),
    )

    await BuildingEquipmentService.updateBulk({ equipmentName: 'Wireless Microphone Mk2' }, ['p1', 'p2'])

    const names = client.tables.equipment.map((e: any) => e.equipment_name)
    expect(names).toEqual(['Wireless Microphone Mk2', 'Wireless Microphone Mk2'])
  })

  it('does not touch serialNumber/brand/model — those are per-unit and intentionally not bulk-writable', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1', serial_number: 'SN-ORIGINAL' }))

    await BuildingEquipmentService.updateBulk(
      { equipmentName: 'Renamed', serialNumber: 'SN-SHOULD-NOT-APPLY' } as any,
      ['p1']
    )

    expect(client.tables.equipment.find((e: any) => e.id === 'p1').serial_number).toBe('SN-ORIGINAL')
  })
})

describe('BuildingEquipmentService.create', () => {
  const facilityId = 'facility-A'

  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase(baseTables(facilityId))
  })

  // Belt-and-suspenders: an un-restored spy from a failing assertion would
  // otherwise leak into the next test and inflate its call count (see the
  // bulk-endpoints describe block above for the full explanation).
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creating a unit pre-assigned to a facility syncs that facility (currently unreachable via the Add Asset UI, but must self-correct if that changes)', async () => {
    const client = fakeClientBox.current
    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')

    await BuildingEquipmentService.create({
      equipmentName: 'New Projector',
      equipmentTypeId: TYPE_PROJECTOR,
      currentStatusId: STATUS_AVAILABLE,
      assignedFacilityId: facilityId,
    })

    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith(facilityId)

    const rows = client.tables.facility_amenity_map.filter(
      (r: any) => r.facility_id === facilityId && r.amenity_id === AMENITY_PROJECTOR
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(1)

    syncSpy.mockRestore()
  })

  it('creating an unassigned unit never calls syncInventoryAmenities', async () => {
    const syncSpy = vi.spyOn(BuildingEquipmentService, 'syncInventoryAmenities')

    await BuildingEquipmentService.create({
      equipmentName: 'New Projector',
      equipmentTypeId: TYPE_PROJECTOR,
      currentStatusId: STATUS_AVAILABLE,
    })

    expect(syncSpy).not.toHaveBeenCalled()
    syncSpy.mockRestore()
  })
})

describe('BuildingEquipmentService.assignToFacility', () => {
  const facilityId = 'facility-A'

  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase(baseTables(facilityId))
  })

  it('claims exactly N available units and marks them IN_USE', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      equipmentRow({ id: 'p1' }),
      equipmentRow({ id: 'p2' }),
      equipmentRow({ id: 'p3' }),
    )

    const ids = await BuildingEquipmentService.assignToFacility(facilityId, TYPE_PROJECTOR, 2)

    expect(ids).toHaveLength(2)
    const claimed = client.tables.equipment.filter((e: any) => ids.includes(e.id))
    expect(claimed.every((e: any) => e.assigned_facility_id === facilityId)).toBe(true)
    expect(claimed.every((e: any) => e.current_status_id === STATUS_IN_USE)).toBe(true)
    // The unclaimed unit stays untouched.
    const untouched = client.tables.equipment.find((e: any) => !ids.includes(e.id))
    expect(untouched.assigned_facility_id).toBeNull()
  })

  it('throws and claims nothing when fewer units are in storage than requested', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(equipmentRow({ id: 'p1' }))

    await expect(BuildingEquipmentService.assignToFacility(facilityId, TYPE_PROJECTOR, 2))
      .rejects.toThrow('Only 1 units available in storage.')

    expect(client.tables.equipment.find((e: any) => e.id === 'p1').assigned_facility_id).toBeNull()
  })

  it('race guard: a unit claimed by a concurrent assign between the read and the write is not silently double-assigned', async () => {
    const client = fakeClientBox.current
    const p1 = equipmentRow({ id: 'p1' })
    client.tables.equipment.push(p1)
    const otherFacility = 'facility-B'
    client.tables.facilities.push({ id: otherFacility, code: 'R102', name: 'Room 102' })

    // Simulate a concurrent request winning the race for p1 in the window
    // between this call's "find available units" SELECT (1st from('equipment')
    // call below) and its guarded UPDATE (2nd call) — by the time the UPDATE's
    // `assigned_facility_id IS NULL` guard evaluates, p1 no longer qualifies.
    const originalFrom = client.from
    let equipmentCalls = 0
    client.from = (table: string) => {
      if (table === 'equipment') {
        equipmentCalls += 1
        if (equipmentCalls === 2) {
          p1.assigned_facility_id = otherFacility
          p1.current_status_id = STATUS_IN_USE
        }
      }
      return originalFrom(table)
    }

    await expect(BuildingEquipmentService.assignToFacility(facilityId, TYPE_PROJECTOR, 1))
      .rejects.toThrow('Some of the requested units were just claimed by another request. Please try again.')

    client.from = originalFrom
    // The concurrent winner's claim must be untouched by the loser's cleanup —
    // the guarded UPDATE claimed 0 rows, so there is nothing to release.
    expect(client.tables.equipment.find((e: any) => e.id === 'p1').assigned_facility_id).toBe(otherFacility)
  })
})

// ── getAll() ──────────────────────────────────────────────────────────────────
//
// The fake client doesn't perform real PostgREST joins — it returns raw rows
// from the target table only. Since getAll() reads `equipment_type`,
// `status_type`, and `facility` via nested selects, test fixtures must carry
// those nested objects pre-populated.

const TYPE_HVAC = 'eqtype-hvac'
const TYPE_HVAC_WINDOW = 'eqtype-hvac-window'
const TYPE_SPLIT_AC = 'eqtype-split-ac'
const FACILITY_A = 'fac-a'
const FACILITY_B = 'fac-b'

function getAllFixtures(): Record<string, Row[]> {
  return {
    equipment_status_types: STATUS_TYPES,
    equipment_types: [
      { id: TYPE_HVAC, type_code: 'HVAC', type_name: 'HVAC Unit', managed_by: 'building' },
      { id: TYPE_HVAC_WINDOW, type_code: 'WINDOW_TYPE_AC', type_name: 'Window-type Aircon', managed_by: 'building' },
      { id: TYPE_SPLIT_AC, type_code: 'SPLIT_TYPE_AC', type_name: 'Split-type Aircon', managed_by: 'building' },
      { id: TYPE_PROJECTOR, type_code: 'PROJECTOR', type_name: 'Projector', managed_by: 'pamo' },
    ],
    equipment: [],
    facilities: [
      { id: FACILITY_A, name: 'Room A' },
      { id: FACILITY_B, name: 'Room B' },
    ],
  }
}

/** Equipment row pre-joined for getAll()'s nested-select shape. */
function getAllRow(overrides: Partial<Row>): Row {
  const typeId = overrides.equipment_type_id ?? TYPE_HVAC
  const statusId = overrides.current_status_id ?? STATUS_AVAILABLE
  const facilityId = overrides.assigned_facility_id ?? null
  const typeRow = getAllFixtures().equipment_types.find(t => t.id === typeId)
  const statusRow = STATUS_TYPES.find(s => s.id === statusId)
  const facilityRow = facilityId ? getAllFixtures().facilities.find(f => f.id === facilityId) : null
  return {
    id: `eq-${Math.random().toString(36).slice(2)}`,
    equipment_code: `HVAC-${String(Math.floor(Math.random() * 900) + 100)}`,
    equipment_name: 'Split-type Air Conditioner 2.0HP',
    equipment_type_id: typeId,
    current_status_id: statusId,
    assigned_facility_id: facilityId,
    brand: 'Carrier',
    model: 'FP-53CEF024',
    serial_number: null,
    purchase_date: null,
    warranty_expiry: null,
    notes: null,
    image_url: null,
    is_active: true,
    // Pre-joined nested objects (what PostgREST would resolve)
    equipment_type: typeRow ? { id: typeRow.id, name: typeRow.type_name, managed_by: typeRow.managed_by } : null,
    status_type: statusRow ? { id: statusRow.id, name: statusRow.status_code } : null,
    facility: facilityRow ? { id: facilityRow.id, name: facilityRow.name } : null,
    ...overrides,
  }
}

describe('BuildingEquipmentService.getAll – assignment filter', () => {
  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase(getAllFixtures())
  })

  it('returns all items when no assignment filter is set', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'a1', assigned_facility_id: FACILITY_A }),
      getAllRow({ id: 'u1', assigned_facility_id: null }),
      getAllRow({ id: 'a2', assigned_facility_id: FACILITY_B }),
    )

    const result = await BuildingEquipmentService.getAll({ managedBy: ['building'] })

    expect(result.equipment).toHaveLength(3)
    expect(result.total).toBe(3)
  })

  it('returns only assigned items when assignment=assigned', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'a1', assigned_facility_id: FACILITY_A }),
      getAllRow({ id: 'u1', assigned_facility_id: null }),
      getAllRow({ id: 'u2', assigned_facility_id: null }),
    )

    const result = await BuildingEquipmentService.getAll({
      managedBy: ['building'],
      assignment: 'assigned',
    })

    expect(result.equipment).toHaveLength(1)
    expect(result.equipment[0].ids).toContain('a1')
  })

  it('returns only unassigned items when assignment=unassigned', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'a1', assigned_facility_id: FACILITY_A }),
      getAllRow({ id: 'u1', assigned_facility_id: null }),
      getAllRow({ id: 'u2', assigned_facility_id: null }),
    )

    const result = await BuildingEquipmentService.getAll({
      managedBy: ['building'],
      assignment: 'unassigned',
    })

    expect(result.equipment).toHaveLength(1)
    expect(result.equipment[0].ids).toEqual(expect.arrayContaining(['u1', 'u2']))
    expect(result.equipment[0].quantity).toBe(2)
  })

  it('returns empty when assignment=assigned but nothing is assigned', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'u1', assigned_facility_id: null }),
      getAllRow({ id: 'u2', assigned_facility_id: null }),
    )

    const result = await BuildingEquipmentService.getAll({
      managedBy: ['building'],
      assignment: 'assigned',
    })

    expect(result.equipment).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

describe('BuildingEquipmentService.getAll – managedBy filter', () => {
  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase(getAllFixtures())
  })

  it('scopes results to the given managed_by type(s)', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'h1', equipment_type_id: TYPE_HVAC, equipment_name: 'HVAC Unit' }),
      getAllRow({ id: 'p1', equipment_type_id: TYPE_PROJECTOR, equipment_name: 'Projector' }),
    )

    const result = await BuildingEquipmentService.getAll({ managedBy: ['building'] })

    expect(result.equipment).toHaveLength(1)
    expect(result.equipment[0].ids).toContain('h1')
  })

  it('includes items from multiple managed_by scopes', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'h1', equipment_type_id: TYPE_HVAC, equipment_name: 'HVAC Unit' }),
      getAllRow({ id: 'p1', equipment_type_id: TYPE_PROJECTOR, equipment_name: 'Projector' }),
    )

    const result = await BuildingEquipmentService.getAll({ managedBy: ['building', 'pamo'] })

    expect(result.equipment).toHaveLength(2)
  })

  it('returns empty when no types match the scope', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'h1', equipment_type_id: TYPE_HVAC, equipment_name: 'HVAC Unit' }),
    )

    // 'it' scope has no types in fixtures
    const result = await BuildingEquipmentService.getAll({ managedBy: ['it'] })

    expect(result.equipment).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ── getUnitsForFacility() ──────────────────────────────────────────────────────
//
// Powers the facility editor's "Managed Assets" list. Unlike getAll(), which
// collapses units into per-type groups (throwing away each unit's code/serial/
// brand), this returns ONE entry per physical unit so the UI can show the asset
// ID, brand, and per-unit status — the whole point of the aircon detail request.
describe('BuildingEquipmentService.getUnitsForFacility', () => {
  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase(getAllFixtures())
  })

  it('returns one entry per physical unit (not grouped), each carrying its own code/brand/model/serial/status', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({
        id: 'ac1', assigned_facility_id: FACILITY_A, equipment_type_id: TYPE_SPLIT_AC,
        equipment_code: 'AC-101-01', brand: 'Carrier', model: '1.5HP',
        serial_number: 'SN-1', current_status_id: STATUS_IN_USE,
      }),
      getAllRow({
        id: 'ac2', assigned_facility_id: FACILITY_A, equipment_type_id: TYPE_SPLIT_AC,
        equipment_code: 'AC-101-02', brand: 'Daikin', model: '2.0HP',
        serial_number: 'SN-2', current_status_id: STATUS_MAINTENANCE,
      }),
    )

    const units = await BuildingEquipmentService.getUnitsForFacility(FACILITY_A)

    // Two physical aircon units of the SAME type must stay as two rows, never
    // collapsed into one "2 units" group.
    expect(units).toHaveLength(2)
    const byCode = Object.fromEntries(units.map((u: any) => [u.equipmentCode, u]))
    expect(byCode['AC-101-01'].brand).toBe('Carrier')
    expect(byCode['AC-101-01'].model).toBe('1.5HP')
    expect(byCode['AC-101-01'].serialNumber).toBe('SN-1')
    expect(byCode['AC-101-01'].currentStatusName).toBe('IN_USE')
    expect(byCode['AC-101-02'].brand).toBe('Daikin')
    expect(byCode['AC-101-02'].currentStatusName).toBe('MAINTENANCE')
    expect(byCode['AC-101-02'].equipmentTypeName).toBe('Split-type Aircon')
  })

  it('excludes units assigned to other facilities and soft-deleted units', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'ac1', assigned_facility_id: FACILITY_A, equipment_type_id: TYPE_SPLIT_AC }),
      getAllRow({ id: 'ac2', assigned_facility_id: FACILITY_B, equipment_type_id: TYPE_SPLIT_AC }),
      getAllRow({ id: 'ac3', assigned_facility_id: FACILITY_A, equipment_type_id: TYPE_SPLIT_AC, is_active: false }),
    )

    const units = await BuildingEquipmentService.getUnitsForFacility(FACILITY_A)

    expect(units.map((u: any) => u.id)).toEqual(['ac1'])
  })

  it('returns an empty array for a facility with no assigned equipment', async () => {
    const units = await BuildingEquipmentService.getUnitsForFacility(FACILITY_A)
    expect(units).toEqual([])
  })
})

// ── facility-equipment assign scope ────────────────────────────────────────────
//
// The per-facility equipment route (assign/unassign) must let a Building Admin
// move the scopes BA is documented to directly assign — non-tech (pamo) AND its
// own HVAC (building), per EQUIPMENT_CAPABILITIES.building_admin.assign — while
// still forcing tech (it) through the IT assignment-request flow. A stale
// ['pamo']-only scope silently 403s every HVAC (aircon) assignment.
describe('BA_FACILITY_ASSIGN_SCOPE (per-facility assign)', () => {
  beforeEach(() => {
    fakeClientBox.current = createFakeSupabase(getAllFixtures())
  })

  it('lets a Building Admin assign an HVAC (building) unit to a facility', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'ac1', equipment_type_id: TYPE_SPLIT_AC, assigned_facility_id: null }),
    )

    const ids = await BuildingEquipmentService.assignToFacility(
      FACILITY_A, TYPE_SPLIT_AC, 1, BA_FACILITY_ASSIGN_SCOPE,
    )

    expect(ids).toHaveLength(1)
    expect(client.tables.equipment.find((e: any) => e.id === 'ac1').assigned_facility_id).toBe(FACILITY_A)
  })

  it('still lets a Building Admin assign a non-tech (pamo) unit', async () => {
    const client = fakeClientBox.current
    client.tables.equipment.push(
      getAllRow({ id: 'pr1', equipment_type_id: TYPE_PROJECTOR, assigned_facility_id: null }),
    )

    const ids = await BuildingEquipmentService.assignToFacility(
      FACILITY_A, TYPE_PROJECTOR, 1, BA_FACILITY_ASSIGN_SCOPE,
    )

    expect(ids).toHaveLength(1)
  })

  it('forbids assigning a tech (it) unit through the facility route (must go via IT request flow)', async () => {
    const client = fakeClientBox.current
    client.tables.equipment_types.push({ id: 'eqtype-tv', type_code: 'TV', type_name: 'TV', managed_by: 'it' })
    client.tables.equipment.push(
      getAllRow({ id: 'tv1', equipment_type_id: 'eqtype-tv', assigned_facility_id: null }),
    )

    await expect(
      BuildingEquipmentService.assignToFacility(FACILITY_A, 'eqtype-tv', 1, BA_FACILITY_ASSIGN_SCOPE),
    ).rejects.toThrow('Forbidden')

    expect(client.tables.equipment.find((e: any) => e.id === 'tv1').assigned_facility_id).toBeNull()
  })
})
