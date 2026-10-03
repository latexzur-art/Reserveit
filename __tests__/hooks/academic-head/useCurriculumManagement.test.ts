import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCurriculumManagement } from '@/hooks/academic-head/useCurriculumManagement'

describe('useCurriculumManagement', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -- Course Catalog --
  describe('Course Catalog', () => {
    describe('fetchCourses', () => {
      it('should start with empty courses and coursesLoading=false', () => {
        const { result } = renderHook(() => useCurriculumManagement())
        expect(result.current.courses).toEqual([])
        expect(result.current.totalCourses).toBe(0)
        expect(result.current.coursesLoading).toBe(false)
      })

      it('should fetch courses with no filters', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ courses: [{ id: 'c1' }], total: 1 }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchCourses()
        })

        expect(result.current.courses).toHaveLength(1)
        expect(result.current.totalCourses).toBe(1)
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/courses'))
      })

      it('should pass filter params as query string', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ courses: [], total: 0 }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchCourses({
            department_code: 'CS',
            year_level: 2,
            term: 1,
            delivery_mode: 'lab',
            approval_status: 'pending',
            search: 'intro',
            page: 2,
            limit: 10,
          })
        })

        const url = mockFetch.mock.calls[0][0] as string
        expect(url).toContain('department_code=CS')
        expect(url).toContain('year_level=2')
        expect(url).toContain('term=1')
        expect(url).toContain('delivery_mode=lab')
        expect(url).toContain('search=intro')
        expect(url).toContain('page=2')
      })

      it('should set coursesLoading=false after fetch completes', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ courses: [], total: 0 }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchCourses()
        })

        expect(result.current.coursesLoading).toBe(false)
      })

      it('should handle fetch error (res.ok=false)', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'fail' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchCourses()
        })

        expect(result.current.courses).toEqual([])
        expect(result.current.coursesLoading).toBe(false)
      })
    })

    describe('createCourse', () => {
      it('should POST to /api/courses with JSON body', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ course: { id: 'c1' }, warnings: [] }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.createCourse({ course_code: 'CS101' } as any)
        })

        expect(res.course.id).toBe('c1')
        expect(mockFetch).toHaveBeenCalledWith('/api/courses', expect.objectContaining({ method: 'POST' }))
      })

      it('should return error on failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Duplicate' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.createCourse({ course_code: 'CS101' } as any)
        })

        expect(res.error).toBe('Duplicate')
      })
    })

    describe('updateCourse', () => {
      it('should PUT to /api/courses/{id}', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ course: { id: 'c1', course_name: 'Updated' } }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.updateCourse('c1', { course_name: 'Updated' } as any)
        })

        expect(res.course.course_name).toBe('Updated')
        expect(mockFetch).toHaveBeenCalledWith('/api/courses/c1', expect.objectContaining({ method: 'PUT' }))
      })

      it('should return error on failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Not found' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.updateCourse('c1', {} as any)
        })

        expect(res.error).toBe('Not found')
      })
    })

    describe('approveCourse', () => {
      it('should PATCH to /api/courses/{id} with approve action', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ course: { id: 'c1', approval_status: 'approved' } }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.approveCourse('c1')
        })

        expect(res.course.approval_status).toBe('approved')
        const call = mockFetch.mock.calls[0]
        expect(call[0]).toBe('/api/courses/c1')
        expect(call[1].method).toBe('PATCH')
        expect(JSON.parse(call[1].body)).toEqual({ action: 'approve' })
      })

      it('should return error on failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Forbidden' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.approveCourse('c1')
        })

        expect(res.error).toBe('Forbidden')
      })
    })
  })

  // -- Upload --
  describe('Upload', () => {
    describe('uploadCSV', () => {
      it('should POST FormData with file and department_id', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ batch_id: 'b1', validation_results: [] }),
        })

        const { result } = renderHook(() => useCurriculumManagement())
        const file = new File(['data'], 'test.csv', { type: 'text/csv' })

        let res: any
        await act(async () => {
          res = await result.current.uploadCSV(file, 'dept-1')
        })

        expect(res.batch_id).toBe('b1')
        const [url, opts] = mockFetch.mock.calls[0]
        expect(url).toBe('/api/courses/upload')
        expect(opts.method).toBe('POST')
        expect(opts.body).toBeInstanceOf(FormData)
      })

      it('should return error on failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid CSV' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.uploadCSV(new File([''], 'test.csv'), 'd1')
        })

        expect(res.error).toBe('Invalid CSV')
      })
    })



    describe('submitBatch', () => {
      it('should POST to /api/courses/batch/{id}/submit', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.submitBatch('batch-1')
        })

        expect(res).toEqual({})
        expect(mockFetch).toHaveBeenCalledWith('/api/courses/batch/batch-1/submit', { method: 'POST' })
      })

      it('should return error on failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Not found' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.submitBatch('batch-1')
        })

        expect(res.error).toBe('Not found')
      })
    })

    describe('downloadTemplate', () => {
      it('should fetch the template endpoint', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(new Blob(['csv,data'])),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        // Mock DOM APIs AFTER renderHook (createElement is used by renderHook itself)
        global.URL.createObjectURL = vi.fn().mockReturnValue('blob:fake')
        global.URL.revokeObjectURL = vi.fn()
        const origCreateElement = document.createElement.bind(document)
        const clickFn = vi.fn()
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
          if (tag === 'a') return { href: '', download: '', click: clickFn } as any
          return origCreateElement(tag)
        })

        await act(async () => {
          await result.current.downloadTemplate()
        })

        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/courses/upload/template'))
        expect(clickFn).toHaveBeenCalled()
      })
    })
  })

  // -- Upload History --
  describe('Upload History', () => {
    describe('fetchUploadHistory', () => {
      it('should fetch with default params', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ uploads: [{ id: 'u1' }], total: 1, individualCourses: [] }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchUploadHistory()
        })

        expect(result.current.uploadHistory).toHaveLength(1)
        expect(result.current.uploadHistoryTotal).toBe(1)
      })

      it('should pass page and deptId as query params', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ uploads: [], total: 0, individualCourses: [] }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchUploadHistory({ page: 2, deptId: 'dept-1' })
        })

        const url = mockFetch.mock.calls[0][0] as string
        expect(url).toContain('page=2')
        expect(url).toContain('department_id=dept-1')
      })

      it('should set uploadHistoryLoading=false after fetch', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ uploads: [], total: 0, individualCourses: [] }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchUploadHistory()
        })

        expect(result.current.uploadHistoryLoading).toBe(false)
      })

      it('should handle error response', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'fail' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchUploadHistory()
        })

        expect(result.current.uploadHistory).toEqual([])
        expect(result.current.uploadHistoryLoading).toBe(false)
      })
    })
  })

  // -- Approval Queue --
  describe('Approval Queue', () => {
    describe('fetchPendingBatches', () => {
      it('should GET /api/courses/approval/pending', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ batches: [{ id: 'b1' }], individualCourses: [] }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchPendingBatches()
        })

        expect(result.current.pendingBatches).toHaveLength(1)
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/courses/approval/pending'))
      })

      it('should pass deptCode as query param', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ batches: [], individualCourses: [] }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchPendingBatches('IT')
        })

        const url = mockFetch.mock.calls[0][0] as string
        expect(url).toContain('department_code=IT')
      })

      it('should set pendingLoading=false after fetch', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ batches: [], individualCourses: [] }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        await act(async () => {
          await result.current.fetchPendingBatches()
        })

        expect(result.current.pendingLoading).toBe(false)
      })
    })

    describe('fetchBatchDetails', () => {
      it('should return batch on success', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ batch: { id: 'b1', courses: [] } }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let batch: any
        await act(async () => {
          batch = await result.current.fetchBatchDetails('b1')
        })

        expect(batch.id).toBe('b1')
      })

      it('should return null on failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Not found' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let batch: any
        await act(async () => {
          batch = await result.current.fetchBatchDetails('b1')
        })

        expect(batch).toBeNull()
      })
    })

    describe('approveBatch', () => {
      it('should POST to approve endpoint', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.approveBatch('b1')
        })

        expect(res).toEqual({})
        expect(mockFetch).toHaveBeenCalledWith('/api/courses/approval/batch/b1/approve', { method: 'POST' })
      })

      it('should return error on failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.approveBatch('b1')
        })

        expect(res.error).toBe('Failed')
      })
    })

    describe('rejectBatchRows', () => {
      it('should POST with course_ids and reason', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.rejectBatchRows('b1', ['c1', 'c2'], 'Bad data')
        })

        expect(res).toEqual({})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.course_ids).toEqual(['c1', 'c2'])
        expect(body.reason).toBe('Bad data')
      })
    })

    describe('rejectBatch', () => {
      it('should POST with reject_all and reason', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.rejectBatch('b1', 'All invalid')
        })

        expect(res).toEqual({})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.reject_all).toBe(true)
        expect(body.reason).toBe('All invalid')
      })
    })

    describe('sendBackBatch', () => {
      it('should POST with notes', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.sendBackBatch('b1', 'Fix row 3')
        })

        expect(res).toEqual({})
        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.notes).toBe('Fix row 3')
      })

      it('should return error on failure', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Server error' }),
        })

        const { result } = renderHook(() => useCurriculumManagement())

        let res: any
        await act(async () => {
          res = await result.current.sendBackBatch('b1', 'notes')
        })

        expect(res.error).toBe('Server error')
      })
    })
  })


})
