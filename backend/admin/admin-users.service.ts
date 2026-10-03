/**
 * Admin Users Service
 *
 * Extends existing AdminAuthService with enhanced user management,
 * pagination, stats, bulk operations, and department queries.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { AdminAuthService } from '@/backend/auth/auth.service'

export const AdminUsersService = {
  // Reuse existing methods from AdminAuthService
  createInternalUser: AdminAuthService.createInternalUser,
  updateAccountStatus: AdminAuthService.updateAccountStatus,
  assignRole: AdminAuthService.assignRole,
  removeRole: AdminAuthService.removeRole,
  deleteUser: AdminAuthService.deleteUser,
  getRoles: AdminAuthService.getRoles,

  /**
   * Get all users with pagination and enhanced joins
   */
  async getAllUsers(filters?: {
    userType?: 'internal' | 'external'
    accountStatus?: string
    roleName?: string
    search?: string
    page?: number
    pageSize?: number
    archived?: boolean
  }) {
    const supabase = createAdminClient()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('users')
      .select(`
        *,
        department:departments!users_department_id_fkey(id, code, name),
        user_roles!user_roles_user_id_fkey(
          is_active,
          role:roles(id, name, display_name, badge_color)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // Filter active vs archived users
    query = query.eq('is_active', !filters?.archived)

    if (filters?.userType) {
      query = query.eq('user_type', filters.userType)
    }

    if (filters?.accountStatus) {
      query = query.eq('account_status', filters.accountStatus)
    }

    if (filters?.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(error.message)
    }

    // Filter by role name client-side if needed (Supabase doesn't easily filter on nested joins)
    let filtered = data || []
    if (filters?.roleName) {
      filtered = filtered.filter((user: any) =>
        user.user_roles?.some(
          (ur: any) => ur.is_active && ur.role?.name === filters.roleName
        )
      )
    }

    return { data: filtered, total: count || 0 }
  },

  /**
   * Get user statistics for dashboard cards
   */
  async getUserStats() {
    const supabase = createAdminClient()

    const [totalRes, internalRes, externalRes, facultyRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('user_type', 'internal'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('user_type', 'external'),
      supabase
        .from('user_roles')
        .select('user_id, role:roles!inner(name)', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('roles.name', 'faculty'),
    ])

    return {
      total_users: totalRes.count || 0,
      internal_users: internalRes.count || 0,
      external_users: externalRes.count || 0,
      faculty_count: facultyRes.count || 0,
    }
  },

  /**
   * Update user profile fields
   */
  async updateUser(userId: string, updates: {
    fullName?: string
    phone?: string
    departmentId?: string | null
    email?: string
    notificationEmail?: string | null
  }) {
    const supabase = createAdminClient()

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (updates.fullName !== undefined) updateData.full_name = updates.fullName
    if (updates.phone !== undefined) updateData.phone = updates.phone
    if (updates.departmentId !== undefined) updateData.department_id = updates.departmentId
    if (updates.email !== undefined) updateData.email = updates.email.toLowerCase()
    if (updates.notificationEmail !== undefined) updateData.notification_email = updates.notificationEmail || null

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  /**
   * Bulk update account status
   */
  async bulkUpdateStatus(userIds: string[], status: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('users')
      .update({ account_status: status, updated_at: new Date().toISOString() })
      .in('id', userIds)

    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  /**
   * Bulk soft-delete users (set inactive)
   */
  async bulkDelete(userIds: string[]) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('users')
      .update({
        account_status: 'inactive',
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .in('id', userIds)

    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  /**
   * Permanently delete a user. Reassigns their bookings/payments/uploads/etc.
   * to the sentinel [Deleted User] row so historical records survive.
   */
  async permanentDeleteUser(userId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_permanent_delete_user', { p_user_id: userId })
    if (error) return { success: false, error: error.message }
    return data as { success: boolean; error?: string }
  },

  /**
   * Restore an archived user back to active
   */
  async restoreUser(userId: string) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('users')
      .update({
        account_status: 'active',
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  /**
   * Get all active departments for dropdowns
   */
  async getDepartments() {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('departments')
      .select('id, code, name')
      .eq('is_active', true)
      .order('code')

    if (error) throw new Error(error.message)
    return data || []
  },
}
