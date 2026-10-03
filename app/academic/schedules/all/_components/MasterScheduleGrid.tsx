'use client'

import { ChevronLeft, ChevronRight, Pencil, Trash2, Loader2, CalendarDays, Flame, CheckSquare, Square, MinusSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonList } from "@/components/ui/SkeletonList";


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

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DAY_COLORS: Record<number, string> = {
  0: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  1: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  2: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  3: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  4: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  5: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  6: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

function formatTime(t: string): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

export function LoadingState() {
  return (
    <SkeletonList />
  )
}

export function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-8 bg-white/20 dark:bg-slate-900/5 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800/50">
      <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <CalendarDays className="w-8 h-8 text-slate-300 dark:text-slate-700" />
      </div>
      <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">
        {filtered ? 'No Matches Found' : 'No Schedules Yet'}
      </h3>
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter max-w-[240px] leading-relaxed">
        {filtered ? 'Try adjusting your filters or search term.' : 'Create the first schedule entry using the button above.'}
      </p>
    </div>
  )
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        aria-label="Previous page"
        className="h-11 w-11 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 transition-all">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[64px] text-center">
        {page} / {totalPages}
      </span>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
        aria-label="Next page"
        className="h-11 w-11 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 transition-all">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function SelectBox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange() }}
      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors shrink-0"
    >
      {indeterminate
        ? <MinusSquare className="h-[18px] w-[18px] text-blue-500" />
        : checked
          ? <CheckSquare className="h-[18px] w-[18px] text-blue-500" />
          : <Square className="h-[18px] w-[18px]" />
      }
    </button>
  )
}

