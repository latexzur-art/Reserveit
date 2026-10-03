'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCurriculumManagement } from '@/hooks/academic-head/useCurriculumManagement'
import { CourseTable } from '@/components/curriculum/CourseTable'
import { CourseFormModal } from '@/components/curriculum/CourseFormModal'
import { CourseUploadModal } from '@/components/curriculum/CourseUploadModal'
import { BatchUploadList } from '@/components/curriculum/BatchUploadList'
import { Grid3X3, Database, X } from 'lucide-react'
import type { Course, CourseFilters, CourseCreateInput } from '@/types/course.types'
import { cn } from '@/lib/utils'

type Tab = 'courses' | 'batches'

export default function CourseCatalogPage() {
  const { user } = useAuth()
  const isAcademicHead = user?.roles.some(r => r.name === 'academic_head') ?? false
  const {
    courses, totalCourses, coursesLoading, fetchCourses,
    createCourse, updateCourse, deleteCourse, bulkDeleteCourses, approveCourse,
    uploadCSV, submitBatch, downloadTemplate,
    uploadHistory, uploadHistoryTotal, uploadHistoryLoading, fetchUploadHistory,
    approveBatch, rejectBatch, sendBackBatch, deleteBatch, rollbackBatch, publishBatch,
  } = useCurriculumManagement()

  const [tab, setTab] = useState<Tab>('courses')
  const [filters, setFilters] = useState<CourseFilters>({ page: 1, limit: 25, approval_status: 'approved' })
  const [batchPage, setBatchPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([])

  // 1. FIXED STATUS CASING (Ensures Green Badge)
  const displayCourses = courses.map(course => ({
    ...course,
    approval_status: course.approval_status === 'approved' ? 'Approved' : course.approval_status
  }))

  useEffect(() => {
    fetch('/api/departments')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.departments) setDepartments(data.departments) })
  }, [])

  useEffect(() => {
    if (tab === 'courses') fetchCourses(filters)
  }, [filters, fetchCourses, tab])

  useEffect(() => {
    if (tab === 'batches') fetchUploadHistory({ page: batchPage })
  }, [tab, batchPage, fetchUploadHistory])

  // 2. RE-ADDED MISSING HANDLERS
  const handleEdit = (course: Course) => {
    setEditingCourse(course)
    setShowForm(true)
  }

  const handleApprove = async (course: Course) => {
    const res = await approveCourse(course.id)
    if (!res.error) fetchCourses(filters)
  }

  const handleFormSubmit = async (input: CourseCreateInput) => {
    if (editingCourse) {
      const res = await updateCourse(editingCourse.id, input)
      if (!res.error) fetchCourses(filters)
      return res
    }
    const res = await createCourse(input)
    if (!res.error) fetchCourses(filters)
    return { error: res.error }
  }

  const handleDeleteById = async (courseId: string, force?: boolean) => {
    const res = await deleteCourse(courseId, force)
    if (!res.error && !res.requiresForce) fetchCourses(filters)
    return res
  }

  const handleBulkDelete = async (coursesToDelete: Course[], force?: boolean) => {
    const res = await bulkDeleteCourses(coursesToDelete.map(c => c.id), force)
    if (!res.error && !res.requiresForce) fetchCourses(filters)
    return res
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 px-4 sm:px-6 py-6">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Course <span className="text-accent-brand">Catalog</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
            Academic Inventory Terminal
          </p>
        </div>

        <div className="flex bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200 dark:border-white/[0.08]">
          <button
            onClick={() => setTab('courses')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
              tab === 'courses' 
                ? "bg-white dark:bg-[#1e232d] text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-white/10" 
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Inventory
          </button>
          <button
            onClick={() => setTab('batches')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
              tab === 'batches' 
                ? "bg-white dark:bg-[#1e232d] text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-white/10" 
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Batches
          </button>
        </div>
      </div>

      {/* ── DATA TABLE ── */}
      <div>
        {tab === 'courses' ? (
          <CourseTable
            courses={displayCourses as unknown as Course[]}
            total={totalCourses}
            loading={coursesLoading}
            filters={filters}
            onFiltersChange={setFilters}
            onAddCourse={() => { setEditingCourse(null); setShowForm(true) }}
            onUploadCourse={() => setShowUpload(true)}
            onEditCourse={handleEdit}
            onApproveCourse={handleApprove}
            onDeleteCourse={(id: any) => handleDeleteById(typeof id === 'string' ? id : id.id)}
            onBulkDeleteCourses={handleBulkDelete}
            showDepartmentColumn
            isAcademicHead={isAcademicHead}
            departments={departments}
          />
        ) : (
          <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
            <BatchUploadList
              batches={uploadHistory}
              total={uploadHistoryTotal}
              loading={uploadHistoryLoading}
              isAcademicHead={isAcademicHead}
              currentUserId={user?.id}
              page={batchPage}
              onPageChange={setBatchPage}
              onSubmitBatch={submitBatch}
              onApproveBatch={approveBatch}
              onRejectBatch={rejectBatch}
              onSendBackBatch={sendBackBatch}
              onDeleteBatch={deleteBatch}
              onRollbackBatch={rollbackBatch}
              onPublishBatch={publishBatch}
              onRefresh={() => fetchUploadHistory({ page: batchPage })}
            />
          </div>
        )}
      </div>

      <CourseFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingCourse(null) }}
        onSubmit={handleFormSubmit}
        editingCourse={editingCourse}
        isAcademicHead={isAcademicHead}
        onDelete={handleDeleteById}
      />
      
      <CourseUploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={uploadCSV}
        onSubmitBatch={submitBatch}
        onDownloadTemplate={downloadTemplate}
        onPublishBatch={isAcademicHead ? publishBatch : undefined}
        isAcademicHead={isAcademicHead}
      />
    </div>
  )
}