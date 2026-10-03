/**
 * Notification System Types
 */

export interface NotificationPayload {
  user_id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  source_type?: string
  source_id?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  action_url?: string
  metadata?: Record<string, unknown>
  expires_at?: string
  is_broadcast?: boolean
  broadcast_id?: string
}

export interface NotificationRow {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  read: boolean
  source_type: string | null
  source_id: string | null
  priority: string
  action_url: string | null
  metadata: Record<string, unknown> | null
  is_broadcast: boolean
  broadcast_id: string | null
  expires_at: string | null
  email_sent: boolean
  email_sent_at: string | null
  email_error: string | null
  created_at: string
}

export interface BroadcastPayload {
  sender_id: string
  title: string
  message: string
  target_audience?: 'all' | 'internal' | 'external' | 'admins'
  target_roles?: string[]
  action_url?: string
  metadata?: Record<string, unknown>
  expires_at?: string
}

export interface BroadcastRow {
  id: string
  sender_id: string
  title: string
  message: string
  target_audience: string
  target_roles: string[] | null
  created_by: string | null
  action_url: string | null
  metadata: Record<string, unknown> | null
  expires_at: string | null
  sent_at: string
  created_at: string
}

export interface PaginatedNotifications {
  notifications: NotificationRow[]
  total: number
  unread_count: number
}
