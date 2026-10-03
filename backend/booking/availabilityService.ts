/**
 * Availability Service
 * Checks facility availability for a given date and time range.
 * Layered check: class schedules → approved bookings → facility blocks → operating hours.
 * @module backend/booking/availabilityService
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AvailabilityResponse,
  ConflictCheckResult,
  TimeSlotAvailability,
} from './booking.types'
import { cacheGet, cacheSet, TTL_24H } from '@/lib/cache'

const OPERATING_HOURS = { open: '07:00', close: '21:00' }

type TimeSlotRow = { id: string; label: string; start_time: string; end_time: string; duration_minutes: number }

export async function getTimeSlots(supabase: SupabaseClient): Promise<TimeSlotRow[]> {
  const SLOTS_KEY = 'booking:time_slots'
  const cached = cacheGet<TimeSlotRow[]>(SLOTS_KEY)
  if (cached) return cached

  const { data } = await supabase
    .from('time_slots')
    .select('id, label:slot_label, start_time, end_time, duration_minutes')
    .eq('is_active', true)
    .order('start_time')

  const slots = data ?? []
  cacheSet(SLOTS_KEY, slots, TTL_24H)
  return slots
}

export async function getFacilityAvailability(
  supabase: SupabaseClient,
  facilityId: string,
  date: string,
  userId?: string,
  hideEventDetails?: boolean
): Promise<AvailabilityResponse> {
  const [facility, timeSlots, classConflicts, bookingConflicts, adminBlocks] = await Promise.all([
    supabase
      .from('facilities')
      .select('id, name, buffer_time')
      .eq('id', facilityId)
      .single(),
    supabase
      .from('time_slots')
      .select('id, label:slot_label, start_time, end_time, duration_minutes')
      .eq('is_active', true)
      .order('start_time'),
    getClassConflicts(supabase, facilityId, date),
    getBookingConflicts(supabase, facilityId, date, undefined, userId),
    getAdminBlocks(supabase, facilityId, date),
  ])

  const facilityName = facility.data?.name ?? 'Unknown Facility'
  const bufferMinutes = parseIntervalToMinutes(facility.data?.buffer_time ?? '00:15:00')

  // Build a unified list of blocked ranges
  let blockedRanges: AvailabilityResponse['blocked_ranges'] = [
    ...classConflicts,
    ...bookingConflicts,
    ...adminBlocks,
  ]

  // Non-privileged viewers see generic "Unavailable" — no event names or school event labels
  if (hideEventDetails) {
    blockedRanges = blockedRanges.map(r =>
      r.type === 'booking' && r.reason?.toLowerCase().includes('school')
        ? { ...r, reason: 'This time slot is unavailable', type: 'booking' }
        : r
    )
  }

  // Evaluate each predefined time slot
  const availableSlots: TimeSlotAvailability[] = (timeSlots.data ?? []).map((slot) => {
    const conflict = findConflict(slot.start_time, slot.end_time, blockedRanges, bufferMinutes)
    const outsideHours =
      slot.start_time < OPERATING_HOURS.open || slot.end_time > OPERATING_HOURS.close

    let conflictType: TimeSlotAvailability['conflict_type'] | undefined
    if (outsideHours) conflictType = 'outside_hours'
    else if (conflict?.type === 'class_schedule') conflictType = 'class'
    else if (conflict?.type === 'booking') conflictType = 'booking'
    else if (conflict?.type === 'maintenance') conflictType = 'maintenance'
    else if (conflict?.type === 'admin_block') conflictType = 'admin_block'

    return {
      slot_id: slot.id,
      label: slot.label,
      start_time: slot.start_time,
      end_time: slot.end_time,
      is_available: !conflict && !outsideHours,
      conflict_reason: outsideHours ? 'Outside operating hours' : conflict?.reason,
      conflict_type: conflictType,
    }
  })

  return {
    facility_id: facilityId,
    facility_name: facilityName,
    date,
    operating_hours: OPERATING_HOURS,
    blocked_ranges: blockedRanges,
    available_slots: availableSlots,
  }
}

export async function checkTimeSlotAvailability(
  supabase: SupabaseClient,
  facilityId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<ConflictCheckResult> {
  const [facility, classConflicts, bookingConflicts, adminBlocks] = await Promise.all([
    supabase.from('facilities').select('buffer_time').eq('id', facilityId).single(),
    getClassConflicts(supabase, facilityId, date),
    getBookingConflicts(supabase, facilityId, date, excludeBookingId),
    getAdminBlocks(supabase, facilityId, date),
  ])

  const bufferMinutes = parseIntervalToMinutes(facility.data?.buffer_time ?? '00:15:00')
  const allBlocked = [...classConflicts, ...bookingConflicts, ...adminBlocks]

  const conflict = findConflict(startTime, endTime, allBlocked, bufferMinutes)
  const outsideHours = startTime < OPERATING_HOURS.open || endTime > OPERATING_HOURS.close

  if (outsideHours) {
    return {
      available: false,
      conflicts: [`Outside operating hours (${OPERATING_HOURS.open}–${OPERATING_HOURS.close})`],
    }
  }

  if (conflict) {
    return {
      available: false,
      conflicts: [conflict.reason],
      conflict_details: [{ type: conflict.type, start: conflict.start, end: conflict.end, reason: conflict.reason }],
    }
  }

  return { available: true, conflicts: [] }
}

/**
 * Detects mismatches between existing reservations and recurring schedules.
 * Flags overlapping reservations as 'Conflict' for Academic Head review.
 */
