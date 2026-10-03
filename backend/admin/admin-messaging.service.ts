import { createAdminClient } from '@/lib/supabase/server'

async function findOrCreateConversation(
  supabase: ReturnType<typeof createAdminClient>,
  userId1: string,
  userId2: string
): Promise<string> {
  const { data: participations } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId1)

  if (participations && participations.length > 0) {
    const convIds = participations.map((p: any) => p.conversation_id)
    const { data: shared } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId2)
      .in('conversation_id', convIds)
      .limit(1)
      .maybeSingle()

    if (shared) return shared.conversation_id
  }

  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({})
    .select('id')
    .single()

  if (error || !conv) throw new Error(error?.message ?? 'Failed to create conversation')

  await supabase.from('conversation_participants').insert([
    { conversation_id: conv.id, user_id: userId1 },
    { conversation_id: conv.id, user_id: userId2 },
  ])

  return conv.id
}

export const AdminMessagingService = {
  async sendMessage(data: {
    senderId: string
    recipientId: string
    subject: string
    body: string
    sendAs: 'email' | 'in-app' | 'both'
  }) {
    const supabase = createAdminClient()

    const conversationId = await findOrCreateConversation(supabase, data.senderId, data.recipientId)

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        sender_id: data.senderId,
        recipient_id: data.recipientId,
        subject: data.subject,
        body: data.body,
        send_as: data.sendAs,
        status: 'sent',
        sent_at: new Date().toISOString(),
        conversation_id: conversationId,
        is_read: false,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    await supabase
      .from('conversations')
      .update({
        last_message_text: data.body.substring(0, 200),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    if (data.sendAs === 'in-app' || data.sendAs === 'both') {
      await supabase.from('notifications').insert({
        user_id: data.recipientId,
        title: `New Message: ${data.subject}`,
        message: data.body.substring(0, 200),
        type: 'info',
        source_type: 'message',
        source_id: message.id,
      })
    }

    return { success: true, messageId: message.id }
  },

  /**
   * Send a broadcast to targeted users
   */
  async sendBroadcast(data: {
    senderId: string
    title: string
    message: string
    targetAudience: 'all' | 'internal' | 'external' | 'admins'
    targetRoles?: string[]
  }) {
    const supabase = createAdminClient()

    const { data: broadcast, error } = await supabase
      .from('broadcasts')
      .insert({
        sender_id: data.senderId,
        title: data.title,
        message: data.message,
        target_audience: data.targetAudience,
        created_by: data.senderId,
        target_roles: data.targetRoles ?? null,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    // Get targeted users
    let userIds: string[] = []

    if (data.targetRoles && data.targetRoles.length > 0) {
      // Role-based targeting
      const { data: roleUsers } = await supabase
        .from('user_roles')
        .select('user_id, roles!inner(name)')
        .in('roles.name', data.targetRoles as any)
        .eq('is_active', true)

      userIds = [...new Set((roleUsers ?? []).map((u: any) => u.user_id))]
    } else {
      // Audience-based targeting
      let userQuery = supabase.from('users').select('id').eq('is_active', true)
      if (data.targetAudience === 'internal') {
        userQuery = userQuery.eq('user_type', 'internal')
      } else if (data.targetAudience === 'external') {
        userQuery = userQuery.eq('user_type', 'external')
      }
      const { data: users } = await userQuery
      userIds = (users ?? []).map((u) => u.id)
    }

    if (userIds.length > 0) {
      const notifications = userIds.map((uid) => ({
        user_id: uid,
        title: data.title,
        message: data.message.substring(0, 200),
        type: 'info' as const,
        source_type: 'broadcast',
        source_id: broadcast.id,
        is_broadcast: true,
        broadcast_id: broadcast.id,
      }))
      await supabase.from('notifications').insert(notifications)
    }

    return { success: true, broadcastId: broadcast.id, recipientCount: userIds.length }
  },

  /**
   * Get notifications for a user
   */
  async getNotifications(userId: string) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw new Error(error.message)
    return data || []
  },

  /**
   * Mark a notification as read
   */
  async markNotificationRead(notificationId: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsRead(userId: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  /**
   * Clear all notifications for a user
   */
  async clearAllNotifications(userId: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  /**
   * Get message templates
   */
  async getTemplates() {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('is_active', true)
      .order('is_system', { ascending: false })
      .order('name')

    if (error) throw new Error(error.message)
    return data || []
  },
}
