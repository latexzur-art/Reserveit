'use client'

import { useState, useEffect } from 'react'
import type { Course, CourseCreateInput, DeliveryMode } from '@/types/course.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { X, Trash2 } from 'lucide-react'
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

interface CourseFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CourseCreateInput) => Promise<{ error?: string }>
  editingCourse?: Course | null
  defaultDepartmentCode?: string
  isAcademicHead?: boolean
  onDelete?: (courseId: string, force?: boolean) => Promise<{ error?: string; requiresForce?: boolean }>
}

export function CourseFormModal({ open, onClose, onSubmit, editingCourse, defaultDepartmentCode, isAcademicHead, onDelete }: CourseFormModalProps) {
  const [form, setForm] = useState<CourseCreateInput>({
    department_code: defaultDepartmentCode ?? '',
    course_code: '',
    course_name: '',
    units: 3,
    year_level: 1,
    term: 1,
    delivery_mode: 'lecture',
    lecture_hours: 3,
    lab_hours: null,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [forceDeletePrompt, setForceDeletePrompt] = useState(false)

  useEffect(() => {
    if (open) {
      fetch('/api/departments')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.departments) setDepartments(data.departments) })
    }
  }, [open])

  useEffect(() => {
    if (editingCourse) {
      setForm({
        department_code: editingCourse.department_code,
        course_code: editingCourse.course_code,
        course_name: editingCourse.course_name,
        units: editingCourse.units,
        year_level: editingCourse.year_level,
        term: editingCourse.term,
        delivery_mode: editingCourse.delivery_mode,
        lecture_hours: editingCourse.lecture_hours,
        lab_hours: editingCourse.lab_hours,
        prerequisite_codes: editingCourse.prerequisite_codes ?? undefined,
        is_elective: editingCourse.is_elective,
        elective_type: editingCourse.elective_type ?? undefined,
        is_active: editingCourse.is_active,
        description: editingCourse.description ?? undefined,
      })
    } else {
      setForm(f => ({ ...f, department_code: defaultDepartmentCode ?? '' }))
    }
  }, [editingCourse, defaultDepartmentCode])

  useEffect(() => {
    if (open) {
      setConfirmDelete(false)
      setForceDeletePrompt(false)
      setError('')
    }
  }, [open, editingCourse])

  if (!open) return null


  const handleDelete = async (force: boolean = false) => {
    if (!editingCourse || !onDelete) return
    setDeleting(true)
    setError('')
    const result = await onDelete(editingCourse.id, force)
    if (result.requiresForce && !force) {
      setDeleting(false)
      setConfirmDelete(false)
      setForceDeletePrompt(true)
    } else if (result.error) {
      setError(result.error)
      setDeleting(false)
      setConfirmDelete(false)
      setForceDeletePrompt(false)
    } else {
      setDeleting(false)
      setConfirmDelete(false)
      setForceDeletePrompt(false)
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.department_code) {
      setError('Please select a department before saving.')
      return
    }
    if (form.is_elective && !form.elective_type?.trim()) {
      setError('Please enter an elective name/type before saving — this field is required because the course is marked as an Elective.')
      return
    }
    setSubmitting(true)
    setError('')
    const result = await onSubmit(form)
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      onClose()
    }
  }

  const updateDeliveryMode = (mode: DeliveryMode) => {
    setForm(f => ({
      ...f,
      delivery_mode: mode,
      lecture_hours: (mode === 'lab' || mode === 'practicum') ? null : (f.lecture_hours ?? 3),
      lab_hours: (mode === 'lecture' || mode === 'practicum') ? null : (f.lab_hours ?? 3),
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{editingCourse ? 'Edit Course' : 'Add Course'}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Department</Label>
              <Select
                value={form.department_code}
                onValueChange={v => setForm(f => ({ ...f, department_code: v }))}
                disabled={!!editingCourse && !isAcademicHead}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.code}>{d.code} — {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isAcademicHead && defaultDepartmentCode && form.department_code && form.department_code !== defaultDepartmentCode && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  This course is outside your department ({defaultDepartmentCode}) — it will be filed under {form.department_code} and needs Academic Head approval.
                </p>
              )}
            </div>
            <div>
              <Label>Course Code</Label>
              <Input value={form.course_code} onChange={e => setForm(f => ({ ...f, course_code: e.target.value.toUpperCase() }))} required disabled={!!editingCourse && !isAcademicHead} />
            </div>
          </div>

          <div>
            <Label>Course Name</Label>
            <Input value={form.course_name} onChange={e => setForm(f => ({ ...f, course_name: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Units</Label>
              <Input type="number" min={1} value={form.units} onChange={e => setForm(f => ({ ...f, units: parseInt(e.target.value) || 1 }))} required />
            </div>
            <div>
              <Label>Year Level</Label>
              <Select value={String(form.year_level)} onValueChange={v => setForm(f => ({ ...f, year_level: parseInt(v) }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Term</Label>
              <Select value={String(form.term)} onValueChange={v => setForm(f => ({ ...f, term: parseInt(v) }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1st Semester</SelectItem>
                  <SelectItem value="2">2nd Semester</SelectItem>
                  <SelectItem value="3">Summer/Midyear</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Delivery Mode</Label>
            <div className="flex gap-4 mt-1">
              {(['lecture', 'lab', 'both', 'practicum'] as DeliveryMode[]).map(mode => (
                <label key={mode} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="delivery_mode" checked={form.delivery_mode === mode} onChange={() => updateDeliveryMode(mode)} className="h-3.5 w-3.5 accent-primary" />
                  <span className="text-sm capitalize">{mode}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(form.delivery_mode === 'lecture' || form.delivery_mode === 'both') && (
              <div>
                <Label>Lecture Hours/Week</Label>
                <Input type="number" step="0.5" min={0.5} value={form.lecture_hours ?? ''} onChange={e => setForm(f => ({ ...f, lecture_hours: parseFloat(e.target.value) || null }))} required />
              </div>
            )}
            {(form.delivery_mode === 'lab' || form.delivery_mode === 'both') && (
              <div>
                <Label>Lab Hours/Week</Label>
                <Input type="number" step="0.5" min={0.5} value={form.lab_hours ?? ''} onChange={e => setForm(f => ({ ...f, lab_hours: parseFloat(e.target.value) || null }))} required />
              </div>
            )}
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-20 resize-none" />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-input px-3 py-2.5">
            <label htmlFor="course-elective" className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox id="course-elective" checked={form.is_elective ?? false} onCheckedChange={v => setForm(f => ({ ...f, is_elective: v === true }))} />
              This is an elective course
            </label>

            <div className="flex items-center gap-2.5">
              <Label htmlFor="course-active" className="text-sm font-medium cursor-pointer">Course is</Label>
              <Switch
                id="course-active"
                checked={form.is_active ?? true}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
              <span className={cn(
                'text-xs font-semibold tabular-nums w-14',
                (form.is_active ?? true) ? 'text-primary' : 'text-muted-foreground'
              )}>
                {(form.is_active ?? true) ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {form.is_elective && (
            <div>
              <Label>Elective Name/Type <span className="text-red-500">*</span></Label>
              <Input
                value={form.elective_type ?? ''}
                onChange={e => setForm(f => ({ ...f, elective_type: e.target.value }))}
                placeholder='e.g. "Web Development", "AI & Machine Learning Track"'
                required
              />
              {!form.elective_type?.trim() && (
                <p className="mt-1 text-xs text-red-500">Required — electives vary by type, so please name this one.</p>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            {editingCourse && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={submitting || (!!form.is_elective && !form.elective_type?.trim())}>{submitting ? 'Saving...' : editingCourse ? 'Update Course' : 'Add Course'}</Button>
            </div>
          </div>
        </form>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the course "{editingCourse?.course_code}: {editingCourse?.course_name}".
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
              {deleting ? 'Deleting...' : 'Delete'}
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
              className="bg-red-600 hover:bg-red-700"
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
    </div>
  )
}