export async function detectReservationScheduleMismatches(
  supabase: SupabaseClient,
  date: string
): Promise<number> {
  const { data: conflicts, error } = await supabase.rpc('detect_reservation_schedule_conflicts', {
    p_date: date
  })

  if (error || !conflicts) return 0

  let flagCount = 0
  for (const conflict of conflicts) {
    // Flag the booking
    const { error: updateError } = await supabase.rpc('update_booking_status', {
      p_booking_id: conflict.booking_id,
      p_new_status: 'flagged',
      p_reason: `System detected conflict with recurring schedule: ${conflict.course_code}`,
      p_metadata: {
        conflict_type: 'class_schedule_overlap',
        schedule_id: conflict.schedule_id,
        course_code: conflict.course_code
      }
    })

    if (!updateError) flagCount++
  }

  return flagCount
}

// =====================================================
// Internal helpers
// =====================================================

interface BlockedRange {
  start: string
  end: string
  reason: string
  type: string
}

async function getClassConflicts(
  supabase: SupabaseClient,
  facilityId: string,
  date: string
): Promise<BlockedRange[]> {
  const dayOfWeek = new Date(date).getDay()
  const conflicts: BlockedRange[] = []

  // 1. Check published class schedules with effective date range
  const { data: publishedSchedules, error: publishedError } = await supabase
    .from('class_schedules')
    .select('course_name, section, start_time, end_time, day_of_week, effective_start_date, effective_end_date')
    .eq('facility_id', facilityId)
    .eq('is_active', true)
    .or(`effective_start_date.is.null,effective_start_date.lte.${date}`)
    .or(`effective_end_date.is.null,effective_end_date.gte.${date}`)

  if (!publishedError && publishedSchedules) {
    conflicts.push(
      ...publishedSchedules
        .filter((cs: Record<string, unknown>) => {
          return (cs.day_of_week as number) === dayOfWeek
        })
        .map((cs: Record<string, string>) => ({
          start: cs.start_time,
          end: cs.end_time,
          reason: `Class Schedule: ${cs.course_name ?? ''} (${cs.section ?? ''})`.trim(),
          type: 'class_schedule',
        }))
    )
  }

  // 2. Check approved staging schedules that haven't been published yet
  const { data: stagingSchedules, error: stagingError } = await supabase
    .from('schedule_entries_staging')
    .select(`
      course_name,
      section,
      start_time,
      end_time,
      day_of_week,
      effective_start_date,
      effective_end_date,
      schedule_uploads!inner(
        batch_effective_date,
        batch_effective_end_date,
        academic_terms!inner(start_date, end_date)
      )
    `)
    .eq('facility_id', facilityId)
    .eq('academic_head_review_status', 'academic_head_approved')
    .eq('is_published', false)
    .not('facility_id', 'is', null)
    .in('validation_status', ['valid', 'warning'])

  if (!stagingError && stagingSchedules) {
    for (const entry of stagingSchedules) {
      if ((entry.day_of_week as number) !== dayOfWeek) continue

      // Determine effective date range (entry → batch → term)
      const upload = Array.isArray(entry.schedule_uploads)
        ? entry.schedule_uploads[0]
        : entry.schedule_uploads
      const term = upload?.academic_terms
        ? Array.isArray(upload.academic_terms)
          ? upload.academic_terms[0]
          : upload.academic_terms
        : null

      const effectiveStart =
        (entry.effective_start_date as string | null) ??
        (upload?.batch_effective_date as string | null) ??
        (term?.start_date as string | null)

      const effectiveEnd =
        (entry.effective_end_date as string | null) ??
        (upload?.batch_effective_end_date as string | null) ??
        (term?.end_date as string | null)

      // Check if booking date falls within effective range
      if (
        effectiveStart &&
        effectiveEnd &&
        date >= effectiveStart &&
        date <= effectiveEnd
      ) {
        conflicts.push({
          start: entry.start_time as string,
          end: entry.end_time as string,
          reason: `Class Schedule: ${(entry.course_name as string) ?? ''} (${(entry.section as string) ?? ''})`.trim(),
          type: 'class_schedule',
        })
      }
    }
  }

  return conflicts
}

