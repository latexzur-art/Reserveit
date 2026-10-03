/**
 * Unified notification types for all frontend portals
 */

export interface UnifiedNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  read: boolean
  priority: 'low' | 'normal' | 'high' | 'urgent'
  createdAt: Date
  actionUrl?: string
  sourceType?: string
  sourceId?: string
  isBroadcast?: boolean
  metadata?: Record<string, unknown>
}

/** Transform a raw DB/API notification row to the unified frontend type */
export function toUnifiedNotification(row: Record<string, unknown>): UnifiedNotification {
  let actionUrl = (row.action_url as string) ?? undefined

  if (!actionUrl) {
    const sourceType = row.source_type as string
    const title = (row.title as string) || ''

    if (sourceType === 'schedule_upload') {
      if (title.includes('Awaiting Review')) {
        actionUrl = '/academic/schedules/review'
      } else {
        actionUrl = '/program/schedules'
      }
    } else if (sourceType === 'schedule_change_request') {
      if (title.includes('New Schedule Change Request')) {
        actionUrl = '/academic/schedules/change-requests'
      } else {
        actionUrl = '/program/schedules/change-requests'
      }
    } else if (sourceType === 'booking') {
      if (title.includes('Needs Your Approval') || title.includes('Policy-Override')) {
        actionUrl = '/admin/building/reservations'
      } else {
        // Fallback for regular user booking notifications
        actionUrl = '/faculty/my-reservations'
      }
    }
  }

  return {
    id: row.id as string,
    title: row.title as string,
    message: row.message as string,
    type: (row.type as UnifiedNotification['type']) ?? 'info',
    read: (row.read as boolean) ?? false,
    priority: (row.priority as UnifiedNotification['priority']) ?? 'normal',
    createdAt: new Date((row.created_at as string) ?? (row.createdAt as string) ?? Date.now()),
    actionUrl,
    sourceType: (row.source_type as string) ?? undefined,
    sourceId: (row.source_id as string) ?? undefined,
    isBroadcast: (row.is_broadcast as boolean) ?? false,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
  }
}