function ScheduleRow({
  schedule: s, isSelected, showInactive, onToggle, onEdit, onDeactivate, onHardDelete,
}: {
  schedule: ClassSchedule; isSelected: boolean; showInactive: boolean
  onToggle: () => void
  onEdit: (s: ClassSchedule) => void
  onDeactivate: (s: ClassSchedule) => void
  onHardDelete: (s: ClassSchedule) => void
}) {
  return (
    <tr
      onClick={onToggle}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'transition-colors group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-inset',
        isSelected ? 'bg-blue-50/50 dark:bg-blue-600/5' : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'
      )}
    >
      <td className="px-5 py-4 w-10">
        <SelectBox checked={isSelected} onChange={onToggle} />
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {s.course_code} <span className="text-slate-400 dark:text-slate-600 font-bold">·</span> {s.section}
          </span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
            {s.course_name}
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">
          {s.departments?.code ?? '—'}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">
            {s.academic_terms?.academic_year ?? '—'}
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
            {s.academic_terms?.term_name ?? ''}
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
          {s.instructor_name ?? <span className="text-slate-300 dark:text-slate-700">—</span>}
        </span>
      </td>
      <td className="px-4 py-4">
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
          {s.facilities ? (s.facilities.room_number ?? s.facilities.name) : <span className="text-slate-300 dark:text-slate-700">—</span>}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-1">
          <span className={cn('inline-flex self-start px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide', DAY_COLORS[s.day_of_week])}>
            {DAYS_SHORT[s.day_of_week]}
          </span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {formatTime(s.start_time)} – {formatTime(s.end_time)}
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className={cn(
          'inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight',
          s.is_active
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-slate-500/10 text-slate-500'
        )}>
          {s.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-4">
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => onEdit(s)}
            className="h-11 w-11 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-all" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {s.is_active ? (
            <button onClick={() => onDeactivate(s)}
              className="h-11 w-11 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-all" title="Deactivate">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button onClick={() => onHardDelete(s)}
              className="h-11 w-11 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all" title="Delete Forever">
              <Flame className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function ScheduleCard({
  schedule: s, isSelected, showInactive, onToggle, onEdit, onDeactivate, onHardDelete,
}: {
  schedule: ClassSchedule; isSelected: boolean; showInactive: boolean
  onToggle: () => void
  onEdit: (s: ClassSchedule) => void
  onDeactivate: (s: ClassSchedule) => void
  onHardDelete: (s: ClassSchedule) => void
}) {
  return (
    <div
      onClick={onToggle}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'p-5 space-y-3 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-inset',
        isSelected ? 'bg-blue-50/50 dark:bg-blue-600/5' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <SelectBox checked={isSelected} onChange={onToggle} />
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{s.course_code}</span>
            <span className="text-[10px] font-bold text-slate-400">·</span>
            <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase">{s.section}</span>
            <span className={cn('px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide', DAY_COLORS[s.day_of_week])}>
              {DAYS_SHORT[s.day_of_week]}
            </span>
          </div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">{s.course_name}</p>
        </div>
        <span className={cn(
          'shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight',
          s.is_active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
        )}>
          {s.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 pl-8">
        <div><span className="text-slate-400 dark:text-slate-600 text-[9px] uppercase tracking-widest block mb-0.5">Dept</span>{s.departments?.code ?? '—'}</div>
        <div><span className="text-slate-400 dark:text-slate-600 text-[9px] uppercase tracking-widest block mb-0.5">Term</span>{s.academic_terms?.academic_year ?? '—'} {s.academic_terms?.term_name ?? ''}</div>
        <div><span className="text-slate-400 dark:text-slate-600 text-[9px] uppercase tracking-widest block mb-0.5">Instructor</span>{s.instructor_name ?? '—'}</div>
        <div><span className="text-slate-400 dark:text-slate-600 text-[9px] uppercase tracking-widest block mb-0.5">Room</span>{s.facilities ? (s.facilities.room_number ?? s.facilities.name) : '—'}</div>
        <div className="col-span-2"><span className="text-slate-400 dark:text-slate-600 text-[9px] uppercase tracking-widest block mb-0.5">Time</span>{formatTime(s.start_time)} – {formatTime(s.end_time)}</div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 pl-8" onClick={e => e.stopPropagation()}>
        <button onClick={() => onEdit(s)}
          className="flex items-center gap-1.5 px-4 h-8 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 transition-all">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        {s.is_active ? (
          <button onClick={() => onDeactivate(s)}
            className="flex items-center gap-1.5 px-4 h-8 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-amber-600 hover:bg-amber-500/10 transition-all">
            <Trash2 className="h-3.5 w-3.5" /> Deactivate
          </button>
        ) : (
          <button onClick={() => onHardDelete(s)}
            className="flex items-center gap-1.5 px-4 h-8 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 transition-all">
            <Flame className="h-3.5 w-3.5" /> Delete Forever
          </button>
        )}
      </div>
    </div>
  )
}

export function MasterScheduleGrid({
  schedules, selected, allSelected, someSelected, showInactive,
  onToggleAll, onToggleSelect, onEdit, onDeactivate, onHardDelete,
}: {
  schedules: ClassSchedule[]
  selected: Set<string>
  allSelected: boolean
  someSelected: boolean
  showInactive: boolean
  onToggleAll: () => void
  onToggleSelect: (id: string) => void
  onEdit: (s: ClassSchedule) => void
  onDeactivate: (s: ClassSchedule) => void
  onHardDelete: (s: ClassSchedule) => void
}) {
  return (
    <div className="bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="px-5 py-4 w-10">
                <SelectBox checked={allSelected} indeterminate={someSelected} onChange={onToggleAll} />
              </th>
              {['Course', 'Department', 'Term', 'Instructor', 'Room', 'Day & Time', 'Status', ''].map(col => (
                <th key={col} className="px-4 py-4 text-left text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {schedules.map(s => (
              <ScheduleRow
                key={s.id} schedule={s}
                isSelected={selected.has(s.id)}
                showInactive={showInactive}
                onToggle={() => onToggleSelect(s.id)}
                onEdit={onEdit} onDeactivate={onDeactivate} onHardDelete={onHardDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
        {schedules.map(s => (
          <ScheduleCard
            key={s.id} schedule={s}
            isSelected={selected.has(s.id)}
            showInactive={showInactive}
            onToggle={() => onToggleSelect(s.id)}
            onEdit={onEdit} onDeactivate={onDeactivate} onHardDelete={onHardDelete}
          />
        ))}
      </div>
    </div>
  )
}
