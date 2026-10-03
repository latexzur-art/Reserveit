/**
 * Authentication Types for ReserveIT
 *
 * @module backend/auth/auth.types
 */

export type UserType = 'internal' | 'external'

export type AccountStatus = 'pending' | 'active' | 'suspended' | 'inactive' | 'restricted' | 'probation'

export interface UserRole {
  id: string
  name: string
  displayName: string
  badgeColor: string
}

export interface UserDepartment {
  id: string
  code: string
  name: string
}

export interface AuthUser {
  id: string
  authUserId: string | null
  email: string
  fullName: string
  userType: UserType
  accountStatus: AccountStatus
  mustChangePassword?: boolean
  employeeId: string | null
  phone: string | null
  avatarUrl: string | null
  notificationEmail: string | null
  gender: string | null
  language: string | null
  emailVerified: boolean
  lastLoginAt: string | null
  department: UserDepartment | null
  roles: UserRole[]
}

export interface SignInResult {
  success: boolean
  user?: AuthUser
  error?: string
  redirectTo?: string
}

export interface SignUpData {
  email: string
  password: string
  fullName: string
  phone?: string
  organizationName?: string
  organizationType?: string
  address?: string
  city?: string
  province?: string
}

export interface CreateInternalUserData {
  email: string
  fullName: string
  employeeId?: string
  departmentId?: string
  roleIds: string[]
  phone?: string
}

export interface RoleRoute {
  role: string
  route: string
  priority: number
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: AuthUser
}
