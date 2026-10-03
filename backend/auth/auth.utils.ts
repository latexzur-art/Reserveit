/**
 * Authentication Utility Functions for ReserveIT
 *
 * @module backend/auth/auth.utils
 */

import { ROLE_PRIORITY, INTERNAL_DOMAINS } from './auth.constants'
import { ROLE_HOME } from '@/lib/routes'
import type { UserRole } from './auth.types'

/**
 * Determines the default route based on user roles
 * Uses role priority to select the highest-priority dashboard.
 * Landing pages come from ROLE_HOME in lib/routes.ts — single source of truth.
 */
export function getDefaultRoute(roles: UserRole[] | string[]): string {
  const rawRoleNames = roles.map(r => typeof r === 'string' ? r : r.name)
  const roleNames = rawRoleNames.map(r => (r === 'pamo' ? 'pamo_officer' : r))

  for (const role of ROLE_PRIORITY) {
    if (roleNames.includes(role)) {
      return ROLE_HOME[role] || '/unauthorized'
    }
  }

  return '/unauthorized'
}

/**
 * Checks if an email belongs to an internal (STI) domain
 */
export function isInternalEmail(email: string): boolean {
  const lowerEmail = email.toLowerCase()
  return INTERNAL_DOMAINS.some(domain => lowerEmail.includes(domain))
}

/**
 * Checks if user has a specific role
 */
export function hasRole(roles: UserRole[] | string[], roleName: string): boolean {
  const roleNames = roles.map(r => typeof r === 'string' ? r : r.name)
  return roleNames.includes(roleName)
}

/**
 * Checks if user has any of the specified roles
 */
export function hasAnyRole(roles: UserRole[] | string[], allowedRoles: string[]): boolean {
  const roleNames = roles.map(r => typeof r === 'string' ? r : r.name)
  return allowedRoles.some(role => roleNames.includes(role))
}

/**
 * Checks if user has all of the specified roles
 */
export function hasAllRoles(roles: UserRole[] | string[], requiredRoles: string[]): boolean {
  const roleNames = roles.map(r => typeof r === 'string' ? r : r.name)
  return requiredRoles.every(role => roleNames.includes(role))
}

/**
 * Gets the highest priority role from a list of roles
 */
export function getHighestPriorityRole(roles: UserRole[] | string[]): string | null {
  const roleNames = roles.map(r => typeof r === 'string' ? r : r.name)

  for (const role of ROLE_PRIORITY) {
    if (roleNames.includes(role)) {
      return role
    }
  }

  return null
}

/**
 * Validates password strength
 * Requirements: 8+ chars, uppercase, lowercase, number
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates Philippine phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  // Accepts: 09XXXXXXXXX or +639XXXXXXXXX
  return /^(09|\+639)\d{9}$/.test(phone)
}

/**
 * Generates a unique employee ID
 * Format: USR-XXXX (e.g., USR-0001)
 */
export function generateEmployeeId(lastId: number): string {
  const nextNumber = lastId + 1
  return `USR-${nextNumber.toString().padStart(4, '0')}`
}

/**
 * Formats user display name for avatars
 * Returns initials (e.g., "John Doe" -> "JD")
 */
export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .map(name => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
