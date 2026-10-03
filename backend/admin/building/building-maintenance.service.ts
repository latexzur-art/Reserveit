/**
 * Building Maintenance Service
 *
 * CRUD operations for maintenance records.
 */

import { handleBulkCancellation } from '@/backend/booking/cancellationHandler'
import { immediateMaintenanceNotificationEmail } from '@/backend/notifications/emailTemplates'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { createAdminClient } from '@/lib/supabase/server'
import { dbMaintenanceToView, type MaintenanceFilters } from './building.types'

export const BuildingMaintenanceService = {
  /**
   * Get all maintenance records with pagination and filters
   */
  async getAll(filters?: MaintenanceFilters) {
    const supabase = createAdminClient()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 20
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('maintenance_records')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('schedule_date', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (filters?.type) {
      query = query.eq('type', filters.type)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.search) {
      query = query.or(
        `target_name.ilike.%${filters.search}%,technician.ilike.%${filters.search}%`
      )
    }

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    return {
      records: (data || []).map(dbMaintenanceToView),
      total: count || 0,
    }
  },

  /**
   * Get maintenance stats
   */
  async getStats() {
    const supabase = createAdminClient()

    const { count: total } = await supabase
      .from('maintenance_records')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    const { count: scheduled } = await supabase
      .from('maintenance_records')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('status', 'scheduled')

    const { count: inProgress } = await supabase
      .from('maintenance_records')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('status', 'in_progress')

    const { count: completed } = await supabase
      .from('maintenance_records')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('status', 'completed')

    return {
      total: total || 0,
      scheduled: scheduled || 0,
      inProgress: inProgress || 0,
      completed: completed || 0,
    }
  },

  /**
   * Create a maintenance record
   */
  async create(record: {
    type: 'facility' | 'equipment'
    targetId: string
    targetName: string
    scheduleDate: string
    technician: string
    notes?: string
    createdBy?: string
  }) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('maintenance_records')
      .insert({
        type: record.type,
        target_id: record.targetId,
        target_name: record.targetName,
        schedule_date: record.scheduleDate,
        technician: record.technician,
        notes: record.notes || null,
        created_by: record.createdBy || null,
        status: 'scheduled',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    // ── 1. Automatic Conflict Handling ─────────────────────────────────────────
    if (record.type === 'facility') {
      const { data: conflictingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('facility_id', record.targetId)
        .eq('booking_date', record.scheduleDate)
        .in('status', ['pending', 'approved'])

      if (conflictingBookings && conflictingBookings.length > 0) {
        const bookingIds = conflictingBookings.map(b => b.id)
        const reason = `Facility closed for emergency maintenance. ${record.notes || ''}`.trim()
        await handleBulkCancellation(
          supabase,
          bookingIds,
          'facility_unavailable',
          record.createdBy || 'system',
          reason
        )
      }
    }

    // ── 2. Immediate Notification ──────────────────────────────────────────────
    const { data: ahRole } = await supabase
      .from('user_roles')
      .select('users!inner(notification_email, email)')
      .eq('roles.name', 'academic_head')
      .limit(1)
      .single()

    const ahEmail = (ahRole?.users as any)?.notification_email || (ahRole?.users as any)?.email
    
    if (ahEmail) {
      const { subject, htmlBody } = immediateMaintenanceNotificationEmail({
        targetName: record.targetName,
        maintenanceType: record.type,
        scheduledDate: new Date(record.scheduleDate).toLocaleDateString('en-PH', {
          timeZone: 'Asia/Manila',
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }),
        technician: record.technician,
        notes: record.notes,
      })
      await sendBrevoEmail({ to: ahEmail, subject, htmlBody }).catch(err =>
        console.error('[maintenance] Failed to send immediate maintenance notification:', err)
      )
    }

    return dbMaintenanceToView(data)
  },

  /**
   * Update a maintenance record
   */
  async update(id: string, updates: Record<string, any>) {
    const supabase = createAdminClient()

    const dbUpdates: Record<string, any> = {}
    const mapping: Record<string, string> = {
      scheduleDate: 'schedule_date',
      completedDate: 'completed_date',
      technician: 'technician',
      status: 'status',
      notes: 'notes',
      targetName: 'target_name',
    }

    for (const [key, value] of Object.entries(updates)) {
      if (mapping[key]) {
        dbUpdates[mapping[key]] = value
      }
    }

    // If completing, set completed_date
    if (dbUpdates.status === 'completed' && !dbUpdates.completed_date) {
      dbUpdates.completed_date = new Date().toISOString().split('T')[0]
    }

    const { data, error } = await supabase
      .from('maintenance_records')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    return dbMaintenanceToView(data)
  },

  /**
   * Soft-delete a maintenance record
   */
  async delete(id: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('maintenance_records')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw new Error(error.message)
  },
}
