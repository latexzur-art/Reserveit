'use client'

import { useState, useCallback } from 'react'
import type {
  Course,
  CourseCreateInput,
  CourseFilters,
  CourseUploadBatch,
  BatchWithCourses,
  CourseValidationResult,
} from '@/types/course.types'

interface UseCurriculumReturn {
  // Course catalog
  courses: Course[]
  totalCourses: number
  coursesLoading: boolean
  fetchCourses: (filters?: CourseFilters) => Promise<void>
  createCourse: (input: CourseCreateInput) => Promise<{ course?: Course; warnings?: any[]; error?: string }>
  updateCourse: (id: string, updates: Partial<CourseCreateInput>) => Promise<{ course?: Course; error?: string }>
  deleteCourse: (id: string, force?: boolean) => Promise<{ error?: string; requiresForce?: boolean }>
  bulkDeleteCourses: (ids: string[], force?: boolean) => Promise<{ deleted?: number; skipped?: number; message?: string; error?: string; requiresForce?: boolean }>
  approveCourse: (id: string) => Promise<{ course?: Course; error?: string }>


  // Upload
  uploadCSV: (file: File, deptId: string, termId?: string, uploaderNotes?: string, labelYearLevel?: number | null, labelTerm?: number | null) => Promise<{ batch_id?: string; validation_results?: any[]; error?: string }>
  submitBatch: (batchId: string) => Promise<{ error?: string }>
  publishBatch: (batchId: string) => Promise<{ error?: string; message?: string }>
  deleteBatch: (batchId: string) => Promise<{ error?: string }>
  requestDeletion: (batchId: string, reason: string) => Promise<{ error?: string }>
  downloadTemplate: (opts?: { code: string; name: string } | { mixed: true; allCodes: string[] }) => Promise<void>

  // Upload history
  uploadHistory: any[]
  uploadHistoryTotal: number
  individualCourseHistory: any[]
  uploadHistoryLoading: boolean
  fetchUploadHistory: (opts?: { page?: number; deptId?: string }) => Promise<void>
  clearHistory: () => Promise<{ cleared?: number; error?: string }>

  // Course action logs (academic head)
  courseLogs: any[]
  courseLogsTotal: number
  courseLogsLoading: boolean
  fetchCourseLogs: (opts?: { page?: number }) => Promise<void>

  // Approval queue
  pendingBatches: BatchWithCourses[]
  pendingIndividualCourses: (Course & { created_by_name: string })[]
  pendingLoading: boolean
  fetchPendingBatches: (deptCode?: string) => Promise<void>
  fetchBatchDetails: (batchId: string) => Promise<BatchWithCourses | null>
  approveBatch: (batchId: string) => Promise<{ error?: string }>
  rejectBatchRows: (batchId: string, courseIds: string[], reason: string) => Promise<{ error?: string }>
  rejectBatch: (batchId: string, reason: string) => Promise<{ error?: string }>
  sendBackBatch: (batchId: string, notes: string) => Promise<{ error?: string }>
  rollbackBatch: (batchId: string) => Promise<{ error?: string }>
}

