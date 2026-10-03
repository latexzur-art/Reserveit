import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminAuthService } from '@/backend/auth/auth.admin.service'
import * as supabaseServer from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

describe('AdminAuthService.createInternalUser (External User)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses upsert for user_roles so pre-existing trigger roles do not cause duplicate key error', async () => {
    const mockUserId = 'ext-user-123'
    const mockRoleId = 'role-client-456'

    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    const mockInsert = vi.fn().mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint "user_roles_user_id_role_id_key"' } })

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'user_roles') {
          return {
            insert: mockInsert,
            upsert: mockUpsert,
          }
        }
        return {}
      }),
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId, email: 'external@test.com' } },
            error: null,
          }),
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    }

    vi.mocked(supabaseServer.createAdminClient).mockReturnValue(mockSupabase as any)

    const result = await AdminAuthService.createInternalUser({
      email: 'external@test.com',
      fullName: 'External Test User',
      userType: 'external',
      temporaryPassword: 'TempPassword123!',
      roleIds: [mockRoleId],
      createdBy: 'admin-123',
    })

    expect(result.success).toBe(true)
    expect(result.userId).toBe(mockUserId)
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        {
          user_id: mockUserId,
          role_id: mockRoleId,
          assigned_by: 'admin-123',
          is_active: true,
        },
      ],
      { onConflict: 'user_id,role_id' }
    )
  })

  it('refines raw PostgreSQL error messages into user-friendly descriptions', async () => {
    const { formatUserCreationError } = await import('@/backend/auth/auth.admin.service')

    const duplicateRoleErr = formatUserCreationError(
      'duplicate key value violates unique constraint "user_roles_user_id_role_id_key"'
    )
    expect(duplicateRoleErr).toBe('Role assignment failed: This user already has this role assigned.')

    const duplicateEmailErr = formatUserCreationError(
      'duplicate key value violates unique constraint "users_email_key"'
    )
    expect(duplicateEmailErr).toBe('A user with this email address already exists. Please use a different email address.')

    const fallbackErr = formatUserCreationError('Network connection timeout')
    expect(fallbackErr).toBe('Network connection timeout')
  })
})
