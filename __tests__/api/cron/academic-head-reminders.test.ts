import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockGetAcademicHeadEmail = vi.hoisted(() =>
  vi.fn().mockResolvedValue('academichead@reserveitlucena.onmicrosoft.com')
)

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: mockSendEmail,
}))

vi.mock('@/backend/notifications/recipientResolver', () => ({
  getAcademicHeadEmail: mockGetAcademicHeadEmail,
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

// Import AFTER mocks
import { GET } from '@/app/api/cron/academic-head-reminders/route'
import { createAdminClient } from '@/lib/supabase/server'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a minimal Supabase mock that supports the two query chains used in the cron route:
 *   maintenance_records: .select().eq().neq().eq()   → awaitable
 *   facility_blocks:     .select().gte().lte()        → awaitable
 */
function makeCronMock(
  maintenanceResult: { data: any[] | null; error: any },
  facilityBlocksResult: { data: any[] | null; error: any }
) {
  const makeChain = (result: { data: any[] | null; error: any }) => ({
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    neq:    vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lte:    vi.fn().mockReturnThis(),
    then:   (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  })

  return {
    from: vi.fn((table: string) =>
      table === 'maintenance_records'
        ? makeChain(maintenanceResult)
        : makeChain(facilityBlocksResult)
    ),
  }
}

function makeCronReq(secret: string | null = process.env.CRON_SECRET ?? 'test-cron-secret') {
  const headers: Record<string, string> = secret !== null
    ? { authorization: `Bearer ${secret}` }
    : {}
  return new NextRequest(
    'http://localhost/api/cron/academic-head-reminders',
    { headers }
  )
}

const EMPTY_RESULT = { data: [], error: null }

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAcademicHeadEmail.mockResolvedValue('academichead@reserveitlucena.onmicrosoft.com')
  vi.mocked(createAdminClient).mockReturnValue(
    makeCronMock(EMPTY_RESULT, EMPTY_RESULT) as any
  )
})

describe('GET /api/cron/academic-head-reminders', () => {

  describe('Authorization', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const req = new NextRequest('http://localhost/api/cron/academic-head-reminders')
      const res = await GET(req)
      expect(res.status).toBe(401)
    })

    it('returns 401 when bearer token is wrong', async () => {
      const res = await GET(makeCronReq('wrong-secret'))
      expect(res.status).toBe(401)
    })

    it('returns 200 with correct token', async () => {
      const res = await GET(makeCronReq())
      expect(res.status).toBe(200)
    })
  })

  describe('Academic Head resolver', () => {
    it('returns early with success:false when no active Academic Head found', async () => {
      mockGetAcademicHeadEmail.mockResolvedValue(null)

      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(false)
      expect(body.reason).toContain('No active Academic Head')
    })

    it('does not call sendEmail when resolver returns null', async () => {
      mockGetAcademicHeadEmail.mockResolvedValue(null)

      await GET(makeCronReq())
      expect(mockSendEmail).not.toHaveBeenCalled()
    })
  })

  describe('Empty database', () => {
    it('returns success:true with zero sent counts', async () => {
      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.maintenanceSent).toBe(0)
      expect(body.facilityBlocksSent).toBe(0)
      expect(body.errors).toEqual([])
    })

    it('does not call sendEmail when there are no records', async () => {
      await GET(makeCronReq())
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('response date matches YYYY-MM-DD format', async () => {
      const res = await GET(makeCronReq())
      const body = await res.json()
      expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('Maintenance records', () => {
    const maintenanceRecord = {
      id: 'maint-uuid-1',
      type: 'Preventive',
      target_name: 'Room 301 A/C Unit',
      schedule_date: '2026-04-11',
      technician: 'Pedro Reyes',
      notes: null,
      status: 'scheduled',
    }

    it('sends one email per maintenance record', async () => {
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock({ data: [maintenanceRecord], error: null }, EMPTY_RESULT) as any
      )

      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(body.maintenanceSent).toBe(1)
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
    })

    it('email subject contains the target name', async () => {
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock({ data: [maintenanceRecord], error: null }, EMPTY_RESULT) as any
      )

      await GET(makeCronReq())

      const { subject } = mockSendEmail.mock.calls[0][0]
      expect(subject).toContain('Room 301 A/C Unit')
    })

    it('email is sent to the resolved Academic Head email', async () => {
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock({ data: [maintenanceRecord], error: null }, EMPTY_RESULT) as any
      )

      await GET(makeCronReq())

      expect(mockSendEmail.mock.calls[0][0].to).toBe(
        'academichead@reserveitlucena.onmicrosoft.com'
      )
    })

    it('sends one email per record when multiple records exist', async () => {
      const records = [
        { ...maintenanceRecord, id: 'maint-1', target_name: 'AC Unit A' },
        { ...maintenanceRecord, id: 'maint-2', target_name: 'Projector B' },
      ]
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock({ data: records, error: null }, EMPTY_RESULT) as any
      )

      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(body.maintenanceSent).toBe(2)
      expect(mockSendEmail).toHaveBeenCalledTimes(2)
    })
  })

  describe('Facility blocks', () => {
    const facilityBlockObject = {
      id: 'block-uuid-1',
      block_type: 'School Event',
      start_time: '2026-04-11T08:00:00+08:00',
      end_time: '2026-04-11T17:00:00+08:00',
      reason: 'Acquaintance Party',
      facilities: { name: 'AVR 2' }, // Supabase FK as object
    }

    const facilityBlockArray = {
      ...facilityBlockObject,
      id: 'block-uuid-2',
      facilities: [{ name: 'Lab 101' }], // Supabase FK as array
    }

    it('sends one email per facility block', async () => {
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock(EMPTY_RESULT, { data: [facilityBlockObject], error: null }) as any
      )

      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(body.facilityBlocksSent).toBe(1)
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
    })

    it('email subject contains facility name (facilities as object)', async () => {
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock(EMPTY_RESULT, { data: [facilityBlockObject], error: null }) as any
      )

      await GET(makeCronReq())

      const { subject } = mockSendEmail.mock.calls[0][0]
      expect(subject).toContain('AVR 2')
    })

    it('email subject contains facility name (facilities as array)', async () => {
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock(EMPTY_RESULT, { data: [facilityBlockArray], error: null }) as any
      )

      await GET(makeCronReq())

      const { subject } = mockSendEmail.mock.calls[0][0]
      expect(subject).toContain('Lab 101')
    })
  })

  describe('Error handling', () => {
    it('returns 200 when Supabase returns errors, with errors listed in body', async () => {
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock(
          { data: null, error: { message: 'maintenance DB error' } },
          { data: null, error: { message: 'blocks DB error' } }
        ) as any
      )

      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.errors).toHaveLength(2)
      expect(body.errors[0]).toContain('maintenance DB error')
      expect(body.errors[1]).toContain('blocks DB error')
    })

    it('does not call sendEmail when Supabase returns errors', async () => {
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock(
          { data: null, error: { message: 'DB error' } },
          { data: null, error: { message: 'DB error' } }
        ) as any
      )

      await GET(makeCronReq())
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('continues to facility blocks even if maintenance query fails', async () => {
      const facilityBlock = {
        id: 'block-1',
        block_type: 'Maintenance',
        start_time: '2026-04-11T08:00:00+08:00',
        end_time: '2026-04-11T17:00:00+08:00',
        reason: null,
        facilities: { name: 'Hall A' },
      }
      vi.mocked(createAdminClient).mockReturnValue(
        makeCronMock(
          { data: null, error: { message: 'maintenance DB error' } },
          { data: [facilityBlock], error: null }
        ) as any
      )

      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(body.errors).toHaveLength(1)
      expect(body.facilityBlocksSent).toBe(1)
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
    })
  })
})
