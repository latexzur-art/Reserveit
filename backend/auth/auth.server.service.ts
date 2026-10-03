/**
 * Server-side auth service (route handlers / server components).
 * @module backend/auth/auth.server.service
 */

import { createClient } from '@/lib/supabase/client'
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server'
import { AUTH_ERRORS } from './auth.constants'
import { isInternalEmail, getDefaultRoute } from './auth.utils'
import type { AuthUser, SignInResult, SignUpData } from './auth.types'
import { transformUserResponse } from './auth.transforms'

export const ServerAuthService = {
  /**
   * Get the current user on the server side
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const supabase = await createServerClient()

    const { data: result, error } = await supabase.rpc('get_current_user_with_roles')

    if (error || !result) {
      return null
    }

    return transformUserResponse(result)
  },

  /**
   * Get the current session on the server side
   */
  async getSession() {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession()
    return !!session
  },

  /**
   * Check if current user has a specific role
   */
  async hasRole(roleName: string): Promise<boolean> {
    const user = await this.getCurrentUser()
    if (!user) return false
    return user.roles.some(r => r.name === roleName)
  },

  /**
   * Check if current user has any of the specified roles
   */
  async hasAnyRole(roleNames: string[]): Promise<boolean> {
    const user = await this.getCurrentUser()
    if (!user) return false
    return user.roles.some(r => roleNames.includes(r.name))
  },
}

/**
 * Admin auth service for user management (requires service role)
 */
