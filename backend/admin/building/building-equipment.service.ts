/**
 * Building Equipment Service
 *
 * CRUD operations for equipment inventory management.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/errors'
import { dbEquipmentToView, type EquipmentFilters, type BuildingEquipment } from './building.types'

/**
 * Apply the shared ids-or-filters targeting logic used by the bulk equipment
 * endpoints (updateBulk/deleteBulk) to a Supabase query builder that has
 * already had `.select(...)`/`.update(...)`/`.delete()` called on it. Kept as
 * one helper so the "before" snapshot query (used to discover which facilities
 * a bulk operation is about to affect) and the actual mutation query can never
 * drift apart and silently target different row sets.
 */
function applyEquipmentBulkFilters(
  query: any,
  ids: string[] | undefined,
  filters: EquipmentFilters | undefined,
  actionLabel: string,
  scopedTypeIds?: string[] | null
) {
  const scoped = (q: any) => (scopedTypeIds ? q.in('equipment_type_id', scopedTypeIds) : q)
  if (ids && ids.length > 0) {
    return scoped(query.in('id', ids))
  } else if (filters) {
    if (filters.category && filters.category !== 'all') query = query.eq('equipment_type_id', filters.category)
    if (filters.status && filters.status !== 'all') query = query.eq('current_status_id', filters.status)
    if (filters.search) query = query.or(`equipment_name.ilike.%${filters.search}%,equipment_code.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`)
    return scoped(query.eq('is_active', true))
  } else {
    throw new Error(`Either ids or filters must be provided for bulk ${actionLabel}`)
  }
}

type ManagedByScope = ('pamo' | 'it' | 'building')[]

/** Resolve the equipment_type ids belonging to the given managed_by scope(s).
 *  Returns null when no scope is supplied (i.e. no scope restriction). */
async function resolveScopedTypeIds(
  supabase: any,
  managedBy?: ManagedByScope
): Promise<string[] | null> {
  if (!managedBy || managedBy.length === 0) return null
  const { data } = await supabase
    .from('equipment_types')
    .select('id')
    .in('managed_by', managedBy)
  return (data || []).map((t: any) => t.id)
}

/** Throw if any of the given equipment_type ids is outside the scope. */
async function assertTypeIdsInScope(
  supabase: any,
  typeIds: string[],
  managedBy?: ManagedByScope
): Promise<void> {
  if (!managedBy || managedBy.length === 0) return
  const allowed = new Set((await resolveScopedTypeIds(supabase, managedBy)) || [])
  for (const id of typeIds) {
    if (!allowed.has(id)) {
      throw new Error('Forbidden: equipment type is outside your managed scope')
    }
  }
}

/** Throw if any of the given equipment ids has a type outside the scope. */
async function assertEquipmentIdsInScope(
  supabase: any,
  equipmentIds: string[],
  managedBy?: ManagedByScope
): Promise<void> {
  if (!managedBy || managedBy.length === 0 || equipmentIds.length === 0) return
  const { data } = await supabase
    .from('equipment')
    .select('equipment_type_id')
    .in('id', equipmentIds)
  const typeIds = [...new Set((data || []).map((r: any) => r.equipment_type_id))] as string[]
  await assertTypeIdsInScope(supabase, typeIds, managedBy)
}

/**
 * Reserve the next `quantity` sequential equipment codes for a type, matching
 * the human-curated prefix already used by that type's existing rows (e.g. the
 * seeded DESKTOP_COMPUTER units are PC-001..PC-015, so the next is PC-016).
 *
 * Those prefixes (PC, MON, CAM, PART, ...) are NOT derivable from
 * equipment_types.type_code — DESKTOP_COMPUTER -> PC, WEBCAM -> CAM — so we
 * recover the prefix from the codes already in the table rather than from the
 * type row. A type with no parseable rows yet (a freshly created custom type)
 * falls back to a type_code-derived prefix starting at 001.
 *
 * NOT race-proof on its own: this reads then the caller inserts, so two
 * concurrent creates can compute the same number. Callers must insert under the
 * unique(equipment_code) constraint and retry on violation — see create().
 */
async function computeSequentialCodes(
  supabase: any,
  typeId: string,
  quantity: number
): Promise<string[]> {
  const { data: rows } = await supabase
    .from('equipment')
    .select('equipment_code')
    .eq('equipment_type_id', typeId)

  // Parse strict "PREFIX-NNN" codes only; anything else (e.g. legacy random
  // codes like LAPT-4837 or quantity suffixes like PC-016-2) is ignored so it
  // can't pollute the sequence we continue from.
  const parsed: { prefix: string; num: number; width: number }[] = []
  for (const r of rows || []) {
    const m = /^([A-Za-z]+)-(\d+)$/.exec(r.equipment_code || '')
    if (m) parsed.push({ prefix: m[1].toUpperCase(), num: parseInt(m[2], 10), width: m[2].length })
  }

  let prefix: string
  let start: number
  let width = 3

  if (parsed.length > 0) {
    // Dominant prefix = the one the most existing rows use, so a stray outlier
    // code doesn't hijack the naming scheme.
    const counts = new Map<string, number>()
    for (const p of parsed) counts.set(p.prefix, (counts.get(p.prefix) || 0) + 1)
    prefix = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const forPrefix = parsed.filter((p) => p.prefix === prefix)
    start = Math.max(...forPrefix.map((p) => p.num)) + 1
    width = Math.max(3, ...forPrefix.map((p) => p.width))
  } else {
    const { data: typeInfo } = await supabase
      .from('equipment_types')
      .select('type_code')
      .eq('id', typeId)
      .single()
    prefix =
      (typeInfo?.type_code || '').replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase() || 'EQ'
    start = 1
  }

  return Array.from({ length: quantity }, (_, i) => `${prefix}-${String(start + i).padStart(width, '0')}`)
}

