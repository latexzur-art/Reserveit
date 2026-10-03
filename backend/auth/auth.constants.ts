/**
 * Authentication Constants for ReserveIT
 *
 * @module backend/auth/auth.constants
 */

import { ROLE_HOME } from '@/lib/routes'

/**
 * Role-based route configuration
 * Maps each role to its default dashboard route.
 * Derived from ROLE_HOME in lib/routes.ts — single source of truth.
 */
export const ROLE_ROUTES: Record<string, string> = ROLE_HOME

/**
 * Role priority for routing (lower number = higher priority)
 * When a user has multiple roles, they're routed to the highest priority dashboard
 */
export const ROLE_PRIORITY: string[] = [
  'it_admin',        // Priority 1 (Highest)
  'building_admin',  // Priority 2
  'pamo_officer',    // Priority 3
  'academic_head',   // Priority 4
  'program_head',    // Priority 5
  'faculty',         // Priority 6
  'external_client', // Priority 7 (Lowest)
]

/**
 * Role display configuration with badge colors
 */
export const ROLE_CONFIG: Record<string, { displayName: string; badgeColor: string; isInternalOnly: boolean }> = {
  it_admin: { displayName: 'IT Admin', badgeColor: 'gray', isInternalOnly: true },
  building_admin: { displayName: 'Building Admin', badgeColor: 'red', isInternalOnly: true },
  pamo_officer: { displayName: 'PAMO Officer', badgeColor: 'orange', isInternalOnly: true },
  academic_head: { displayName: 'Academic Head', badgeColor: 'purple', isInternalOnly: true },
  program_head: { displayName: 'Program Head', badgeColor: 'yellow', isInternalOnly: true },
  faculty: { displayName: 'Faculty', badgeColor: 'teal', isInternalOnly: true },
  external_client: { displayName: 'External Client', badgeColor: 'orange', isInternalOnly: false },
}

/**
 * Internal email domains that require MS365 SSO
 */
export const INTERNAL_DOMAINS = [
  '@reserveitlucena.onmicrosoft.com',
  '@lucena.sti.edu.ph',
  '@sti.edu.ph',
]

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/auth/callback',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/unauthorized',
]

/**
 * Error messages
 */
export const AUTH_ERRORS = {
  UNAUTHORIZED_INTERNAL: 'Access denied. STI employees must be pre-registered by the IT Admin before signing in.',
  ACCOUNT_SUSPENDED: 'Your account has been suspended. Please contact the administrator.',
  ACCOUNT_INACTIVE: 'Your account is inactive. Please contact the IT Admin.',
  ACCOUNT_PENDING: 'Your account is pending activation. Please wait for the IT Admin to activate your account.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  STI_EMAIL_NOT_ALLOWED: 'STI employees should use Microsoft Sign-In.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
}
