/**
 * Building Facilities Service
 *
 * CRUD operations for facilities management, floor listing, and status queries.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { cacheDeleteByPrefix } from '@/lib/cache'
import {
  sanitizeSearch,
  dbFacilityToView,
  normalizeAmenityName,
  prettifyAmenityName,
  AMENITY_NAME_MAX_LENGTH,
  AMENITY_NOTES_MAX_LENGTH,
  type FacilityFilters,
  type FacilityAmenity,
  type FacilityUpcomingBooking,
  type ManualAmenityInput,
  type AmenityCatalogEntry,
  type FacilityAmenityRow,
} from './building.types'

// ─── Helper functions for getWithStatus ───

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatTime12h(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export const BuildingFacilitiesService = {
  /**
   * Get all facilities with pagination and filters
   */
  async getAll(filters?: FacilityFilters) {
    const supabase = createAdminClient()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('facilities')
      .select(`
        *,
        floor:floors!facilities_floor_id_fkey(id, name, floor_number),
        facility_type:facility_types!facilities_facility_type_id_fkey(id, name)
      `, { count: 'exact' })
      .order('room_number', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (filters?.floor) {
      query = query.eq('floor_id', filters.floor)
    }

    if (filters?.type) {
      query = query.eq('facility_type_id', filters.type)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.search) {
      const s = sanitizeSearch(filters.search)
      query = query.or(
        `name.ilike.%${s}%,room_number.ilike.%${s}%,code.ilike.%${s}%`
      )
    }

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    return {
      facilities: (data || []).map(dbFacilityToView),
      total: count || 0,
    }
  },

  /**
   * Get a single facility by ID
   */
  async getById(id: string) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('facilities')
      .select(`
        *,
        floor:floors!facilities_floor_id_fkey(id, name, floor_number),
        facility_type:facility_types!facilities_facility_type_id_fkey(id, name)
      `)
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)

    return dbFacilityToView(data)
  },

  /**
   * Create a new facility
   */
  async create(facility: {
    code: string
    name: string
    description?: string
    floorId: string
    facilityTypeId: string
    capacity: number
    areaSqm?: number
    roomNumber?: string
    isBookable?: boolean
    requiresApproval?: boolean
    hourlyRate?: number
    halfDayRate?: number
    fullDayRate?: number
    isAvailableForRental?: boolean
    amenities?: ManualAmenityInput[]
  }) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('facilities')
      .insert({
        code: facility.code,
        name: facility.name,
        description: facility.description || null,
        floor_id: facility.floorId,
        facility_type_id: facility.facilityTypeId,
        capacity: facility.capacity,
        area_sqm: facility.areaSqm || null,
        room_number: facility.roomNumber || null,
        is_bookable: facility.isBookable ?? true,
        requires_approval: facility.requiresApproval ?? true,
        hourly_rate: facility.hourlyRate || null,
        half_day_rate: facility.halfDayRate || null,
        full_day_rate: facility.fullDayRate || null,
        is_available_for_rental: facility.isAvailableForRental ?? false,
      })
      .select(`
        *,
        floor:floors!facilities_floor_id_fkey(id, name, floor_number),
        facility_type:facility_types!facilities_facility_type_id_fkey(id, name)
      `)
      .single()

    if (error) throw new Error(error.message)

    // Bust the cached default facility list (GET /api/facilities, key
    // 'ref:facilities:default') so the new room shows up in the booking-form
    // dropdown immediately instead of waiting out its 10-minute TTL. Scoped to
    // facility create/update only — syncManualAmenities/syncInventoryAmenities
    // never touch this cache, since the list it backs carries no amenities data.
    cacheDeleteByPrefix('ref:facilities')

    if (facility.amenities) {
      await this.syncManualAmenities(data.id, facility.amenities)
    }

    return dbFacilityToView(data)
  },

  /**
   * Update a facility
   */
  async update(id: string, updates: Record<string, any>) {
    const supabase = createAdminClient()

    // Map camelCase to snake_case
    const dbUpdates: Record<string, any> = {}
    const mapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      floorId: 'floor_id',
      facilityTypeId: 'facility_type_id',
      capacity: 'capacity',
      areaSqm: 'area_sqm',
      roomNumber: 'room_number',
      isBookable: 'is_bookable',
      requiresApproval: 'requires_approval',
      status: 'status',
      hourlyRate: 'hourly_rate',
      halfDayRate: 'half_day_rate',
      fullDayRate: 'full_day_rate',
      isAvailableForRental: 'is_available_for_rental',
    }

    for (const [key, value] of Object.entries(updates)) {
      if (mapping[key]) {
        dbUpdates[mapping[key]] = value
      }
    }

    const { data, error } = await supabase
      .from('facilities')
      .update(dbUpdates)
      .eq('id', id)
      .select(`
        *,
        floor:floors!facilities_floor_id_fkey(id, name, floor_number),
        facility_type:facility_types!facilities_facility_type_id_fkey(id, name)
      `)
      .single()

    if (error) throw new Error(error.message)

    // Bust the cached default facility list — see create() above for why. A
    // rename, floor/type/capacity/status change, etc. must be reflected in the
    // booking-form dropdown without waiting out the TTL.
    cacheDeleteByPrefix('ref:facilities')

    if (Array.isArray(updates.amenities)) {
      await this.syncManualAmenities(id, updates.amenities)
    }

    return dbFacilityToView(data)
  },

  /**
   * Soft-delete a facility (set status to unavailable)
   */
  async delete(id: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('facilities')
      .update({ status: 'unavailable' })
      .eq('id', id)

    if (error) throw new Error(error.message)

    // Bust the cached default facility list — see create() above for why. The
    // cached query filters .eq('status', 'available'), so without this a
    // soft-deleted facility can linger in the booking-form dropdown for up to
    // the cache's 10-minute TTL.
    cacheDeleteByPrefix('ref:facilities')
  },

  /**
   * Sync a facility's manually-curated amenities (facility_amenity_map rows tagged
   * source='manual') to exactly match the given list.
   *
   * Ownership contract: two writers touch facility_amenity_map — this method
   * (source='manual', the admin editor) and the Phase 4 inventory-sync bridge
   * (source='inventory', derived from equipment counts). They must never step on
   * each other's rows, so every delete/insert here is strictly scoped to
   * `source = 'manual'`, and any amenity that already has a `source='inventory'`
   * row for this facility is excluded from that delete+reinsert batch entirely —
   * this method never creates, deletes, or touches the quantity/source of an
   * inventory-owned row. The one narrow exception: notes are still admin-editable
   * on an inventory-owned row (the brochure note is not something Phase 4 will
   * ever manage), so those get a separate, explicitly source='inventory'-scoped
   * `UPDATE ... SET notes = ...` that can never affect quantity or source.
   *
   * Amenity names are matched against existing `facility_amenities` rows using a
   * case/format-insensitive comparison (see normalizeAmenityName) so "WiFi",
   * "wifi" and "Wi-Fi" all resolve to the same catalog row instead of spawning
   * duplicates. A brand-new name creates a new `facility_amenities` row.
   */
  async syncManualAmenities(facilityId: string, amenities: ManualAmenityInput[]) {
    const supabase = createAdminClient()

    // 1. Validate & clean every input up front — no partial writes on bad data.
    const cleaned = amenities.map((a) => {
      const name = (a.name || '').trim()
      if (!name) {
        throw new Error('Amenity name is required')
      }
      if (name.length > AMENITY_NAME_MAX_LENGTH) {
        throw new Error(`Amenity name must be ${AMENITY_NAME_MAX_LENGTH} characters or fewer`)
      }

      const quantity = typeof a.quantity === 'string' ? Number(a.quantity) : a.quantity
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
        throw new Error(`Amenity "${name}" quantity must be a whole number of at least 1`)
      }

      const notes = a.notes?.trim() ? a.notes.trim() : null
      if (notes && notes.length > AMENITY_NOTES_MAX_LENGTH) {
        throw new Error(`Amenity "${name}" notes must be ${AMENITY_NOTES_MAX_LENGTH} characters or fewer`)
      }

      return { name, quantity, notes }
    })

    // 2. De-dupe within this submission by normalized name (last write wins).
    const byNormalized = new Map<string, { name: string; quantity: number; notes: string | null }>()
    for (const a of cleaned) {
      byNormalized.set(normalizeAmenityName(a.name), a)
    }
    const deduped = [...byNormalized.values()]

    if (deduped.length === 0) {
      // Nothing to keep — clear this facility's manual rows and leave inventory rows alone.
      const { error: clearError } = await supabase
        .from('facility_amenity_map')
        .delete()
        .eq('facility_id', facilityId)
        .eq('source', 'manual')

      if (clearError) throw new Error(clearError.message)
      return
    }

    // 3. Resolve each name to a facility_amenities.id, matching existing rows by
    //    normalized name before creating a new one.
    const { data: existingAmenities, error: fetchAmenitiesError } = await supabase
      .from('facility_amenities')
      .select('id, name')

    if (fetchAmenitiesError) throw new Error(fetchAmenitiesError.message)

    const catalogByNormalized = new Map<string, { id: string; name: string }>()
    for (const row of existingAmenities || []) {
      catalogByNormalized.set(normalizeAmenityName(row.name), { id: row.id, name: row.name })
    }

    const resolved: { amenityId: string; quantity: number; notes: string | null }[] = []
    for (const a of deduped) {
      const key = normalizeAmenityName(a.name)
      let match = catalogByNormalized.get(key)

      if (!match) {
        const { data: created, error: createError } = await supabase
          .from('facility_amenities')
          .insert({ name: a.name })
          .select('id, name')
          .single()

        if (createError) {
          // Another writer may have created the same (normalized) name concurrently —
          // fall back to looking it up rather than failing the whole sync.
          const { data: raceRow, error: raceFetchError } = await supabase
            .from('facility_amenities')
            .select('id, name')
            .ilike('name', a.name)
            .maybeSingle()

          if (raceFetchError || !raceRow) throw new Error(createError.message)
          match = { id: raceRow.id, name: raceRow.name }
        } else {
          match = { id: created.id, name: created.name }
        }

        catalogByNormalized.set(key, match)
      }

      resolved.push({ amenityId: match.id, quantity: a.quantity, notes: a.notes })
    }

    // 4. Never touch amenities that already have an inventory-owned row for this
    //    facility — the #1 named risk for this phase is clobbering those rows.
    const amenityIds = resolved.map(r => r.amenityId)
    const { data: inventoryRows, error: inventoryFetchError } = await supabase
      .from('facility_amenity_map')
      .select('amenity_id')
      .eq('facility_id', facilityId)
      .eq('source', 'inventory')
      .in('amenity_id', amenityIds)

    if (inventoryFetchError) throw new Error(inventoryFetchError.message)

    const inventoryOwnedIds = new Set((inventoryRows || []).map((r: any) => r.amenity_id))
    const manualRows = resolved.filter(r => !inventoryOwnedIds.has(r.amenityId))
    const inventoryOwnedRows = resolved.filter(r => inventoryOwnedIds.has(r.amenityId))

    // 5. Replace this facility's manual rows — scoped delete, then reinsert.
    //    `AND source = 'manual'` is load-bearing: a bare `eq('facility_id', ...)`
    //    delete would also destroy source='inventory' rows owned by Phase 4.
    const { error: deleteError } = await supabase
      .from('facility_amenity_map')
      .delete()
      .eq('facility_id', facilityId)
      .eq('source', 'manual')

    if (deleteError) throw new Error(deleteError.message)

    if (manualRows.length > 0) {
      const { error: insertError } = await supabase
        .from('facility_amenity_map')
        .insert(
          manualRows.map(r => ({
            facility_id: facilityId,
            amenity_id: r.amenityId,
            quantity: r.quantity,
            notes: r.notes,
            source: 'manual',
          }))
        )

      if (insertError) throw new Error(insertError.message)
    }

    // 6. Notes-only update for inventory-owned rows. This is the one write this
    //    method is allowed to make against a source='inventory' row: only the
    //    `notes` column, scoped by facility_id + amenity_id + source='inventory'
    //    together, so it is architecturally incapable of touching quantity or
    //    source, and can never match (let alone mutate) a manual row.
    if (inventoryOwnedRows.length > 0) {
      const results = await Promise.all(
        inventoryOwnedRows.map(r =>
          supabase
            .from('facility_amenity_map')
            .update({ notes: r.notes })
            .eq('facility_id', facilityId)
            .eq('amenity_id', r.amenityId)
            .eq('source', 'inventory')
        )
      )

      const notesUpdateError = results.find(res => res.error)?.error
      if (notesUpdateError) throw new Error(notesUpdateError.message)
    }
  },

  /**
   * Full amenity catalog (facility_amenities), enriched with whether each amenity
   * is equipment-backed (linked from some equipment_types row via amenity_id).
   * Powers the manual editor's "select existing / add new" combobox.
   */
  async getAmenityCatalog(): Promise<AmenityCatalogEntry[]> {
    const supabase = createAdminClient()

    const [{ data: amenities, error: amenitiesError }, { data: links, error: linksError }] = await Promise.all([
      supabase
        .from('facility_amenities')
        .select('id, name, category, icon')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('equipment_types')
        .select('amenity_id')
        .not('amenity_id', 'is', null),
    ])

    if (amenitiesError) throw new Error(amenitiesError.message)
    if (linksError) throw new Error(linksError.message)

    const equipmentBackedIds = new Set((links || []).map((l: any) => l.amenity_id))

    return (amenities || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      category: a.category ?? null,
      icon: a.icon ?? null,
      isEquipmentBacked: equipmentBackedIds.has(a.id),
    }))
  },

  /**
   * Current facility_amenity_map rows for one facility (both source='manual' and
   * source='inventory'), enriched with the amenity name and equipment-backed flag,
   * for the manual editor to render when opening a facility for edit.
   */
  async getFacilityAmenities(facilityId: string): Promise<FacilityAmenityRow[]> {
    const supabase = createAdminClient()

    const [{ data: rows, error: rowsError }, catalog] = await Promise.all([
      supabase
        .from('facility_amenity_map')
        .select('amenity_id, quantity, notes, source, amenity:facility_amenities(id, name)')
        .eq('facility_id', facilityId),
      this.getAmenityCatalog(),
    ])

    if (rowsError) throw new Error(rowsError.message)

    const equipmentBackedIds = new Set(catalog.filter(c => c.isEquipmentBacked).map(c => c.id))

    return (rows || []).map((r: any) => ({
      amenityId: r.amenity_id,
      name: r.amenity?.name || '',
      quantity: r.quantity,
      notes: r.notes,
      source: r.source,
      isEquipmentBacked: equipmentBackedIds.has(r.amenity_id),
    }))
  },

  /**
   * Get all floors
   */
  async getFloors() {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('floors')
      .select('id, building_id, floor_number, name, description, is_active')
      .eq('is_active', true)
      .order('floor_number', { ascending: true })

    if (error) throw new Error(error.message)

    return (data || []).map((f: any) => ({
      id: f.id,
      buildingId: f.building_id,
      floorNumber: f.floor_number,
      name: f.name,
      description: f.description,
      isActive: f.is_active,
    }))
  },

  /**
   * Get facility types
   */
  async getTypes() {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('facility_types')
      .select('id, name, description')
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)

    return data || []
  },

  /**
   * Get facilities with live occupancy status, amenities, utilization, and upcoming bookings
   */
  async getWithStatus(floorId?: string) {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 8)
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
    const WORKDAY_MINUTES = 600 // 8 AM to 6 PM

    let facilityQuery = supabase
      .from('facilities')
      .select(`
        *,
        floor:floors!facilities_floor_id_fkey(id, name, floor_number),
        facility_type:facility_types!facilities_facility_type_id_fkey(id, name)
      `)
      .neq('status', 'unavailable')
      .order('room_number', { ascending: true })

    if (floorId) {
      facilityQuery = facilityQuery.eq('floor_id', floorId)
    }

    // Run all queries in parallel
    const [
      facilitiesResult,
      currentBookingsResult,
      currentClassesResult,
      amenitiesResult,
      upcomingBookingsResult,
      todayAllBookingsResult,
      todayAllClassesResult,
    ] = await Promise.all([
      facilityQuery,
      // Current bookings (occupying now)
      supabase
        .from('bookings')
        .select(`
          id, start_time, end_time, purpose, event_name, expected_attendees,
          user:users!bookings_user_id_fkey(full_name),
          booking_facilities(facility_id)
        `)
        .eq('booking_date', today)
        .in('current_status', ['approved', 'auto_approved'])
        .lte('start_time', currentTime)
        .gte('end_time', currentTime),
      // Current class schedules
      supabase
        .from('class_schedules')
        .select(`
          id, course_name, section, instructor_name, start_time, end_time,
          facility:facilities!class_schedules_facility_id_fkey(id)
        `)
        .eq('day_of_week', dayOfWeek)
        .lte('start_time', currentTime)
        .gte('end_time', currentTime)
        .lte('effective_start_date', today)
        .gte('effective_end_date', today),
      // All amenities for all facilities
      supabase
        .from('facility_amenity_map')
        .select(`
          facility_id, quantity, notes,
          amenity:facility_amenities(name, icon, category, is_active)
        `),
      // Upcoming bookings (after current time today)
      supabase
        .from('bookings')
        .select(`
          id, start_time, end_time, purpose, event_name, expected_attendees,
          user:users!bookings_user_id_fkey(full_name),
          booking_facilities(facility_id)
        `)
        .eq('booking_date', today)
        .in('current_status', ['approved', 'auto_approved'])
        .gt('start_time', currentTime)
        .order('start_time', { ascending: true }),
      // All today's bookings for utilization
      supabase
        .from('bookings')
        .select(`
          start_time, end_time,
          booking_facilities(facility_id)
        `)
        .eq('booking_date', today)
        .in('current_status', ['approved', 'auto_approved', 'completed']),
      // All today's classes for utilization
      supabase
        .from('class_schedules')
        .select(`
          start_time, end_time,
          facility:facilities!class_schedules_facility_id_fkey(id)
        `)
        .eq('day_of_week', dayOfWeek)
        .lte('effective_start_date', today)
        .gte('effective_end_date', today),
    ])

    if (facilitiesResult.error) throw new Error(facilitiesResult.error.message)

    const facilities = facilitiesResult.data || []
    const currentBookings = currentBookingsResult.data || []
    const currentClasses = currentClassesResult.data || []

    // Build occupied map (bookings take priority over class schedules)
    const occupiedMap = new Map<string, any>()
    for (const b of currentBookings) {
      for (const bf of (b as any).booking_facilities || []) {
        occupiedMap.set(bf.facility_id, { ...b, source: 'booking' })
      }
    }
    for (const cs of currentClasses) {
      const facilityId = (cs.facility as any)?.id
      if (facilityId && !occupiedMap.has(facilityId)) {
        occupiedMap.set(facilityId, { ...cs, source: 'class_schedule' })
      }
    }

    // Build amenity map: facilityId -> FacilityAmenity[]
    const amenityMap = new Map<string, FacilityAmenity[]>()
    for (const row of amenitiesResult.data || []) {
      const amenity = row.amenity as any
      if (!amenity || amenity.is_active === false) continue
      const entry: FacilityAmenity = {
        name: amenity.name,
        displayName: prettifyAmenityName(amenity.name),
        icon: amenity.icon,
        category: amenity.category,
        quantity: row.quantity,
        notes: row.notes ?? null,
      }
      const list = amenityMap.get(row.facility_id) || []
      list.push(entry)
      amenityMap.set(row.facility_id, list)
    }

    // Build upcoming bookings map: facilityId -> FacilityUpcomingBooking[]
    const upcomingMap = new Map<string, FacilityUpcomingBooking[]>()
    for (const b of upcomingBookingsResult.data || []) {
      for (const bf of (b as any).booking_facilities || []) {
        const entry: FacilityUpcomingBooking = {
          id: b.id,
          title: (b as any).event_name || b.purpose || 'Booking',
          requesterName: (b.user as any)?.full_name || 'Unknown',
          startTime: formatTime12h(b.start_time),
          endTime: formatTime12h(b.end_time),
          attendees: (b as any).expected_attendees,
          source: 'booking',
        }
        const list = upcomingMap.get(bf.facility_id) || []
        list.push(entry)
        upcomingMap.set(bf.facility_id, list)
      }
    }

    // Build utilization map: facilityId -> total occupied minutes today
    const utilizationMinutes = new Map<string, number>()
    function addMinutes(facilityId: string, startTime: string, endTime: string) {
      const mins = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime))
      utilizationMinutes.set(facilityId, (utilizationMinutes.get(facilityId) || 0) + mins)
    }
    for (const b of todayAllBookingsResult.data || []) {
      for (const bf of (b as any).booking_facilities || []) {
        addMinutes(bf.facility_id, b.start_time, b.end_time)
      }
    }
    for (const cs of todayAllClassesResult.data || []) {
      const facilityId = (cs.facility as any)?.id
      if (facilityId) addMinutes(facilityId, cs.start_time, cs.end_time)
    }

    // Map facilities to view with all enhanced fields
    return facilities.map((f: any) => {
      const occupant = occupiedMap.get(f.id)
      const view = dbFacilityToView(f)
      const upcoming = (upcomingMap.get(f.id) || []).slice(0, 2)

      if (occupant) {
        const endMinutes = timeToMinutes(occupant.end_time)
        const nowMinutes = now.getHours() * 60 + now.getMinutes()
        const minutesLeft = endMinutes - nowMinutes

        if (occupant.source === 'class_schedule') {
          view.currentActivity = `${occupant.course_name}${occupant.section ? ` (${occupant.section})` : ''}`
          view.currentUser = occupant.instructor_name || ''
        } else {
          view.currentActivity = occupant.purpose || 'In use'
          view.currentUser = (occupant.user as any)?.full_name || ''
        }
        view.timeLeft = minutesLeft > 0 ? `${minutesLeft} min left` : 'Ending soon'
        view.status = 'occupied'
        view.currentStartTime = formatTime12h(occupant.start_time)
        view.currentEndTime = formatTime12h(occupant.end_time)
        view.currentAttendees = occupant.source === 'booking' ? occupant.expected_attendees : null
      }

      // Amenities
      view.amenities = amenityMap.get(f.id) || []

      // Upcoming bookings
      view.upcomingBookings = upcoming

      // Today's utilization
      const usedMins = utilizationMinutes.get(f.id) || 0
      view.todayUtilizationPct = Math.min(100, Math.round((usedMins / WORKDAY_MINUTES) * 100))

      // Next available time
      if (f.status === 'maintenance') {
        view.nextAvailableTime = 'Contact Admin'
      } else if (!occupant) {
        view.nextAvailableTime = 'Available Now'
      } else {
        view.nextAvailableTime = `Today ${formatTime12h(occupant.end_time)}`
      }

      return view
    })
  },
}
