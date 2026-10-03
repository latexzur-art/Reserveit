'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCurriculumManagement } from '@/hooks/academic-head/useCurriculumManagement'
import { useRefetchOnFocus } from '@/hooks/shared/useRefetchOnFocus'
import { BatchUploadList } from '@/components/curriculum/BatchUploadList'
import { CourseUploadModal } from '@/components/curriculum/CourseUploadModal'
import { CourseFormModal } from '@/components/curriculum/CourseFormModal'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { Button } from '@/components/ui/button'
import { GraduationCap, Upload, Plus } from 'lucide-react'
import type { CourseCreateInput } from '@/types/course.types'

export default function ProgramHeadCurriculumPage() {
  const { user } = useAuth()
  const {
    uploadHistory, uploadHistoryTotal, uploadHistoryLoading, fetchUploadHistory,
    uploadCSV, submitBatch, deleteBatch, requestDeletion, downloadTemplate,
  } = useCurriculumManagement()

  const [batchPage, setBatchPage] = useState(1)
  const [showUpload, setShowUpload] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([])
  const [gridDeptId, setGridDeptId] = useState('')

  // Pre-select the program head's own department when departments load
  useEffect(() => {
    fetch('/api/departments')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.departments) return
        setDepartments(data.departments)
        // Auto-select the user's department for grid entry
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userDeptCode = (user as any)?.department?.code
        if (userDeptCode) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          const match = data.departments.find((d: any) => d.code === userDeptCode)
          if (match) {
            setGridDeptId(match.id)
          }
        }
      })
  }, [user])

  useEffect(() => {
    fetchUploadHistory({ page: batchPage })
  }, [batchPage, fetchUploadHistory])

  const refreshBatches = () => fetchUploadHistory({ page: batchPage })

  useRefetchOnFocus(refreshBatches)

  const handleFormSubmit = async (input: CourseCreateInput) => {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.validation?.errors?.[0]?.message ?? data.error ?? 'Failed to create course' }
    refreshBatches()
    return {}
  }

  return (
    <div className="min-h-screen bg-background">
      <ConnectedTopBar
        title="Curriculum"
        breadcrumbs={[
          { label: 'Dashboard', href: '/program/dashboard' },
          { label: 'Curriculum' },
        ]}
      />

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Curriculum <span className="text-accent-brand">Management</span></h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload course batches and submit them to the Academic Head for approval.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-1" /> Upload / Batch Entry
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Course
            </Button>
          </div>
        </div>

        {/* Batch list */}
        <BatchUploadList
          batches={uploadHistory}
          total={uploadHistoryTotal}
          loading={uploadHistoryLoading}
          isAcademicHead={false}
          page={batchPage}
          onPageChange={setBatchPage}
          onSubmitBatch={submitBatch}
          onApproveBatch={async () => ({ error: 'Not available' })}
          onRejectBatch={async () => ({ error: 'Not available' })}
          onSendBackBatch={async () => ({ error: 'Not available' })}
          onDeleteBatch={deleteBatch}
          onRequestDeletion={requestDeletion}
          onRefresh={refreshBatches}
        />
      </main>

      {/* Modals */}
      <CourseUploadModal
        open={showUpload}
        onClose={() => { setShowUpload(false); refreshBatches() }}
        onUpload={uploadCSV}
        onSubmitBatch={submitBatch}
        onDownloadTemplate={downloadTemplate}
        departmentId={gridDeptId}
      />

      <CourseFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleFormSubmit}
        editingCourse={null}
        isAcademicHead={false}
      />
    </div>
  )
}
