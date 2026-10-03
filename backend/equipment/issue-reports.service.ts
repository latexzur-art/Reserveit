/**
 * Equipment Issue Reports Service
 *
 * Professor/BA-filed equipment problem reports with a triage + escalation
 * lifecycle. Building Admin is the front-line; escalation routes by is_tech
 * (non-tech -> PAMO, tech -> IT Admin / it_admin).
 */

import { createAdminClient } from '@/lib/supabase/server'
import { canHandleReport, type ReportStatus } from '@/lib/equipment/report-policy'

export type ReportCategory = 'broken' | 'missing' | 'malfunction' | 'other'
export type { ReportStatus }

const SELECT = `
  *,
  equipment:equipment!equipment_issue_reports_equipment_id_fkey(id, equipment_code, equipment_name),
  facility:facilities!equipment_issue_reports_facility_id_fkey(id, name),
  reporter:users!equipment_issue_reports_reported_by_user_id_fkey(id, full_name),
  handler:users!equipment_issue_reports_handled_by_user_id_fkey(id, full_name)
`

function toView(row: any) {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    equipmentCode: row.equipment_code || row.equipment?.equipment_code || null,
    equipmentName: row.equipment?.equipment_name || null,
    facilityId: row.facility_id,
    facilityName: row.facility?.name || null,
    reportedByUserId: row.reported_by_user_id,
    reportedByName: row.reporter?.full_name || null,
    category: row.category as ReportCategory,
    description: row.description,
    isTech: row.is_tech,
    status: row.status as ReportStatus,
    handledByUserId: row.handled_by_user_id,
    handledByName: row.handler?.full_name || null,
    resolutionNotes: row.resolution_notes,
    escalatedAt: row.escalated_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const EquipmentIssueReportsService = {
  /** File a report. is_tech + equipment_code snapshot resolved from the item. */
  async create(input: {
    equipmentId?: string | null
    facilityId?: string | null
    category: ReportCategory
    description: string
    reportedByUserId: string
  }) {
    const supabase = createAdminClient()

    let isTech = false
    let equipmentCode: string | null = null
    if (input.equipmentId) {
      const { data: eq } = await supabase
        .from('equipment')
        .select('equipment_code, equipment_type:equipment_types!equipment_equipment_type_id_fkey(managed_by)')
        .eq('id', input.equipmentId)
        .single()
      equipmentCode = eq?.equipment_code ?? null
      isTech = (eq?.equipment_type as any)?.managed_by === 'it'
    }

    const { data, error } = await supabase
      .from('equipment_issue_reports')
      .insert({
        equipment_id: input.equipmentId || null,
        equipment_code: equipmentCode,
        facility_id: input.facilityId || null,
        reported_by_user_id: input.reportedByUserId,
        category: input.category,
        description: input.description,
        is_tech: isTech,
      })
      .select(SELECT)
      .single()

    if (error) throw new Error(error.message)
    return toView(data)
  },

  /**
   * Lightweight, professor-readable list of the equipment assigned to a facility,
   * for the report dialog's item picker. `isTech` is derived from the type's
   * managed_by so the caller sends an equipmentId that routes correctly.
   */
  async listEquipmentForFacility(facilityId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('equipment')
      .select('id, equipment_code, equipment_name, equipment_type:equipment_types!equipment_equipment_type_id_fkey(managed_by)')
      .eq('assigned_facility_id', facilityId)

    if (error) throw new Error(error.message)
    return (data || []).map((row: any) => ({
      id: row.id,
      equipmentCode: row.equipment_code ?? null,
      equipmentName: row.equipment_name ?? null,
      isTech: (row.equipment_type as any)?.managed_by === 'it',
    }))
  },

  /**
   * List reports scoped to the caller:
   *   building_admin -> all
   *   pamo_officer   -> escalated non-tech
   *   it_admin   -> escalated tech
   *   otherwise      -> the caller's own reports
   */
  async list(opts: { userId: string; roles: string[] }) {
    const supabase = createAdminClient()
    let query = supabase
      .from('equipment_issue_reports')
      .select(SELECT)
      .order('created_at', { ascending: false })

    // The owning office keeps seeing a report through its in-progress states,
    // not just while it sits at 'escalated' — mirrors canHandleReport.
    const OFFICE_STATUSES = ['escalated', 'under_process', 'still_broken']
    const { roles, userId } = opts
    if (roles.includes('building_admin')) {
      // no extra filter — sees all
    } else if (roles.includes('pamo_officer')) {
      query = query.eq('is_tech', false).in('status', OFFICE_STATUSES)
    } else if (roles.includes('it_admin')) {
      query = query.eq('is_tech', true).in('status', OFFICE_STATUSES)
    } else {
      query = query.eq('reported_by_user_id', userId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data || []).map(toView)
  },

  /**
   * Overview summary for the PAMO officer: the number of escalated non-tech
   * reports awaiting handling, plus the most recent few for a preview. One
   * round-trip — `count: 'exact'` returns the full total independent of `limit`.
   */
  async pamoEscalationSummary(limit = 3) {
    const supabase = createAdminClient()
    const { data, count, error } = await supabase
      .from('equipment_issue_reports')
      .select(SELECT, { count: 'exact' })
      .eq('is_tech', false)
      .eq('status', 'escalated')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return { open: count ?? 0, latest: (data || []).map(toView) }
  },

  /**
   * Transition a report. Authorization by role:
   *   building_admin -> any transition (front-line)
   *   pamo_officer   -> only escalated non-tech reports
   *   it_admin   -> only escalated tech reports
   */
  async updateStatus(
    id: string,
    input: {
      status: ReportStatus
      resolutionNotes?: string | null
      handledByUserId: string
      roles: string[]
      /** Building-admin-only routing override for item-less reports (tech vs non-tech). */
      isTech?: boolean
    },
  ) {
    const supabase = createAdminClient()

    const { data: current, error: fetchErr } = await supabase
      .from('equipment_issue_reports')
      .select('is_tech, status')
      .eq('id', id)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)

    if (!canHandleReport(input.roles, current.is_tech, current.status)) {
      throw new Error('Forbidden: not allowed to update this report')
    }

    const patch: Record<string, any> = {
      status: input.status,
      handled_by_user_id: input.handledByUserId,
    }
    // Only the front-line (building_admin) may correct routing, and only when a
    // report has no equipment item to derive it from (create() defaults to
    // non-tech, which otherwise misroutes tech reports to PAMO).
    if (input.isTech !== undefined && input.roles.includes('building_admin')) {
      patch.is_tech = input.isTech
    }
    if (input.resolutionNotes !== undefined) patch.resolution_notes = input.resolutionNotes
    if (input.status === 'escalated') patch.escalated_at = new Date().toISOString()
    if (input.status === 'resolved') patch.resolved_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('equipment_issue_reports')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) throw new Error(error.message)
    return toView(data)
  },
}
