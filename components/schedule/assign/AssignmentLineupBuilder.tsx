'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Send,
  ClipboardList,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
  UserX,
  AlertTriangle,
  UserCheck,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { ProfessorPicker } from './ProfessorPicker'
import { FacultyDirectory } from './FacultyDirectory'
import { Faculty, fmtSlot, UNASSIGNED_NAME } from './types'

interface Section {
  id: string
  course_code: string
  course_name: string
  section: string
  session_type: string | null
  day_of_week: number
  start_time: string
  end_time: string
  instructor_id?: string | null
  instructor_name?: string | null
  facilities: { name: string; room_number: string } | null
}

type Pick = { id: string | null; name: string }

export function AssignmentLineupBuilder({
  onComplete,
  onClose,
  hideDirectory = false,
}: {
  onComplete?: () => void
  onClose?: () => void
  hideDirectory?: boolean
} = {}) {
  const { user } = useAuth()
  const deptId = user?.department?.id ?? null
  const roleNames = (user?.roles ?? []).map((r) => r.name)
  const isAcademicHead = roleNames.includes('academic_head') || roleNames.includes('building_admin')

  const [sections, setSections] = useState<Section[]>([])
  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ applied?: number; skipped?: number; pending?: boolean } | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [alreadyProposed, setAlreadyProposed] = useState(0)

  // Section view filter tab: 'unassigned' vs 'assigned'
  const [sectionTab, setSectionTab] = useState<'unassigned' | 'assigned'>('unassigned')
  const [unassigningScheduleId, setUnassigningScheduleId] = useState<string | null>(null)

  // Conflict Swap Prompt Modal State
  const [swapPrompt, setSwapPrompt] = useState<{
    targetSchedule: Section
    newProfId: string
    newProfName: string
    conflict: { id: string; course_code: string; section: string; day_of_week: number; start_time: string; end_time: string }
  } | null>(null)
  const [swapping, setSwapping] = useState(false)

  const fetchSchedules = async () => {
    setLoading(true)
    const qs = deptId ? `&department_id=${deptId}` : ''
    const isUnassignedQuery = sectionTab === 'unassigned' ? '&unassigned=true' : ''

    try {
      const [live, fac, pending] = await Promise.all([
        fetch(`/api/schedules/live?limit=200${isUnassignedQuery}${qs}`).then((r) => r.json()),
        fetch('/api/faculty/availability').then((r) => r.json()),
        fetch('/api/schedules/assignments?status=pending').then((r) => r.json()),
      ])

      const proposed = new Set<string>()
      for (const l of pending.lineups ?? []) {
        for (const it of l.items ?? []) proposed.add(it.class_schedule_id)
      }

      let open = (live.schedules ?? []).filter((s: Section) => !proposed.has(s.id))
      if (sectionTab === 'assigned') {
        open = open.filter((s: Section) => Boolean(s.instructor_id))
      }

      setSections(open)
      setAlreadyProposed((live.schedules ?? []).length - open.length)
      setFaculty(fac.faculty ?? [])
      setError(null)
      if (open.length > 0 && !activeSectionId) setActiveSectionId(open[0].id)
    } catch {
      setError('Failed to load sections.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [deptId, sectionTab])

  const handleDirectUnassign = async (scheduleId: string) => {
    setUnassigningScheduleId(scheduleId)
    setError(null)
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
        setError(data.error || 'Failed to unassign schedule')
        return
      }
      if (onComplete) onComplete()
      await fetchSchedules()
    } catch {
      setError('Network error during unassign')
    } finally {
      setUnassigningScheduleId(null)
    }
  }

  const handleSelectProfessor = async (section: Section, profId: string | null, profName: string) => {
    if (!profId) {
      // If choosing to unassign an assigned section directly
      if (section.instructor_id) {
        await handleDirectUnassign(section.id)
      } else {
        setPicks((prev) => ({ ...prev, [section.id]: { id: null, name: UNASSIGNED_NAME } }))
      }
      return
    }

    // Check if professor has a slot conflict in local faculty availability
    const targetFac = faculty.find((f) => f.id === profId)
    if (targetFac) {
      const busyConflict = targetFac.busy_blocks.find(
        (b) =>
          b.source === 'teaching' &&
          b.day_of_week === section.day_of_week &&
          b.schedule_id !== section.id &&
          b.start_time < section.end_time &&
          b.end_time > section.start_time
      )

      if (busyConflict && busyConflict.schedule_id) {
        // Pop conflict swap prompt modal!
        setSwapPrompt({
          targetSchedule: section,
          newProfId: profId,
          newProfName: profName,
          conflict: {
            id: busyConflict.schedule_id,
            course_code: busyConflict.label.split(' ')[0] || 'Schedule',
            section: busyConflict.label.split(' ')[1] || '',
            day_of_week: busyConflict.day_of_week,
            start_time: busyConflict.start_time,
            end_time: busyConflict.end_time,
          },
        })
        return
      }
    }

    // Update local picks
    setPicks((prev) => ({ ...prev, [section.id]: { id: profId, name: profName } }))
  }

  const executeSwap = async () => {
    if (!swapPrompt) return
    setSwapping(true)
    setError(null)
    try {
      const res = await fetch('/api/schedules/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: swapPrompt.targetSchedule.id,
          action: 'swap_unassign_first',
          new_instructor_id: swapPrompt.newProfId,
          new_instructor_name: swapPrompt.newProfName,
          conflicting_schedule_id: swapPrompt.conflict.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Swap operation failed')
        return
      }
      setSwapPrompt(null)
      setPicks((prev) => ({
        ...prev,
        [swapPrompt.targetSchedule.id]: { id: swapPrompt.newProfId, name: swapPrompt.newProfName },
      }))
      if (onComplete) onComplete()
      await fetchSchedules()
    } catch {
      setError('Network error during swap')
    } finally {
      setSwapping(false)
    }
  }

  const chosen = useMemo(
    () => Object.entries(picks).filter(([, p]) => p.id !== null),
    [picks]
  )

  const submit = async () => {
    if (chosen.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/schedules/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: chosen.map(([scheduleId, p]) => ({
            class_schedule_id: scheduleId,
            proposed_instructor_id: p.id,
            proposed_instructor_name: p.name,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Submit failed')
        return
      }
      setDone({ applied: data.result?.applied, skipped: data.result?.skipped, pending: data.status === 'pending' })
      if (onComplete) onComplete()
      // Drop applied sections from the list.
      const assignedIds = new Set(chosen.map(([id]) => id))
      setSections((prev) => {
        const next = prev.filter((s) => !assignedIds.has(s.id))
        if (next.length > 0) setActiveSectionId(next[0].id)
        else setActiveSectionId(null)
        return next
      })
      setPicks({})
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-3xl bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    )
  }

  // Reference directory: every professor by department + the subjects they teach.
  const directory = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <Users className="h-4 w-4" />
        Faculty directory — {faculty.length} professor{faculty.length === 1 ? '' : 's'} and their subjects
      </div>
      <FacultyDirectory faculty={faculty} ownDepartmentId={deptId} />
    </div>
  )

  if (sections.length === 0) {
    return (
      <div className="space-y-4">
        {!hideDirectory && directory}
        <div className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-[2rem] p-12 sm:p-16 text-center">
          <div className="p-4 bg-emerald-500/10 rounded-full w-fit mx-auto mb-5">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <p className="text-base font-bold text-slate-800 dark:text-slate-200">
            {alreadyProposed > 0 ? 'All unassigned sections are awaiting approval' : 'All sections have professors'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            {alreadyProposed > 0
              ? `${alreadyProposed} section${alreadyProposed === 1 ? '' : 's'} in a pending lineup. Assign more once those are reviewed.`
              : 'Nothing to assign right now. Unassigned sections appear here as schedules are published.'}
          </p>
          {done && (
            <p className="mt-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {done.pending
                ? 'Lineup submitted for academic-head approval.'
                : `Applied ${done.applied ?? 0}${done.skipped ? `, ${done.skipped} skipped (conflict)` : ''}.`}
            </p>
          )}
          {onClose && (
            <div className="mt-6">
              <Button
                type="button"
                onClick={onClose}
                className="h-10 px-6 bg-[#050d36] dark:bg-blue-600 hover:bg-[#050d36]/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                Close Drawer
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!hideDirectory && directory}
      {/* Section Filter Tabs & Action Bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setSectionTab('unassigned')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
              sectionTab === 'unassigned'
                ? 'bg-[#050d36] text-white dark:bg-blue-600 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            Unassigned Sections
          </button>
          <button
            type="button"
            onClick={() => setSectionTab('assigned')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
              sectionTab === 'assigned'
                ? 'bg-[#050d36] text-white dark:bg-blue-600 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            Assigned Sections
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <ClipboardList className="h-4 w-4" />
            {sections.length} {sectionTab} section{sections.length === 1 ? '' : 's'}
            {chosen.length > 0 && ` · ${chosen.length} selected`}
            {alreadyProposed > 0 && (
              <span className="text-slate-400">· {alreadyProposed} awaiting approval</span>
            )}
          </p>
          <Button
            onClick={submit}
            disabled={submitting || chosen.length === 0}
            className="h-10 px-6 bg-[#050d36] dark:bg-blue-600 hover:bg-[#050d36]/90 dark:hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-wide"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {isAcademicHead ? `Apply ${chosen.length || ''}`.trim() : `Submit ${chosen.length || ''} for approval`.trim()}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
      )}
      {done && (
        <p className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
          {done.pending
            ? 'Lineup submitted for academic-head approval.'
            : `Applied ${done.applied ?? 0}${done.skipped ? `, ${done.skipped} skipped (conflict)` : ''}.`}
        </p>
      )}

      <div className="space-y-3">
        {sections.map((s) => {
          const currentProfName = s.instructor_name || null
          const pick = picks[s.id] ?? { id: s.instructor_id ?? null, name: currentProfName ?? UNASSIGNED_NAME }
          const isActive = activeSectionId === s.id
          
          return (
            <div
              key={s.id}
              className={cn(
                "bg-white dark:bg-[#15181E] border transition-all duration-200 rounded-[2rem] overflow-hidden",
                isActive 
                  ? "border-blue-500 ring-1 ring-blue-500 shadow-md dark:border-blue-500" 
                  : "border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12]"
              )}
            >
              <button
                type="button"
                onClick={() => setActiveSectionId(isActive ? null : s.id)}
                className="w-full text-left p-5 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{s.course_code} · {s.section}</p>
                    {s.session_type && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                        {s.session_type === 'lab' ? 'LAB' : 'LEC'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{s.course_name}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtSlot(s.day_of_week, s.start_time, s.end_time)}</span>
                    {s.facilities && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.facilities.name || s.facilities.room_number}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  <div className="text-right flex flex-col items-end gap-1">
                    {pick.id ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                          <span className="text-xs font-bold">{pick.name}</span>
                          {faculty.find((f) => f.id === pick.id)?.department_code && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                              {faculty.find((f) => f.id === pick.id)?.department_code}
                            </span>
                          )}
                        </div>
                        {s.instructor_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDirectUnassign(s.id)
                            }}
                            disabled={unassigningScheduleId === s.id}
                            className="px-2.5 py-1 text-xs font-bold rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors flex items-center gap-1 shrink-0"
                            title="Unassign professor from this section"
                          >
                            {unassigningScheduleId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserX className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                        Unassigned
                      </span>
                    )}
                  </div>
                  {isActive ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </div>
              </button>

              {isActive && (
                <div className="px-5 pb-5">
                  <div className="pt-3 border-t border-slate-100 dark:border-white/5">
                    <ProfessorPicker
                      faculty={faculty}
                      dayOfWeek={s.day_of_week}
                      startTime={s.start_time}
                      endTime={s.end_time}
                      value={pick.id}
                      valueName={pick.name}
                      ownDepartmentId={deptId}
                      isAcademicHead={isAcademicHead}
                      scheduleId={s.id}
                      onChange={(id, name) => handleSelectProfessor(s, id, name)}
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setActiveSectionId(null)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center gap-1.5"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                        Close Section Details
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Conflict Swap Alert Modal Dialog */}
      {swapPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
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
              <span className="font-bold text-slate-700 dark:text-slate-200">{swapPrompt.targetSchedule.course_code}</span>?
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
