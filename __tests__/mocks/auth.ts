import { vi } from 'vitest'

export const mockAcademicHeadUser = {
  id: 'user-ah-001',
  email: 'academic.head@test.com',
  full_name: 'Test Academic Head',
  roles: [{ name: 'academic_head' }],
  departments: [{ id: 'dept-001', code: 'CS', name: 'Computer Science' }],
}

export const mockProgramHeadUser = {
  id: 'user-ph-001',
  email: 'program.head@test.com',
  full_name: 'Test Program Head',
  roles: [{ name: 'program_head' }],
  departments: [{ id: 'dept-001', code: 'CS', name: 'Computer Science' }],
}

export const mockFacultyUser = {
  id: 'user-fac-001',
  email: 'faculty@test.com',
  full_name: 'Test Faculty',
  roles: [{ name: 'faculty' }],
  departments: [{ id: 'dept-001', code: 'CS', name: 'Computer Science' }],
}

export const mockBuildingAdminUser = {
  id: 'user-ba-001',
  email: 'ba@test.com',
  full_name: 'Test Building Admin',
  roles: [{ name: 'building_admin' }],
  departments: [{ id: 'dept-001', code: 'CS', name: 'Computer Science' }],
}

/**
 * Mock the auth guard module. Call this in your test file:
 *   vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockAcademicHeadUser))
 */
export function mockAuthGuard(user: typeof mockAcademicHeadUser) {
  const result = { error: null, user }
  return {
    requireAuthenticatedUser: vi.fn().mockResolvedValue(result),
    requireAuthenticatedInternal: vi.fn().mockResolvedValue(result),
    requireBuildingAdmin: vi.fn().mockResolvedValue(result),
    requireBuildingAdminStrict: vi.fn().mockResolvedValue(result),
    requireAcademicHead: vi.fn().mockResolvedValue(result),
    requireAcademicHeadOrBuildingAdmin: vi.fn().mockResolvedValue(result),
    requireProgramHead: vi.fn().mockResolvedValue(result),
    requireUserManager: vi.fn().mockResolvedValue(result),
  }
}

/**
 * Mock useAuth hook return value
 */
export function mockUseAuth(user: typeof mockAcademicHeadUser | null = mockAcademicHeadUser) {
  return {
    user: user ? { id: user.id, email: user.email, full_name: user.full_name } : null,
    signOut: vi.fn(),
    loading: false,
  }
}

/**
 * Helper to build an AuthResult user (matches getAuthUserWithRoles contract).
 * Course routes call getAuthUserWithRoles() which returns { user, error: string|null }.
 */
export function authResultUser(mock: typeof mockAcademicHeadUser) {
  return {
    id: mock.id,
    auth_user_id: `auth-${mock.id}`,
    email: mock.email,
    full_name: mock.full_name,
    user_type: 'internal',
    account_status: 'active',
    employee_id: null,
    phone: null,
    avatar_url: null,
    roles: mock.roles.map(r => ({ id: `role-${r.name}`, name: r.name, displayName: r.name, badgeColor: null })),
    department: mock.departments[0] ?? null,
  }
}

/**
 * Mock getAuthUserWithRoles from @/lib/supabase/auth-helper.
 * Returns { user, error } where error is a string (not a Response).
 */
export function mockGetAuthUserWithRoles(user: typeof mockAcademicHeadUser | null) {
  return {
    getAuthUserWithRoles: vi.fn().mockResolvedValue(
      user
        ? { user: authResultUser(user), error: null }
        : { user: null, error: 'Session expired' }
    ),
  }
}

/**
 * Mock the unified auth guard module (@/lib/auth/guards) for schedule tests.
 * Returns every guard exported by lib/auth/guards so factory-mocking works
 * regardless of which one the route under test calls.
 */
export function mockScheduleAuthGuard(user: typeof mockAcademicHeadUser | null) {
  const result = user
    ? { error: null, user: authResultUser(user) }
    : {
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
        user: null,
      }
  return {
    requireAuthenticatedUser: vi.fn().mockResolvedValue(result),
    requireAuthenticatedInternal: vi.fn().mockResolvedValue(result),
    requireAcademicHead: vi.fn().mockResolvedValue(result),
    requireAcademicHeadOrBuildingAdmin: vi.fn().mockResolvedValue(result),
    requireProgramHead: vi.fn().mockResolvedValue(result),
    requireBuildingAdmin: vi.fn().mockResolvedValue(result),
    requireBuildingAdminStrict: vi.fn().mockResolvedValue(result),
    requireUserManager: vi.fn().mockResolvedValue(result),
  }
}
