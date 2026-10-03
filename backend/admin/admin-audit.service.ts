/**
 * Admin Audit Service
 *
 * Logs admin actions for auditing and compliance.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type { AuditLog } from './admin.types'

export const AdminAuditService = {
  /**
   * Log an admin action
   */
  async log(data: {
    actorId: string
    action: string
    targetType: string
    targetId?: string
    details?: Record<string, any>
  }) {
    const supabase = createAdminClient()

    await supabase.from('audit_logs').insert({
      actor_id: data.actorId,
      action: data.action,
      target_type: data.targetType,
      target_id: data.targetId,
      details: data.details || {},
    })
  },

  /**
   * Fetch audit logs with actor info, pagination, and optional filters
   */
  async getAuditLogs(params: {
    page?: number
    pageSize?: number
    action?: string
    targetType?: string
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const supabase = createAdminClient()
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('audit_logs')
      .select('id, action, target_type, target_id, details, created_at, actor:users!actor_id(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (params.action) {
      query = query.eq('action', params.action)
    }
    if (params.targetType) {
      query = query.eq('target_type', params.targetType)
    }

    const { data, count, error } = await query

    if (error) throw new Error(error.message)

    const logs: AuditLog[] = (data || []).map((row: any) => ({
      id: row.id,
      actorName: row.actor?.full_name || null,
      actorEmail: row.actor?.email || null,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      details: row.details || {},
      createdAt: row.created_at,
    }))

    return { logs, total: count || 0 }
  },
}
