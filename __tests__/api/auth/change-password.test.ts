import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/change-password/route'
import * as ssr from '@supabase/ssr'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: () => {},
  }),
}))

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects passwords under 8 characters', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        newPassword: 'short',
        confirmPassword: 'short',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('rejects passwords when confirmPassword does not match', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        newPassword: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('rejects unauthenticated users with 401', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No user') }),
      },
    }
    vi.mocked(ssr.createServerClient).mockReturnValue(mockSupabase as any)

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        newPassword: 'ValidPassword123!',
        confirmPassword: 'ValidPassword123!',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toContain('Unauthorized')
  })

  it('updates password and clears must_change_password flag for authenticated user', async () => {
    const mockUserId = 'user-uuid-9999'
    const mockUpdateUser = vi.fn().mockResolvedValue({ error: null })
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId, email: 'test@example.com' } },
          error: null,
        }),
        updateUser: mockUpdateUser,
      },
      from: vi.fn().mockReturnValue({
        update: mockUpdate,
      }),
    }

    vi.mocked(ssr.createServerClient).mockReturnValue(mockSupabase as any)

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        newPassword: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewStrongPassword123!' })
    expect(mockSupabase.from).toHaveBeenCalledWith('users')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ must_change_password: false })
    )
    expect(mockEq).toHaveBeenCalledWith('auth_user_id', mockUserId)
  })
})
