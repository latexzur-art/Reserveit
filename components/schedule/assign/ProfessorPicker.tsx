'use client'

import { useMemo, useState } from 'react'
import { Search, Check, CircleSlash, UserX, Building2, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Faculty, BlockSource, clashingBlock, fmtSlot, UNASSIGNED_NAME } from './types'

/**
 * Conflict-aware professor picker. Inline-expanding (never an absolute popover —
 * it lives inside scrollable cards and modals, so a popover would clip). Shows
 * each faculty member with department + availability for the section's slot;
 * busy professors stay selectable but are flagged (non-blocking, matching the
 * validator's warning philosophy). Includes an explicit "Leave Unassigned" row.
 */
export function ProfessorPicker({
  faculty,
  dayOfWeek,
  startTime,
  endTime,
  value,
  valueName,
  onChange,
  ownDepartmentId,
  isAcademicHead,
  busySources,
  scheduleId,
}: {
  faculty: Faculty[]
  dayOfWeek: number
  startTime: string
  endTime: string
  value: string | null
  valueName: string
  onChange: (id: string | null, name: string) => void
  ownDepartmentId?: string | null
  isAcademicHead?: boolean
  /** Which busy-block kinds flag a row. Omit for all (builder); pass
   *  HARD_CONFLICT_SOURCES in review to match the approval RPC exactly. */
  busySources?: BlockSource[]
  scheduleId?: string
}) {
  const [q, setQ] = useState('')
  // Default the department filter to the assigner's own department (program head
  // lands on their faculty); 'all' shows every department.
  const [dept, setDept] = useState<string>(ownDepartmentId ?? 'all')

  const deptOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of faculty) {
      if (f.department_id) m.set(f.department_id, f.department_name || f.department_code || 'Department')
    }
    return Array.from(m, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [faculty])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = faculty
      .filter((f) => dept === 'all' || f.department_id === dept)
      .map((f) => {
        const isCurrent = f.id === value
        const busy = isCurrent ? null : clashingBlock(f, dayOfWeek, startTime, endTime, busySources, scheduleId)
        return { f, busy, isCurrent }
      })

    const filtered = term
      ? list.filter(({ f }) =>
          f.full_name.toLowerCase().includes(term) ||
          (f.department_code ?? '').toLowerCase().includes(term) ||
          f.subjects.some((s) => s.code.toLowerCase().includes(term) || s.name.toLowerCase().includes(term)))
      : list
    // Priority: 1) Currently assigned to this section, 2) Available professors, 3) Busy professors
    return filtered.sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
      if (!!a.busy !== !!b.busy) return a.busy ? 1 : -1
      const aOwn = a.f.department_id === ownDepartmentId
      const bOwn = b.f.department_id === ownDepartmentId
      if (aOwn !== bOwn) return aOwn ? -1 : 1
      return a.f.full_name.localeCompare(b.f.full_name)
    })
  }, [faculty, dayOfWeek, startTime, endTime, q, dept, ownDepartmentId, busySources, value, scheduleId])

  const isUnassigned = !value

  const pick = (id: string | null, name: string) => {
    onChange(id, name)
    setQ('')
  }

  return (
    <div className="w-full mt-2 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-white/5">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or subject…"
          className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {deptOptions.length > 1 && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-white/5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setDept('all')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
              dept === 'all'
                ? 'bg-[#050d36] text-white dark:bg-blue-600'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
            )}
          >
            All Depts
          </button>
          {deptOptions.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDept(d.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                dept === d.id
                  ? 'bg-[#050d36] text-white dark:bg-blue-600'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Sticky Leave Unassigned */}
      <button
        type="button"
        onClick={() => pick(null, UNASSIGNED_NAME)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors border-b border-slate-100 dark:border-white/5',
          'hover:bg-slate-50 dark:hover:bg-white/5 rounded-md',
          isUnassigned && 'bg-blue-50/50 dark:bg-blue-500/10'
        )}
      >
        <UserX className={cn('h-4 w-4 shrink-0', isUnassigned ? 'text-blue-500' : 'text-slate-400')} />
        <span className={cn('font-medium', isUnassigned ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400')}>
          Leave Unassigned (TBD)
        </span>
        {isUnassigned && <Check className="h-4 w-4 ml-auto text-blue-500" />}
      </button>

      <div className="max-h-64 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">No faculty match “{q}”.</p>
        ) : (
          rows.map(({ f, busy, isCurrent }) => {
            const isSel = f.id === value
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => pick(f.id, f.full_name)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-slate-100/50 dark:border-white/[0.02] last:border-0 rounded-md',
                  'hover:bg-slate-50 dark:hover:bg-white/5',
                  isSel && 'bg-blue-50/50 dark:bg-blue-500/10'
                )}
              >
                {isCurrent ? (
                  <UserCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                ) : busy ? (
                  <CircleSlash className="h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                )}
                <span className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('truncate text-sm font-semibold', isSel ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white')}>
                      {f.full_name}
                    </span>
                    {f.department_code && (
                      <span className="shrink-0 text-xs font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                        {f.department_code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {isCurrent ? (
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        Currently assigned to this section
                      </span>
                    ) : busy ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        Busy: {busy.label} ({fmtSlot(busy.day_of_week, busy.start_time, busy.end_time)})
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-500">
                        Free this slot
                      </span>
                    )}
                  </div>
                  {f.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {f.subjects.map((s) => (
                        <span
                          key={s.code}
                          className="inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                        >
                          {s.code}
                        </span>
                      ))}
                    </div>
                  )}
                </span>
                {isSel && <Check className="h-4 w-4 shrink-0 ml-auto text-blue-500" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
