/**
 * Admin Settings Service
 *
 * Manages system settings (key-value store) and role CRUD operations.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type { GeneralSettings, RoleDetail } from './admin.types'

export const AdminSettingsService = {
  // ─── System Settings ─────────────────────────────────────

  async getSettings(category?: string): Promise<Record<string, any>> {
    const supabase = createAdminClient()

    let query = supabase.from('system_settings').select('key, value')
    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const settings: Record<string, any> = {}
    for (const row of data || []) {
      settings[row.key] = row.value
    }
    return settings
  },

  async updateSettings(
    settings: Partial<GeneralSettings>,
    updatedBy: string,
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient()

    const entries = Object.entries(settings).filter(
      ([, v]) => v !== undefined,
    )

    for (const [key, value] of entries) {
      const { error } = await supabase
        .from('system_settings')
        .update({
          value: JSON.stringify(value),
          updated_by: updatedBy,
        })
        .eq('key', key)

      if (error) return { success: false, error: error.message }
    }

    return { success: true }
  },

  // ─── Role CRUD ────────────────────────────────────────────

  async getRolesWithCounts(): Promise<RoleDetail[]> {
    const supabase = createAdminClient()

    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    // Get user counts per role
    const { data: counts } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('is_active', true)

    const countMap: Record<string, number> = {}
    for (const row of counts || []) {
      countMap[row.role_id] = (countMap[row.role_id] || 0) + 1
    }

    return (roles || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      displayName: r.display_name || r.name,
      description: r.description || '',
      badgeColor: r.badge_color || 'gray',
      isInternalOnly: r.is_internal_only ?? true,
      permissions: r.permissions || {},
      isActive: r.is_active ?? true,
      userCount: countMap[r.id] || 0,
    }))
  },

  async getRoleWithUsers(roleId: string) {
    const supabase = createAdminClient()

    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single()

    if (roleError) throw new Error(roleError.message)

    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('user:users!user_roles_user_id_fkey(id, full_name, email, account_status)')
      .eq('role_id', roleId)
      .eq('is_active', true)

    const users = (userRoles || [])
      .map((ur: any) => ur.user)
      .filter(Boolean)
      .map((u: any) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        status: u.account_status,
      }))

    return {
      role: {
        id: role.id,
        name: role.name,
        displayName: role.display_name || role.name,
        description: role.description || '',
        badgeColor: role.badge_color || 'gray',
        isInternalOnly: role.is_internal_only ?? true,
        permissions: role.permissions || {},
        isActive: role.is_active ?? true,
        userCount: users.length,
      },
      users,
    }
  },

  async createRole(data: {
    name: string
    displayName: string
    description: string
    badgeColor: string
    isInternalOnly: boolean
    permissions: Record<string, string[]>
  }): Promise<{ success: boolean; roleId?: string; error?: string }> {
    const supabase = createAdminClient()

    const { data: role, error } = await supabase
      .from('roles')
      .insert({
        name: data.name,
        display_name: data.displayName,
        description: data.description,
        badge_color: data.badgeColor,
        is_internal_only: data.isInternalOnly,
        permissions: data.permissions,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, roleId: role.id }
  },

  async updateRole(
    roleId: string,
    updates: {
      displayName?: string
      description?: string
      badgeColor?: string
      isInternalOnly?: boolean
      permissions?: Record<string, string[]>
      isActive?: boolean
    },
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient()

    const updateData: Record<string, any> = {}
    if (updates.displayName !== undefined) updateData.display_name = updates.displayName
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.badgeColor !== undefined) updateData.badge_color = updates.badgeColor
    if (updates.isInternalOnly !== undefined) updateData.is_internal_only = updates.isInternalOnly
    if (updates.permissions !== undefined) updateData.permissions = updates.permissions
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive

    const { error } = await supabase
      .from('roles')
      .update(updateData)
      .eq('id', roleId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  async deactivateRole(roleId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('roles')
      .update({ is_active: false })
      .eq('id', roleId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  },
}
