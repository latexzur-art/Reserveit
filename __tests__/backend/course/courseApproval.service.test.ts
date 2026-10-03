import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../mocks/supabase'
import {
  approveBatch,
  rejectBatch,
  sendBackBatch,
  rejectBatchRows,
} from '@/backend/course/courseApproval.service'

describe('courseApproval.service', () => {
  let supabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    supabase = createMockSupabaseClient()
  })

  describe('approveBatch', () => {
    it('should approve all pending courses and update batch status', async () => {
      const approvedCourses = [{ id: 'c1' }, { id: 'c2' }]

      // Track from() calls to differentiate tables
      const fromCalls: string[] = []
      supabase.from.mockImplementation((table: string) => {
        fromCalls.push(table)
        const chain: any = {
          update: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (res: any) => {
            if (table === 'courses') {
              return Promise.resolve({ data: approvedCourses, error: null }).then(res)
            }
            return Promise.resolve({ data: null, error: null }).then(res)
          },
        }
        return chain
      })

      // Mock onCourseApproved's internal supabase calls
      // (it calls from('courses') then from('schedule_entries_staging'))
      // The mock returns empty data which causes early return

      const result = await approveBatch(supabase as any, 'batch-001', 'reviewer-001')
      expect(result.approvedCount).toBe(2)
      expect(fromCalls).toContain('courses')
      expect(fromCalls).toContain('course_uploads')
    })

    it('should throw on supabase error', async () => {
      supabase.from.mockImplementation(() => {
        const chain: any = {
          update: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (res: any) => Promise.resolve({ data: null, error: { message: 'DB failure' } }).then(res),
        }
        return chain
      })

      await expect(approveBatch(supabase as any, 'batch-001', 'reviewer-001'))
        .rejects.toThrow('Failed to approve batch')
    })
  })

  describe('rejectBatch', () => {
    it('should reject all pending courses in a batch', async () => {
      const fromCalls: string[] = []
      supabase.from.mockImplementation((table: string) => {
        fromCalls.push(table)
        const chain: any = {
          update: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (res: any) => {
            if (table === 'courses') {
              return Promise.resolve({ data: [{ id: 'c1' }], error: null }).then(res)
            }
            return Promise.resolve({ data: null, error: null }).then(res)
          },
        }
        return chain
      })

      await rejectBatch(supabase as any, 'batch-001', 'Not suitable', 'reviewer-001')
      expect(fromCalls).toContain('courses')
      expect(fromCalls).toContain('course_uploads')
    })
  })

  describe('sendBackBatch', () => {
    it('should set courses to sent_back and batch to draft', async () => {
      const fromCalls: string[] = []
      supabase.from.mockImplementation((table: string) => {
        fromCalls.push(table)
        const chain: any = {
          update: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (res: any) => Promise.resolve({ data: null, error: null }).then(res),
        }
        return chain
      })

      await sendBackBatch(supabase as any, 'batch-001', 'Please fix units', 'reviewer-001')
      expect(fromCalls.filter(t => t === 'courses')).toHaveLength(1)
      // course_uploads is updated once + read again by loadBatchMeta for the notification
      expect(fromCalls.filter(t => t === 'course_uploads').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('rejectBatchRows', () => {
    it('should reject specific course rows and update batch', async () => {
      let callIdx = 0
      supabase.from.mockImplementation((table: string) => {
        callIdx++
        const chain: any = {
          update: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (res: any) => {
            // First courses call: reject rows
            if (table === 'courses' && callIdx <= 1) {
              return Promise.resolve({ data: [{ id: 'c1' }], error: null }).then(res)
            }
            // Second courses call: count pending
            if (table === 'courses') {
              return Promise.resolve({ count: 0, error: null }).then(res)
            }
            return Promise.resolve({ data: null, error: null }).then(res)
          },
        }
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
        return chain
      })

      const result = await rejectBatchRows(supabase as any, 'batch-001', ['c1'], 'Bad data', 'reviewer-001')
      expect(result.rejectedCount).toBe(1)
    })
  })
})
