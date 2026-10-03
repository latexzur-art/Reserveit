/**
 * Building Reports Service
 *
 * Aggregates data for the reports & analytics page.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { sanitizeSearch, dbTransactionToView, type PaymentFilters, type BuildingTransaction } from './building.types'

/**
 * Shared inputs for prescriptive insights. Fetched once and reused by
 * getAnalyticsBundle so these three (multi-query) calls don't run twice per request.
 * Only the fields consumed by the rules engine are declared; the real objects
 * (richer) satisfy this structurally.
 */
interface PrescriptiveInputs {
  forecast: { maxCapacity: number; forecastedPeak: number }
  yieldData: Array<{ id: string; name: string; utilization: number; bookings: number }>
  maintenance: Array<{ id: string; name: string; wearPercent: number }>
}

export const BuildingReportsService = {
  /**
   * Get report stats
   */
  async getStats() {
    const supabase = createAdminClient()

    // Total bookings
    const { count: totalBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })

    // Completed bookings
    const { count: completedBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('current_status', 'completed')

    // Total revenue from completed payments
    const { data: revenueData } = await supabase
      .from('payments')
      .select('amount')
      .eq('payment_status', 'completed')

    const totalRevenue = (revenueData || []).reduce(
      (sum: number, p: { amount: number | null }) => sum + (p.amount || 0),
      0,
    )

    // Utilization: recent approved bookings / total possible slots (simplified)
    const { count: totalFacilities } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'unavailable')

    // Rough utilization: approved bookings in last 30 days / (facilities * 30 days * avg 8 slots)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: recentBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .in('current_status', ['approved', 'completed'])
      .gte('booking_date', thirtyDaysAgo.toISOString().split('T')[0])

    const possibleSlots = (totalFacilities || 1) * 30 * 8
    const avgUtilization = possibleSlots > 0
      ? Math.round(((recentBookings || 0) / possibleSlots) * 100)
      : 0

    const completionRate = (totalBookings || 0) > 0
      ? Math.round(((completedBookings || 0) / (totalBookings || 1)) * 100)
      : 0

    return {
      totalBookings: totalBookings || 0,
      totalRevenue,
      avgUtilization: Math.min(avgUtilization, 100),
      completionRate,
    }
  },

  /**
   * Get payment logs with filters
   */
  async getPayments(filters?: PaymentFilters) {
    const supabase = createAdminClient()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('payments')
      .select(`
        *,
        user:users!payments_user_id_fkey(id, full_name, email),
        qr_code:payment_qr_codes(label, account_name, account_number),
        booking:bookings!payments_booking_id_fkey(
          id, booking_reference, booking_date,
          booking_facilities(
            facility:facilities(id, name)
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (filters?.status) {
      query = query.eq('payment_status', filters.status)
    }

    if (filters?.method) {
      query = query.eq('payment_method', filters.method)
    }

    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    if (filters?.search) {
      const s = sanitizeSearch(filters.search)
      query = query.or(
        `payment_reference.ilike.%${s}%`
      )
    }

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    const { data: refundRows } = await supabase.from('payment_refunds').select('amount')
    const totalRefunded = (refundRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0)

    return {
      transactions: (data || []).map(dbTransactionToView),
      total: count || 0,
      totalRefunded,
    }
  },

  /**
   * Get system/audit logs
   */
  async getSystemLogs(filters?: {
    search?: string
    action?: string
    page?: number
    pageSize?: number
  }) {
    const supabase = createAdminClient()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        actor:users!audit_logs_actor_id_fkey(id, full_name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (filters?.action) {
      query = query.eq('action', filters.action)
    }

    if (filters?.search) {
      const s = sanitizeSearch(filters.search)
      query = query.or(
        `action.ilike.%${s}%,target_type.ilike.%${s}%`
      )
    }

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    type AuditLogRow = {
      id: string
      actor_id: string | null
      actor: { full_name: string | null; email: string | null } | null
      action: string
      target_type: string | null
      target_id: string | null
      details: unknown
      created_at: string
    }

    return {
      logs: ((data || []) as unknown as AuditLogRow[]).map((l) => ({
        id: l.id,
        actorId: l.actor_id,
        actorName: l.actor?.full_name || 'System',
        actorEmail: l.actor?.email || '',
        action: l.action,
        targetType: l.target_type,
        targetId: l.target_id,
        details: l.details,
        createdAt: l.created_at,
      })),
      total: count || 0,
    }
  },

  /**
   * Create a payment log entry
   */
  async createPaymentLog(payload: {
    bookingRef: string
    amount: number
    paymentMethod: string
    paymentStatus?: string
  }): Promise<BuildingTransaction> {
    const supabase = createAdminClient()

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference')
      .eq('booking_reference', payload.bookingRef)
      .single()

    if (bookingErr || !booking) {
      throw new Error(`Booking ${payload.bookingRef} not found`)
    }

    const { data: payment, error: insertErr } = await supabase
      .from('payments')
      .insert({
        booking_id: booking.id,
        user_id: booking.user_id,
        amount: payload.amount,
        currency: 'PHP',
        payment_method: payload.paymentMethod,
        payment_status: payload.paymentStatus || 'completed',
        payment_reference: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      })
      .select(`
        *,
        user:users!payments_user_id_fkey(id, full_name, email),
        booking:bookings!payments_booking_id_fkey(
          id, booking_reference, booking_date,
          booking_facilities(
            facility:facilities(id, name)
          )
        )
      `)
      .single()

    if (insertErr) throw new Error(`Failed to create payment: ${insertErr.message}`)

    return dbTransactionToView(payment)
  },

  /**
   * Get chart data for reports
   */
  async getChartData() {
    const supabase = createAdminClient()
    const currentYear = new Date().getFullYear()

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Initialize monthly trends with zeros
    type TrendRow = { name: string; internal: number; external: number; total: number }
    const bookingTrendsMap = monthNames.reduce<Record<string, TrendRow>>((acc, month) => {
      acc[month] = { name: month, internal: 0, external: 0, total: 0 }
      return acc
    }, {})

    // Booking trends by month (12 months, current year)
    const { data: bookingsByMonth } = await supabase
      .from('bookings')
      .select('booking_date, booking_type')
      .gte('booking_date', `${currentYear}-01-01`)
      .lte('booking_date', `${currentYear}-12-31`)
      .in('current_status', ['approved', 'completed'])

    for (const b of bookingsByMonth || []) {
      const month = new Date(b.booking_date).getMonth()
      const monthName = monthNames[month]
      if (monthName in bookingTrendsMap) {
        bookingTrendsMap[monthName].total++
        if (b.booking_type === 'internal') {
          bookingTrendsMap[monthName].internal++
        } else {
          bookingTrendsMap[monthName].external++
        }
      }
    }

    const bookingTrends = monthNames.map(m => bookingTrendsMap[m])

    // Revenue trends
    type RevenueRow = { name: string; revenue: number }
    const revenueTrendsMap = monthNames.reduce<Record<string, RevenueRow>>((acc, month) => {
      acc[month] = { name: month, revenue: 0 }
      return acc
    }, {})

    const { data: paymentsByMonth } = await supabase
      .from('payments')
      .select('created_at, amount')
      .eq('payment_status', 'completed')
      .gte('created_at', `${currentYear}-01-01`)
      .lte('created_at', `${currentYear}-12-31`)

    for (const p of paymentsByMonth || []) {
      const month = new Date(p.created_at).getMonth()
      const monthName = monthNames[month]
      if (monthName in revenueTrendsMap) {
        revenueTrendsMap[monthName].revenue += p.amount || 0
      }
    }

    const revenueTrends = monthNames.map(m => revenueTrendsMap[m])

    // Peak hours (7AM-6PM)
    const peakHoursMap: Record<string, { hour: string; usage: number }> = {}
    for (let h = 7; h <= 18; h++) {
      const hour = `${String(h).padStart(2, '0')}:00`
      peakHoursMap[hour] = { hour, usage: 0 }
    }

    const { data: bookingsByTime } = await supabase
      .from('bookings')
      .select('start_time')
      .in('current_status', ['approved', 'completed'])

    for (const b of bookingsByTime || []) {
      const hourStr = b.start_time.substring(0, 2)
      const hour = parseInt(hourStr)
      if (hour >= 7 && hour <= 18) {
        const hourKey = `${String(hour).padStart(2, '0')}:00`
        if (hourKey in peakHoursMap) {
          peakHoursMap[hourKey].usage++
        }
      }
    }

    const peakHours = Object.values(peakHoursMap)

    // Facility utilization (top 10)
    const { data: facilityBookingCounts } = await supabase
      .from('booking_facilities')
      .select('facility:facilities(id, name)')
      .limit(10)

    type FacilityRef = { id: string; name: string } | null
    const facilityCountMap: Record<string, { name: string; bookings: number }> = {}
    for (const bf of facilityBookingCounts || []) {
      const fac = bf.facility as unknown as FacilityRef
      if (fac) {
        if (!facilityCountMap[fac.id]) {
          facilityCountMap[fac.id] = { name: fac.name, bookings: 0 }
        }
        facilityCountMap[fac.id].bookings++
      }
    }

    const facilityUtilization = Object.values(facilityCountMap)
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 10)

    // Facility types distribution
    const { data: facilityTypeData } = await supabase
      .from('facilities')
      .select('facility_type_id, facility_type:facility_types(id, name)')

    type FacilityTypeRef = { id: string; name: string } | null
    const typeCountMap: Record<string, { name: string; value: number }> = {}
    for (const f of facilityTypeData || []) {
      const type = f.facility_type as unknown as FacilityTypeRef
      if (type) {
        if (!typeCountMap[type.id]) {
          typeCountMap[type.id] = { name: type.name, value: 0 }
        }
        typeCountMap[type.id].value++
      }
    }

    const facilityTypes = Object.values(typeCountMap)

    // Booking type distribution
    const { count: internalCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('booking_type', 'internal')
      .in('current_status', ['approved', 'completed'])

    const { count: externalCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('booking_type', 'external')
      .in('current_status', ['approved', 'completed'])

    const bookingTypeDistribution = [
      { name: 'Internal', value: internalCount || 0 },
      { name: 'External', value: externalCount || 0 },
    ]

    return {
      bookingTrends,
      revenueTrends,
      peakHours,
      facilityUtilization,
      facilityTypes,
      bookingTypeDistribution,
    }
  },

  // ===========================================================
  // ADVANCED ANALYTICS SUITE
  // Phases 1-4: Descriptive → Diagnostic → Predictive → Prescriptive
  // ===========================================================

  /**
   * Phase 1.1 — Facility Capacity Heatmap
   * 7-day × 15-hour density grid (Mon–Sun, 07:00–21:00).
   * Density % = overlapping bookings in that hour / total active facilities.
   */
  async getFacilityHeatmapAnalytics() {
    const supabase = createAdminClient()
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const HOUR_START = 7
    const HOUR_END = 21 // exclusive upper edge → 15 hour buckets (7..21)
    const HOUR_COUNT = HOUR_END - HOUR_START

    const { count: totalFacilities } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'unavailable')

    const denom = Math.max(1, totalFacilities || 1)

    const { data: bookings } = await supabase
      .from('bookings')
      .select('booking_date, start_time, end_time, current_status')
      .in('current_status', ['approved', 'completed'])

    // counts[day][hour]
    const counts: number[][] = Array.from({ length: 7 }, () => Array(HOUR_COUNT).fill(0))

    for (const b of bookings || []) {
      if (!b.booking_date || !b.start_time || !b.end_time) continue
      const day = new Date(`${b.booking_date}T00:00:00`).getDay()
      const startH = parseInt(String(b.start_time).slice(0, 2), 10)
      const endH = parseInt(String(b.end_time).slice(0, 2), 10)
      const endMin = parseInt(String(b.end_time).slice(3, 5), 10)
      const inclusiveEndH = endMin > 0 ? endH : endH - 1
      for (let h = startH; h <= inclusiveEndH; h++) {
        if (h >= HOUR_START && h < HOUR_END) {
          counts[day][h - HOUR_START]++
        }
      }
    }

    const cells: Array<{ day: string; hour: string; density: number; count: number }> = []
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < HOUR_COUNT; h++) {
        cells.push({
          day: DAY_NAMES[d],
          hour: `${String(h + HOUR_START).padStart(2, '0')}:00`,
          count: counts[d][h],
          density: Math.min(100, Math.round((counts[d][h] / denom) * 100)),
        })
      }
    }
    return cells
  },

  /**
   * Phase 1.2 — Departmental Resource Allocation
   * Booking counts grouped by department.
   */
  async getDepartmentalUsage() {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('bookings')
      .select('id, user:users!bookings_user_id_fkey(department:departments!users_department_id_fkey(id, name, code))')
      .in('current_status', ['approved', 'completed'])

    if (error) throw new Error(error.message)

    type DeptRow = { id: string; user: { department: { id: string; name: string; code: string } | null } | null }
    const map = new Map<string, { name: string; value: number }>()
    for (const row of (data || []) as unknown as DeptRow[]) {
      const dept = row.user?.department
      const key = dept?.id || 'unassigned'
      const name = dept?.name || 'Unassigned'
      const prev = map.get(key)
      if (prev) prev.value++
      else map.set(key, { name, value: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  },

  /**
   * Phase 2 — Opportunity Cost & Yield Analyzer
   * Per-facility utilization % and "ghost rate" (cancelled/no-show within 24h of start).
   */
  async getYieldAnalytics() {
    const supabase = createAdminClient()
    const POTENTIAL_HOURS_PER_MONTH = 10 * 22 // 10h/day × 22 working days

    const { data: facilities } = await supabase
      .from('facilities')
      .select('id, name, status')
      .neq('status', 'unavailable')

    const { data: bookingFacilities } = await supabase
      .from('booking_facilities')
      .select(`
        facility_id,
        booking:bookings!inner(
          id, booking_date, start_time, end_time, current_status,
          cancelled_at, submitted_at
        )
      `)

    type Agg = { hours: number; total: number; ghost: number }
    const byFacility = new Map<string, Agg>()
    for (const f of facilities || []) {
      byFacility.set(f.id, { hours: 0, total: 0, ghost: 0 })
    }

    type BfRow = {
      facility_id: string
      booking: {
        id: string
        booking_date: string
        start_time: string
        end_time: string
        current_status: string
        cancelled_at: string | null
        submitted_at: string | null
      } | null
    }
    for (const bf of (bookingFacilities || []) as unknown as BfRow[]) {
      const agg = byFacility.get(bf.facility_id)
      if (!agg) continue
      const b = bf.booking
      if (!b) continue
      agg.total++

      if (b.current_status === 'approved' || b.current_status === 'completed') {
        const startH = parseInt(String(b.start_time).slice(0, 2), 10)
        const startM = parseInt(String(b.start_time).slice(3, 5), 10)
        const endH = parseInt(String(b.end_time).slice(0, 2), 10)
        const endM = parseInt(String(b.end_time).slice(3, 5), 10)
        const hours = (endH + endM / 60) - (startH + startM / 60)
        if (hours > 0) agg.hours += hours
      }

      if (b.current_status === 'cancelled' && b.cancelled_at && b.booking_date && b.start_time) {
        const startMs = new Date(`${b.booking_date}T${b.start_time}`).getTime()
        const cancelMs = new Date(b.cancelled_at).getTime()
        if (Number.isFinite(startMs) && Number.isFinite(cancelMs) && startMs - cancelMs <= 24 * 60 * 60 * 1000) {
          agg.ghost++
        }
      }
    }

    const result = (facilities || []).map(f => {
      const agg = byFacility.get(f.id) || { hours: 0, total: 0, ghost: 0 }
      const utilization = Math.min(100, Math.round((agg.hours / POTENTIAL_HOURS_PER_MONTH) * 100))
      const ghostRate = agg.total > 0 ? Math.round((agg.ghost / agg.total) * 100) : 0
      return { id: f.id, name: f.name, utilization, ghostRate, bookings: agg.total }
    })

    return result.sort((a, b) => b.utilization - a.utilization)
  },

  /**
   * Phase 3.1 — Time-Series Capacity Forecasting
   * Last 6 months of booking volume + 2-month Simple Moving Average projection.
   */
  async getCapacityForecast() {
    const supabase = createAdminClient()
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const { data } = await supabase
      .from('bookings')
      .select('booking_date')
      .in('current_status', ['approved', 'completed'])
      .gte('booking_date', start.toISOString().slice(0, 10))

    const buckets: { name: string; volume: number | null; forecast: number | null }[] = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      buckets.push({ name: `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, volume: 0, forecast: null })
    }

    for (const b of data || []) {
      const d = new Date(b.booking_date)
      const idx = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth())
      if (idx >= 0 && idx < buckets.length) buckets[idx].volume = (buckets[idx].volume || 0) + 1
    }

    // Simple 3-month moving average for forecast
    const sma = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length)
    const last3 = buckets.slice(-3).map(b => b.volume || 0)
    const f1 = Math.round(sma(last3))
    const last3b = [...last3.slice(1), f1]
    const f2 = Math.round(sma(last3b))

    // Connect forecast visually: last historical point also gets a forecast value
    if (buckets.length > 0) buckets[buckets.length - 1].forecast = buckets[buckets.length - 1].volume

    const lastDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const next1 = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1)
    const next2 = new Date(lastDate.getFullYear(), lastDate.getMonth() + 2, 1)
    buckets.push({ name: `${monthNames[next1.getMonth()]} '${String(next1.getFullYear()).slice(2)}`, volume: null, forecast: f1 })
    buckets.push({ name: `${monthNames[next2.getMonth()]} '${String(next2.getFullYear()).slice(2)}`, volume: null, forecast: f2 })

    // Max capacity reference line: assume 10h/day × 22 days × #facilities (matches yield potential)
    const { count: totalFacilities } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'unavailable')

    const maxCapacity = Math.max(1, (totalFacilities || 1)) * 22 // rough monthly booking cap

    return { series: buckets, maxCapacity, forecastedPeak: Math.max(f1, f2) }
  },

  /**
   * Phase 3.2 — Predictive Wear-and-Tear Maintenance
   * Cumulative completed hours ÷ max_safe_hours, gated to facilities that opted in.
   */
  async getMaintenancePredictors() {
    const supabase = createAdminClient()

    const { data: facilities } = await supabase
      .from('facilities')
      .select('id, name, max_safe_hours')
      .not('max_safe_hours', 'is', null)

    if (!facilities || facilities.length === 0) return []

    const ids = facilities.map(f => f.id)

    const { data: rows } = await supabase
      .from('booking_facilities')
      .select(`
        facility_id,
        booking:bookings!inner(start_time, end_time, current_status)
      `)
      .in('facility_id', ids)

    type MaintRow = {
      facility_id: string
      booking: { start_time: string; end_time: string; current_status: string } | null
    }
    const byFacility = new Map<string, number>()
    for (const r of (rows || []) as unknown as MaintRow[]) {
      const b = r.booking
      if (!b || b.current_status !== 'completed') continue
      const startH = parseInt(String(b.start_time).slice(0, 2), 10)
      const startM = parseInt(String(b.start_time).slice(3, 5), 10)
      const endH = parseInt(String(b.end_time).slice(0, 2), 10)
      const endM = parseInt(String(b.end_time).slice(3, 5), 10)
      const hours = (endH + endM / 60) - (startH + startM / 60)
      if (hours > 0) byFacility.set(r.facility_id, (byFacility.get(r.facility_id) || 0) + hours)
    }

    return facilities.map(f => {
      const cumulative = byFacility.get(f.id) || 0
      const maxHours = f.max_safe_hours || 0
      const wearPercent = maxHours > 0 ? Math.min(100, Math.round((cumulative / maxHours) * 100)) : 0
      return {
        id: f.id,
        name: f.name,
        cumulativeHours: Math.round(cumulative),
        maxSafeHours: maxHours,
        wearPercent,
      }
    }).sort((a, b) => b.wearPercent - a.wearPercent)
  },

  /** Fetch the three upstream tiers the insights engine depends on, in parallel. */
  async _fetchPrescriptiveInputs() {
    const [forecast, yieldData, maintenance] = await Promise.all([
      this.getCapacityForecast(),
      this.getYieldAnalytics(),
      this.getMaintenancePredictors(),
    ])
    return { forecast, yieldData, maintenance }
  },

  /**
   * Phase 4 — Prescriptive Insights Engine
   * Rule-based recommendations derived from the upstream tiers.
   */
  async generatePrescriptiveInsights(precomputed?: PrescriptiveInputs) {
    // Reuse already-computed analytics when called from getAnalyticsBundle to
    // avoid re-running these three (multi-query) calls a second time per request.
    const { forecast, yieldData, maintenance } =
      precomputed ?? (await this._fetchPrescriptiveInputs())

    type Insight = { id: string; severity: 'warning' | 'alert' | 'tip'; icon: string; title: string; body: string }
    const insights: Insight[] = []

    // Rule 1 — Capacity warning
    if (forecast.maxCapacity > 0) {
      const peakRatio = forecast.forecastedPeak / forecast.maxCapacity
      if (peakRatio > 0.9) {
        insights.push({
          id: 'cap-1',
          severity: 'warning',
          icon: 'warning',
          title: 'Capacity Warning',
          body: `Forecasted demand reaches ${(peakRatio * 100).toFixed(0)}% of system capacity next month. Recommend restricting external bookings.`,
        })
      }
    }

    // Rule 2 — Maintenance alerts
    for (const m of maintenance) {
      if (m.wearPercent > 85) {
        insights.push({
          id: `maint-${m.id}`,
          severity: 'alert',
          icon: 'wrench',
          title: 'Maintenance Alert',
          body: `${m.name} is at ${m.wearPercent}% of safe operational hours. Schedule immediate inspection.`,
        })
      }
    }

    // Rule 3 — Underutilization
    for (const y of yieldData) {
      if (y.utilization < 10 && y.bookings >= 1) {
        insights.push({
          id: `yield-${y.id}`,
          severity: 'tip',
          icon: 'lightbulb',
          title: 'Efficiency Insight',
          body: `${y.name} is severely underutilized (${y.utilization}%). Consider repurposing or consolidating.`,
        })
      }
    }

    return insights
  },

  /**
   * Bundle endpoint for the analytics page.
   */
  async getAnalyticsBundle() {
    // forecast/yield/maintenance feed both the response and the insights engine,
    // so fetch them once and reuse — avoids running each a second time.
    const [heatmap, departmental, { forecast, yieldData, maintenance }] = await Promise.all([
      this.getFacilityHeatmapAnalytics(),
      this.getDepartmentalUsage(),
      this._fetchPrescriptiveInputs(),
    ])
    const insights = await this.generatePrescriptiveInsights({ forecast, yieldData, maintenance })
    return { heatmap, departmental, yield: yieldData, forecast, maintenance, insights }
  },

  /**
   * Get audit log stats
   */
  async getSystemLogStats() {
    const supabase = createAdminClient()

    const { count: total } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })

    const today = new Date().toISOString().split('T')[0]
    const { count: todayCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`)

    return {
      total: total || 0,
      today: todayCount || 0,
    }
  },
}
