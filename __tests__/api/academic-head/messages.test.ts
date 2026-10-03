import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
  requireAcademicHead: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/backend/admin', () => ({
  AdminMessagingService: {
    sendMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-001' }),
  },
}))

import { GET, POST } from '@/app/api/academic-head/messages/route'
import { requireAuthenticatedUser, requireAcademicHead } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockRequireAuth = vi.mocked(requireAuthenticatedUser)
const mockRequireAcademicHead = vi.mocked(requireAcademicHead)
const mockCreateAdmin = vi.mocked(createAdminClient)

describe('GET /api/academic-head/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAcademicHead.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const req = new NextRequest('http://localhost:3000/api/academic-head/messages')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('should return messages for authenticated user', async () => {
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockMessages = [
      {
        id: 'm1',
        sender_id: mockAcademicHeadUser.id,
        recipient_id: 'u2',
        subject: 'Test',
        body: 'Hello',
        status: 'sent',
        sent_at: '2026-03-25T00:00:00Z',
        created_at: '2026-03-25T00:00:00Z',
        sender: { id: mockAcademicHeadUser.id, full_name: 'Test Academic Head' },
        recipient: { id: 'u2', full_name: 'Prof Smith' },
      },
    ]

    const mockSupabase: any = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        then: (res: any) => Promise.resolve({ data: mockMessages, count: 1, error: null }).then(res),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase)

    const req = new NextRequest('http://localhost:3000/api/academic-head/messages')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.messages).toHaveLength(1)
    expect(data.messages[0].isMine).toBe(true)
    expect(data.total).toBe(1)
  })
})

describe('POST /api/academic-head/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 400 for missing required fields', async () => {
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const req = new NextRequest('http://localhost:3000/api/academic-head/messages', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('should send a message successfully', async () => {
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase: any = {
      from: vi.fn().mockImplementation(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'msg-001' }, error: null }),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase)

    const req = new NextRequest('http://localhost:3000/api/academic-head/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipientId: 'u2',
        subject: 'Schedule Update',
        body: 'Please review the new schedule.',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.id).toBe('msg-001')
  })
})