export const BuildingEquipmentService = {
  /**
   * Get all equipment with pagination and filters
   */
  async getAll(filters?: EquipmentFilters) {
    const supabase = createAdminClient()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50
    const offset = (page - 1) * pageSize

    // For professional grouping, we use a more complex query.
    // Since Supabase JS doesn't support GROUP BY directly in .select(), 
    // we fetch filtered items and group them. 
    // For high-performance at scale, we fetch a larger buffer or use a view,
    // but for now, we'll fetch all matching items to ensure accurate grouping.

    let query = supabase
      .from('equipment')
      .select(`
        *,
        equipment_type:equipment_types!equipment_equipment_type_id_fkey(id, name:type_name, managed_by),
        status_type:equipment_status_types!equipment_current_status_id_fkey(id, name:status_name),
        facility:facilities!equipment_assigned_facility_id_fkey(id, name)
      `)
      .eq('is_active', true)
      .order('equipment_name', { ascending: true })

    if (filters?.category && filters.category !== 'all') {
      query = query.eq('equipment_type_id', filters.category)
    }

    if (filters?.facilityId) {
      query = query.eq('assigned_facility_id', filters.facilityId)
    }

    // Scope filter: applied client-side after the fetch to avoid a separate
    // round-trip to resolveScopedTypeIds. The join on equipment_types is
    // already part of the select, so we have managed_by available on each row.
    // For small-to-medium inventories the in-memory filter is negligible
    // compared to the network latency of an extra Supabase round-trip.
    const hasScope = !!filters?.managedBy?.length
    const scopeSet = hasScope ? new Set(filters!.managedBy!) : null

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('current_status_id', filters.status)
    }

    if (filters?.search) {
      query = query.or(
        `equipment_name.ilike.%${filters.search}%,equipment_code.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`
      )
    }

    if (filters?.assignment === 'assigned') {
      query = query.not('assigned_facility_id', 'is', null)
    } else if (filters?.assignment === 'unassigned') {
      query = query.is('assigned_facility_id', null)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    // Manual Grouping for accuracy across pages
    const groups: Record<string, any> = {}
    const items = (data || [])
      .filter(row => !scopeSet || scopeSet.has(row.equipment_type?.managed_by))
      .map(dbEquipmentToView)

    items.forEach(item => {
      const key = `${item.equipmentName}-${item.equipmentTypeId}-${item.assignedFacilityId}-${item.currentStatusId}`;
      if (!groups[key]) {
        groups[key] = {
          ...item,
          quantity: 0,
          ids: [],
          displayCode: item.equipmentCode?.split('-').slice(0, 2).join('-') || item.equipmentCode
        }
      }
      groups[key].quantity += 1;
      groups[key].ids.push(item.id);
    });

    const allGroups = Object.values(groups)
    const paginatedGroups = allGroups.slice(offset, offset + pageSize)

    return {
      equipment: paginatedGroups,
      total: allGroups.length,
    }
  },

  /**
   * Per-unit equipment currently assigned to one facility, ungrouped.
   *
   * getAll() collapses units into per-type groups for the inventory table (a
   * "3 units" row); the facility editor needs the opposite — one row per
   * physical unit so it can surface each asset's code, brand/model, serial, and
   * individual status. Kept as its own method rather than a getAll() flag so the
   * grouped return shape (relied on by the inventory table + assign picker)
   * never changes.
   */
  async getUnitsForFacility(facilityId: string): Promise<BuildingEquipment[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('equipment')
      .select(`
        *,
        equipment_type:equipment_types!equipment_equipment_type_id_fkey(id, name:type_name, managed_by),
        status_type:equipment_status_types!equipment_current_status_id_fkey(id, name:status_name),
        facility:facilities!equipment_assigned_facility_id_fkey(id, name)
      `)
      .eq('assigned_facility_id', facilityId)
      .eq('is_active', true)
      .order('equipment_code', { ascending: true })

    if (error) throw new Error(error.message)
    return (data || []).map(dbEquipmentToView)
  },

  /**
   * Get equipment stats
   */
  async getStats(managedBy?: ManagedByScope) {
    const supabase = createAdminClient()

    const scopedIds = await resolveScopedTypeIds(supabase, managedBy)
    const scoped = (q: any) => (scopedIds ? q.in('equipment_type_id', scopedIds) : q)

    const { count: total } = await scoped(
      supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('is_active', true)
    )

    // Get status type IDs for counting
    const { data: statusTypes } = await supabase
      .from('equipment_status_types')
      .select('id, name:status_name, status_code')

    const statusMap = new Map((statusTypes || []).map((s: any) => [s.status_code, s.id]))

    const availableId = statusMap.get('AVAILABLE')
    const inUseId = statusMap.get('IN_USE')
    const maintenanceId = statusMap.get('MAINTENANCE')

    const { count: available } = availableId
      ? await scoped(supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('current_status_id', availableId))
      : { count: 0 }

    const { count: inUse } = inUseId
      ? await scoped(supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('current_status_id', inUseId))
      : { count: 0 }

    const { count: maintenance } = maintenanceId
      ? await scoped(supabase.from('equipment').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('current_status_id', maintenanceId))
      : { count: 0 }

    return {
      total: total || 0,
      available: available || 0,
      inUse: inUse || 0,
      maintenance: maintenance || 0,
    }
  },

  /**
   * Get equipment types for filter dropdown
   */
  async getTypes(managedBy?: ManagedByScope) {
    const supabase = createAdminClient()

    let query = supabase
      .from('equipment_types')
      .select('id, name:type_name, description, managed_by')
      .order('type_name', { ascending: true })

    if (managedBy?.length) {
      query = query.in('managed_by', managedBy)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)

    return data || []
  },

  /**
   * Get equipment status types
   */
  async getStatusTypes() {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('equipment_status_types')
      .select('id, name:status_name, description')
      .order('status_name', { ascending: true })

    if (error) throw new Error(error.message)

    return data || []
  },

  /**
   * Create a new equipment type
   */
  async createType(name: string, scope?: ManagedByScope) {
    const supabase = createAdminClient()
    const typeCode = name.toUpperCase().replace(/\s+/g, '_')

    const { data, error } = await supabase
      .from('equipment_types')
      .upsert({
        type_code: typeCode,
        type_name: name,
        icon: 'package',
        managed_by: scope && scope.length === 1 ? scope[0] : 'pamo',
      }, { onConflict: 'type_code' })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  },

  /**
   * Create equipment
   */
  async create(equipment: {
    equipmentCode?: string
    equipmentName: string
    equipmentTypeId: string
    currentStatusId?: string
    assignedFacilityId?: string
    serialNumber?: string
    brand?: string
    model?: string
    purchaseDate?: string
    warrantyExpiry?: string
    notes?: string
    quantity?: number
  }, scope?: ManagedByScope) {
    const supabase = createAdminClient()
    const quantity = Math.min(100, Math.max(1, equipment.quantity || 1))

    // Get default status if missing
    let statusId = equipment.currentStatusId
    if (!statusId) {
      const { data: statusType } = await supabase
        .from('equipment_status_types')
        .select('id')
        .eq('status_code', 'AVAILABLE')
        .single()
      statusId = statusType?.id
    }

    // Handle custom type if provided
    let typeId = equipment.equipmentTypeId
    const customTypeName = (equipment as any).customTypeName
    if (customTypeName) {
      const type = await this.createType(customTypeName, scope)
      typeId = type.id
    }

    // Enforce that the target type is within the caller's write scope.
    await assertTypeIdsInScope(supabase, [typeId], scope)

    const buildItems = (codes: string[]) =>
      codes.map((code) => ({
        equipment_code: code,
        equipment_name: equipment.equipmentName,
        equipment_type_id: typeId,
        current_status_id: statusId,
        assigned_facility_id: equipment.assignedFacilityId || null,
        serial_number: equipment.serialNumber || null,
        brand: equipment.brand || null,
        model: equipment.model || null,
        purchase_date: equipment.purchaseDate || null,
        warranty_expiry: equipment.warrantyExpiry || null,
        notes: equipment.notes || null,
      }))

    // A manual code (rare — the Add Asset UI never sends one) is honoured as-is;
    // otherwise the code is auto-generated by continuing this type's existing
    // sequential prefix (PC-015 -> PC-016). See computeSequentialCodes.
    const manualCodes = equipment.equipmentCode
      ? Array.from({ length: quantity }, (_, i) =>
          quantity > 1 ? `${equipment.equipmentCode}-${i + 1}` : equipment.equipmentCode!
        )
      : null

    // Sequential codes are computed from a read then inserted under the
    // unique(equipment_code) constraint, so a concurrent create can collide.
    // Recompute the sequence and retry a few times before surfacing the error.
    // Manual codes are user-chosen, so a clash there is a real conflict — never
    // silently retried into a different code.
    let data: any = null
    for (let attempt = 0; ; attempt++) {
      const codes = manualCodes ?? (await computeSequentialCodes(supabase, typeId, quantity))
      const res = await supabase
        .from('equipment')
        .insert(buildItems(codes))
        .select(`
          *,
          equipment_type:equipment_types!equipment_equipment_type_id_fkey(id, name:type_name, managed_by),
          status_type:equipment_status_types!equipment_current_status_id_fkey(id, name:status_name),
          facility:facilities!equipment_assigned_facility_id_fkey(id, name)
        `)
      if (!res.error) {
        data = res.data
        break
      }
      const isDup =
        res.error.code === '23505' || /duplicate key|equipment_code/i.test(res.error.message || '')
      if (manualCodes || !isDup || attempt >= 4) throw new Error(res.error.message)
      // otherwise loop: a concurrent create took our number, recompute and retry
    }

    // Equipment mutation has committed — recompute inventory-derived amenities
    // for the facility these units landed in, if any. The current Add Asset UI
    // never sets assignedFacilityId at creation time (new units always start
    // unassigned in storage), so this is a no-op today; wired up now so this
    // path self-corrects the moment that changes, instead of silently
    // reintroducing the same staleness gap importBulk had (see its comment
    // above). Same log-don't-fail convention as every other write path here.
    if (equipment.assignedFacilityId) {
      try {
        await this.syncInventoryAmenities(equipment.assignedFacilityId)
      } catch (syncErr) {
        console.error('[equipment/create] inventory amenity sync failed:', getErrorMessage(syncErr))
      }
    }

    return quantity === 1 ? dbEquipmentToView(data[0]) : data.map(dbEquipmentToView)
  },

  /**
   * Bulk import equipment
   */
  async importBulk(items: Array<{
    equipmentName: string
    equipmentType: string // Name or ID
    brand?: string
    model?: string
    serialNumber?: string
    notes?: string
    quantity?: number
  }>, scope?: ManagedByScope) {
    const supabase = createAdminClient()

    // 1. Resolve all types
    const uniqueTypeNames = [...new Set(items.map(i => i.equipmentType))];
    const typeMapping: Record<string, string> = {};

    for (const name of uniqueTypeNames) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) {
        typeMapping[name] = name;
        continue;
      }

      const { data: existing } = await supabase
        .from('equipment_types')
        .select('id')
        .ilike('type_name', name)
        .single();

      if (existing) {
        typeMapping[name] = existing.id;
      } else {
        const newType = await this.createType(name, scope);
        typeMapping[name] = newType.id;
      }
    }

    // Every resolved type must be within the caller's write scope.
    await assertTypeIdsInScope(supabase, [...new Set(Object.values(typeMapping))], scope)

    // 2. Expand each row into its physical units (capped per row like create()),
    // tagged with the resolved typeId so codes can be reserved per type.
    const units = items.flatMap((item) => {
      const qty = Math.min(100, Math.max(1, Number(item.quantity) || 1))
      return Array.from({ length: qty }, () => item)
    })

    // Total units per type, so each type gets a contiguous sequential run
    // (MON-013, MON-014, ... continuing that type's existing codes) instead of
    // the old random base. See computeSequentialCodes.
    const perTypeTotal = new Map<string, number>()
    for (const item of units) {
      const typeId = typeMapping[item.equipmentType]
      perTypeTotal.set(typeId, (perTypeTotal.get(typeId) || 0) + 1)
    }

    // Default status is fixed across retries.
    const { data: statusType } = await supabase
      .from('equipment_status_types')
      .select('id')
      .eq('status_code', 'AVAILABLE')
      .single();
    const statusId = statusType?.id;

    // Codes are computed from a read then inserted under unique(equipment_code),
    // so a concurrent import can grab the same number. Recompute the whole batch
    // and retry a few times before surfacing the error.
    let data: any = null
    for (let attempt = 0; ; attempt++) {
      // Fresh per-type code pools + cursors on each attempt.
      const pools = new Map<string, string[]>()
      for (const [typeId, total] of perTypeTotal) {
        pools.set(typeId, await computeSequentialCodes(supabase, typeId, total))
      }
      const cursor = new Map<string, number>()

      const itemsToInsert = units.map((item) => {
        const typeId = typeMapping[item.equipmentType]
        const idx = cursor.get(typeId) || 0
        cursor.set(typeId, idx + 1)
        return {
          equipment_code: pools.get(typeId)![idx],
          equipment_name: item.equipmentName,
          equipment_type_id: typeId,
          current_status_id: statusId,
          brand: item.brand || null,
          model: item.model || null,
          serial_number: item.serialNumber || null,
          notes: item.notes || null,
        }
      })

      const res = await supabase.from('equipment').insert(itemsToInsert).select()
      if (!res.error) {
        data = res.data
        break
      }
      const isDup =
        res.error.code === '23505' || /duplicate key|equipment_code/i.test(res.error.message || '')
      if (!isDup || attempt >= 4) throw new Error(res.error.message)
      // otherwise loop: a concurrent import took our numbers, recompute and retry
    }

    // Equipment mutation has committed — recompute inventory-derived amenities
    // for every distinct facility any imported unit landed in. itemsToInsert
    // never sets assigned_facility_id today (bulk import always creates
    // unassigned units in storage), so this set is currently always empty and
    // the loop below is a no-op; it's wired up now so this path self-corrects
    // the moment bulk import gains the ability to pre-assign a facility,
    // instead of silently reintroducing the same staleness gap. Same
    // log-don't-fail convention as the single assign/unassign call sites in
    // app/api/admin/building/facilities/[id]/equipment/route.ts.
    const affectedFacilityIds = new Set<string>(
      (data || [])
        .map((row: any) => row.assigned_facility_id)
        .filter((id: any): id is string => !!id)
    );

    for (const facilityId of affectedFacilityIds) {
      try {
        await this.syncInventoryAmenities(facilityId);
      } catch (syncErr) {
        console.error('[equipment/importBulk] inventory amenity sync failed:', getErrorMessage(syncErr));
      }
    }

    return data.length;
  },

  /**
   * Update equipment
   */
  async update(id: string, updates: Record<string, any>, scope?: ManagedByScope) {
    const supabase = createAdminClient()

    // The item being edited must be within scope, and if the type is being
    // changed the new type must also be within scope.
    await assertEquipmentIdsInScope(supabase, [id], scope)

    if (updates.customTypeName) {
      const newType = await this.createType(updates.customTypeName, scope)
      updates.equipmentTypeId = newType.id
    }

    if (updates.equipmentTypeId) {
      await assertTypeIdsInScope(supabase, [updates.equipmentTypeId], scope)
    }

    const dbUpdates: Record<string, any> = {}
    const mapping: Record<string, string> = {
      equipmentCode: 'equipment_code',
      equipmentName: 'equipment_name',
      equipmentTypeId: 'equipment_type_id',
      currentStatusId: 'current_status_id',
      assignedFacilityId: 'assigned_facility_id',
      serialNumber: 'serial_number',
      brand: 'brand',
      model: 'model',
      purchaseDate: 'purchase_date',
      warrantyExpiry: 'warranty_expiry',
      notes: 'notes',
      imageUrl: 'image_url',
    }

    for (const [key, value] of Object.entries(updates)) {
      if (mapping[key]) {
        dbUpdates[mapping[key]] = value
      }
    }

    if (Object.keys(dbUpdates).length === 0) {
      // If no valid updates, fetch the current item and return it
      const { data: existing, error: fetchError } = await supabase
        .from('equipment')
        .select(`
          *,
          equipment_type:equipment_types!equipment_equipment_type_id_fkey(id, name:type_name, managed_by),
          status_type:equipment_status_types!equipment_current_status_id_fkey(id, name:status_name),
          facility:facilities!equipment_assigned_facility_id_fkey(id, name)
        `)
        .eq('id', id)
        .single()

      if (fetchError) throw new Error(fetchError.message)
      return dbEquipmentToView(existing)
    }

    // Snapshot which facility this unit was assigned to *before* the mutation —
    // a status flip (e.g. -> BROKEN) or equipment_type_id reclassification can
    // change that facility's inventory-derived amenity counts even when
    // assigned_facility_id itself isn't part of this update, and that "before"
    // facility is no longer discoverable once the update below overwrites it.
    const { data: beforeRow, error: beforeError } = await supabase
      .from('equipment')
      .select('assigned_facility_id')
      .eq('id', id)
      .single()
    if (beforeError) throw new Error(beforeError.message)

    const { data, error } = await supabase
      .from('equipment')
      .update(dbUpdates)
      .eq('id', id)
      .select(`
        *,
        equipment_type:equipment_types!equipment_equipment_type_id_fkey(id, name:type_name, managed_by),
        status_type:equipment_status_types!equipment_current_status_id_fkey(id, name:status_name),
        facility:facilities!equipment_assigned_facility_id_fkey(id, name)
      `)
      .single()

    if (error) throw new Error(error.message)

    // Equipment mutation has committed — recompute inventory-derived amenities
    // for the facility this unit was assigned to before (it may have left, or
    // had its status/type change), plus the new facility if this update
    // reassigned it. Same log-don't-fail convention as updateBulk/deleteBulk:
    // a sync failure must not report the (already-successful) update as failed.
    const affectedFacilityIds = new Set<string>()
    if (beforeRow?.assigned_facility_id) affectedFacilityIds.add(beforeRow.assigned_facility_id)
    if (dbUpdates.assigned_facility_id) affectedFacilityIds.add(dbUpdates.assigned_facility_id)

    for (const facilityId of affectedFacilityIds) {
      try {
        await this.syncInventoryAmenities(facilityId)
      } catch (syncErr) {
        console.error('[equipment/update] inventory amenity sync failed:', getErrorMessage(syncErr))
      }
    }

    return dbEquipmentToView(data)
  },

  /**
   * Soft-delete equipment
   */
  async delete(id: string, scope?: ManagedByScope) {
    const supabase = createAdminClient()

    await assertEquipmentIdsInScope(supabase, [id], scope)

    // Snapshot the assigned facility before soft-deleting — once is_active
    // flips to false, syncInventoryAmenities's live-count query (is_active =
    // true) will no longer see this unit, so that facility's inventory-derived
    // amenity count goes stale unless recomputed.
    const { data: beforeRow, error: beforeError } = await supabase
      .from('equipment')
      .select('assigned_facility_id')
      .eq('id', id)
      .single()
    if (beforeError) throw new Error(beforeError.message)

    const { error } = await supabase
      .from('equipment')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw new Error(error.message)

    if (beforeRow?.assigned_facility_id) {
      try {
        await this.syncInventoryAmenities(beforeRow.assigned_facility_id)
      } catch (syncErr) {
        console.error('[equipment/delete] inventory amenity sync failed:', getErrorMessage(syncErr))
      }
    }
  },

  /**
   * Soft-delete multiple equipment items
   */
  async deleteBulk(ids?: string[], filters?: EquipmentFilters, scope?: ManagedByScope) {
    const supabase = createAdminClient()

    const scopedTypeIds = await resolveScopedTypeIds(supabase, scope ?? filters?.managedBy)

    // Snapshot the assigned facilities for the rows about to be soft-deleted —
    // once is_active flips to false, syncInventoryAmenities's live-count query
    // (which filters on is_active = true) will no longer see them, so those
    // facilities' inventory-derived amenity counts go stale unless recomputed.
    const { data: beforeRows, error: beforeError } = await applyEquipmentBulkFilters(
      supabase.from('equipment').select('assigned_facility_id'),
      ids,
      filters,
      'delete',
      scopedTypeIds
    )
    if (beforeError) throw new Error(beforeError.message)

    const { error } = await applyEquipmentBulkFilters(
      supabase.from('equipment').update({ is_active: false }),
      ids,
      filters,
      'delete',
      scopedTypeIds
    )
    if (error) throw new Error(error.message)

    // Equipment mutation has committed — recompute inventory-derived amenities
    // for every distinct facility that had units soft-deleted out from under it.
    // A sync failure here must not report the (already-successful) delete as
    // failed: it's a derived, self-healing recompute-from-scratch, same
    // log-don't-fail convention as the single assign/unassign call sites in
    // app/api/admin/building/facilities/[id]/equipment/route.ts.
    const affectedFacilityIds = new Set<string>()
    for (const row of beforeRows || []) {
      if (row.assigned_facility_id) affectedFacilityIds.add(row.assigned_facility_id)
    }

    for (const facilityId of affectedFacilityIds) {
      try {
        await this.syncInventoryAmenities(facilityId)
      } catch (syncErr) {
        console.error('[equipment/deleteBulk] inventory amenity sync failed:', getErrorMessage(syncErr))
      }
    }
  },

  /**
   * Update multiple equipment items
   */
  async updateBulk(updates: Record<string, any>, ids?: string[], filters?: EquipmentFilters, scope?: ManagedByScope) {
    const supabase = createAdminClient()

    // If a bulk update changes the type, the new type must be within scope.
    if (updates.equipmentTypeId) {
      await assertTypeIdsInScope(supabase, [updates.equipmentTypeId], scope)
    }
    const scopedTypeIds = await resolveScopedTypeIds(supabase, scope ?? filters?.managedBy)

    const dbUpdates: Record<string, any> = {}
    // Deliberately narrower than update()'s mapping: fields like serialNumber/
    // brand/model are per-unit and aren't part of the equipment-table grouping
    // key (equipmentName-equipmentTypeId-assignedFacilityId-currentStatusId), so
    // bulk-writing them across a selection would silently clobber genuinely
    // distinct units with the same value. equipmentName IS part of that
    // grouping key — every unit in a bulk selection sourced from a grouped row
    // (see EquipmentTable's "Edit" action) already shares one — so renaming the
    // batch is coherent and safe to include here.
    const mapping: Record<string, string> = {
      equipmentName: 'equipment_name',
      equipmentTypeId: 'equipment_type_id',
      currentStatusId: 'current_status_id',
      assignedFacilityId: 'assigned_facility_id',
    }

    for (const [key, value] of Object.entries(updates)) {
      if (mapping[key]) {
        dbUpdates[mapping[key]] = value
      }
    }

    if (Object.keys(dbUpdates).length === 0) return

    // Snapshot which facilities the targeted rows are assigned to *before* the
    // mutation runs. A bulk update can reassign units (assigned_facility_id
    // changing) or flip their status to BROKEN/RETIRED without touching
    // assigned_facility_id at all — either way, the facility(ies) the rows were
    // assigned to before this call need their inventory-derived amenity counts
    // recomputed, and that "before" facility is no longer discoverable once
    // assigned_facility_id has been overwritten by the update below.
    const { data: beforeRows, error: beforeError } = await applyEquipmentBulkFilters(
      supabase.from('equipment').select('assigned_facility_id'),
      ids,
      filters,
      'update',
      scopedTypeIds
    )
    if (beforeError) throw new Error(beforeError.message)

    const { error } = await applyEquipmentBulkFilters(
      supabase.from('equipment').update(dbUpdates),
      ids,
      filters,
      'update',
      scopedTypeIds
    )
    if (error) throw new Error(error.message)

    // Equipment mutation has committed — recompute inventory-derived amenities
    // for every distinct facility this bulk update touched: every facility the
    // rows were assigned to before (they may have left, or had a unit go
    // BROKEN/RETIRED), plus the new facility if this update reassigned them. A
    // sync failure here must not report the (already-successful) update as
    // failed: it's a derived, self-healing recompute-from-scratch, same
    // log-don't-fail convention as the single assign/unassign call sites in
    // app/api/admin/building/facilities/[id]/equipment/route.ts.
    const affectedFacilityIds = new Set<string>()
    for (const row of beforeRows || []) {
      if (row.assigned_facility_id) affectedFacilityIds.add(row.assigned_facility_id)
    }
    if (dbUpdates.assigned_facility_id) {
      affectedFacilityIds.add(dbUpdates.assigned_facility_id)
    }

    for (const facilityId of affectedFacilityIds) {
      try {
        await this.syncInventoryAmenities(facilityId)
      } catch (syncErr) {
        console.error('[equipment/updateBulk] inventory amenity sync failed:', getErrorMessage(syncErr))
      }
    }
  },

  /**
   * Assign N units of a specific type to a facility
   */
  async assignToFacility(facilityId: string, typeId: string, quantity: number, scope?: ManagedByScope) {
    const supabase = createAdminClient()

    // Callers restricted to a managed_by scope (e.g. BA -> 'pamo') may not move
    // equipment of another office's type through this path.
    await assertTypeIdsInScope(supabase, [typeId], scope)

    // 1. Get status IDs
    const { data: statusTypes } = await supabase
      .from('equipment_status_types')
      .select('id, status_code')

    const inUseId = statusTypes?.find(s => s.status_code === 'IN_USE')?.id
    const availableId = statusTypes?.find(s => s.status_code === 'AVAILABLE')?.id

    if (!inUseId) throw new Error('Status IN_USE not found')

    // 2. Find available units
    const { data: availableItems, error: findError } = await supabase
      .from('equipment')
      .select('id')
      .eq('equipment_type_id', typeId)
      .eq('is_active', true)
      .is('assigned_facility_id', null)
      .limit(quantity)

    if (findError) throw new Error(findError.message)
    if (!availableItems || availableItems.length < quantity) {
      throw new Error(`Only ${availableItems?.length || 0} units available in storage.`)
    }

    // 3. Update them — re-guarded with `.is('assigned_facility_id', null)` so a
    // concurrent assignToFacility call racing for the same units (the window
    // between step 2's SELECT and this UPDATE on two overlapping requests)
    // can't silently win: only rows still unassigned *at write time* actually
    // get claimed. Without this guard, both callers' UPDATEs would succeed
    // unconditionally and the loser's units would end up double-assigned to
    // whichever request wrote last, silently corrupting both facilities'
    // inventory-derived amenity counts.
    const ids = availableItems.map(i => i.id)
    const { data: claimed, error: updateError } = await supabase
      .from('equipment')
      .update({
        assigned_facility_id: facilityId,
        current_status_id: inUseId
      })
      .in('id', ids)
      .is('assigned_facility_id', null)
      .select('id')

    if (updateError) throw new Error(updateError.message)

    const claimedIds = (claimed || []).map((c: any) => c.id)

    if (claimedIds.length < quantity) {
      // Lost the race for some units to a concurrent assign — release whatever
      // we did claim so this call fails cleanly (nothing left half-assigned)
      // instead of silently under-fulfilling the requested quantity.
      if (claimedIds.length > 0) {
        await supabase
          .from('equipment')
          .update({ assigned_facility_id: null, current_status_id: availableId ?? null })
          .in('id', claimedIds)
      }
      throw new Error('Some of the requested units were just claimed by another request. Please try again.')
    }

    return claimedIds
  },

  /**
   * Unassign specific units and return to storage
   */
  async unassignFromFacility(ids: string[], scope?: ManagedByScope) {
    const supabase = createAdminClient()

    // Scope-restricted callers may only unassign their own office's equipment.
    await assertEquipmentIdsInScope(supabase, ids, scope)

    // 1. Get status IDs
    const { data: statusTypes } = await supabase
      .from('equipment_status_types')
      .select('id, status_code')

    const availableId = statusTypes?.find(s => s.status_code === 'AVAILABLE')?.id

    if (!availableId) throw new Error('Status AVAILABLE not found')

    // 2. Update them
    const { error: updateError } = await supabase
      .from('equipment')
      .update({
        assigned_facility_id: null,
        current_status_id: availableId
      })
      .in('id', ids)

    if (updateError) throw new Error(updateError.message)
    return true
  },

  /**
   * Recompute a facility's inventory-derived amenities (facility_amenity_map rows
   * tagged source='inventory') from the equipment currently assigned to it.
   * Recompute-from-scratch on every call — no incremental diffing against the
   * previous state.
   *
   * Ownership contract (mirror image of BuildingFacilitiesService.syncManualAmenities,
   * Phase 1): this method owns source='inventory' rows only. Every write it performs
   * is either (a) an upsert keyed on (facility_id, amenity_id) that sets
   * source='inventory', or (b) a delete scoped to `AND source = 'inventory'`. It never
   * deletes or bulk-overwrites a source='manual' row.
   *
   * Precedence rule (the one deliberate exception): if a source='manual' row already
   * exists for (facility_id, amenity_id) and that amenity is equipment-backed with
   * >=1 active assigned unit right now, this method takes ownership of it — flips
   * `source` to 'inventory' and sets `quantity` to the live count. `notes` is never
   * part of either the insert or update payload here, so it is preserved untouched on
   * a flip/recompute and only defaults to NULL for a genuinely brand-new row.
   *
   * "Active and assigned": is_active = true (the soft-delete flag used everywhere
   * else in this service) AND assigned_facility_id = facilityId, excluding units
   * whose current_status_id is BROKEN or RETIRED. Those two statuses mean the unit is
   * non-functional/decommissioned; updateBulk() can set either status without
   * clearing assigned_facility_id, so a facility can otherwise end up with a "phantom"
   * assigned-but-dead unit inflating its amenity count. AVAILABLE/IN_USE/RESERVED/
   * MAINTENANCE all still count as real, present inventory.
   */
  async syncInventoryAmenities(facilityId: string) {
    const supabase = createAdminClient()

    // 1. Resolve which statuses are excluded (BROKEN, RETIRED).
    const { data: statusTypes, error: statusError } = await supabase
      .from('equipment_status_types')
      .select('id, status_code')

    if (statusError) throw new Error(statusError.message)

    const excludedStatusIds = new Set(
      (statusTypes || [])
        .filter((s: any) => s.status_code === 'BROKEN' || s.status_code === 'RETIRED')
        .map((s: any) => s.id)
    )

    // 2. Live equipment assigned to this facility, grouped by equipment_type_id.
    const { data: equipmentRows, error: equipmentError } = await supabase
      .from('equipment')
      .select('id, equipment_type_id, current_status_id')
      .eq('assigned_facility_id', facilityId)
      .eq('is_active', true)

    if (equipmentError) throw new Error(equipmentError.message)

    const countByTypeId = new Map<string, number>()
    for (const row of equipmentRows || []) {
      if (excludedStatusIds.has(row.current_status_id)) continue
      countByTypeId.set(row.equipment_type_id, (countByTypeId.get(row.equipment_type_id) || 0) + 1)
    }

    // 3. Resolve equipment_type -> amenity_id (Phase 0 link). Types with
    //    amenity_id IS NULL (cables, cords, pointers, furniture, ...) never surface
    //    as an amenity, no matter how many units are assigned.
    const typeIds = [...countByTypeId.keys()]
    let typeRows: Array<{ id: string; amenity_id: string | null }> = []
    if (typeIds.length > 0) {
      const { data, error } = await supabase
        .from('equipment_types')
        .select('id, amenity_id')
        .in('id', typeIds)

      if (error) throw new Error(error.message)
      typeRows = data || []
    }

    // Live counts keyed by amenity_id — merges multiple equipment types that link
    // to the same amenity (e.g. MIC_WIRED + MIC_WIRELESS -> microphone).
    const liveCountByAmenityId = new Map<string, number>()
    for (const t of typeRows) {
      if (!t.amenity_id) continue
      const count = countByTypeId.get(t.id) || 0
      if (count <= 0) continue
      liveCountByAmenityId.set(t.amenity_id, (liveCountByAmenityId.get(t.amenity_id) || 0) + count)
    }

    // 4. This facility's existing facility_amenity_map rows (both sources) — needed
    //    to decide insert-vs-update per amenity and to find stale inventory rows.
    //    facility_amenity_map has a UNIQUE(facility_id, amenity_id) constraint, so
    //    there is at most one row per amenity regardless of source.
    const { data: existingRows, error: existingError } = await supabase
      .from('facility_amenity_map')
      .select('amenity_id, source')
      .eq('facility_id', facilityId)

    if (existingError) throw new Error(existingError.message)

    const existingByAmenityId = new Map<string, { source: string }>()
    for (const row of existingRows || []) {
      existingByAmenityId.set(row.amenity_id, { source: row.source })
    }

    // 5. Upsert every live-counted amenity as source='inventory'. This is the only
    //    write path that creates/mutates a row here, and it always sets
    //    source='inventory' — including the precedence-flip case, where an existing
    //    source='manual' row for this (facility_id, amenity_id) gets taken over.
    //    `notes` is deliberately absent from both payloads below.
    const toInsert: Array<{ facility_id: string; amenity_id: string; quantity: number; source: 'inventory' }> = []

    for (const [amenityId, quantity] of liveCountByAmenityId.entries()) {
      if (existingByAmenityId.has(amenityId)) {
        const { error } = await supabase
          .from('facility_amenity_map')
          .update({ source: 'inventory', quantity })
          .eq('facility_id', facilityId)
          .eq('amenity_id', amenityId)

        if (error) throw new Error(error.message)
      } else {
        toInsert.push({ facility_id: facilityId, amenity_id: amenityId, quantity, source: 'inventory' })
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('facility_amenity_map').insert(toInsert)
      if (error) throw new Error(error.message)
    }

    // 6. Delete stale inventory rows: any source='inventory' row for this facility
    //    whose amenity fell out of this call's live-count set (equipment fully
    //    unassigned/type unlinked). `AND source = 'inventory'` is load-bearing — a
    //    source='manual' row is never eligible for this delete, whatever its
    //    amenity_id. This is what removes a row entirely rather than leaving it at
    //    quantity=0.
    const staleAmenityIds = (existingRows || [])
      .filter((row: any) => row.source === 'inventory' && !liveCountByAmenityId.has(row.amenity_id))
      .map((row: any) => row.amenity_id)

    if (staleAmenityIds.length > 0) {
      const { error } = await supabase
        .from('facility_amenity_map')
        .delete()
        .eq('facility_id', facilityId)
        .eq('source', 'inventory')
        .in('amenity_id', staleAmenityIds)

      if (error) throw new Error(error.message)
    }
  },
}
