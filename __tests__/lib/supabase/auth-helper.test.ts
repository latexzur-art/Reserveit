import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/headers
const mockCookieStore = {
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
}
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}))

// Mock @supabase/ssr
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  rpc: vi.fn(),
}
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockReturnValue(mockSupabaseClient),
}))

describe('getAuthUserWithRoles', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockCookieStore.getAll.mockReturnValue([])
    mockCookieStore.set.mockImplementation(() => {})
  })

  it('returns user when RPC succeeds', async () => {
    const { getAuthUserWithRoles } = await import('@/lib/supabase/auth-helper')

    const mockUser = {
      id: 'user-1',
      auth_user_id: 'auth-1',
      email: 'test@example.com',
      full_name: 'Test User',
      user_type: 'external',
      account_status: 'active',
      roles: [{ id: 'role-1', name: 'external_client', displayName: 'External Client', badgeColor: null }],
      department: null,
    }

    mockSupabaseClient.rpc.mockResolvedValue({ data: mockUser, error: null })

    const result = await getAuthUserWithRoles()

    expect(result.error).toBeNull()
    expect(result.user).toEqual(mockUser)
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_current_user_with_roles')
  })

  it('falls back to getUser when RPC fails (token expired)', async () => {
    const { getAuthUserWithRoles } = await import('@/lib/supabase/auth-helper')

    // RPC fails due to expired token
    mockSupabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'JWT expired' },
    })

    // getUser succeeds (validates JWT server-side without refresh)
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-1', email: 'test@example.com' } },
      error: null,
    })

    // Create a fresh admin client for the fallback query
    const mockAdminClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          auth_user_id: 'auth-1',
          email: 'test@example.com',
          full_name: 'Test User',
          user_type: 'external',
          account_status: 'active',
          employee_id: null,
          phone: null,
          avatar_url: null,
          roles: [{ id: 'role-1', name: 'external_client', displayName: 'External Client', badgeColor: null }],
          department: null,
        },
        error: null,
      }),
    }

    // We need to mock createAdminClient for the fallback
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => mockAdminClient,
    }))

    const result = await getAuthUserWithRoles()

    // Should succeed via fallback
    expect(result.error).toBeNull()
    expect(result.user).toBeDefined()
    expect(result.user?.email).toBe('test@example.com')
  })

  it('returns error when both RPC and getUser fail', async () => {
    const { getAuthUserWithRoles } = await import('@/lib/supabase/auth-helper')

    // RPC fails
    mockSupabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'JWT expired' },
    })

    // getUser also fails
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    })

    const result = await getAuthUserWithRoles()

    expect(result.error).toBe('Unauthorized')
    expect(result.user).toBeNull()
  })

  it('returns error when RPC returns null data without error', async () => {
    const { getAuthUserWithRoles } = await import('@/lib/supabase/auth-helper')

    // RPC returns null data but no error (user not found in RPC)
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null })

    // getUser also returns no user
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const result = await getAuthUserWithRoles()

    expect(result.error).toBe('Unauthorized')
    expect(result.user).toBeNull()
  })

  it('returns error when getUser succeeds but profile not found', async () => {
    const { getAuthUserWithRoles } = await import('@/lib/supabase/auth-helper')

    // RPC fails
    mockSupabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'JWT expired' },
    })

    // getUser succeeds
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-1', email: 'test@example.com' } },
      error: null,
    })

    // Admin client returns no profile (user archived or missing)
    const mockAdminClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'No rows' } }),
    }

    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => mockAdminClient,
    }))

    const result = await getAuthUserWithRoles()

    expect(result.error).toBe('Unauthorized')
    expect(result.user).toBeNull()
  })

  it('handles RPC timeout gracefully', async () => {
    const { getAuthUserWithRoles } = await import('@/lib/supabase/auth-helper')

    // RPC times out
    mockSupabaseClient.rpc.mockImplementation(() =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 100))
    )

    // getUser succeeds
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-1', email: 'test@example.com' } },
      error: null,
    })

    const mockAdminClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          auth_user_id: 'auth-1',
          email: 'test@example.com',
          full_name: 'Test User',
          user_type: 'external',
          account_status: 'active',
          employee_id: null,
          phone: null,
          avatar_url: null,
          user_roles: [],
          departments: null,
        },
        error: null,
      }),
    }

    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => mockAdminClient,
    }))

    const result = await getAuthUserWithRoles()

    expect(result.error).toBeNull()
    expect(result.user?.email).toBe('test@example.com')
  })

  it('maps user roles correctly in fallback', async () => {
    const { getAuthUserWithRoles } = await import('@/lib/supabase/auth-helper')

    // RPC fails
    mockSupabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'JWT expired' },
    })

    // getUser succeeds
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-1', email: 'test@example.com' } },
      error: null,
    })

    const mockAdminClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          auth_user_id: 'auth-1',
          email: 'test@example.com',
          full_name: 'Test User',
          user_type: 'external',
          account_status: 'active',
          employee_id: null,
          phone: null,
          avatar_url: null,
          user_roles: [
            { role: { id: 'r1', name: 'external_client', display_name: 'External Client', badge_color: 'blue' } },
            { role: { id: 'r2', name: 'building_admin', display_name: 'Building Admin', badge_color: 'red' } },
          ],
          departments: { id: 'd1', code: 'CS', name: 'Computer Science' },
        },
        error: null,
      }),
    }

    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => mockAdminClient,
    }))

    const result = await getAuthUserWithRoles()

    expect(result.error).toBeNull()
    expect(result.user?.roles).toHaveLength(2)
    expect(result.user?.roles[0].name).toBe('external_client')
    expect(result.user?.roles[0].displayName).toBe('External Client')
    expect(result.user?.roles[0].badgeColor).toBe('blue')
    expect(result.user?.department?.name).toBe('Computer Science')
  })
})
