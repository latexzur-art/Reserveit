import { describe, it, expect, vi, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock createAdminClient before importing the resolver
const mockMaybeSingle = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    })),
  })),
}))

// Import AFTER mocks
import { getAcademicHeadEmail } from '@/backend/notifications/recipientResolver'

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks()
})

describe('getAcademicHeadEmail', () => {
  it('returns the email when an active academic head exists', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { users: { id: 'head-1', notification_email: 'academichead@reserveitlucena.onmicrosoft.com' } },
      error: null,
    })

    const result = await getAcademicHeadEmail()
    expect(result).toBe('academichead@reserveitlucena.onmicrosoft.com')
  })

  it('returns null when no active academic head row exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getAcademicHeadEmail()
    expect(result).toBeNull()
  })

  it('returns null on DB error without throwing', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    })

    const result = await getAcademicHeadEmail()
    expect(result).toBeNull()
  })

  it('returns null when users relation is null', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { users: null },
      error: null,
    })

    const result = await getAcademicHeadEmail()
    expect(result).toBeNull()
  })

  it('returns null when users object exists but email is undefined', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { users: { email: undefined } },
      error: null,
    })

    const result = await getAcademicHeadEmail()
    expect(result).toBeNull()
  })

  it('returns null when users object exists but email is empty string', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { users: { email: '' } },
      error: null,
    })

    const result = await getAcademicHeadEmail()
    expect(result).toBeNull()
  })

  it('never throws when maybeSingle rejects unexpectedly', async () => {
    mockMaybeSingle.mockRejectedValue(new Error('unexpected crash'))

    await expect(getAcademicHeadEmail()).resolves.toBeNull()
  })
})
