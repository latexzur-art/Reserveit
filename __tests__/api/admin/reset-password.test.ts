import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/users/[id]/reset-password/route'
import * as guards from '@/lib/auth/guards'
import * as supabaseServer from '@/lib/supabase/server'
import * as entraService from '@/backend/auth/entra-users.service'

vi.mock('@/lib/auth/guards', () => ({
  requireUserManager: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/backend/admin', () => ({
  AdminAuditService: {
    log: vi.fn(),
  },
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/backend/auth/entra-users.service', () => ({
  resetEntraUserPassword: vi.fn().mockResolvedValue({ temporaryPassword: 'EntraTempPass123!' }),
  EntraPermissionError: class EntraPermissionError extends Error {},
}))

describe('POST /api/admin/users/[id]/reset-password', () => {
  const mockAdminUser = { id: 'admin-uuid-123' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(guards.requireUserManager).mockResolvedValue({
      error: null,
      user: mockAdminUser as any,
    })
  })

  it('resets password for external user without Entra account and sets must_change_password', async () => {
    const mockExternalUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    const mockUpdateUserById = vi.fn().mockResolvedValue({ data: {}, error: null })
    const mockUpdateUsersTable = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    const mockTargetUser = {
      id: mockExternalUserId,
      auth_user_id: mockExternalUserId,
      entra_object_id: null,
      user_type: 'external',
      email: 'external@example.com',
      notification_email: 'external@example.com',
      full_name: 'External User',
    }

    const mockAdminClient = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockTargetUser, error: null }),
              }),
            }),
            update: mockUpdateUsersTable,
          }
        }
        if (table === 'user_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { roles: { name: 'external_client' } },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
      auth: {
        admin: {
          updateUserById: mockUpdateUserById,
        },
      },
    }

    vi.mocked(supabaseServer.createAdminClient).mockReturnValue(mockAdminClient as any)

    const request = new NextRequest(
      `http://localhost:3000/api/admin/users/${mockExternalUserId}/reset-password`,
      { method: 'POST' }
    )

    const response = await POST(request, { params: Promise.resolve({ id: mockExternalUserId }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(typeof body.temporaryPassword).toBe('string')
    expect(mockUpdateUserById).toHaveBeenCalledWith(
      mockExternalUserId,
      expect.objectContaining({ password: body.temporaryPassword })
    )
    expect(mockUpdateUsersTable).toHaveBeenCalledWith(
      expect.objectContaining({ must_change_password: true })
    )
  })

  it('resets password for Entra user and sets must_change_password flag', async () => {
    const mockEntraUserId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
    const mockUpdateUsersTable = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    const mockTargetEntraUser = {
      id: mockEntraUserId,
      auth_user_id: 'auth-entra-id',
      entra_object_id: 'entra-guid-9999',
      user_type: 'internal',
      email: 'entrauser@sti.edu.ph',
      notification_email: 'entrauser.personal@gmail.com',
      full_name: 'Entra User',
    }

    const mockAdminClient = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockTargetEntraUser, error: null }),
              }),
            }),
            update: mockUpdateUsersTable,
          }
        }
        if (table === 'user_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { roles: { name: 'faculty' } },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }

    vi.mocked(supabaseServer.createAdminClient).mockReturnValue(mockAdminClient as any)

    const request = new NextRequest(
      `http://localhost:3000/api/admin/users/${mockEntraUserId}/reset-password`,
      { method: 'POST' }
    )

    const response = await POST(request, { params: Promise.resolve({ id: mockEntraUserId }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.temporaryPassword).toBe('EntraTempPass123!')
    expect(entraService.resetEntraUserPassword).toHaveBeenCalledWith('entra-guid-9999')
    expect(mockUpdateUsersTable).toHaveBeenCalledWith(
      expect.objectContaining({ must_change_password: true })
    )
  })
})
