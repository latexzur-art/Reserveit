import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn(),
  RATE_LIMITS: { AI_CHAT: { windowMs: 60000, maxRequests: 20 } },
}))

vi.mock('openai', () => {
  return {
    OpenAI: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({
              facility_search_term: 'AVR',
              booking_date: '2026-08-15',
              start_time: '10:00',
              end_time: '12:00',
              booking_purpose: 'academic',
              expected_attendees: 30,
              department: null,
              course: null,
              session_type: 'lecture',
              purpose_statement: 'Test purpose',
              special_requests: null,
              estimated_score: 85,
              confidence: 'high',
              notes: null,
            }) } }],
          }),
        },
      }
    },
  }
})

import { POST } from '@/app/api/ai/quick-parse/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const mockRequireAuth = vi.mocked(requireAuthenticatedUser)
const mockRateLimit = vi.mocked(checkRateLimitAsync)

describe('POST /api/ai/quick-parse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_AI_FEATURES_ENABLED = 'true'
    process.env.OPENROUTER_API_KEY = 'test-key'
  })

  it('returns 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const req = new NextRequest('http://localhost:3000/api/ai/quick-parse', {
      method: 'POST',
      body: JSON.stringify({ text: 'Book AVR for Monday at 10am' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: { id: 'u1', roles: [] } as any })
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
    mockRateLimit.mockResolvedValue(rateLimitResponse as any)

    const req = new NextRequest('http://localhost:3000/api/ai/quick-parse', {
      method: 'POST',
      body: JSON.stringify({ text: 'Book AVR for Monday at 10am' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('returns parsed result for authenticated, non-rate-limited user', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: { id: 'u1', roles: [] } as any })
    mockRateLimit.mockResolvedValue(null as any)

    const req = new NextRequest('http://localhost:3000/api/ai/quick-parse', {
      method: 'POST',
      body: JSON.stringify({ text: 'Book AVR for Monday at 10am for 30 students' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.facility_search_term).toBe('AVR')
    expect(data.booking_purpose).toBe('academic')
  })
})
