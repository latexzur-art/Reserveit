/**
 * Client-side Authentication Service for ReserveIT
 *
 * This module contains only client-safe authentication operations.
 * Use this in React components and client-side code.
 *
 * @module backend/auth/auth.client
 */

import { createClient } from '@/lib/supabase/client'
import { isInternalEmail, getDefaultRoute } from './auth.utils'
import type { AuthUser, SignInResult, SignUpData } from './auth.types'

/**
 * Transform database response to AuthUser type
 */
function transformUserResponse(data: any): AuthUser {
  return {
    id: data.id,
    authUserId: data.auth_user_id,
    email: data.email,
    fullName: data.full_name,
    userType: data.user_type,
    accountStatus: data.account_status,
    mustChangePassword: data.must_change_password ?? false,
    employeeId: data.employee_id,
    phone: data.phone,
    avatarUrl: data.avatar_url,
    notificationEmail: data.notification_email ?? null,
    gender: data.gender ?? null,
    language: data.language ?? null,
    emailVerified: data.email_verified,
    lastLoginAt: data.last_login_at,
    department: data.department,
    roles: data.roles || [],
  }
}

/**
 * Client-side auth service for use in React components
 */
export const AuthService = {
  /**
   * Sign in with Microsoft 365 (for internal STI users)
   * Uses a server-side API route to avoid the hanging browser Supabase client.
   */
  async signInWithMicrosoft(): Promise<void> {
    // Marks this tab as an Azure flow so the callback page knows it's safe to
    // auto-retry on transient Azure failures (without affecting other flows).
    sessionStorage.setItem('auth_flow', 'azure')
    window.location.href = '/api/auth/login/microsoft'
  },

  /**
   * Sign in with email/password (for external users only)
   * Uses a server-side API route to avoid the hanging browser Supabase client.
   */
  async signInWithEmail(email: string, password: string): Promise<SignInResult> {
    const res = await fetch('/api/auth/login/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data?.error ?? 'Sign in failed. Please try again.' }
    }

    return { success: true, redirectTo: '/client/dashboard' }
  },

  /**
   * Sign in with Google (for external users)
   * Uses a server-side API route to avoid the hanging browser Supabase client.
   */
  async signInWithGoogle(): Promise<void> {
    window.location.href = '/api/auth/login/google'
  },

  /**
   * Sign up a new external user
   * Uses a server-side API route to avoid the hanging browser Supabase client.
   */
  async signUp(data: SignUpData): Promise<SignInResult> {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      return { success: false, error: json?.error ?? 'Sign up failed. Please try again.' }
    }

    return { success: true, redirectTo: '/auth/verify-email' }
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
