/**
 * Suggestion Engine
 * Returns up to 3 alternative rooms, time slots, or dates
 * when a hard constraint fails but is reroutable.
 * @module backend/booking/suggestionEngine
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlternativeSuggestion, BookingContext } from './booking.types'
import { checkTimeSlotAvailability, getTimeSlots } from './availabilityService'

export async function getSuggestions(
  supabase: SupabaseClient,
  failedCode: string,
  booking: BookingContext
): Promise<AlternativeSuggestion[]> {
  switch (failedCode) {
    case 'BOOKING_CONFLICT':
    case 'CLASS_CONFLICT':
    case 'BUFFER_VIOLATION':
    case 'UNDER_MAINTENANCE':
    case 'ADMIN_BLOCK':
      return suggestAlternativeRooms(supabase, booking)

    case 'CAPACITY_EXCEEDED':
      return suggestLargerRooms(supabase, booking)

    case 'OUTSIDE_HOURS':
      return suggestValidTimeSlots(supabase, booking)

    case 'EXAM_PERIOD_BLOCK':
    case 'ENROLLMENT_BLOCK':
      return suggestAlternativeDates(supabase, booking)

    case 'PURPOSE_MISMATCH':
      return suggestMatchingFacilities(supabase, booking)

    case 'EVENT_IN_CLASSROOM':
      return suggestEventVenues(supabase, booking)

    default:
      return []
  }
}

// =====================================================
// Alternative room suggestions (same capacity range, nearest floor)
// =====================================================

async function suggestAlternativeRooms(
  supabase: SupabaseClient,
  booking: BookingContext
): Promise<AlternativeSuggestion[]> {
  const { data: currentFacility } = await supabase
    .from('facilities')
    .select('capacity, floor_id, floors!inner(floor_number, building_id), facility_type_id')
    .eq('id', booking.facility_id)
    .single()

  if (!currentFacility) return []

  const minCapacity = booking.expected_attendees ?? 1
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfFloors = (currentFacility as any).floors
  const cfFloor = Array.isArray(cfFloors) ? cfFloors[0] : cfFloors
  const currentFloor = cfFloor?.floor_number ?? 0
  const buildingId = cfFloor?.building_id

  const { data: candidates } = await supabase
    .from('facilities')
    .select('id, name, capacity, floors!inner(floor_number, building_id, buildings!inner(name))')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('facility_type_id', (currentFacility as any).facility_type_id)
    .eq('status', 'available')
    .gte('capacity', minCapacity)
    .neq('id', booking.facility_id)
    .limit(10)

  if (!candidates) return []

  // Check availability and sort by proximity
  const available: (AlternativeSuggestion & { floorDiff: number })[] = []

  for (const facility of candidates) {
    const check = await checkTimeSlotAvailability(
      supabase,
      facility.id,
      booking.booking_date,
      booking.start_time,
      booking.end_time
    )

    if (check.available) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fFloors = (facility as any).floors
      const fFloor = Array.isArray(fFloors) ? fFloors[0] : fFloors
      const floor = fFloor?.floor_number ?? 0
      const sameBuilding = fFloor?.building_id === buildingId
      const floorDiff = Math.abs(floor - currentFloor) + (sameBuilding ? 0 : 100)
      const buildings = fFloor?.buildings
      const buildingObj = Array.isArray(buildings) ? buildings[0] : buildings

      available.push({
        type: 'room',
        facility_id: facility.id,
        facility_name: facility.name,
        capacity: facility.capacity,
        floor_number: floor,
        building_name: buildingObj?.name,
        reason: `Available ${sameBuilding ? 'nearby' : 'alternative'} room`,
        floorDiff,
      })
    }

    if (available.length >= 3) break
  }

  return available
    .sort((a, b) => a.floorDiff - b.floorDiff)
    .slice(0, 3)
    .map(({ floorDiff: _fd, ...s }) => s)
}

// =====================================================
// Larger room suggestions (capacity > requested)
// =====================================================

async function suggestLargerRooms(
  supabase: SupabaseClient,
  booking: BookingContext
): Promise<AlternativeSuggestion[]> {
  const { data: candidates } = await supabase
    .from('facilities')
    .select('id, name, capacity, floors!inner(floor_number, buildings!inner(name))')
    .gte('capacity', booking.expected_attendees ?? 1)
    .eq('status', 'available')
    .neq('id', booking.facility_id)
    .order('capacity', { ascending: true })
    .limit(10)

  const available: AlternativeSuggestion[] = []

  for (const facility of candidates ?? []) {
    const check = await checkTimeSlotAvailability(
      supabase,
      facility.id,
      booking.booking_date,
      booking.start_time,
      booking.end_time
    )

    if (check.available) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fFloors = (facility as any).floors
      const fFloor = Array.isArray(fFloors) ? fFloors[0] : fFloors
      const buildings = fFloor?.buildings
      const buildingObj = Array.isArray(buildings) ? buildings[0] : buildings
      available.push({
        type: 'room',
        facility_id: facility.id,
        facility_name: facility.name,
        capacity: facility.capacity,
        floor_number: fFloor?.floor_number,
        building_name: buildingObj?.name,
        reason: `Larger room (capacity: ${facility.capacity})`,
      })
    }

    if (available.length >= 3) break
  }

  return available
}

// =====================================================
// Valid time slot suggestions (today, same facility)
// =====================================================

async function suggestValidTimeSlots(
  supabase: SupabaseClient,
  booking: BookingContext
): Promise<AlternativeSuggestion[]> {
  const allSlots = await getTimeSlots(supabase)
  const slots = allSlots.filter(s => s.start_time >= '07:00' && s.end_time <= '21:00')

  const available: AlternativeSuggestion[] = []

  for (const slot of slots) {
    const check = await checkTimeSlotAvailability(
      supabase,
      booking.facility_id,
      booking.booking_date,
      slot.start_time,
      slot.end_time
    )

    if (check.available) {
      available.push({
        type: 'time_slot',
        facility_id: booking.facility_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        date: booking.booking_date,
        reason: `Available slot: ${slot.label}`,
      })
    }

    if (available.length >= 3) break
  }

  return available
}

// =====================================================
// Alternative dates (after blocked period)
// =====================================================

async function suggestAlternativeDates(
  supabase: SupabaseClient,
  booking: BookingContext
): Promise<AlternativeSuggestion[]> {
  const suggestions: AlternativeSuggestion[] = []
  const startDate = new Date(booking.booking_date)
  startDate.setDate(startDate.getDate() + 1)

  for (let i = 0; i < 14 && suggestions.length < 3; i++) {
    const candidateDate = new Date(startDate)
    candidateDate.setDate(startDate.getDate() + i)
    const dateStr = candidateDate.toISOString().split('T')[0]

    const check = await checkTimeSlotAvailability(
      supabase,
      booking.facility_id,
      dateStr,
      booking.start_time,
      booking.end_time
    )

    if (check.available) {
      suggestions.push({
        type: 'date',
        facility_id: booking.facility_id,
        date: dateStr,
        start_time: booking.start_time,
        end_time: booking.end_time,
        reason: `Available on ${dateStr}`,
      })
    }
  }

  return suggestions
}

// =====================================================
// Purpose-matching facility suggestions
// =====================================================

async function suggestMatchingFacilities(
  supabase: SupabaseClient,
  booking: BookingContext
): Promise<AlternativeSuggestion[]> {
  const { data: candidates } = await supabase
    .from('facilities')
    .select('id, name, capacity, facility_types!inner(name, booking_rules), floors!inner(floor_number)')
    .eq('status', 'available')
    .gte('capacity', booking.expected_attendees ?? 1)
    .neq('id', booking.facility_id)
    .limit(10)

  const available: AlternativeSuggestion[] = []

  for (const facility of candidates ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ftRaw = (facility as any).facility_types
    const ft = Array.isArray(ftRaw) ? ftRaw[0] : ftRaw
    const bookingRules = (ft?.booking_rules ?? null) as Record<string, unknown> | null
    const allowedPurposes = (bookingRules?.allowed_purposes as string[] | null) ?? []

    if (allowedPurposes.length > 0 && !allowedPurposes.includes(booking.booking_purpose)) continue

    const check = await checkTimeSlotAvailability(
      supabase,
      facility.id,
      booking.booking_date,
      booking.start_time,
      booking.end_time
    )

    if (check.available) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fFloors = (facility as any).floors
      const fFloor = Array.isArray(fFloors) ? fFloors[0] : fFloors
      available.push({
        type: 'room',
        facility_id: facility.id,
        facility_name: facility.name,
        capacity: facility.capacity,
        floor_number: fFloor?.floor_number,
        reason: `Allows ${booking.booking_purpose} bookings`,
      })
    }

    if (available.length >= 3) break
  }

  return available
}

// =====================================================
// Event venue suggestions (MPH, Auditorium, Library, 5th floor)
// =====================================================

async function suggestEventVenues(
  supabase: SupabaseClient,
  booking: BookingContext
): Promise<AlternativeSuggestion[]> {
  const { data: candidates } = await supabase
    .from('facilities')
    .select('id, name, capacity, facility_types!inner(name), floors!inner(floor_number)')
    .eq('status', 'available')
    .gte('capacity', booking.expected_attendees ?? 1)

  const eventKeywords = ['mph', 'multi', 'auditorium', 'library', 'function']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventFacilities = (candidates ?? []).filter((f: any) => {
    const ftRaw = f.facility_types
    const ft = Array.isArray(ftRaw) ? ftRaw[0] : ftRaw
    const typeName = (ft?.name ?? '').toLowerCase()
    const fname = (f.name ?? '').toLowerCase()
    const fFloors = f.floors
    const fFloor = Array.isArray(fFloors) ? fFloors[0] : fFloors
    const floorNum = fFloor?.floor_number
    return (
      eventKeywords.some((kw) => typeName.includes(kw) || fname.includes(kw)) ||
      floorNum === 5
    )
  })

  const available: AlternativeSuggestion[] = []

  for (const facility of eventFacilities.slice(0, 10)) {
    const check = await checkTimeSlotAvailability(
      supabase,
      facility.id,
      booking.booking_date,
      booking.start_time,
      booking.end_time
    )

    if (check.available) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fFloors = (facility as any).floors
      const fFloor = Array.isArray(fFloors) ? fFloors[0] : fFloors
      available.push({
        type: 'room',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        facility_id: (facility as any).id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        facility_name: (facility as any).name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capacity: (facility as any).capacity,
        floor_number: fFloor?.floor_number,
        reason: 'Designated event venue',
      })
    }

    if (available.length >= 3) break
  }

  return available
}
