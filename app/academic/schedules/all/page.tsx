'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Combobox } from '@/components/ui/combobox'
import {
  Plus, Trash2,
  Loader2, BookOpen, AlertTriangle, X, Save,
  LayoutList, Flame, CheckSquare,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMasterScheduleFilters } from '@/hooks/academic-head/useMasterScheduleFilters'
import { ScheduleFilters } from './_components/ScheduleFilters'
import { MasterScheduleGrid, LoadingState, EmptyState, Pagination } from './_components/MasterScheduleGrid'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ── Types ──────────────────────────────────────────────────────────────────────

type Department = { id: string; name: string; code: string }
type AcademicTerm = {
  id: string; term_name: string; term_code: string
  academic_year: string; term_type: string; is_active?: boolean
}
type Facility = { id: string; name: string; room_number?: string | null }
type Instructor = {
  id: string
  full_name: string
  employee_id: string | null
  department_id: string | null
  department_code: string | null
}
type ClassSchedule = {
  id: string
  course_code: string; course_name: string; section: string
  instructor_name: string | null
  day_of_week: number
  start_time: string; end_time: string
  effective_start_date: string | null; effective_end_date: string | null
  is_active: boolean; version: number
  facility_id: string | null; department_id: string; academic_term_id: string
  facilities: { id: string; name: string; room_number: string | null } | null
  departments: { id: string; name: string; code: string } | null
  academic_terms: { id: string; term_name: string; term_code: string; academic_year: string; term_type: string } | null
}
type FormData = {
  academic_term_id: string; department_id: string; facility_id: string
  course_code: string; course_name: string; section: string
  instructor_name: string; day_of_week: string
  start_time: string; end_time: string
  effective_start_date: string; effective_end_date: string
  reason: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const LIMIT = 50

function formatTime(t: string): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

const emptyForm = (): FormData => ({
  academic_term_id: '', department_id: '', facility_id: '',
  course_code: '', course_name: '', section: '', instructor_name: '',
  day_of_week: '1', start_time: '07:00', end_time: '08:00',
  effective_start_date: '', effective_end_date: '', reason: '',
})

function scheduleToForm(s: ClassSchedule): FormData {
  return {
    academic_term_id: s.academic_term_id,
    department_id: s.department_id,
    facility_id: s.facility_id ?? '',
    course_code: s.course_code,
    course_name: s.course_name,
    section: s.section,
    instructor_name: s.instructor_name ?? '',
    day_of_week: String(s.day_of_week),
    start_time: s.start_time?.slice(0, 5) ?? '',
    end_time: s.end_time?.slice(0, 5) ?? '',
    effective_start_date: s.effective_start_date ?? '',
    effective_end_date: s.effective_end_date ?? '',
    reason: '',
  }
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AllSchedulesPage() {
  // Filters
  const [departmentId, setDepartmentId] = useState('')
  const [termId, setTermId] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [page, setPage] = useState(1)

  // Data
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState<Department[]>([])
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [instructorsLoading, setInstructorsLoading] = useState(true)

  // Selection (via hook)
  const {
    selected,
    setSelected,
    allSelected,
    someSelected,
    selectedCount,
    toggleSelect,
    toggleAll,
    clearSelection,
    selectedActiveCount,
    selectedInactiveCount,
  } = useMasterScheduleFilters(schedules)

  // CRUD modals
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ClassSchedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClassSchedule | null>(null)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<ClassSchedule | null>(null)
  const [bulkAction, setBulkAction] = useState<'deactivate' | 'hard_delete' | null>(null)

  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reference data
  useEffect(() => {
    setInstructorsLoading(true)
    Promise.all([
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/admin/academic-terms').then(r => r.json()),
      fetch('/api/facilities').then(r => r.json()),
      fetch('/api/instructors').then(r => r.json()),
    ]).then(([d, t, f, i]) => {
      setDepartments(d.departments ?? [])
      setTerms(t.terms ?? [])
      setFacilities(f.facilities ?? [])
      setInstructors(i.instructors ?? [])
    }).catch(() => {})
      .finally(() => setInstructorsLoading(false))
  }, [])

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (departmentId) params.set('department_id', departmentId)
      if (termId) params.set('academic_term_id', termId)
      if (search) params.set('search', search)
      if (showInactive) params.set('include_inactive', 'true')
      if (unassignedOnly) params.set('unassigned', 'true')
      const res = await fetch(`/api/schedules/all?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setSchedules(data.schedules ?? [])
      setTotal(data.total ?? 0)
    } catch (e: any) {
      setError(e.message)
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [page, departmentId, termId, search, showInactive, unassignedOnly])

  useEffect(() => { setPage(1); setSelected(new Set()) }, [departmentId, termId, search, showInactive, unassignedOnly])
  useEffect(() => { setSelected(new Set()) }, [page])
  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  const totalPages = Math.ceil(total / LIMIT)

  // ── CRUD handlers ────────────────────────────────────────────────────────────

  const handleCreate = async (data: FormData) => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/schedules/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          day_of_week: parseInt(data.day_of_week),
          facility_id: data.facility_id || null,
          instructor_name: data.instructor_name || null,
          effective_start_date: data.effective_start_date || null,
          effective_end_date: data.effective_end_date || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create')
      setCreateOpen(false); fetchSchedules()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleEdit = async (data: FormData) => {
    if (!editTarget) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/schedules/manage/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: data.facility_id || null,
          course_code: data.course_code,
          course_name: data.course_name,
          section: data.section,
          instructor_name: data.instructor_name || null,
          day_of_week: parseInt(data.day_of_week),
          start_time: data.start_time,
          end_time: data.end_time,
          effective_start_date: data.effective_start_date || null,
          effective_end_date: data.effective_end_date || null,
          reason: data.reason || 'Modified by Academic Head',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update')
      setEditTarget(null); fetchSchedules()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  // Soft delete single
  const handleDeactivate = async () => {
    if (!deleteTarget) return
    setActing(true); setError(null)
    try {
      const res = await fetch(`/api/schedules/manage/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to deactivate')
      setDeleteTarget(null); fetchSchedules()
    } catch (e: any) { setError(e.message) }
    finally { setActing(false) }
  }

  // Hard delete single
  const handleHardDelete = async () => {
    if (!hardDeleteTarget) return
    setActing(true); setError(null)
    try {
      const res = await fetch(`/api/schedules/all/${hardDeleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to permanently delete')
      setHardDeleteTarget(null); fetchSchedules()
    } catch (e: any) { setError(e.message) }
    finally { setActing(false) }
  }

  // Bulk deactivate
  const handleBulkDeactivate = async () => {
    const ids = [...selected]
    setActing(true); setError(null)
    try {
      const res = await fetch('/api/schedules/all/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Bulk deactivate failed')
      clearSelection(); setBulkAction(null); fetchSchedules()
    } catch (e: any) { setError(e.message) }
    finally { setActing(false) }
  }

  // Bulk hard delete
  const handleBulkHardDelete = async () => {
    const ids = [...selected]
    setActing(true); setError(null)
    try {
      const res = await fetch('/api/schedules/all/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Bulk delete failed')
      clearSelection(); setBulkAction(null); fetchSchedules()
    } catch (e: any) { setError(e.message) }
    finally { setActing(false) }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#060A11] transition-colors duration-300">
      <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-32">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">
              Schedule <span className="text-accent-brand">Directory</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
              View, manage, and modify all class schedule entries
            </p>
          </div>
          <button
            onClick={() => { setError(null); setCreateOpen(true) }}
            className="flex items-center gap-2 px-6 h-12 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-lg shadow-slate-900/10 dark:shadow-blue-600/20 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New Schedule
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filters */}
        <ScheduleFilters
          searchInput={searchInput}
          departmentId={departmentId}
          termId={termId}
          showInactive={showInactive}
          unassignedOnly={unassignedOnly}
          departments={departments}
          terms={terms}
          onSearchInputChange={setSearchInput}
          onDepartmentChange={setDepartmentId}
          onTermChange={setTermId}
          onShowInactiveChange={setShowInactive}
          onUnassignedOnlyChange={setUnassignedOnly}
        />

        {/* Count + Pagination */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <LayoutList className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
              {loading ? 'Loading…' : `${total.toLocaleString()} schedule${total !== 1 ? 's' : ''} found`}
            </span>
            {selectedCount > 0 && (
              <span className="ml-2 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-wide">
                {selectedCount} selected
              </span>
            )}
          </div>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          )}
        </div>

        {/* Content */}
        {loading ? (
          <LoadingState />
        ) : schedules.length === 0 ? (
          <EmptyState filtered={!!(departmentId || termId || search)} />
        ) : (
          <div className="space-y-2">
            <MasterScheduleGrid
              schedules={schedules}
              selected={selected}
              allSelected={allSelected}
              someSelected={someSelected}
              showInactive={showInactive}
              onToggleAll={toggleAll}
              onToggleSelect={toggleSelect}
              onEdit={s => { setError(null); setEditTarget(s) }}
              onDeactivate={s => { setError(null); setDeleteTarget(s) }}
              onHardDelete={s => { setError(null); setHardDeleteTarget(s) }}
            />
            {totalPages > 1 && (
              <div className="flex justify-center pt-4">
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 bg-slate-900 dark:bg-[#0B0F17] border border-slate-700 dark:border-slate-700 rounded-2xl px-5 py-3 shadow-2xl shadow-slate-900/40">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
              <CheckSquare className="h-4 w-4 text-blue-400" />
              <span className="text-[11px] font-black text-white uppercase tracking-wide">
                {selectedCount} selected
              </span>
            </div>

            {selectedActiveCount > 0 && (
              <button
                onClick={() => setBulkAction('deactivate')}
                className="flex items-center gap-2 px-4 h-9 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Deactivate {selectedActiveCount > 0 && `(${selectedActiveCount})`}
              </button>
            )}

            {selectedInactiveCount > 0 && (
              <button
                onClick={() => setBulkAction('hard_delete')}
                className="flex items-center gap-2 px-4 h-9 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Flame className="h-3.5 w-3.5" />
                Delete Forever {selectedInactiveCount > 0 && `(${selectedInactiveCount})`}
              </button>
            )}

            <button
              onClick={clearSelection}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {createOpen && (
        <ScheduleFormModal
          title="New Schedule"
          departments={departments} terms={terms} facilities={facilities}
          instructors={instructors} instructorsLoading={instructorsLoading}
          saving={saving}
          onClose={() => { setCreateOpen(false); setError(null) }}
          onSave={handleCreate}
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <ScheduleFormModal
          title="Edit Schedule" initial={scheduleToForm(editTarget)} isEdit
          departments={departments} terms={terms} facilities={facilities}
          instructors={instructors} instructorsLoading={instructorsLoading}
          saving={saving}
          onClose={() => { setEditTarget(null); setError(null) }}
          onSave={handleEdit}
        />
      )}

      {/* Soft Delete Confirm */}
      {deleteTarget && (
        <ConfirmModal
          icon={<Trash2 className="h-6 w-6 text-amber-500" />}
          iconBg="bg-amber-500/10"
          title="Deactivate Schedule"
          acting={acting}
          onCancel={() => { setDeleteTarget(null); setError(null) }}
          onConfirm={handleDeactivate}
          confirmLabel="Deactivate"
          confirmClass="bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
        >
          <p className="text-[13px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">
            {deleteTarget.course_code} · {deleteTarget.section}
          </p>
          <p className="text-[11px] font-bold text-slate-500">{deleteTarget.course_name}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">
            {DAYS[deleteTarget.day_of_week]} · {formatTime(deleteTarget.start_time)} – {formatTime(deleteTarget.end_time)}
          </p>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-widest mt-5">
            This schedule will be marked inactive. It remains in the database and can be permanently deleted afterward.
          </p>
        </ConfirmModal>
      )}

      {/* Hard Delete Confirm */}
      {hardDeleteTarget && (
        <ConfirmModal
          icon={<Flame className="h-6 w-6 text-rose-500" />}
          iconBg="bg-rose-500/10"
          title="Permanently Delete"
          acting={acting}
          onCancel={() => { setHardDeleteTarget(null); setError(null) }}
          onConfirm={handleHardDelete}
          confirmLabel="Delete Forever"
          confirmClass="bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
        >
          <p className="text-[13px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">
            {hardDeleteTarget.course_code} · {hardDeleteTarget.section}
          </p>
          <p className="text-[11px] font-bold text-slate-500">{hardDeleteTarget.course_name}</p>
          <div className="mt-4 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Irreversible Action</span>
            </div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
              This record will be removed from the database permanently. This cannot be undone.
            </p>
          </div>
        </ConfirmModal>
      )}

      {/* Bulk Deactivate Confirm */}
      {bulkAction === 'deactivate' && (
        <ConfirmModal
          icon={<Trash2 className="h-6 w-6 text-amber-500" />}
          iconBg="bg-amber-500/10"
          title={`Deactivate ${selectedActiveCount} Schedule${selectedActiveCount !== 1 ? 's' : ''}`}
          acting={acting}
          onCancel={() => setBulkAction(null)}
          onConfirm={handleBulkDeactivate}
          confirmLabel="Deactivate All"
          confirmClass="bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
        >
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-widest">
            {selectedActiveCount} active schedule{selectedActiveCount !== 1 ? 's' : ''} will be marked inactive.
            {selectedInactiveCount > 0 && ` ${selectedInactiveCount} already-inactive item${selectedInactiveCount !== 1 ? 's' : ''} in your selection will be skipped.`}
          </p>
        </ConfirmModal>
      )}

      {/* Bulk Hard Delete Confirm */}
      {bulkAction === 'hard_delete' && (
        <ConfirmModal
          icon={<Flame className="h-6 w-6 text-rose-500" />}
          iconBg="bg-rose-500/10"
          title={`Delete ${selectedInactiveCount} Record${selectedInactiveCount !== 1 ? 's' : ''} Forever`}
          acting={acting}
          onCancel={() => setBulkAction(null)}
          onConfirm={handleBulkHardDelete}
          confirmLabel="Delete Forever"
          confirmClass="bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
        >
          <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Irreversible Action</span>
            </div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
              {selectedInactiveCount} inactive record{selectedInactiveCount !== 1 ? 's' : ''} will be permanently removed.
              {selectedActiveCount > 0 && ` ${selectedActiveCount} active item${selectedActiveCount !== 1 ? 's' : ''} in your selection will be skipped (deactivate them first).`}
            </p>
          </div>
        </ConfirmModal>
      )}
    </div>
  )
}

// ── Schedule Form Modal ────────────────────────────────────────────────────────

function ScheduleFormModal({
  title, initial, isEdit = false, departments, terms, facilities, instructors, instructorsLoading, saving, onClose, onSave,
}: {
  title: string; initial?: FormData; isEdit?: boolean
  departments: Department[]; terms: AcademicTerm[]; facilities: Facility[]
  instructors: Instructor[]; instructorsLoading: boolean
  saving: boolean; onClose: () => void; onSave: (data: FormData) => void
}) {
  const [form, setForm] = useState<FormData>(initial ?? emptyForm())
  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const instructorOptions = useMemo(() => {
    return instructors.map(i => {
      const deptInfo = i.department_code ? ` (${i.department_code})` : ''
      return {
        value: i.full_name,
        label: i.full_name,
        sublabel: i.employee_id ? `ID: ${i.employee_id}${deptInfo}` : deptInfo || undefined,
      }
    })
  }, [instructors])

  const [overlaps, setOverlaps] = useState<any[]>([])
  const [checkingOverlaps, setCheckingOverlaps] = useState(false)

  useEffect(() => {
    const day = parseInt(form.day_of_week)
    const start = form.start_time
    const end = form.end_time
    const instructor = form.instructor_name?.trim()
    const section = form.section?.trim()
    const selectedFac = facilities.find(f => f.id === form.facility_id)
    const room = selectedFac ? (selectedFac.room_number || selectedFac.name) : ''

    if (
      Number.isNaN(day) ||
      !start ||
      !end ||
      start >= end ||
      (!instructor && !section && !room)
    ) {
      setOverlaps([])
      return
    }

    const controller = new AbortController()
    const delayDebounce = setTimeout(async () => {
      setCheckingOverlaps(true)
      try {
        const res = await fetch('/api/schedules/conflicts/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day_of_week: day,
            start_time: start,
            end_time: end,
            room,
            instructor,
            section,
          }),
          signal: controller.signal,
        })
        const json = await res.json()
        if (res.ok && json.conflicts) {
          const filtered = json.conflicts.filter((c: any) => {
            if (!isEdit || !initial) return true
            const isSelf = 
              c.course_code === initial.course_code &&
              c.section === initial.section &&
              Number(c.day_of_week) === Number(initial.day_of_week) &&
              c.start_time === initial.start_time &&
              c.end_time === initial.end_time
            return !isSelf
          })
          setOverlaps(filtered)
        } else {
          setOverlaps([])
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err)
        }
      } finally {
        setCheckingOverlaps(false)
      }
    }, 500)

    return () => {
      clearTimeout(delayDebounce)
      controller.abort()
    }
  }, [form.day_of_week, form.start_time, form.end_time, form.instructor_name, form.facility_id, form.section, facilities, isEdit, initial])

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0B0F17] border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-0 gap-0">
        <DialogHeader className="flex-row items-center space-y-0 px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800 text-left">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 dark:bg-blue-600 rounded-xl">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Academic Term" required>
              <select value={form.academic_term_id} onChange={e => set('academic_term_id', e.target.value)} required disabled={isEdit} className={inputCls(isEdit)}>
                <option value="">Select term…</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.academic_year} — {t.term_name}</option>)}
              </select>
            </FormField>
            <FormField label="Department" required>
              <select value={form.department_id} onChange={e => set('department_id', e.target.value)} required disabled={isEdit} className={inputCls(isEdit)}>
                <option value="">Select department…</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <FormField label="Course Code" required>
                <input type="text" value={form.course_code} onChange={e => set('course_code', e.target.value.toUpperCase())} required placeholder="e.g. CS101" className={inputCls()} />
              </FormField>
            </div>
            <FormField label="Section" required>
              <input type="text" value={form.section} onChange={e => set('section', e.target.value.toUpperCase())} required placeholder="e.g. A" className={inputCls()} />
            </FormField>
          </div>

          <FormField label="Course Name" required>
            <input type="text" value={form.course_name} onChange={e => set('course_name', e.target.value)} required placeholder="e.g. Introduction to Computer Science" className={inputCls()} />
          </FormField>

          <FormField label="Instructor Name">
            <Combobox
              value={form.instructor_name}
              onChange={v => set('instructor_name', v)}
              options={instructorOptions}
              placeholder="Full name (optional)"
              searchPlaceholder="Search instructors…"
              emptyMessage="No instructors match."
              allowCustom
              loading={instructorsLoading}
              variant="schedule"
            />
          </FormField>

          <FormField label="Facility / Room">
            <select value={form.facility_id} onChange={e => set('facility_id', e.target.value)} className={inputCls()}>
              <option value="">No room assigned</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.room_number ? `${f.room_number} — ` : ''}{f.name}</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Day of Week" required>
              <select value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)} required className={inputCls()}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="Start Time" required>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} required className={inputCls()} />
            </FormField>
            <FormField label="End Time" required>
              <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} required className={inputCls()} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Effective Start Date">
              <input type="date" value={form.effective_start_date} onChange={e => set('effective_start_date', e.target.value)} className={inputCls()} />
            </FormField>
            <FormField label="Effective End Date">
              <input type="date" value={form.effective_end_date} onChange={e => set('effective_end_date', e.target.value)} className={inputCls()} />
            </FormField>
          </div>

          {overlaps.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                  Potential Scheduling Overlaps
                </span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {overlaps.map((c, i) => (
                  <p key={i} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-relaxed">
                    • {c.match === 'instructor' ? `Instructor ${c.instructor}` : c.match === 'room' ? `Room ${c.room}` : `Section ${c.section}`} overlaps with <span className="text-slate-700 dark:text-slate-300">{c.course_code} {c.section}</span> ({c.start_time} - {c.end_time} on {DAYS[c.day_of_week]})
                  </p>
                ))}
              </div>
            </div>
          )}

          {isEdit && (
            <FormField label="Reason for Change">
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2}
                placeholder="Describe why this schedule is being modified…" className={cn(inputCls(), 'resize-none h-auto py-3')} />
            </FormField>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="w-full sm:w-auto px-6 h-12 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-10 h-14 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10 dark:shadow-blue-600/20 active:scale-95">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">
        {label}{required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function inputCls(disabled?: boolean) {
  return cn(
    'w-full h-11 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl',
    'text-[11px] font-bold text-slate-700 dark:text-slate-300 px-3',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-slate-400',
    disabled && 'opacity-50 cursor-not-allowed'
  )
}

// ── Generic Confirm Modal ──────────────────────────────────────────────────────

function ConfirmModal({
  icon, iconBg, title, acting, onCancel, onConfirm, confirmLabel, confirmClass, children,
}: {
  icon: React.ReactNode; iconBg: string; title: string
  acting: boolean; onCancel: () => void; onConfirm: () => void
  confirmLabel: string; confirmClass: string; children: React.ReactNode
}) {
  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onCancel() }}>
      <AlertDialogContent className="max-w-md p-8 sm:p-10 bg-white dark:bg-[#0B0F17] border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
        <AlertDialogHeader className="flex-row items-center gap-4 space-y-0 mb-2 text-left">
          <div className={cn('p-3 rounded-2xl', iconBg)}>{icon}</div>
          <AlertDialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="mb-8 space-y-2">{children}</div>
        <AlertDialogFooter className="flex-col sm:flex-row items-center justify-end gap-3">
          <AlertDialogCancel
            onClick={onCancel}
            className="w-full sm:w-auto m-0 px-6 h-12 bg-transparent border-transparent text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-transparent dark:hover:bg-transparent transition-colors"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm() }}
            disabled={acting}
            className={cn('w-full sm:w-auto flex items-center justify-center gap-2 px-10 h-14 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 active:scale-95', confirmClass)}
          >
            {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {acting ? 'Working…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
