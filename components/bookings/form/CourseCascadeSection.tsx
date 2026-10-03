"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle, ChevronDown, Check, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DropdownSelect } from '@/components/bookings/form/DropdownSelect'
import type { useReservationForm } from '@/hooks/faculty/useReservationForm'

interface CourseOptionLike {
  course_code: string
  course_name: string
  is_assigned?: boolean
  is_elective?: boolean
  elective_type?: string | null
}

function courseSecondaryLabel(c: CourseOptionLike): string {
  return c.is_elective && c.elective_type ? c.elective_type : c.course_name
}

function courseDisplayLabel(c: CourseOptionLike): string {
  return `${courseSecondaryLabel(c)} — ${c.course_code}`
}

type Hook = ReturnType<typeof useReservationForm>

interface CourseCascadeSectionProps {
  formData: Hook['formData']
  updateField: Hook['updateField']
  loadingCourses: Hook['loadingCourses']
  departmentCourses: Hook['departmentCourses']
  selectedDeptCourses: Hook['selectedDeptCourses']
  selectedCourseDeliveryMode: Hook['selectedCourseDeliveryMode']
  validationErrors: Hook['validationErrors']
  facilityMismatchWarning: Hook['facilityMismatchWarning']
  facilityMatchGood: Hook['facilityMatchGood']
}