async function getBookingConflicts(
  supabase: SupabaseClient,
  facilityId: string,
  date: string,
  excludeBookingId?: string,
  userId?: string
): Promise<BlockedRange[]> {
  let query = supabase
    .from('booking_facilities')
    .select('booking_id, bookings!inner(user_id, start_time, end_time, current_status, booking_reference, booking_type, event_name)')
    .eq('facility_id', facilityId)
    .eq('bookings.booking_date', date)
    .in('bookings.current_status', ['approved', 'auto_approved', 'flagged', 'pending', 'pending_user_response', 'cancellation_requested'])

  if (excludeBookingId) {
    query = query.neq('booking_id', excludeBookingId)
  }

  const { data, error } = await query
  if (error || !data) return []

  return data.map((row: Record<string, unknown>) => {
    const b = row.bookings as Record<string, string>
    const isOwn = userId && b.user_id === userId
    const isSchoolEvent = b.booking_type === 'school_event_block'
    return {
      start: b.start_time,
      end: b.end_time,
      reason: isOwn
        ? "You already have an active booking for this facility at the same date and time"
        : isSchoolEvent
        ? b.event_name
          ? `Reserved for school event: ${b.event_name}`
          : "This time slot is reserved for a school-sanctioned event"
        : "This facility is already reserved by another user at this time",
      type: 'booking',
    }
  })
}

async function getAdminBlocks(
  supabase: SupabaseClient,
  facilityId: string,
  date: string
): Promise<BlockedRange[]> {
  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`

  const { data, error } = await supabase
    .from('facility_blocks')
    .select('start_time, end_time, block_type, reason')
    .eq('facility_id', facilityId)
    .lte('start_time', dayEnd)
    .gte('end_time', dayStart)

  if (error || !data) return []

  return data.map((block: Record<string, string>) => ({
    start: block.start_time.slice(11, 16), // Extract HH:MM from ISO timestamp
    end: block.end_time.slice(11, 16),
    reason: block.block_type === 'event_hold' 
      ? "This time slot is reserved for a school-sanctioned event"
      : block.reason ?? `${block.block_type.replace('_', ' ')}`,
    type: block.block_type === 'maintenance' ? 'maintenance' : 'admin_block',
  }))
}

function findConflict(
  startTime: string,
  endTime: string,
  blocked: BlockedRange[],
  bufferMinutes: number
): BlockedRange | null {
  const bufferedStart = subtractMinutes(startTime, bufferMinutes)
  const bufferedEnd = addMinutes(endTime, bufferMinutes)

  for (const block of blocked) {
    if (timesOverlap(block.start, block.end, bufferedStart, bufferedEnd)) {
      return block
    }
  }
  return null
}

// =====================================================
// Time utility helpers
// =====================================================

function timeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return timeToMinutes(start1) < timeToMinutes(end2) &&
    timeToMinutes(end1) > timeToMinutes(start2)
}

function parseIntervalToMinutes(interval: unknown): number {
  // Handle plain numbers (stored as integer minutes in DB)
  if (typeof interval === 'number') return interval
  // Supabase returns INTERVAL columns as objects like {hours: 0, minutes: 15, seconds: 0}
  if (interval && typeof interval === 'object') {
    const obj = interval as Record<string, number>
    return (obj.hours ?? 0) * 60 + (obj.minutes ?? 0)
  }
  const str = String(interval ?? '00:15:00')
  if (str.includes(':')) {
    const parts = str.split(':').map(Number)
    return parts[0] * 60 + parts[1]
  }
  const match = str.match(/(\d+)/)
  return match ? parseInt(match[1]) : 15
}

function addMinutes(time: string, minutes: number): string {
  const total = timeToMinutes(time) + minutes
  const h = Math.floor(total / 60).toString().padStart(2, '0')
  const m = (total % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function subtractMinutes(time: string, minutes: number): string {
  const total = Math.max(0, timeToMinutes(time) - minutes)
  const h = Math.floor(total / 60).toString().padStart(2, '0')
  const m = (total % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}
