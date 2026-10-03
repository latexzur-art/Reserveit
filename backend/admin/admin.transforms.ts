/**
 * Transform functions between database rows and admin UI types
 */

import type { User, Notification } from './admin.types'
import { roleDbToDisplay, statusDbToDisplay, typeDbToDisplay } from './admin.types'

/**
 * Transform a database user row (with joined roles/department) to the UI User type.
 * The DB row comes from Supabase query with joins:
 * users.*, department:departments(id,code,name), user_roles(role:roles(id,name,display_name,badge_color), is_active)
 */
export function dbUserToView(dbUser: any): User {
  const nameParts = (dbUser.full_name || '').trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  // Extract active roles from the joined data
  const activeRoles = (dbUser.user_roles || [])
    .filter((ur: any) => ur.is_active !== false)
    .map((ur: any) => ur.role)
    .filter(Boolean)

  const primaryRole = activeRoles[0]

  return {
    id: dbUser.id,
    firstName,
    lastName,
    email: dbUser.email || '',
    phone: dbUser.phone || undefined,
    type: (typeDbToDisplay[dbUser.user_type] || 'Internal') as User['type'],
    role: (primaryRole?.display_name || roleDbToDisplay[primaryRole?.name] || 'No Role') as User['role'],
    roleName: primaryRole?.name || '',
    roleId: primaryRole?.id || '',
    department: dbUser.department?.code || 'N/A',
    departmentId: dbUser.department?.id || dbUser.department_id || null,
    organization: dbUser.organization || undefined,
    status: (statusDbToDisplay[dbUser.account_status] || 'Pending') as User['status'],
    bookingsCount: dbUser.bookings_count || 0,
    createdAt: new Date(dbUser.created_at),
    lastLogin: dbUser.last_login_at ? new Date(dbUser.last_login_at) : undefined,
    avatar: dbUser.avatar_url || undefined,
    entraObjectId: dbUser.entra_object_id || undefined,
    notificationEmail: dbUser.notification_email ?? null,
  }
}

/**
 * Transform a database notification row to the UI Notification type.
 */
export function dbNotificationToView(dbNotif: any): Notification {
  return {
    id: dbNotif.id,
    title: dbNotif.title,
    message: dbNotif.message,
    type: dbNotif.type || 'info',
    read: dbNotif.read || false,
    createdAt: new Date(dbNotif.created_at),
    userId: dbNotif.user_id,
  }
}
