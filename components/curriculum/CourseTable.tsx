'use client'

import { useEffect, useState } from 'react'
import type { Course, CourseFilters, DeliveryMode, ApprovalStatus } from '@/types/course.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ChevronLeft, ChevronRight, Search, Plus, Upload, Trash2, Download } from 'lucide-react'

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  sent_back: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

const DELIVERY_LABELS: Record<DeliveryMode, string> = {
  lecture: 'Lecture',
  lab: 'Lab',
  both: 'Both',
  practicum: 'Practicum',
}

interface CourseTableProps {
  courses: Course[]
  total: number
  loading: boolean
  filters: CourseFilters
  onFiltersChange: (filters: CourseFilters) => void
  onAddCourse: () => void
  onUploadCourse: () => void
  onEditCourse: (course: Course) => void
  onApproveCourse?: (course: Course) => void
  onDeleteCourse?: (course: Course, force?: boolean) => Promise<{ error?: string; requiresForce?: boolean }>
  onBulkDeleteCourses?: (courses: Course[], force?: boolean) => Promise<{ error?: string; requiresForce?: boolean }>
  showDepartmentColumn?: boolean
  isAcademicHead?: boolean
  departments?: { id: string; code: string; name: string }[]
}

export function CourseTable({
  courses, total, loading, filters, onFiltersChange,
  onAddCourse, onUploadCourse, onEditCourse, onApproveCourse, onDeleteCourse, onBulkDeleteCourses, showDepartmentColumn, isAcademicHead,
  departments,
}: CourseTableProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const page = filters.page ?? 1
  const limit = filters.limit ?? 25
  const totalPages = Math.ceil(total / limit)

  const handleSearch = () => {
    setSelectedIds(new Set())
    onFiltersChange({ ...filters, search: searchInput, page: 1 })
  }

  // Debounce so typing filters the table without requiring Enter
  useEffect(() => {
    if (searchInput === (filters.search ?? '')) return
    const handle = setTimeout(() => {
      setSelectedIds(new Set())
      onFiltersChange({ ...filters, search: searchInput || undefined, page: 1 })
    }, 400)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // --- Bulk Delete State & Logic ---
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [forceBulkDeletePrompt, setForceBulkDeletePrompt] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const handleBulkDelete = async (force: boolean = false) => {
    if (!onBulkDeleteCourses || selectedIds.size === 0) return
    setBulkDeleting(true)
    const selectedCourses = courses.filter(c => selectedIds.has(c.id))
    const result = await onBulkDeleteCourses(selectedCourses, force)
    setBulkDeleting(false)

    if (result && result.requiresForce && !force) {
      setConfirmBulkDelete(false)
      setForceBulkDeletePrompt(true)
    } else if (result && result.error) {
      alert(result.error)
      setConfirmBulkDelete(false)
      setForceBulkDeletePrompt(false)
    } else {
      setSelectedIds(new Set())
      setConfirmBulkDelete(false)
      setForceBulkDeletePrompt(false)
    }
  }

  // --- Single Delete State & Logic ---
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [forceDeletePrompt, setForceDeletePrompt] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (force: boolean = false) => {
    if (!onDeleteCourse || !courseToDelete) return
    setDeleting(true)
    const result = await onDeleteCourse(courseToDelete, force)
    setDeleting(false)

    if (result && result.requiresForce && !force) {
      setConfirmDelete(false)
      setForceDeletePrompt(true)
    } else if (result && result.error) {
      alert(result.error)
      setConfirmDelete(false)
      setForceDeletePrompt(false)
      setCourseToDelete(null)
    } else {
      setConfirmDelete(false)
      setForceDeletePrompt(false)
      setCourseToDelete(null)
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filters.department_code) params.append('department_code', filters.department_code)
    if (filters.year_level) params.append('year_level', filters.year_level.toString())
    if (filters.term) params.append('term', filters.term.toString())
    if (filters.delivery_mode) params.append('delivery_mode', filters.delivery_mode)
    if (filters.approval_status) params.append('approval_status', filters.approval_status)
    if (filters.search) params.append('search', filters.search)
    if (filters.batch_upload_id) params.append('batch_upload_id', filters.batch_upload_id)

    window.location.href = `/api/courses/export?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 w-64"
            />
          </div>

          {departments && departments.length > 0 && (
            <select
              value={filters.department_code ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, department_code: e.target.value || undefined, page: 1 })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All Depts</option>
              {departments.map(d => (
                <option key={d.id} value={d.code}>{d.code}</option>
              ))}
            </select>
          )}

          <select
            value={filters.year_level ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, year_level: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All Years</option>
            {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>

          <select
            value={filters.term ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, term: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All Terms</option>
            <option value="1">1st Semester</option>
            <option value="2">2nd Semester</option>
            <option value="3">Summer/Midyear</option>
          </select>

          <select
            value={filters.delivery_mode ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, delivery_mode: (e.target.value || undefined) as DeliveryMode | undefined, page: 1 })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All Modes</option>
            <option value="lecture">Lecture</option>
            <option value="lab">Lab</option>
            <option value="both">Both</option>
          </select>

          <select
            value={filters.approval_status ?? ''}
            onChange={(e) => onFiltersChange({ ...filters, approval_status: (e.target.value || undefined) as ApprovalStatus | undefined, page: 1 })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="sent_back">Sent Back</option>
          </select>
        </div>

        <div className="flex gap-2">
          {selectedIds.size > 0 && onBulkDeleteCourses && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setConfirmBulkDelete(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button onClick={handleExport} variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
          <Button onClick={onUploadCourse} variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" /> Upload CSV
          </Button>
          <Button onClick={onAddCourse} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Course
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 w-[40px]">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300"
                  checked={courses.length > 0 && selectedIds.size === courses.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(courses.map(c => c.id)))
                    else setSelectedIds(new Set())
                  }}
                />
              </th>
              <th className="text-left px-4 py-3 font-medium">Code</th>
              <th className="text-left px-4 py-3 font-medium">Course Name</th>
              {showDepartmentColumn && <th className="text-left px-4 py-3 font-medium">Dept</th>}
              <th className="text-center px-4 py-3 font-medium">Units</th>
              <th className="text-center px-4 py-3 font-medium">Year/Term</th>
              <th className="text-center px-4 py-3 font-medium">Mode</th>
              <th className="text-center px-4 py-3 font-medium">Active</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : courses.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No courses found</td></tr>
            ) : courses.map((course) => (
              <tr key={course.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300"
                    checked={selectedIds.has(course.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedIds)
                      if (e.target.checked) newSet.add(course.id)
                      else newSet.delete(course.id)
                      setSelectedIds(newSet)
                    }}
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs">{course.course_code}</td>
                <td className="px-4 py-3">{course.course_name}</td>
                {showDepartmentColumn && <td className="px-4 py-3 text-xs">{course.department_code}</td>}
                <td className="px-4 py-3 text-center">{course.units}</td>
                <td className="px-4 py-3 text-center text-xs">Y{course.year_level} / T{course.term}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant="outline" className="text-xs">{DELIVERY_LABELS[course.delivery_mode as DeliveryMode] ?? course.delivery_mode}</Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={course.is_active ? "default" : "secondary"} className={course.is_active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : ""}>
                    {course.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[course.approval_status as ApprovalStatus]}`}>
                    {course.approval_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  {['pending', 'sent_back'].includes(course.approval_status) && onApproveCourse && (
                    <Button variant="ghost" size="sm" className="text-green-500 hover:text-green-600" onClick={() => onApproveCourse(course)}>Approve</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onEditCourse(course)}>Edit</Button>
                  {onDeleteCourse && (
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                      setCourseToDelete(course)
                      setConfirmDelete(true)
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline" size="sm" disabled={page <= 1}
              onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="sm" disabled={page >= totalPages}
              onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals for Single Delete */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the course "{courseToDelete?.course_code}: {courseToDelete?.course_name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault()
                handleDelete(false)
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Course'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={forceDeletePrompt} onOpenChange={setForceDeletePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Active Schedules Detected</AlertDialogTitle>
            <AlertDialogDescription>
              Cannot delete this course because it has active schedules linked to it. 
              Do you want to force delete the course and permanently delete its associated schedules as well?
              This action is highly destructive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault()
                handleDelete(true)
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Course & Schedules'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modals for Bulk Delete */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete these courses?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {selectedIds.size} selected course(s).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault()
                handleBulkDelete(false)
              }}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? 'Deleting...' : 'Delete Courses'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={forceBulkDeletePrompt} onOpenChange={setForceBulkDeletePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Active Schedules Detected</AlertDialogTitle>
            <AlertDialogDescription>
              Cannot delete because some of the selected courses have active schedules linked to them. 
              Do you want to force delete these courses and permanently delete their associated schedules as well?
              This action is highly destructive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault()
                handleBulkDelete(true)
              }}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? 'Deleting...' : 'Force Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