export function useCurriculumManagement(): UseCurriculumReturn {
  const [courses, setCourses] = useState<Course[]>([])
  const [totalCourses, setTotalCourses] = useState(0)
  const [coursesLoading, setCoursesLoading] = useState(false)

  const [uploadHistory, setUploadHistory] = useState<any[]>([])
  const [uploadHistoryTotal, setUploadHistoryTotal] = useState(0)
  const [individualCourseHistory, setIndividualCourseHistory] = useState<any[]>([])
  const [uploadHistoryLoading, setUploadHistoryLoading] = useState(false)

  const [courseLogs, setCourseLogs] = useState<any[]>([])
  const [courseLogsTotal, setCourseLogsTotal] = useState(0)
  const [courseLogsLoading, setCourseLogsLoading] = useState(false)

  const [pendingBatches, setPendingBatches] = useState<BatchWithCourses[]>([])
  const [pendingIndividualCourses, setPendingIndividualCourses] = useState<(Course & { created_by_name: string })[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)

  // -- Course Catalog --
  const fetchCourses = useCallback(async (filters?: CourseFilters) => {
    setCoursesLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters?.department_code) params.set('department_code', filters.department_code)
      if (filters?.year_level) params.set('year_level', String(filters.year_level))
      if (filters?.term) params.set('term', String(filters.term))
      if (filters?.delivery_mode) params.set('delivery_mode', filters.delivery_mode)
      if (filters?.approval_status) params.set('approval_status', filters.approval_status)
      if (filters?.search) params.set('search', filters.search)
      if (filters?.page) params.set('page', String(filters.page))
      if (filters?.limit) params.set('limit', String(filters.limit))

      const res = await fetch(`/api/courses?${params}`)
      const data = await res.json()
      if (res.ok) {
        setCourses(data.courses ?? [])
        setTotalCourses(data.total ?? 0)
      }
    } finally {
      setCoursesLoading(false)
    }
  }, [])

  const createCourse = useCallback(async (input: CourseCreateInput) => {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.validation?.errors?.[0]?.message ?? data.error ?? 'Failed to create course' }
    return { course: data.course, warnings: data.warnings }
  }, [])

  const updateCourse = useCallback(async (id: string, updates: Partial<CourseCreateInput>) => {
    const res = await fetch(`/api/courses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Failed to update course' }
    return { course: data.course }
  }, [])

  const deleteCourse = useCallback(async (id: string, force?: boolean) => {
    const url = new URL(`/api/courses/${id}`, window.location.origin)
    if (force) url.searchParams.set('force', 'true')
    
    const res = await fetch(url.toString(), {
      method: 'DELETE',
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Failed to delete course', requiresForce: data.requiresForce }
    return {}
  }, [])

  const bulkDeleteCourses = useCallback(async (ids: string[], force?: boolean) => {
    const res = await fetch('/api/courses/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseIds: ids, force }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Failed to bulk delete courses', requiresForce: data.requiresForce }
    return { deleted: data.deleted, skipped: data.skipped, message: data.message }
  }, [])

  const approveCourse = useCallback(async (id: string) => {
    const res = await fetch(`/api/courses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Failed to approve course' }
    return { course: data.course }
  }, [])

  // -- Upload --
  const uploadCSV = useCallback(async (file: File, deptId: string, termId?: string, uploaderNotes?: string, labelYearLevel?: number | null, labelTerm?: number | null) => {
    const formData = new FormData()
    formData.append('file', file)
    if (deptId) formData.append('department_id', deptId)
    else formData.append('mixed', 'true')
    if (termId) formData.append('academic_term_id', termId)
    if (uploaderNotes) formData.append('uploader_notes', uploaderNotes)
    if (labelYearLevel != null) formData.append('label_year_level', String(labelYearLevel))
    if (labelTerm != null) formData.append('label_term', String(labelTerm))

    const res = await fetch('/api/courses/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Upload failed' }
    return data
  }, [])

  const submitBatch = useCallback(async (batchId: string) => {
    const res = await fetch(`/api/courses/batch/${batchId}/submit`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Submit failed' }
    return {}
  }, [])

  // Privileged self-publish — Academic Head only. Skips the review queue and
  // approves the uploader's own batch directly. Throws 403 for other roles.
  const publishBatch = useCallback(async (batchId: string) => {
    const res = await fetch(`/api/courses/batch/${batchId}/publish`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Publish failed' }
    return { message: data.message }
  }, [])

  const deleteBatch = useCallback(async (batchId: string) => {
    const res = await fetch(`/api/courses/batch/${batchId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Failed to delete batch' }
    return {}
  }, [])

  const downloadTemplate = useCallback(async (opts?: { code: string; name: string } | { mixed: true; allCodes: string[] }) => {
    const params = new URLSearchParams()
    let filename = 'course_template.xlsx'

    if (opts && 'mixed' in opts) {
      params.set('mixed', 'true')
      if (opts.allCodes.length) params.set('all_dept_codes', opts.allCodes.join(','))
      filename = 'course_template_mixed.xlsx'
    } else if (opts) {
      params.set('department_code', opts.code)
      params.set('department_name', opts.name)
      filename = `course_template_${opts.code}.xlsx`
    }

    const res = await fetch(`/api/courses/upload/template?${params}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [])

  // -- Upload History --
  const fetchUploadHistory = useCallback(async (opts?: { page?: number; deptId?: string }) => {
    setUploadHistoryLoading(true)
    try {
      const params = new URLSearchParams()
      if (opts?.page) params.set('page', String(opts.page))
      if (opts?.deptId) params.set('department_id', opts.deptId)

      const res = await fetch(`/api/courses/upload/history?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setUploadHistory(data.uploads ?? [])
        setUploadHistoryTotal(data.total ?? 0)
        setIndividualCourseHistory(data.individualCourses ?? [])
      }
    } finally {
      setUploadHistoryLoading(false)
    }
  }, [])

  const clearHistory = useCallback(async () => {
    const res = await fetch('/api/courses/upload/history/clear', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Failed to clear history' }
    return { cleared: data.cleared }
  }, [])

  // -- Course Action Logs --
  const fetchCourseLogs = useCallback(async (opts?: { page?: number }) => {
    setCourseLogsLoading(true)
    try {
      const params = new URLSearchParams()
      if (opts?.page) params.set('page', String(opts.page))

      const res = await fetch(`/api/courses/upload/logs?${params}`)
      const data = await res.json()
      if (res.ok) {
        setCourseLogs(data.logs ?? [])
        setCourseLogsTotal(data.total ?? 0)
      }
    } finally {
      setCourseLogsLoading(false)
    }
  }, [])

  // -- Approval Queue --
  const fetchPendingBatches = useCallback(async (deptCode?: string) => {
    setPendingLoading(true)
    try {
      const params = new URLSearchParams()
      if (deptCode) params.set('department_code', deptCode)

      const res = await fetch(`/api/courses/approval/pending?${params}`)
      const data = await res.json()
      if (res.ok) {
        setPendingBatches(data.batches ?? [])
        setPendingIndividualCourses(data.individualCourses ?? [])
      }
    } finally {
      setPendingLoading(false)
    }
  }, [])

  const fetchBatchDetails = useCallback(async (batchId: string): Promise<BatchWithCourses | null> => {
    const res = await fetch(`/api/courses/approval/batch/${batchId}`)
    const data = await res.json()
    return res.ok ? data.batch : null
  }, [])

  const approveBatch = useCallback(async (batchId: string) => {
    const res = await fetch(`/api/courses/approval/batch/${batchId}/approve`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Approval failed' }
    return {}
  }, [])

  const rejectBatchRows = useCallback(async (batchId: string, courseIds: string[], reason: string) => {
    const res = await fetch(`/api/courses/approval/batch/${batchId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_ids: courseIds, reason }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Rejection failed' }
    return {}
  }, [])

  const rejectBatch = useCallback(async (batchId: string, reason: string) => {
    const res = await fetch(`/api/courses/approval/batch/${batchId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reject_all: true, reason }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Rejection failed' }
    return {}
  }, [])

  const sendBackBatch = useCallback(async (batchId: string, notes: string) => {
    const res = await fetch(`/api/courses/approval/batch/${batchId}/send-back`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Send-back failed' }
    return {}
  }, [])

  const rollbackBatch = useCallback(async (batchId: string) => {
    const res = await fetch(`/api/courses/approval/batch/${batchId}/rollback`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Rollback failed' }
    return {}
  }, [])

  const requestDeletion = useCallback(async (batchId: string, reason: string) => {
    const res = await fetch(`/api/courses/batch/${batchId}/request-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Request failed' }
    return {}
  }, [])

  // -- Term Offerings Removed --

  return {
    courses, totalCourses, coursesLoading, fetchCourses, createCourse, updateCourse, deleteCourse, bulkDeleteCourses, approveCourse,
    uploadCSV, submitBatch, publishBatch, deleteBatch, requestDeletion, downloadTemplate,
    uploadHistory, uploadHistoryTotal, individualCourseHistory, uploadHistoryLoading, fetchUploadHistory, clearHistory,
    courseLogs, courseLogsTotal, courseLogsLoading, fetchCourseLogs,
    pendingBatches, pendingIndividualCourses, pendingLoading, fetchPendingBatches, fetchBatchDetails,
    approveBatch, rejectBatchRows, rejectBatch, sendBackBatch, rollbackBatch,
  }
}
