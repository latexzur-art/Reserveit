/**
 * Building Dashboard Service
 *
 * Provides aggregate stats, today's bookings, and weekly utilization data
 * for the building admin dashboard.
 */

import { createAdminClient } from '@/lib/supabase/server'

export const BuildingDashboardService = {
  /**
   * Get aggregate dashboard stats
   */
  async getStats() {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 8)

    // Total active facilities
    const { count: totalFacilities } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'unavailable')

    // Total approved bookings
    const { count: totalBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('current_status', 'approved')

    // Today's approved bookings
    const { count: todaysBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('booking_date', today)
      .eq('current_status', 'approved')

    // Currently occupied facilities (bookings happening right now)
    const { data: currentBookings } = await supabase
      .from('bookings')
      .select('id, booking_facilities!inner(facility_id)')
      .eq('booking_date', today)
      .eq('current_status', 'approved')
      .lte('start_time', currentTime)
      .gte('end_time', currentTime)

    const occupiedCount = new Set(
      (currentBookings || []).flatMap((b: any) =>
        (b.booking_facilities || []).map((bf: any) => bf.facility_id)
      )
    ).size

    const utilization = (totalFacilities || 0) > 0
      ? Math.round((occupiedCount / (totalFacilities || 1)) * 100)
      : 0

    // Active users
    const { count: activeUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // Pending approvals: includes pending, flagged, and auto_approved in oversight window
    const { count: pendingCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('current_status', 'pending')

    const { count: flaggedCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('current_status', 'flagged')

    const { count: oversightCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('current_status', 'auto_approved')
      .gte('oversight_expires_at', now.toISOString())

    const pendingApprovals = (pendingCount || 0) + (flaggedCount || 0) + (oversightCount || 0)

    // Status breakdown counts
    const { count: approvedCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('current_status', 'approved')

    const { count: rejectedCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('current_status', 'rejected')

    const { count: cancelledCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('current_status', 'cancelled')

    return {
      totalFacilities: totalFacilities || 0,
      totalBookings: totalBookings || 0,
      todaysBookings: todaysBookings || 0,
      roomUtilization: utilization,
      activeUsers: activeUsers || 0,
      pendingApprovals,
      statusBreakdown: {
        pending: pendingCount || 0,
        flagged: flaggedCount || 0,
        oversight: oversightCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        cancelled: cancelledCount || 0,
      },
    }
  },

  /**
   * Get today's bookings with facility details
   */
  async getTodaysBookings() {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_reference, booking_date, start_time, end_time, current_status, purpose,
        user:users!bookings_user_id_fkey(full_name),
        booking_facilities(
          facility:facilities(id, name, room_number)
        )
      `)
      .eq('booking_date', today)
      .eq('current_status', 'approved')
      .order('start_time', { ascending: true })
      .limit(10)

    if (error) throw new Error(error.message)

    return (data || []).map((b: any) => ({
      id: b.id,
      bookingReference: b.booking_reference,
      date: b.booking_date,
      startTime: b.start_time,
      endTime: b.end_time,
      status: b.current_status,
      requester: b.user?.full_name || 'Unknown',
      facilityName: b.booking_facilities?.[0]?.facility?.name || 'N/A',
      roomNumber: b.booking_facilities?.[0]?.facility?.room_number || '',
    }))
  },

  /**
   * Get weekly booking counts grouped by day
   */
  async getWeeklyUtilization() {
    const supabase = createAdminClient()
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const mondayStr = monday.toISOString().split('T')[0]
    const sundayStr = sunday.toISOString().split('T')[0]

    // Single query for the entire week
    const { data: weekBookings, error } = await supabase
      .from('bookings')
      .select('booking_date')
      .in('current_status', ['approved', 'auto_approved', 'completed'])
      .gte('booking_date', mondayStr)
      .lte('booking_date', sundayStr)

    if (error) throw new Error(error.message)

    // Count bookings per day
    const countByDate = new Map<string, number>()
    for (const b of weekBookings || []) {
      countByDate.set(b.booking_date, (countByDate.get(b.booking_date) || 0) + 1)
    }

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days.map((day, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      return { day, Bookings: countByDate.get(dateStr) || 0 }
    })
  },

  /**
   * Get upcoming maintenance records
   */
  async getUpcomingMaintenance() {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'scheduled')
      .gte('schedule_date', today)
      .order('schedule_date', { ascending: true })
      .limit(5)

    if (error) throw new Error(error.message)

    return (data || []).map((m: any) => ({
      id: m.id,
      type: m.type,
      item: m.target_name,
      scheduleDate: m.schedule_date,
      status: m.status,
    }))
  },

  /**
   * Get facility status overview (currently occupied)
   */
  async getFacilityStatusOverview() {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 8)

    // Get all active bookings happening right now
    const { data: currentBookings } = await supabase
      .from('bookings')
      .select(`
        id, start_time, end_time, purpose,
        user:users!bookings_user_id_fkey(full_name),
        booking_facilities(
          facility:facilities(id, name, room_number)
        )
      `)
      .eq('booking_date', today)
      .eq('current_status', 'approved')
      .lte('start_time', currentTime)
      .gte('end_time', currentTime)

    return (currentBookings || []).map((b: any) => {
      const facility = b.booking_facilities?.[0]?.facility
      // Calculate time left
      const endParts = b.end_time.split(':')
      const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1])
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      const minutesLeft = endMinutes - nowMinutes

      return {
        id: facility?.id || b.id,
        roomNumber: facility?.room_number || '',
        name: facility?.name || 'Unknown',
        status: 'Occupied',
        currentActivity: b.purpose || 'In use',
        currentUser: b.user?.full_name || '',
        timeLeft: minutesLeft > 0 ? `${minutesLeft} min left` : 'Ending soon',
      }
    })
  },

  /**
   * Get booking dates for a given month (for mini calendar)
   */
  async getMonthBookingDates(year: number, month: number) {
    const supabase = createAdminClient()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

    const { data, error } = await supabase
      .from('bookings')
      .select('booking_date')
      .eq('current_status', 'approved')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)

    if (error) throw new Error(error.message)

    // Return unique dates
    const dates = [...new Set((data || []).map((b: any) => b.booking_date))]
    return dates
  },
}
