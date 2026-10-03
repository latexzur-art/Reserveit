/**
 * Course Audit Service
 *
 * Reads the audit trail of curriculum upload actions (clear, delete, reject,
 * send-back, approve/publish) for the academic head's Course History "Logs" view.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Actions surfaced in the academic head course-history Logs tab. */
export const COURSE_LOG_ACTIONS = [
  'upload_history_cleared',
  'delete_rejected_upload',
  'batch_rejected',
  'batch_rows_rejected',
  'batch_sent_back',
  'batch_approved',
  'batch_self_published',
] as const

export interface CourseAuditLog {
  id: string
  action: string
  targetId: string | null
  details: Record<string, any>
  createdAt: string
  actorName: string | null
  actorEmail: string | null
}

export async function getCourseAuditLogs(
  supabase: SupabaseClient,
  opts: { page?: number; limit?: number }
): Promise<{ logs: CourseAuditLog[]; total: number }> {
  const page = opts.page ?? 1
  const limit = Math.min(opts.limit ?? 20, 50)
  const offset = (page - 1) * limit

  const { data, count, error } = await supabase
    .from('audit_logs')
    .select('id, action, target_type, target_id, details, created_at, actor:users!actor_id(full_name, email)', { count: 'exact' })
    .eq('target_type', 'course_upload')
    .in('action', COURSE_LOG_ACTIONS as unknown as string[])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(`Failed to fetch course logs: ${error.message}`)

  const logs: CourseAuditLog[] = (data ?? []).map((row: any) => ({
    id: row.id,
    action: row.action,
    targetId: row.target_id,
    details: row.details ?? {},
    createdAt: row.created_at,
    actorName: row.actor?.full_name ?? null,
    actorEmail: row.actor?.email ?? null,
  }))

  return { logs, total: count ?? 0 }
}
