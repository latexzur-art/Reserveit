import { NextResponse } from 'next/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'

type RoleName = string

function unauthorized(authError: string | null) {
  return {
    error: NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 }),
    user: null,
  }
}

function forbidden(message: string) {
  return {
    error: NextResponse.json({ error: message }, { status: 403 }),
    user: null,
  }
}

async function getProfileOrUnauthorized() {
  const { user: profile, error: authError } = await getAuthUserWithRoles()
  if (!profile) {
    console.error('[auth-guard] Authentication failed:', authError)
    return { profile: null, unauth: unauthorized(authError) }
  }
  return { profile, unauth: null }
}

function rolesOf(profile: { roles?: { name: string }[] | null }): RoleName[] {
  return (profile.roles ?? []).map((r) => r.name)
}

function hasAny(roles: RoleName[], allowed: RoleName[]): boolean {
  return roles.some((r) => allowed.includes(r))
}

/** Require any authenticated user (internal or external). */
export async function requireAuthenticatedUser() {
  const { profile, unauth } = await getProfileOrUnauthorized()
  if (unauth) return unauth
  return { error: null, user: profile }
}

/** Any authenticated internal user (alias preserved for schedules call sites). */
export const requireAuthenticatedInternal = requireAuthenticatedUser

/** Broad building-admin guard: building_admin | academic_head. */
export async function requireBuildingAdmin() {
  const { profile, unauth } = await getProfileOrUnauthorized()
  if (unauth) return unauth
  // ponytail: it_admin (user-manager) has no business in booking ops; dropped it.
  if (!hasAny(rolesOf(profile), ['building_admin', 'academic_head'])) {
    return forbidden('Forbidden: building admin role required')
  }
  return { error: null, user: profile }
}

/** Strict building-admin guard: only building_admin. */
export async function requireBuildingAdminStrict() {
  const { profile, unauth } = await getProfileOrUnauthorized()
  if (unauth) return unauth
  if (!rolesOf(profile).includes('building_admin')) {
    return forbidden('Forbidden: building_admin role required')
  }
  return { error: null, user: profile }
}

/** Strict academic-head guard: only academic_head. */
export async function requireAcademicHead() {
  const { profile, unauth } = await getProfileOrUnauthorized()
  if (unauth) return unauth
  if (!rolesOf(profile).includes('academic_head')) {
    return forbidden('Forbidden: academic head role required')
  }
  return { error: null, user: profile }
}

/** Broad academic-head guard for schedule endpoints: academic_head | building_admin. */
export async function requireAcademicHeadOrBuildingAdmin() {
  const { profile, unauth } = await getProfileOrUnauthorized()
  if (unauth) return unauth
  if (!hasAny(rolesOf(profile), ['academic_head', 'building_admin'])) {
    return forbidden('Forbidden: academic head role required')
  }
  return { error: null, user: profile }
}

/** Program-head guard for schedule uploads: program_head | academic_head | building_admin. */
export async function requireProgramHead() {
  const { profile, unauth } = await getProfileOrUnauthorized()
  if (unauth) return unauth
  if (!hasAny(rolesOf(profile), ['program_head', 'academic_head', 'building_admin'])) {
    return forbidden('Forbidden: program head role required')
  }
  return { error: null, user: profile }
}

/** User-manager guard: only it_admin. */
export async function requireUserManager() {
  const { profile, unauth } = await getProfileOrUnauthorized()
  if (unauth) return unauth
  if (!rolesOf(profile).includes('it_admin')) {
    return forbidden('Forbidden: it_admin role required')
  }
  return { error: null, user: profile }
}

/** PAMO guard: pamo_officer or pamo (non-tech equipment inventory owner). */
export async function requirePamo() {
  const { profile, unauth } = await getProfileOrUnauthorized()
  if (unauth) return unauth
  if (!hasAny(rolesOf(profile), ['pamo_officer', 'pamo'])) {
    return forbidden('Forbidden: PAMO role required')
  }
  return { error: null, user: profile }
}
