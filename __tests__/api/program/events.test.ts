import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockProgramHeadUser, mockFacultyUser } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => ({
  requireProgramHead: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/backend/notifications/notification.service', () => ({
  NotificationService: { createForRoles: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/schedule-events/voidSchoolEventConflicts', () => ({
  voidConflictsForSchoolEvent: vi.fn().mockResolvedValue(undefined),
}))

import { GET, POST } from '@/app/api/program-head/schedule-events/route'
import { requireProgramHead } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockRequireAuth = vi.mocked(requireProgramHead)
const mockCreateAdmin = vi.mocked(createAdminClient)

describe('GET /api/program-head/schedule-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('should return events for program head', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockProgramHeadUser as any })

    const mockEvents = [
      {
        id: 'e1',
        booking_date: '2026-04-01',
        start_time: '08:00',
        end_time: '17:00',
        event_name: 'Midterms',
        current_status: 'pending',
        booking_facilities: [{
          facility_id: 'f1',
          facilities: { name: 'Room 101', room_number: '101' },
        }],
      },
    ]

    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (res: any) => {
          if (table === 'bookings') {
            return Promise.resolve({ data: mockEvents, error: null }).then(res)
          }
          return Promise.resolve({ data: [], error: null }).then(res)
        },
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase)

    const res = await GET()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.events).toHaveLength(1)
    expect(data.events[0].event_name).toBe('Midterms')
    expect(data.events[0].facility_id).toBe('f1')
  })
})

describe('POST /api/program-head/schedule-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null })

    const req = new NextRequest('http://localhost:3000/api/program-head/schedule-events', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('should return 400 for missing required fields', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockProgramHeadUser as any })

    const mockSupabase: any = {
      from: vi.fn(),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase)

    const req = new NextRequest('http://localhost:3000/api/program-head/schedule-events', {
      method: 'POST',
      body: JSON.stringify({ event_name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Missing required fields')
  })

  it('should create an event successfully', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockProgramHeadUser as any })

    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'event-001' }, error: null }),
        then: (res: any) => Promise.resolve({ data: [], error: null }).then(res),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase)

    const req = new NextRequest('http://localhost:3000/api/program-head/schedule-events', {
      method: 'POST',
      body: JSON.stringify({
        event_name: 'Midterm Exams',
        booking_date: '2026-04-01',
        facility_ids: ['f1', 'f2'],
        start_time: '08:00',
        end_time: '17:00',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('should accept legacy facility_id (single)', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockProgramHeadUser as any })

    const mockSupabase: any = {
      from: vi.fn().mockImplementation(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'event-002' }, error: null }),
        then: (res: any) => Promise.resolve({ data: [], error: null }).then(res),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase)

    const req = new NextRequest('http://localhost:3000/api/program-head/schedule-events', {
      method: 'POST',
      body: JSON.stringify({
        event_name: 'Faculty Meeting',
        booking_date: '2026-04-05',
        facility_id: 'f1',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
