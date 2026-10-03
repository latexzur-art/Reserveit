import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth guard
vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

// Mock Supabase — returns data based on which columns are selected
function createMockSupabase(statusData: any, ownershipData: any) {
  const chain: any = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.select = vi.fn().mockImplementation((cols: string) => {
    chain._selectedCols = cols
    return chain
  })
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockImplementation(() => {
    if (chain._selectedCols?.includes('current_status')) {
      return Promise.resolve({ data: statusData, error: statusData ? null : { message: 'not found' } })
    }
    return Promise.resolve({ data: ownershipData, error: ownershipData ? null : { message: 'not found' } })
  })
  return chain
}

let mockSupabase: ReturnType<typeof createMockSupabase>

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

import { NextRequest, NextResponse } from 'next/server'
import { GET } from '@/app/api/bookings/[id]/status/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'

const VALID_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

function mockRequest() {
  return new NextRequest(`http://localhost/api/bookings/${VALID_UUID}/status`)
}

describe('GET /api/bookings/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null as any,
    })

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(401)
  })

  it('should return booking status for owner', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      error: null,
      user: { id: 'user-1', roles: [] } as any,
    })

    mockSupabase = createMockSupabase(
      { current_status: 'auto_approved', pipeline_processed_at: '2026-08-11T12:00:00Z', assigned_reviewer_role: null },
      { user_id: 'user-1' }
    )

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.current_status).toBe('auto_approved')
  })

  it('should return 403 for non-owner non-admin', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      error: null,
      user: { id: 'user-2', roles: [] } as any,
    })

    mockSupabase = createMockSupabase(
      { current_status: 'pending', pipeline_processed_at: null, assigned_reviewer_role: null },
      { user_id: 'user-1' }
    )

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(403)
  })

  it('should allow admin roles to view any booking', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      error: null,
      user: { id: 'admin-1', roles: [{ name: 'academic_head' }] } as any,
    })

    mockSupabase = createMockSupabase(
      { current_status: 'auto_approved', pipeline_processed_at: '2026-08-11T12:00:00Z', assigned_reviewer_role: null },
      { user_id: 'user-1' }
    )

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(200)
  })

  it('should return 404 for nonexistent booking', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      error: null,
      user: { id: 'user-1', roles: [] } as any,
    })

    mockSupabase = createMockSupabase(null, null)

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(404)
  })
})
