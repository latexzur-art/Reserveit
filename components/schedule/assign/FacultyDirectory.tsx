'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  ChevronRight,
  ChevronUp,
  Users,
  BookOpen,
  X,
  IdCard,
  CalendarClock,
  User,
  UserX,
  UserCheck,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Faculty, BusyBlock, fmtSlot } from './types'
import { ProfessorPicker } from './ProfessorPicker'
import { Button } from '@/components/ui/button'

const SOURCE_META: Record<BusyBlock['source'], { label: string; cls: string }> = {
  teaching: { label: 'Teaching', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  booking: { label: 'Booking', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  proposed: { label: 'Pending lineup', cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
}

/**
 * Modern Faculty Directory with Horizontal Department Filter Tabs and Flat List View.
 */
export function FacultyDirectory({
  faculty,
  ownDepartmentId,
  onRefresh,
}: {
  faculty: Faculty[]
  ownDepartmentId?: string | null
  onRefresh?: () => void
}) {
  const [q, setQ] = useState('')
  const [dept, setDept] = useState<string>(ownDepartmentId ?? 'all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const deptOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of faculty) {
      if (f.department_id) m.set(f.department_id, f.department_name || f.department_code || 'Department')
    }
    return Array.from(m, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [faculty])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return faculty.filter((f) => {
      const matchDept = dept === 'all' || f.department_id === dept
      const matchQuery =
        !term ||
        f.full_name.toLowerCase().includes(term) ||
        (f.department_code ?? '').toLowerCase().includes(term) ||
        (f.department_name ?? '').toLowerCase().includes(term) ||
        f.subjects.some((s) => s.code.toLowerCase().includes(term) || s.name.toLowerCase().includes(term))
      return matchDept && matchQuery
    })
  }, [faculty, q, dept])

  return (
    <div className="space-y-4">
      {/* Search & Department Filters Header */}
      <div className="space-y-3">
        {/* Search Bar (Full Width) */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by professor, department, or subject code…"
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Horizontal Department Filter Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setDept('all')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0',
              dept === 'all'
                ? 'bg-[#050d36] text-white dark:bg-blue-600 shadow-sm'
                : 'bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
            )}
          >
            All Depts ({faculty.length})
          </button>
          {deptOptions.map((d) => {
            const count = faculty.filter((f) => f.department_id === d.id).length
            const isSelected = dept === d.id
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDept(d.id)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0',
                  isSelected
                    ? 'bg-[#050d36] text-white dark:bg-blue-600 shadow-sm'
                    : 'bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                )}
              >
                {d.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Flat List of Professors */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center">
          <Users className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No professors found</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Try searching for a different name or changing filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => {
            const isExpanded = expandedId === f.id
            const isOwnDept = f.department_id === ownDepartmentId

            return (
              <div
                key={f.id}
                className={cn(
                  'bg-white dark:bg-[#15181E] border transition-all duration-200 rounded-2xl overflow-hidden',
                  isExpanded
                    ? 'border-blue-500 dark:border-blue-500 ring-1 ring-blue-500 shadow-md'
                    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                )}
              >
                {/* Header button to toggle expansion */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : f.id)}
                  className="w-full p-4 flex items-center justify-between gap-4 text-left group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={cn(
                        'p-2.5 rounded-xl shrink-0 transition-colors',
                        isExpanded
                          ? 'bg-blue-500 text-white dark:bg-blue-600'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-white/10'
                      )}
                    >
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {f.full_name}
                        </span>
                        {f.department_name && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                            {f.department_code || f.department_name}
                          </span>
                        )}
                        {isOwnDept && (
                          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            Your Dept
                          </span>
                        )}
                      </div>

                      {/* Subject tags summary */}
                      {f.subjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {f.subjects.map((s) => (
                            <span
                              key={s.code}
                              title={s.name}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                            >
                              <BookOpen className="h-3 w-3" />
                              {s.code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No subjects assigned yet</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-blue-500 dark:text-blue-400 group-hover:underline">
                      {isExpanded ? 'Hide Commitments' : 'View Schedule'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-blue-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Inline Expansion Detail */}
                {isExpanded && (
                  <FacultyDetailInline
                    faculty={f}
                    allFaculty={faculty}
                    onRefresh={onRefresh}
                    onCollapse={() => setExpandedId(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Inline expandable detail profile for one professor */
function FacultyDetailInline({
  faculty,
  allFaculty,
  onRefresh,
  onCollapse,
}: {
  faculty: Faculty
  allFaculty: Faculty[]
  onRefresh?: () => void
  onCollapse?: () => void
}) {
  const [unassigningId, setUnassigningId] = useState<string | null>(null)
  const [reassigningScheduleId, setReassigningScheduleId] = useState<string | null>(null)
  const [reassigningProfId, setReassigningProfId] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)

  // Conflict Swap Prompt Modal State
  const [swapPrompt, setSwapPrompt] = useState<{
    scheduleId: string
    scheduleLabel: string
    newProfId: string
    newProfName: string
    conflict: { id: string; course_code: string; section: string; day_of_week: number; start_time: string; end_time: string }
  } | null>(null)
  const [swapping, setSwapping] = useState(false)

  const blocks = useMemo(
    () =>
      [...faculty.busy_blocks].sort(
        (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
      ),
    [faculty.busy_blocks]
  )

  const handleUnassignCommitment = async (scheduleId: string) => {
    setUnassigningId(scheduleId)
    setActionErr(null)
    try {
      const res = await fetch('/api/schedules/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: scheduleId,
          action: 'unassign',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionErr(data.error || 'Unassign failed')
        return
      }
      if (onRefresh) onRefresh()
    } catch {
      setActionErr('Network error')
    } finally {
      setUnassigningId(null)
    }
  }

  const handleReassignCommitment = async (
    scheduleId: string,
    scheduleLabel: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    newProfId: string | null,
    newProfName: string
  ) => {
    if (!newProfId) {
      await handleUnassignCommitment(scheduleId)
      return
    }

    setReassigningScheduleId(scheduleId)
    setReassigningProfId(newProfId)
    setActionErr(null)

    // Check if new professor has a slot conflict
    const targetFac = allFaculty.find((f) => f.id === newProfId)
    if (targetFac) {
      const busyConflict = targetFac.busy_blocks.find(
        (b) =>
          b.source === 'teaching' &&
          b.day_of_week === dayOfWeek &&
          b.schedule_id !== scheduleId &&
          b.start_time < endTime &&
          b.end_time > startTime
      )

      if (busyConflict && busyConflict.schedule_id) {
        setSwapPrompt({
          scheduleId,
          scheduleLabel,
          newProfId,
          newProfName,
          conflict: {
            id: busyConflict.schedule_id,
            course_code: busyConflict.label.split(' ')[0] || 'Schedule',
            section: busyConflict.label.split(' ')[1] || '',
            day_of_week: busyConflict.day_of_week,
            start_time: busyConflict.start_time,
            end_time: busyConflict.end_time,
          },
        })
        setReassigningScheduleId(null)
        setReassigningProfId(null)
        return
      }
    }

    try {
      const res = await fetch('/api/schedules/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: scheduleId,
          action: 'reassign',
          new_instructor_id: newProfId,
          new_instructor_name: newProfName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionErr(data.error || 'Reassign failed')
        return
      }
      setReassigningScheduleId(null)
      setReassigningProfId(null)
      if (onRefresh) onRefresh()
    } catch {
      setActionErr('Network error during reassign')
      setReassigningScheduleId(null)
      setReassigningProfId(null)
    }
  }

  const executeSwap = async () => {
    if (!swapPrompt) return
    setSwapping(true)
    setActionErr(null)
    try {
      const res = await fetch('/api/schedules/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: swapPrompt.scheduleId,
          action: 'swap_unassign_first',
          new_instructor_id: swapPrompt.newProfId,
          new_instructor_name: swapPrompt.newProfName,
          conflicting_schedule_id: swapPrompt.conflict.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionErr(data.error || 'Swap operation failed')
        return
      }
      setSwapPrompt(null)
      if (onRefresh) onRefresh()
    } catch {
      setActionErr('Network error during swap')
    } finally {
      setSwapping(false)
    }
  }

  return (
    <div className="px-4 pb-4 pt-1 sm:pl-16 sm:pr-6 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="space-y-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] p-4 sm:p-5 border border-slate-100 dark:border-white/5">
        {actionErr && (
          <p className="text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-1.5">
            {actionErr}
          </p>
        )}

        {faculty.employee_id && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <IdCard className="h-4 w-4 text-slate-400" />
            Employee ID: <span className="font-semibold text-slate-700 dark:text-slate-200">{faculty.employee_id}</span>
          </div>
        )}

        {/* Subjects list */}
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <BookOpen className="h-3.5 w-3.5" />
            Subjects Taught ({faculty.subjects.length})
          </h4>
          {faculty.subjects.length > 0 ? (
            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {faculty.subjects.map((s) => (
                <li
                  key={s.code}
                  className="flex items-center gap-2 text-xs p-2.5 rounded-xl bg-white dark:bg-[#15181E] border border-slate-100 dark:border-white/5"
                >
                  <span className="shrink-0 font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                    {s.code}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200 truncate">{s.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 flex items-center gap-2 rounded-xl p-3 bg-slate-100/70 dark:bg-white/5">
              <BookOpen className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No subjects assigned yet.</p>
            </div>
          )}
        </section>

        {/* Weekly commitments */}
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <CalendarClock className="h-3.5 w-3.5" />
            Weekly Commitments ({blocks.length})
          </h4>
          {blocks.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {blocks.map((b, i) => {
                const meta = SOURCE_META[b.source]
                const isTeaching = b.source === 'teaching' && Boolean(b.schedule_id)
                const isUnassigning = b.schedule_id === unassigningId
                const isReassigningThis = b.schedule_id === reassigningScheduleId

                return (
                  <li
                    key={`${b.day_of_week}-${b.start_time}-${i}`}
                    className="rounded-2xl bg-white dark:bg-[#15181E] border border-slate-100 dark:border-white/5 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900 dark:text-white">
                          {fmtSlot(b.day_of_week, b.start_time, b.end_time)}
                        </span>
                        {b.label && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{b.label}</span>}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md', meta.cls)}>
                          {meta.label}
                        </span>
                        {isTeaching && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setReassigningScheduleId(isReassigningThis ? null : b.schedule_id!)
                              }
                              className={cn(
                                'px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1',
                                isReassigningThis
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              )}
                              title="Reassign another professor to take over this section"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Reassign
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUnassignCommitment(b.schedule_id!)}
                              disabled={isUnassigning}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors flex items-center gap-1"
                              title="Unassign professor from this class section"
                            >
                              {isUnassigning ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <UserX className="h-3 w-3" />
                              )}
                              Unassign
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expandable Reassign Professor Picker */}
                    {isReassigningThis && b.schedule_id && (
                      <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                          Select new professor to reassign {b.label}:
                        </p>
                        <ProfessorPicker
                          faculty={allFaculty}
                          dayOfWeek={b.day_of_week}
                          startTime={b.start_time}
                          endTime={b.end_time}
                          value={faculty.id}
                          valueName={faculty.full_name}
                          ownDepartmentId={faculty.department_id}
                          scheduleId={b.schedule_id}
                          onChange={(newProfId, newProfName) =>
                            handleReassignCommitment(
                              b.schedule_id!,
                              b.label,
                              b.day_of_week,
                              b.start_time,
                              b.end_time,
                              newProfId,
                              newProfName
                            )
                          }
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-2 flex items-center gap-2 rounded-xl p-3 bg-emerald-500/10 dark:bg-emerald-500/10">
              <CalendarClock className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">No recorded commitments — fully available.</p>
            </div>
          )}
        </section>

        {onCollapse && (
          <div className="flex justify-end pt-3 border-t border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={onCollapse}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-200/60 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center gap-1.5"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Collapse Details
            </button>
          </div>
        )}
      </div>

      {/* Conflict Swap Alert Modal Dialog */}
      {swapPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-2.5 rounded-2xl bg-amber-500/10">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Schedule Conflict Detected</h3>
                <p className="text-xs text-slate-500">Professor slot overlap</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-bold">{swapPrompt.newProfName}</span> is currently assigned to:
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-1 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">
                {swapPrompt.conflict.course_code} · {swapPrompt.conflict.section}
              </p>
              <p className="text-slate-500">
                {fmtSlot(swapPrompt.conflict.day_of_week, swapPrompt.conflict.start_time, swapPrompt.conflict.end_time)}
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Would you like to unassign <span className="font-bold text-slate-700 dark:text-slate-200">{swapPrompt.newProfName}</span> from{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{swapPrompt.conflict.course_code}</span> first and reassign to{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">{swapPrompt.scheduleLabel}</span>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSwapPrompt(null)}
                className="h-9 px-4 text-xs font-semibold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={executeSwap}
                disabled={swapping}
                className="h-9 px-4 text-xs font-bold uppercase tracking-wider rounded-xl bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5"
              >
                {swapping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                Unassign Previous & Reassign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
