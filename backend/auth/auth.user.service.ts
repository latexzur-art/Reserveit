/**
 * Client-side (browser) auth service for React components.
 * @module backend/auth/auth.user.service
 */

import { createClient } from '@/lib/supabase/client'
import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server'
import { AUTH_ERRORS } from './auth.constants'
import { isInternalEmail, getDefaultRoute } from './auth.utils'
import type { AuthUser, SignInResult, SignUpData } from './auth.types'
import { transformUserResponse } from './auth.transforms'

/**
 * Client-side auth service for use in React components
 */
export const AuthService = {
  /**
   * Sign in with Microsoft 365 (for internal STI users)
   */
  async signInWithMicrosoft(): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      throw new Error(error.message)
    }
  },

  /**
   * Sign in with email/password (for external users only)
   */
  async signInWithEmail(email: string, password: string): Promise<SignInResult> {
    // Block STI emails from using email/password auth
    if (isInternalEmail(email)) {
      return {
        success: false,
        error: AUTH_ERRORS.STI_EMAIL_NOT_ALLOWED,
      }
    }

    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    // Fetch user profile with roles
    const user = await this.getCurrentUser()

    if (!user) {
      return {
        success: false,
        error: AUTH_ERRORS.UNAUTHORIZED_INTERNAL,
      }
    }

    // Check account status
    if (user.accountStatus === 'suspended') {
      await supabase.auth.signOut()
      return { success: false, error: AUTH_ERRORS.ACCOUNT_SUSPENDED }
    }

    if (user.accountStatus === 'inactive') {
      await supabase.auth.signOut()
      return { success: false, error: AUTH_ERRORS.ACCOUNT_INACTIVE }
    }

    return {
      success: true,
      user,
      redirectTo: getDefaultRoute(user.roles),
    }
  },

  /**
   * Sign up a new external user
   */
  async signUp(data: SignUpData): Promise<SignInResult> {
    // Block STI emails from self-registration
    if (isInternalEmail(data.email)) {
      return {
        success: false,
        error: AUTH_ERRORS.STI_EMAIL_NOT_ALLOWED,
      }
    }

    const supabase = createClient()

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          phone: data.phone,
          organization_name: data.organizationName,
          organization_type: data.organizationType,
        },
        emailRedirectTo: `${window.location.origin}/auth/verify-email`,
      },
    })

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      redirectTo: '/auth/verify-email',
    }
  },

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    const supabase = createClient()
    await supabase.auth.signOut()
  },

  /**
   * Get the current authenticated user with roles
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const supabase = createClient()

    const { data: result, error } = await supabase.rpc('get_current_user_with_roles')

    if (error || !result) {
      return null
    }

    return transformUserResponse(result)
  },

  /**
   * Get the current auth session
   */
  async getSession() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    const supabase = createClient()
    return supabase.auth.onAuthStateChange(callback)
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    if (isInternalEmail(email)) {
      return {
        success: false,
        error: 'STI employees should reset their password through Microsoft 365.',
      }
    }

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  },

  /**
   * Update password (after reset)
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  },
}

/**
 * Server-side auth service for use in API routes and server components
 */
