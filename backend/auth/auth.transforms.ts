/**
 * Shared user-row → AuthUser transform.
 * @module backend/auth/auth.transforms
 */

import type { AuthUser } from './auth.types'

export function transformUserResponse(data: any): AuthUser {
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
