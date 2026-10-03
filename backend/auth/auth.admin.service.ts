/**
 * Admin (service-role) auth operations.
 * @module backend/auth/auth.admin.service
 */

import { createClient } from '@/lib/supabase/client'
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server'
import { AUTH_ERRORS } from './auth.constants'
import { isInternalEmail, getDefaultRoute } from './auth.utils'
import type { AuthUser, SignInResult, SignUpData } from './auth.types'
import { transformUserResponse } from './auth.transforms'

export const AdminAuthService = {
  /**
   * Create a new internal user (IT Admin only)
   * This creates the user entry WITHOUT an auth account
   * The user will link their account on first MS365 sign-in
   */
  async createInternalUser(data: {
    email: string
    fullName: string
    employeeId?: string
    departmentId?: string
    roleIds: string[]
    phone?: string
    notificationEmail?: string
    createdBy: string
    entraObjectId?: string
    userType?: 'internal' | 'external'
    temporaryPassword?: string
  }): Promise<{ success: boolean; userId?: string; temporaryPassword?: string; error?: string }> {
    const supabase = createAdminClient()

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', data.email.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      return {
        success: false,
        error: 'A user with this email already exists. Please use a different email address.'
      }
    }

    // External user with temporary password creation
    if (data.userType === 'external' && data.temporaryPassword) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email.toLowerCase(),
        password: data.temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      })

      if (authError || !authData.user) {
        return { success: false, error: authError?.message || 'Failed to create auth user.' }
      }

      const userId = authData.user.id

      // Update the public.users record created by trigger
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: data.fullName,
          phone: data.phone ?? null,
          user_type: 'external',
          account_status: 'active',
          must_change_password: true,
          created_by: data.createdBy,
        })
        .eq('id', userId)

      if (updateError) {
        await supabase.auth.admin.deleteUser(userId)
        return { success: false, error: updateError.message }
      }

      // Assign roles using upsert to avoid duplicate key error if trigger already assigned it
      if (data.roleIds.length > 0) {
        const roleAssignments = data.roleIds.map(roleId => ({
          user_id: userId,
          role_id: roleId,
          assigned_by: data.createdBy,
          is_active: true,
        }))

        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert(roleAssignments, { onConflict: 'user_id,role_id' })

        if (roleError) {
          await supabase.from('users').delete().eq('id', userId)
          await supabase.auth.admin.deleteUser(userId)
          return { success: false, error: formatUserCreationError(roleError.message) }
        }
      }

      return { success: true, userId, temporaryPassword: data.temporaryPassword }
    }

    // Insert internal user (no auth account yet)
    const id = crypto.randomUUID()
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id,
        email: data.email.toLowerCase(),
        full_name: data.fullName,
        employee_id: data.employeeId,
        department_id: data.departmentId,
        phone: data.phone,
        notification_email: data.notificationEmail ?? null,
        user_type: data.userType || 'internal',
        account_status: 'pending',
        is_active: true,
        created_by: data.createdBy,
        entra_object_id: data.entraObjectId ?? null,
      })
      .select('id')
      .single()

    if (userError) {
      return { success: false, error: formatUserCreationError(userError.message) }
    }

    // Assign roles
    if (data.roleIds.length > 0) {
      const roleAssignments = data.roleIds.map(roleId => ({
        user_id: user.id,
        role_id: roleId,
        assigned_by: data.createdBy,
        is_active: true,
      }))

      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert(roleAssignments, { onConflict: 'user_id,role_id' })

      if (roleError) {
        // Rollback user creation
        await supabase.from('users').delete().eq('id', user.id)
        return { success: false, error: formatUserCreationError(roleError.message) }
      }
    }

    return { success: true, userId: user.id }
  },

  /**
   * Update user account status
   */
  async updateAccountStatus(
    userId: string,
    status: 'pending' | 'active' | 'suspended' | 'inactive'
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('users')
      .update({ account_status: status, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  },

  /**
   * Assign a role to a user
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient()

    const { error } = await supabase.from('user_roles').upsert(
      {
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
        is_active: true,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,role_id' }
    )

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  },

  /**
   * Remove a role from a user
   */
  async removeRole(userId: string, roleId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('user_roles')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('role_id', roleId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  },

  /**
   * Delete a user (soft delete by setting inactive)
   */
  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('users')
      .update({
        account_status: 'inactive',
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  },

  /**
   * Get all users (for IT Admin dashboard)
   */
  async getAllUsers(filters?: {
    userType?: 'internal' | 'external'
    accountStatus?: string
    roleId?: string
    search?: string
  }) {
    const supabase = createAdminClient()

    let query = supabase
      .from('users')
      .select(`
        *,
        department:departments(id, code, name),
        user_roles(
          role:roles(id, name, description)
        )
      `)
      .order('created_at', { ascending: false })

    if (filters?.userType) {
      query = query.eq('user_type', filters.userType)
    }

    if (filters?.accountStatus) {
      query = query.eq('account_status', filters.accountStatus)
    }

    if (filters?.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    return data
  },

  /**
   * Get all available roles
   */
  async getRoles() {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      throw new Error(error.message)
    }

    return data
  },
}

/**
 * Format raw database user creation errors into user-friendly error messages.
 */
export function formatUserCreationError(rawError: string): string {
  if (
    rawError.includes('user_roles_user_id_role_id_key') ||
    rawError.includes('duplicate key value violates unique constraint "user_roles_user_id_role_id_key"')
  ) {
    return 'Role assignment failed: This user already has this role assigned.'
  }
  if (
    rawError.includes('users_email_key') ||
    rawError.includes('duplicate key value violates unique constraint "users_email_key"') ||
    rawError.includes('23505')
  ) {
    return 'A user with this email address already exists. Please use a different email address.'
  }
  return rawError
}

