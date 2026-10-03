/**
 * Schedule Issue Reports Service
 *
 * Faculty / Program Head / Academic Head file reports about schedule problems
 * (wrong room, time conflicts, missing sessions, etc.).
 * Building Admin triages; escalation routes to the equipment issue report
 * pipeline (IT Admin for tech, PAMO for non-tech).
 * Every status change is auto-logged via a Postgres trigger.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { NotificationService } from '@/backend/notifications/notification.service'
import {
  canFileScheduleReport,
  canTriageScheduleReport,
  isValidTransition,
  type ScheduleReportStatus,
} from '@/lib/schedule/report-policy'

export type ScheduleReportCategory =
  | 'wrong_room'
  | 'time_conflict'
  | 'missing_session'
  | 'incorrect_time'
  | 'instructor_mismatch'
  | 'not_updated'
  | 'equipment_issue'
  | 'other'

export type { ScheduleReportStatus }

const SELECT = `
  *,
  reporter:users!schedule_issue_reports_reported_by_fkey(id, full_name),
  resolver:users!schedule_issue_reports_resolved_by_fkey(id, full_name),
  facility:facilities!schedule_issue_reports_facility_id_fkey(id, name)
`

const LOG_SELECT = `
  *,
  performer:users!schedule_issue_report_logs_performed_by_fkey(id, full_name)
`

function toView(row: any) {
  return {
    id: row.id,
    scheduleType: row.schedule_type,
    scheduleId: row.schedule_id,
    facilityId: row.facility_id,
    facilityName: row.facility_name || row.facility?.name || null,
    courseCode: row.course_code,
    section: row.section,
    scheduleDate: row.schedule_date,
    startTime: row.start_time,
    endTime: row.end_time,
    dayOfWeek: row.day_of_week,
    reportedBy: row.reported_by,
    reportedByName: row.reporter?.full_name || null,
    category: row.category as ScheduleReportCategory,
    noticedAt: row.noticed_at,
    whatHappened: row.what_happened,
    whatToCorrect: row.what_to_correct,
    equipmentType: row.equipment_type,
    isTech: row.is_tech,
    isHvac: row.is_hvac,
    status: row.status as ScheduleReportStatus,
    resolutionNotes: row.resolution_notes,
    resolvedBy: row.resolved_by,
    resolvedByName: row.resolver?.full_name || null,
    resolvedAt: row.resolved_at,
    escalatedEquipmentReportId: row.escalated_equipment_report_id,
    escalatedTo: row.escalated_to,
    escalatedAt: row.escalated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toLogView(row: any) {
  return {
    id: row.id,
    reportId: row.report_id,
    action: row.action,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    notes: row.notes,
    performedBy: row.performed_by,
    performedByName: row.performer?.full_name || null,
    createdAt: row.created_at,
  }
}

export const ScheduleIssueReportsService = {
  /** File a new schedule issue report. */
  async create(input: {
    scheduleType: 'class' | 'reservation'
    scheduleId: string
    facilityId?: string | null
    facilityName?: string | null
    courseCode?: string | null
    section?: string | null
    scheduleDate?: string | null
    startTime?: string | null
    endTime?: string | null
    dayOfWeek?: number | null
    category: ScheduleReportCategory
    noticedAt?: string
    whatHappened: string
    whatToCorrect?: string | null
    equipmentType?: string | null
    isTech?: boolean | null
    isHvac?: boolean | null
    reportedBy: string
  }) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('schedule_issue_reports')
      .insert({
        schedule_type: input.scheduleType,
        schedule_id: input.scheduleId,
        facility_id: input.facilityId || null,
        facility_name: input.facilityName || null,
        course_code: input.courseCode || null,
        section: input.section || null,
        schedule_date: input.scheduleDate || null,
        start_time: input.startTime || null,
        end_time: input.endTime || null,
        day_of_week: input.dayOfWeek ?? null,
        reported_by: input.reportedBy,
        category: input.category,
        noticed_at: input.noticedAt || new Date().toISOString().slice(0, 10),
        what_happened: input.whatHappened,
        what_to_correct: input.whatToCorrect || null,
        equipment_type: input.equipmentType || null,
        is_tech: input.isTech ?? false,
        is_hvac: input.isHvac ?? false,
      })
      .select(SELECT)
      .single()

    if (error) throw new Error(error.message)
    const report = toView(data)

    // Notify building admins about the new report
    try {
      await NotificationService.createForRoles(['building_admin'], {
        title: 'New Schedule Issue Report',
        message: `A new schedule issue report has been filed: ${input.category} — ${input.whatHappened.substring(0, 100)}`,
        type: 'info',
        source_type: 'schedule_issue_report',
        source_id: report.id,
        priority: 'normal',
        action_url: '/admin/building/facility-management',
        metadata: {
          facility_name: input.facilityName,
          category: input.category,
          schedule_type: input.scheduleType,
        },
      })
    } catch (err) {
      console.error('[schedule-report] notification failed:', err)
    }

    return report
  },

  /** List reports filed by a specific user. */
  async listForUser(userId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('schedule_issue_reports')
      .select(SELECT)
      .eq('reported_by', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []).map(toView)
  },

  /** Admin list with optional filters. */
  async listForAdmin(
    status?: ScheduleReportStatus,
    filters?: { category?: string; isHvac?: boolean; isTech?: boolean; facilityId?: string },
  ) {
    const supabase = createAdminClient()

    let query = supabase
      .from('schedule_issue_reports')
      .select(SELECT)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    if (filters?.facilityId) {
      query = query.eq('facility_id', filters.facilityId)
    }
    if (filters?.isHvac !== undefined) {
      query = query.eq('is_hvac', filters.isHvac)
    }
    if (filters?.isTech !== undefined) {
      query = query.eq('is_tech', filters.isTech)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data || []).map(toView)
  },

  /** Transition a report's status. */
  async updateStatus(
    id: string,
    input: {
      status: ScheduleReportStatus
      resolutionNotes?: string | null
      resolvedBy: string
    },
  ) {
    const supabase = createAdminClient()

    const { data: current, error: fetchErr } = await supabase
      .from('schedule_issue_reports')
      .select('status, reported_by, facility_name')
      .eq('id', id)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)

    if (!isValidTransition(current.status as ScheduleReportStatus, input.status)) {
      throw new Error(
        `Invalid transition from "${current.status}" to "${input.status}"`,
      )
    }

    const patch: Record<string, any> = {
      status: input.status,
      resolved_by: input.resolvedBy,
    }
    if (input.resolutionNotes !== undefined) {
      patch.resolution_notes = input.resolutionNotes
    }
    if (input.status === 'resolved') {
      patch.resolved_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('schedule_issue_reports')
      .update(patch)
      .eq('id', id)
      .eq('status', current.status) // optimistic lock
      .select(SELECT)
      .single()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Report was modified by another user. Please refresh.')
    const updatedReport = toView(data)

    // Notify reporter when report is resolved
    if (input.status === 'resolved' && current.reported_by) {
      try {
        await NotificationService.create({
          user_id: current.reported_by,
          title: 'Your Schedule Report Has Been Resolved',
          message: `Your report about ${current.facility_name || 'a schedule issue'} has been resolved.`,
          type: 'success',
          source_type: 'schedule_issue_report',
          source_id: updatedReport.id,
          priority: 'normal',
          action_url: '/faculty/schedules',
        })
      } catch (err) {
        console.error('[schedule-report] notification failed:', err)
      }
    }

    return updatedReport
  },

  /** Self-service update by the report owner. Limited to what_to_correct and retraction (dismiss). */
  async updateSelf(
    id: string,
    userId: string,
    input: { whatToCorrect?: string; retract?: boolean },
  ) {
    const supabase = createAdminClient()

    // Fetch current report to verify ownership and status
    const { data: current, error: fetchErr } = await supabase
      .from('schedule_issue_reports')
      .select('id, reported_by, status, what_to_correct, facility_name')
      .eq('id', id)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)
    if (!current) throw new Error('Report not found')
    if (current.reported_by !== userId) throw new Error('You can only edit your own reports')

    // Build the update payload
    const patch: Record<string, any> = {}

    if (input.whatToCorrect !== undefined) {
      patch.what_to_correct = input.whatToCorrect
    }

    if (input.retract) {
      // Only pending or under_review can be retracted by the owner
      if (current.status !== 'pending' && current.status !== 'under_review') {
        throw new Error('Only pending or under review reports can be retracted')
      }
      patch.status = 'dismissed'
      patch.resolution_notes = 'Retracted by reporter'
      patch.resolved_by = userId
      patch.resolved_at = new Date().toISOString()
    }

    if (Object.keys(patch).length === 0) {
      throw new Error('No changes provided')
    }

    const { data, error } = await supabase
      .from('schedule_issue_reports')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) throw new Error(error.message)
    return toView(data)
  },

  /** Escalate a schedule report to the equipment issue report pipeline. */
  async escalate(
    id: string,
    input: {
      isTech: boolean
      escalatedBy: string
      description?: string
    },
  ) {
    const supabase = createAdminClient()

    // Fetch the current report
    const { data: current, error: fetchErr } = await supabase
      .from('schedule_issue_reports')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)

    // Status guard: only pending or under_review can be escalated
    if (current.status !== 'pending' && current.status !== 'under_review') {
      throw new Error(
        `Cannot escalate report with status "${current.status}". Only pending or under_review reports can be escalated.`,
      )
    }

    const escalatedTo = input.isTech ? 'it_admin' : 'pamo'

    // Create the equipment issue report
    const { data: eqReport, error: eqErr } = await supabase
      .from('equipment_issue_reports')
      .insert({
        equipment_id: null,
        facility_id: current.facility_id,
        reported_by_user_id: input.escalatedBy,
        category: 'other',
        description: current.what_happened,
        is_tech: input.isTech,
        status: 'escalated',
        escalated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (eqErr) throw new Error(eqErr.message)

    // Facility warning with dedup: update existing active warning or create new
    if (current.facility_id) {
      const { data: existingWarning } = await supabase
        .from('facility_warnings')
        .select('id, message')
        .eq('facility_id', current.facility_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (existingWarning) {
        await supabase
          .from('facility_warnings')
          .update({
            message: `${existingWarning.message}\nAlso reported: ${input.description ?? current.what_happened}`,
          })
          .eq('id', existingWarning.id)
      } else {
        await supabase.from('facility_warnings').insert({
          facility_id: current.facility_id,
          severity: 'warning',
          message: `[${current.category ?? 'other'}] ${input.description ?? current.what_happened} — being resolved`,
          is_active: true,
          created_by: input.escalatedBy,
        })
      }
    }

    // Update the schedule report with optimistic locking
    const { data: updated, error: updErr } = await supabase
      .from('schedule_issue_reports')
      .update({
        status: 'escalated',
        escalated_equipment_report_id: eqReport.id,
        escalated_to: escalatedTo,
        escalated_at: new Date().toISOString(),
        resolved_by: input.escalatedBy,
      })
      .eq('id', id)
      .eq('status', current.status) // optimistic lock
      .select(SELECT)
      .single()
    if (updErr) throw new Error(updErr.message)
    if (!updated) throw new Error('Report was modified by another user. Please refresh.')

    const result = toView(updated)

    // Notify the target office about the escalation
    try {
      const targetRole = input.isTech ? 'it_admin' : 'pamo_officer'
      await NotificationService.createForRoles([targetRole], {
        title: 'Schedule Issue Escalated — Equipment',
        message: `A schedule issue has been escalated to your office: ${current.what_happened.substring(0, 100)}`,
        type: 'warning',
        source_type: 'schedule_issue_report',
        source_id: result.id,
        priority: 'high',
        action_url: input.isTech ? '/admin/it/equipment-issues' : '/admin/pamo/equipment-issues',
        metadata: {
          facility_id: current.facility_id,
          facility_name: current.facility_name,
          escalated_to: escalatedTo,
          equipment_report_id: eqReport.id,
        },
      })
    } catch (err) {
      console.error('[schedule-report] escalation notification failed:', err)
    }

    // Notify affected faculty (instructors with class schedules in the facility)
    if (current.facility_id) {
      try {
        const { data: affectedClasses } = await supabase
          .from('class_schedules')
          .select('instructor_id')
          .eq('facility_id', current.facility_id)
          .eq('is_active', true)
          .is('superseded_by', null)

        const instructorIds = [...new Set(affectedClasses?.map((c: any) => c.instructor_id).filter(Boolean))]
        if (instructorIds.length > 0) {
          const payloads = instructorIds.map((id: string) => ({
            user_id: id,
            title: `Room Notice: ${current.facility_name}`,
            message: `A facility issue has been reported for ${current.facility_name}. The building admin is resolving it.`,
            type: 'warning' as const,
            source_type: 'schedule_issue_report',
            source_id: result.id,
            priority: 'normal' as const,
            action_url: '/faculty/schedules',
            metadata: { facility_id: current.facility_id, facility_name: current.facility_name },
          }))
          await NotificationService.createBulk(payloads)
        }
      } catch (err) {
        console.error('[schedule-report] faculty notification failed:', err)
      }
    }

    return result
  },

  /** Get activity log for a report. */
  async getActivityLog(reportId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('schedule_issue_report_logs')
      .select(LOG_SELECT)
      .eq('report_id', reportId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    return (data || []).map(toLogView)
  },

  /** Get attachments for a report. */
  async getAttachments(reportId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('schedule_issue_report_attachments')
      .select('id, report_id, storage_path, public_url, caption, file_size, sort_order, created_at')
      .eq('report_id', reportId)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(error.message)
    return (data || []).map((row: any) => ({
      id: row.id,
      reportId: row.report_id,
      storagePath: row.storage_path,
      publicUrl: row.public_url,
      caption: row.caption,
      fileSize: row.file_size,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    }))
  },

  /** Count attachments for a report (used for the 5-attachment limit). */
  async getAttachmentCount(reportId: string) {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from('schedule_issue_report_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('report_id', reportId)

    if (error) throw new Error(error.message)
    return count ?? 0
  },

  /** Delete a single attachment (admin). Also removes the file from storage. */
  async deleteAttachment(attachmentId: string) {
    const supabase = createAdminClient()

    // Fetch the attachment to get the storage path
    const { data: attachment, error: fetchErr } = await supabase
      .from('schedule_issue_report_attachments')
      .select('id, storage_path')
      .eq('id', attachmentId)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)
    if (!attachment) throw new Error('Attachment not found')

    // Delete from storage
    const { error: storageErr } = await supabase.storage
      .from('schedule-report-attachments')
      .remove([attachment.storage_path])
    if (storageErr) {
      console.error('[schedule-report] storage delete failed:', storageErr)
      // Continue anyway — the DB row is the source of truth
    }

    // Delete the DB row
    const { error: deleteErr } = await supabase
      .from('schedule_issue_report_attachments')
      .delete()
      .eq('id', attachmentId)
    if (deleteErr) throw new Error(deleteErr.message)

    return { deleted: true }
  },
}
