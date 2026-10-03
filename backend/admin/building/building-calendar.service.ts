/**
 * Building Calendar Service
 *
 * Combines bookings, class schedules, and maintenance into unified calendar events.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type { BuildingCalendarEvent } from './building.types'

export const BuildingCalendarService = {
  /**
   * Get combined calendar events for a date range
   */
  async getEvents(startDate: string, endDate: string, facilityId?: string): Promise<BuildingCalendarEvent[]> {
    const supabase = createAdminClient()
    const events: BuildingCalendarEvent[] = []

    // 1. Bookings
    let bookingQuery = supabase
      .from('bookings')
      .select(`
        id, booking_date, start_time, end_time, purpose, current_status, event_name, booking_type,
        requires_payment, event_approval_status,
        booking_facilities(
          facility:facilities(id, name)
        ),
        user:users!bookings_user_id_fkey(id, full_name, email)
      `)
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .in('current_status', ['approved', 'auto_approved', 'pending', 'awaiting_reschedule'])
      // Show all non-payment bookings, external_paid, and internal_paid bookings
      .or('requires_payment.eq.false,booking_type.eq.external_paid,booking_type.eq.internal_paid')

    const { data: bookings, error: bookingsErr } = await bookingQuery
    if (bookingsErr) console.error('[CalendarService] bookings query failed:', bookingsErr.message)

    for (const b of bookings || []) {
      const bf = b.booking_facilities?.[0] as any
      const facility = bf?.facility as { id: string; name: string } | null
      if (facilityId && facility?.id !== facilityId) continue

      let eventType: 'booking' | 'paid_reservation' | 'class_schedule' | 'maintenance' | 'event' | 'pending_event' | 'awaiting_reschedule' = 'booking'
      if (b.booking_type === 'school_event_block') {
        eventType = b.event_approval_status === 'pending' ? 'pending_event' : 'event'
      } else if (b.current_status === 'awaiting_reschedule') {
        eventType = 'awaiting_reschedule'
      } else if (b.booking_type === 'external_paid' || b.booking_type === 'internal_paid' || b.requires_payment === true) {
        eventType = 'paid_reservation'
      }

      const userRaw = Array.isArray(b.user) ? b.user[0] : b.user
      const user = userRaw as { id?: string; full_name?: string | null; email?: string | null } | null

      events.push({
        id: b.id,
        title: b.event_name || b.purpose || 'Booking',
        date: b.booking_date,
        startTime: b.start_time,
        endTime: b.end_time,
        type: eventType,
        facilityName: facility?.name || null,
        status: b.current_status,
        bookingType: b.booking_type,
        bookerName: user?.full_name || null,
      })
    }

    // 2. Class schedules (recurring — map to date range)
    const { data: schedules, error: schedulesErr } = await supabase
      .from('class_schedules')
      .select(`
        id, course_name, section, session_type, instructor_name, day_of_week, start_time, end_time,
        effective_start_date, effective_end_date,
        facility:facilities(id, name)
      `)
      .eq('is_active', true)
      .lte('effective_start_date', endDate)
      .gte('effective_end_date', startDate)
    if (schedulesErr) console.error('[CalendarService] schedules query failed:', schedulesErr.message)

    for (const s of schedules || []) {
      const sFacility = s.facility as unknown as { id: string; name: string } | null
      if (facilityId && sFacility?.id !== facilityId) continue

      // day_of_week is SMALLINT 0-6 in DB (0=Sunday, matches JS Date.getDay())
      const dayNum = typeof s.day_of_week === 'number' ? s.day_of_week : -1
      if (dayNum < 0 || dayNum > 6) continue

      // Generate dates for this schedule within the range
      const start = new Date(Math.max(new Date(startDate).getTime(), new Date(s.effective_start_date).getTime()))
      const end = new Date(Math.min(new Date(endDate).getTime(), new Date(s.effective_end_date).getTime()))

      const current = new Date(start)
      while (current <= end) {
        if (current.getDay() === dayNum) {
          events.push({
            id: `schedule-${s.id}-${current.toISOString().split('T')[0]}`,
            title: `${s.course_name} (${s.section})`,
            date: current.toISOString().split('T')[0],
            startTime: s.start_time,
            endTime: s.end_time,
            type: 'class_schedule',
            facilityName: sFacility?.name || null,
          })
        }
        current.setDate(current.getDate() + 1)
      }
    }

    // 3. Maintenance records
    let maintQuery = supabase
      .from('maintenance_records')
      .select('*')
      .eq('is_active', true)
      .gte('schedule_date', startDate)
      .lte('schedule_date', endDate)
      .in('status', ['scheduled', 'in_progress'])

    const { data: maintenance, error: maintErr } = await maintQuery
    if (maintErr) console.error('[CalendarService] maintenance query failed:', maintErr.message)

    for (const m of maintenance || []) {
      events.push({
        id: m.id,
        title: `Maintenance: ${m.target_name}`,
        date: m.schedule_date,
        startTime: '08:00:00',
        endTime: '17:00:00',
        type: 'maintenance',
        facilityName: m.target_name,
        status: m.status,
      })
    }

    // 4. Facility blocks (admin blocks, event holds)
    let blocksQuery = supabase
      .from('facility_blocks')
      .select(`
        id, block_type, start_time, end_time, reason,
        facility:facilities(id, name)
      `)
      .lte('start_time', `${endDate}T23:59:59`)
      .gte('end_time', `${startDate}T00:00:00`)

    const { data: blocks, error: blocksErr } = await blocksQuery
    if (blocksErr) console.error('[CalendarService] facility_blocks query failed:', blocksErr.message)

    for (const bl of blocks || []) {
      const blFacility = bl.facility as unknown as { id: string; name: string } | null
      if (facilityId && blFacility?.id !== facilityId) continue

      const blockStart = new Date(bl.start_time)
      const blockEnd = new Date(bl.end_time)

      events.push({
        id: bl.id,
        title: `${bl.block_type === 'maintenance' ? 'Maintenance' : bl.block_type === 'event_hold' ? 'School Event' : 'Admin Block'}: ${bl.reason || blFacility?.name || ''}`,
        date: blockStart.toISOString().split('T')[0],
        startTime: bl.start_time.includes('T') ? bl.start_time.split('T')[1].slice(0, 8) : bl.start_time,
        endTime: bl.end_time.includes('T') ? bl.end_time.split('T')[1].slice(0, 8) : bl.end_time,
        type: bl.block_type === 'event_hold' ? 'event' : 'maintenance',
        facilityName: blFacility?.name || null,
        status: bl.block_type,
      })
    }

    return events.sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date)
      return dateComp !== 0 ? dateComp : a.startTime.localeCompare(b.startTime)
    })
  },

  /**
   * Create a new calendar event (facility block)
   */
  async createEvent(payload: {
    title: string
    date: string
    startTime: string
    endTime: string
    facilityId?: string
    reason?: string
    type?: string
  }): Promise<BuildingCalendarEvent> {
    const supabase = createAdminClient()

    const formatTime = (t: string) => (t.length === 5 ? `${t}:00` : t)
    const startDateTime = `${payload.date}T${formatTime(payload.startTime)}`
    const endDateTime = `${payload.date}T${formatTime(payload.endTime)}`

    const { data: block, error: insertErr } = await supabase
      .from('facility_blocks')
      .insert({
        facility_id: payload.facilityId || null,
        start_time: startDateTime,
        end_time: endDateTime,
        block_type: payload.type === 'event' ? 'event_hold' : payload.type === 'maintenance' ? 'maintenance' : 'event_hold',
        reason: payload.reason || payload.title,
      })
      .select(`
        id, block_type, start_time, end_time, reason,
        facility:facilities(id, name)
      `)
      .single()

    if (insertErr) throw new Error(`Failed to create event: ${insertErr.message}`)

    const blockFacility = (block.facility as unknown as { id: string; name: string }) || null

    return {
      id: block.id,
      title: payload.title,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      type: block.block_type === 'event_hold' ? 'event' : 'maintenance',
      facilityName: blockFacility?.name || null,
      status: block.block_type,
    }
  },
}
