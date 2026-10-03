/**
 * Equipment Assignment Requests Service
 *
 * BA cannot assign tech equipment directly; it submits an assignment request
 * that IT Admin (it_admin) approves and processes. On completion the item
 * is actually moved via the assign_equipment_facility() RPC (which logs the
 * movement).
 */

import { createAdminClient } from '@/lib/supabase/server'
import { isRequestTransitionAllowed, type RequestStatus } from '@/lib/equipment/assignment-request-policy'

export type { RequestStatus }

const SELECT = `
  *,
  equipment:equipment!equipment_assignment_requests_equipment_id_fkey(id, equipment_code, equipment_name),
  from_facility:facilities!equipment_assignment_requests_from_facility_id_fkey(id, name),
  to_facility:facilities!equipment_assignment_requests_to_facility_id_fkey(id, name),
  requester:users!equipment_assignment_requests_requested_by_user_id_fkey(id, full_name),
  handler:users!equipment_assignment_requests_handled_by_user_id_fkey(id, full_name)
`

function toView(row: any) {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    equipmentCode: row.equipment?.equipment_code || null,
    equipmentName: row.equipment?.equipment_name || null,
    fromFacilityId: row.from_facility_id,
    fromFacilityName: row.from_facility?.name || null,
    toFacilityId: row.to_facility_id,
    toFacilityName: row.to_facility?.name || null,
    requestedByUserId: row.requested_by_user_id,
    requestedByName: row.requester?.full_name || null,
    reason: row.reason,
    status: row.status as RequestStatus,
    handledByUserId: row.handled_by_user_id,
    handledByName: row.handler?.full_name || null,
    statusNote: row.status_note,
    decidedAt: row.decided_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const EquipmentAssignmentRequestsService = {
  /** BA submits a request to assign a tech item to a room. */
  async create(input: {
    equipmentId: string
    toFacilityId: string
    reason?: string | null
    requestedByUserId: string
  }) {
    const supabase = createAdminClient()

    const { data: eq } = await supabase
      .from('equipment')
      .select('assigned_facility_id, equipment_type:equipment_types!equipment_equipment_type_id_fkey(managed_by)')
      .eq('id', input.equipmentId)
      .single()
    if (!eq) throw new Error('Equipment not found')
    if ((eq.equipment_type as any)?.managed_by !== 'it') {
      throw new Error('Assignment requests are only for tech (IT-managed) equipment')
    }

    const { data, error } = await supabase
      .from('equipment_assignment_requests')
      .insert({
        equipment_id: input.equipmentId,
        from_facility_id: eq.assigned_facility_id || null,
        to_facility_id: input.toFacilityId,
        requested_by_user_id: input.requestedByUserId,
        reason: input.reason || null,
      })
      .select(SELECT)
      .single()
    if (error) throw new Error(error.message)
    return toView(data)
  },

  /** BA sees own requests; it_admin sees all. */
  async list(opts: { userId: string; roles: string[] }) {
    const supabase = createAdminClient()
    let query = supabase
      .from('equipment_assignment_requests')
      .select(SELECT)
      .order('created_at', { ascending: false })

    if (!opts.roles.includes('it_admin')) {
      query = query.eq('requested_by_user_id', opts.userId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data || []).map(toView)
  },

  /** IT Admin advances a request. On 'completed' the item is actually moved. */
  async updateStatus(
    id: string,
    input: { status: RequestStatus; statusNote?: string | null; handledByUserId: string },
  ) {
    const supabase = createAdminClient()

    const { data: current, error: fetchErr } = await supabase
      .from('equipment_assignment_requests')
      .select('equipment_id, to_facility_id, status')
      .eq('id', id)
      .single()
    if (fetchErr) throw new Error(fetchErr.message)

    if (!isRequestTransitionAllowed(current.status, input.status)) {
      throw new Error(`Forbidden: cannot move request from ${current.status} to ${input.status}`)
    }

    const patch: Record<string, any> = {
      status: input.status,
      handled_by_user_id: input.handledByUserId,
    }
    if (input.statusNote !== undefined) patch.status_note = input.statusNote
    if (input.status === 'approved' || input.status === 'rejected') {
      patch.decided_at = new Date().toISOString()
    }

    if (input.status === 'completed') {
      // Perform the real move + movement log via the DB function.
      const { error: rpcErr } = await supabase.rpc('assign_equipment_facility', {
        p_equipment_id: current.equipment_id,
        p_to_facility_id: current.to_facility_id,
        p_user_id: input.handledByUserId,
        p_reason: input.statusNote || 'Assignment request completed',
      })
      if (rpcErr) throw new Error(rpcErr.message)
      patch.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('equipment_assignment_requests')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) throw new Error(error.message)
    return toView(data)
  },
}
