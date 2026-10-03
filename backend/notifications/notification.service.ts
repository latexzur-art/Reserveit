/**
 * Centralized Notification Service
 *
 * All notification CRUD operations. Uses service_role (admin) client
 * to bypass RLS for server-side operations.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type {
  NotificationPayload,
  NotificationRow,
  BroadcastPayload,
  PaginatedNotifications,
} from './notification.types'

export const NotificationService = {
  /**
   * Create a single notification
   */
  async create(payload: NotificationPayload): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase.from('notifications').insert({
      user_id: payload.user_id,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      source_type: payload.source_type ?? null,
      source_id: payload.source_id ?? null,
      priority: payload.priority ?? 'normal',
      action_url: payload.action_url ?? null,
      metadata: payload.metadata ?? {},
      expires_at: payload.expires_at ?? null,
      is_broadcast: payload.is_broadcast ?? false,
      broadcast_id: payload.broadcast_id ?? null,
      read: false,
    })

    if (error) {
      console.error('[NotificationService.create] Failed:', error.message)
      throw new Error(`Failed to create notification: ${error.message}`)
    }
  },

  /**
   * Create multiple notifications in a single insert
   */
  async createBulk(payloads: NotificationPayload[]): Promise<void> {
    if (payloads.length === 0) return

    const supabase = createAdminClient()
    const rows = payloads.map((p) => ({
      user_id: p.user_id,
      title: p.title,
      message: p.message,
      type: p.type,
      source_type: p.source_type ?? null,
      source_id: p.source_id ?? null,
      priority: p.priority ?? 'normal',
      action_url: p.action_url ?? null,
      metadata: p.metadata ?? {},
      expires_at: p.expires_at ?? null,
      is_broadcast: p.is_broadcast ?? false,
      broadcast_id: p.broadcast_id ?? null,
      read: false,
    }))

    const { error } = await supabase.from('notifications').insert(rows)

    if (error) {
      console.error('[NotificationService.createBulk] Failed:', error.message)
      throw new Error(`Failed to create bulk notifications: ${error.message}`)
    }
  },

  /**
   * Create notifications for all users with given roles
   */
  async createForRoles(
    roleNames: string[],
    payload: Omit<NotificationPayload, 'user_id'>
  ): Promise<number> {
    const supabase = createAdminClient()

    const { data: users, error } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .in('roles.name', roleNames)
      .eq('is_active', true)

    if (error || !users) return 0

    const uniqueUserIds = [
      ...new Set((users as Array<{ user_id: string }>).map((u) => u.user_id)),
    ]

    if (uniqueUserIds.length === 0) return 0

    await this.createBulk(
      uniqueUserIds.map((userId) => ({ ...payload, user_id: userId }))
    )

    return uniqueUserIds.length
  },

  /**
   * Get paginated notifications for a user
   */
  async getUserNotifications(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<PaginatedNotifications> {
    const supabase = createAdminClient()
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (options.unreadOnly) {
      query = query.eq('read', false)
    }

    const { data, count, error } = await query

    if (error) {
      console.error('[NotificationService.getUserNotifications] Failed:', error.message)
      throw new Error(error.message)
    }

    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    return {
      notifications: (data as NotificationRow[]) ?? [],
      total: count ?? 0,
      unread_count: unreadCount ?? 0,
    }
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const supabase = createAdminClient()

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) return 0
    return count ?? 0
  },

  /**
   * Mark a single notification as read
   */
  async markRead(notificationId: string, userId: string): Promise<void> {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`)
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllRead(userId: string): Promise<void> {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) {
      throw new Error(`Failed to mark all as read: ${error.message}`)
    }
  },

  /**
   * Delete a single notification
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete notification: ${error.message}`)
    }
  },

  /**
   * Delete all notifications for a user
   */
  async deleteAll(userId: string): Promise<void> {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete all notifications: ${error.message}`)
    }
  },

  /**
   * Send a broadcast — inserts into broadcasts table and fans out to notifications
   */
  async createBroadcast(
    payload: BroadcastPayload
  ): Promise<{ broadcastId: string; recipientCount: number }> {
    const supabase = createAdminClient()

    // Insert broadcast record
    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .insert({
        sender_id: payload.sender_id,
        title: payload.title,
        message: payload.message,
        target_audience: payload.target_audience ?? 'all',
        target_roles: payload.target_roles ?? null,
        created_by: payload.sender_id,
        action_url: payload.action_url ?? null,
        metadata: payload.metadata ?? {},
        expires_at: payload.expires_at ?? null,
      })
      .select()
      .single()

    if (broadcastError || !broadcast) {
      throw new Error(`Failed to create broadcast: ${broadcastError?.message}`)
    }

    // Get targeted users
    let userIds: string[] = []

    if (payload.target_roles && payload.target_roles.length > 0) {
      // Role-based targeting
      const { data: users } = await supabase
        .from('user_roles')
        .select('user_id, roles!inner(name)')
        .in('roles.name', payload.target_roles)
        .eq('is_active', true)

      if (users) {
        userIds = [
          ...new Set(
            (users as Array<{ user_id: string }>).map((u) => u.user_id)
          ),
        ]
      }
    } else {
      // Audience-based targeting (legacy)
      let userQuery = supabase.from('users').select('id').eq('is_active', true)
      if (payload.target_audience === 'internal') {
        userQuery = userQuery.eq('user_type', 'internal')
      } else if (payload.target_audience === 'external') {
        userQuery = userQuery.eq('user_type', 'external')
      }

      const { data: users } = await userQuery
      if (users) {
        userIds = users.map((u) => u.id)
      }
    }

    // Fan out to individual notifications
    if (userIds.length > 0) {
      const notifications = userIds.map((userId) => ({
        user_id: userId,
        title: payload.title,
        message: payload.message.substring(0, 500),
        type: 'info' as const,
        source_type: 'broadcast',
        source_id: broadcast.id,
        priority: 'normal',
        is_broadcast: true,
        broadcast_id: broadcast.id,
        action_url: payload.action_url ?? null,
        metadata: payload.metadata ?? {},
        expires_at: payload.expires_at ?? null,
        read: false,
      }))

      await supabase.from('notifications').insert(notifications)
    }

    return { broadcastId: broadcast.id, recipientCount: userIds.length }
  },

  /**
   * Get broadcast history with pagination
   */
  async getBroadcasts(options: { limit?: number; offset?: number } = {}) {
    const supabase = createAdminClient()
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0

    const { data, count, error } = await supabase
      .from('broadcasts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)

    return {
      broadcasts: data ?? [],
      total: count ?? 0,
    }
  },

  /**
   * Purge expired notifications
   */
  async purgeExpired(): Promise<number> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .not('expires_at', 'is', null)
      .select('id')

    if (error) {
      console.error('[NotificationService.purgeExpired] Failed:', error.message)
      return 0
    }
    return data?.length ?? 0
  },

  /**
   * Purge old read notifications
   */
  async purgeOldRead(olderThanDays: number = 30): Promise<number> {
    const supabase = createAdminClient()
    const cutoff = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('read', true)
      .lt('created_at', cutoff)
      .select('id')

    if (error) {
      console.error('[NotificationService.purgeOldRead] Failed:', error.message)
      return 0
    }
    return data?.length ?? 0
  },
}