export function CourseCascadeSection({
  formData,
  updateField,
  loadingCourses,
  departmentCourses,
  selectedDeptCourses,
  selectedCourseDeliveryMode,
  validationErrors,
  facilityMismatchWarning,
  facilityMatchGood,
}: CourseCascadeSectionProps) {
  const [courseOpen, setCourseOpen] = useState(false)
  const [courseQuery, setCourseQuery] = useState('')
  const courseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (courseRef.current && !courseRef.current.contains(e.target as Node)) {
        setCourseOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Derived from the committed value (covers initial load, dept-change reset,
  // QuickFill prefill) — only overridden by the live-typed query while open.
  const committedCourseLabel = useMemo(() => {
    const course = selectedDeptCourses.find((c: any) => c.course_code === formData.booking_course_code)
    return course ? courseDisplayLabel(course) : ''
  }, [selectedDeptCourses, formData.booking_course_code])

  const courseInputValue = courseOpen ? courseQuery : committedCourseLabel

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase()
    if (!q) return selectedDeptCourses
    return selectedDeptCourses.filter((c: any) =>
      c.course_code.toLowerCase().includes(q) ||
      c.course_name.toLowerCase().includes(q) ||
      (c.elective_type && c.elective_type.toLowerCase().includes(q))
    )
  }, [courseQuery, selectedDeptCourses])

  const filteredAssigned = filteredCourses.filter((c: any) => c.is_assigned)
  const filteredOther = filteredCourses.filter((c: any) => !c.is_assigned)

  const selectCourse = (c: any) => {
    updateField('booking_course_code', c.course_code)
    setCourseOpen(false)
  }

  return (
    <>
                {/* Course Information (dynamic cascade, visible for academic purpose) */}
                {formData.booking_purpose === 'academic' && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground dark:text-slate-400">
                      Course Information
                      <span className="text-xs text-green-600 dark:text-green-400 ml-2 inline-flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber-500" /> Helps boost approval for specialized facilities</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground dark:text-slate-400 mb-1">Department</label>
                        <DropdownSelect
                          value={formData.booking_department_code}
                          onChange={v => updateField('booking_department_code', v)}
                          disabled={loadingCourses}
                          placeholder="Select department"
                          options={departmentCourses.map(d => ({
                            value: d.department_code,
                            label: `${d.department_name} (${d.department_code})`,
                          }))}
                        />
                      </div>
                      <div className="relative" ref={courseRef}>
                        <label className="block text-xs font-medium text-muted-foreground dark:text-slate-400 mb-1">Course</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={courseInputValue}
                            onChange={e => {
                              setCourseQuery(e.target.value)
                              setCourseOpen(true)
                              if (formData.booking_course_code) updateField('booking_course_code', '')
                            }}
                            onFocus={() => {
                              setCourseOpen(true)
                              setCourseQuery('')
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
                            }}
                            disabled={!formData.booking_department_code}
                            placeholder={formData.booking_department_code ? 'Search by code or name...' : 'Select department first'}
                            autoComplete="off"
                            className="flex h-10 w-full rounded-xl border border-border bg-background pl-3 pr-8 py-2 text-xs font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {formData.booking_course_code ? (
                            <button
                              type="button"
                              onClick={() => {
                                updateField('booking_course_code', '')
                                setCourseQuery('')
                                setCourseOpen(false)
                              }}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                          )}
                        </div>
                        {courseOpen && formData.booking_department_code && (
                          <div className="absolute z-50 top-full left-0 min-w-full w-max max-w-[28rem] sm:max-w-md max-w-[calc(100vw-2rem)] mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-card shadow-2xl p-1.5">
                            {filteredCourses.length === 0 ? (
                              <div className="px-4 py-5 text-center text-xs text-muted-foreground font-medium">
                                No courses match &quot;{courseQuery}&quot;
                              </div>
                            ) : (
                              <>
                                {filteredAssigned.length > 0 && (
                                  <div>
                                    <p className="px-3 pt-2 pb-1 text-[11px] font-bold text-muted-foreground">Your Courses</p>
                                    {filteredAssigned.map((c: any) => {
                                      const isSelected = formData.booking_course_code === c.course_code
                                      return (
                                        <button
                                          key={c.course_code}
                                          type="button"
                                          title={`${courseSecondaryLabel(c)} (${c.course_code})`}
                                          onClick={() => selectCourse(c)}
                                          className={cn(
                                            'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium rounded-lg transition-colors mb-0.5 last:mb-0',
                                            isSelected
                                              ? 'bg-primary/10 text-primary font-bold'
                                              : 'hover:bg-muted/60 text-foreground'
                                          )}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <p className={cn('font-medium whitespace-normal break-words text-xs leading-normal', isSelected && 'font-bold text-primary')}>{courseSecondaryLabel(c)}</p>
                                            <p className="text-[11px] text-muted-foreground whitespace-normal break-words mt-0.5">{c.course_code}</p>
                                          </div>
                                          {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                                {filteredOther.length > 0 && (
                                  <div>
                                    <p className="px-3 pt-2 pb-1 text-[11px] font-bold text-muted-foreground">Other Courses</p>
                                    {filteredOther.map((c: any) => {
                                      const isSelected = formData.booking_course_code === c.course_code
                                      return (
                                        <button
                                          key={c.course_code}
                                          type="button"
                                          title={`${courseSecondaryLabel(c)} (${c.course_code})`}
                                          onClick={() => selectCourse(c)}
                                          className={cn(
                                            'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium rounded-lg transition-colors mb-0.5 last:mb-0',
                                            isSelected
                                              ? 'bg-primary/10 text-primary font-bold'
                                              : 'hover:bg-muted/60 text-foreground'
                                          )}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <p className={cn('font-medium whitespace-normal break-words text-xs leading-normal', isSelected && 'font-bold text-primary')}>{courseSecondaryLabel(c)}</p>
                                            <p className="text-[11px] text-muted-foreground whitespace-normal break-words mt-0.5">{c.course_code}</p>
                                          </div>
                                          {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground dark:text-slate-400 mb-1">Session Type</label>
                        <DropdownSelect
                          value={formData.session_type}
                          onChange={v => updateField('session_type', v as any)}
                          disabled={!formData.booking_course_code || selectedCourseDeliveryMode !== 'both'}
                          error={!!validationErrors.session_type}
                          placeholder={selectedCourseDeliveryMode === 'both' ? 'Select session type' : 'Auto-detected'}
                          options={
                            selectedCourseDeliveryMode === 'both'
                              ? [
                                  { value: 'lecture', label: 'Lecture' },
                                  { value: 'lab', label: 'Lab' },
                                ]
                              : formData.session_type
                                ? [{ value: formData.session_type, label: formData.session_type === 'lecture' ? 'Lecture' : 'Lab' }]
                                : []
                          }
                        />
                        {validationErrors.session_type && (
                          <p className="mt-1 text-xs text-red-500">{validationErrors.session_type}</p>
                        )}
                      </div>
                    </div>
                    {facilityMismatchWarning && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40">
                        <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">{facilityMismatchWarning}</p>
                      </div>
                    )}
                    {facilityMatchGood && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-green-700 dark:text-green-400">Facility matches session type — good to go.</p>
                      </div>
                    )}
                  </div>
                )}
    </>
  )
}
