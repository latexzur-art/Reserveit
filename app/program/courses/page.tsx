'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { BookOpen, Search, Loader2, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SkeletonList } from "@/components/ui/SkeletonList";


interface Course {
  id: string
  course_code: string
  course_name: string
  units: number
  year_level: number
  term: number
  delivery_mode: string
  is_elective: boolean
  approval_status: string
  description?: string | null
  lecture_hours?: number | null
  lab_hours?: number | null
}

const YEAR_OPTIONS = [
  { value: 0, label: 'All Years' },
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
]

const SEM_OPTIONS = [
  { value: 0, label: 'All Semesters' },
  { value: 1, label: '1st Sem' },
  { value: 2, label: '2nd Sem' },
]

const ORDINALS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }

const DELIVERY_LABELS: Record<string, string> = {
  lecture: 'Lecture',
  lab: 'Lab',
  both: 'Lec / Lab',
  practicum: 'Practicum',
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  sent_back: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
}

const LIMIT = 50

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-semibold transition-all border',
        active
          ? 'bg-sti-blue text-white border-sti-blue shadow-sm'
          : 'border-border text-muted-foreground hover:border-sti-blue/50 hover:text-foreground bg-background'
      )}
    >
      {children}
    </button>
  )
}

export default function ProgramHeadCoursesPage() {
  const { user, loading: authLoading } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState(0)
  const [semFilter, setSemFilter] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [yearFilter, semFilter, debouncedSearch])

  const fetchCourses = useCallback(() => {
    if (authLoading) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (yearFilter) params.set('year_level', String(yearFilter))
    if (semFilter) params.set('term', String(semFilter))
    if (debouncedSearch) params.set('search', debouncedSearch)
    params.set('approval_status', 'approved')

    fetch(`/api/courses?${params}`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(data => {
        setCourses(data.courses ?? [])
        setTotal(data.total ?? 0)
        setError(null)
      })
      .catch(() => setError('Failed to load courses'))
      .finally(() => setLoading(false))
  }, [authLoading, yearFilter, semFilter, debouncedSearch, page])

  useEffect(() => { fetchCourses() }, [fetchCourses])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const departmentName = (user as any)?.department?.name ?? 'Department'
  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="min-h-screen bg-background">
      <ConnectedTopBar
        title="Courses"
        breadcrumbs={[
          { label: 'Dashboard', href: '/program/dashboard' },
          { label: 'Courses' },
        ]}
      />

      {/* Page header */}
      <div className="relative overflow-hidden px-8 py-8 border-b border-border/40 bg-card">
        <div className="absolute inset-0 bg-gradient-to-tr from-sti-blue/10 via-sti-blue/5 to-transparent pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-sti-blue/10 rounded-2xl border border-sti-blue/20 shrink-0">
            <BookOpen className="w-6 h-6 text-sti-blue" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Course <span className="text-accent-brand">Catalog</span></h1>
            <p className="text-base text-muted-foreground flex items-center gap-2">
              <span className="font-medium text-foreground/80">{departmentName}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              <span>{total} course{total !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 border-b border-border/40 bg-card/50 space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by code or name..."
            aria-label="Search courses by code or name"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-12 shrink-0">Year</span>
          {YEAR_OPTIONS.map(y => (
            <FilterChip key={y.value} active={yearFilter === y.value} onClick={() => setYearFilter(y.value)}>
              {y.label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-12 shrink-0">Sem</span>
          {SEM_OPTIONS.map(s => (
            <FilterChip key={s.value} active={semFilter === s.value} onClick={() => setSemFilter(s.value)}>
              {s.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="font-semibold text-red-600 dark:text-red-400">Failed to load courses</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <button
              onClick={fetchCourses}
              className="mt-4 text-xs font-medium text-sti-blue hover:underline"
            >
              Try again
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No courses found</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search || yearFilter || semFilter
                ? 'Try adjusting your filters or search terms.'
                : 'No courses have been added for your department yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Code</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Course Name</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Units</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Year</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Sem</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Mode</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {courses.map((course) => (
                      <tr
                        key={course.id}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs text-foreground bg-muted px-2 py-0.5 rounded-md">
                            {course.course_code}
                          </span>
                          {course.is_elective && (
                            <span className="ml-1.5 text-[10px] font-semibold text-purple-500 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                              Elective
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="font-medium text-foreground leading-snug">{course.course_name}</p>
                          {course.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">{course.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="font-semibold text-foreground">{course.units}</span>
                          <span className="text-muted-foreground text-xs ml-0.5">u</span>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span className="text-xs font-semibold text-foreground/80">
                            {ORDINALS[course.year_level] ?? course.year_level} Yr
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span className="text-xs font-semibold text-foreground/80">
                            {ORDINALS[course.term] ?? course.term} Sem
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span className="text-xs font-medium text-muted-foreground">
                            {DELIVERY_LABELS[course.delivery_mode] ?? course.delivery_mode}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                              STATUS_STYLES[course.approval_status] ?? 'bg-muted text-muted-foreground border-border'
                            )}
                          >
                            {course.approval_status === 'sent_back' ? 'Sent Back' : course.approval_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} courses
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
