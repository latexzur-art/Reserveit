'use client'

import { Search, Filter, Eye, EyeOff, UserMinus, UserCheck } from 'lucide-react'

type Department = { id: string; name: string; code: string }
type AcademicTerm = {
  id: string; term_name: string; term_code: string
  academic_year: string; term_type: string; is_active?: boolean
}

interface ScheduleFiltersProps {
  searchInput: string
  departmentId: string
  termId: string
  showInactive: boolean
  unassignedOnly: boolean
  departments: Department[]
  terms: AcademicTerm[]
  onSearchInputChange: (value: string) => void
  onDepartmentChange: (value: string) => void
  onTermChange: (value: string) => void
  onShowInactiveChange: (value: boolean) => void
  onUnassignedOnlyChange: (value: boolean) => void
}

export function ScheduleFilters({
  searchInput,
  departmentId,
  termId,
  showInactive,
  departments,
  terms,
  onSearchInputChange,
  onDepartmentChange,
  onTermChange,
  onShowInactiveChange,
  unassignedOnly,
  onUnassignedOnlyChange,
}: ScheduleFiltersProps) {
  return (
    <div className="bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 rounded-[2rem] p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Filters</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Course, section, instructor…"
            value={searchInput}
            onChange={e => onSearchInputChange(e.target.value)}
            className="w-full pl-10 pr-4 h-11 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
          />
        </div>
        <select
          value={departmentId}
          onChange={e => onDepartmentChange(e.target.value)}
          className="h-11 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
          ))}
        </select>
        <select
          value={termId}
          onChange={e => onTermChange(e.target.value)}
          className="h-11 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
        >
          <option value="">All Terms</option>
          {terms.map(t => (
            <option key={t.id} value={t.id}>{t.academic_year} — {t.term_name}</option>
          ))}
        </select>
        <label className="flex items-center gap-3 h-11 px-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-all">
          {showInactive
            ? <Eye className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            : <EyeOff className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          }
          <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">
            {showInactive ? 'Showing Inactive' : 'Active Only'}
          </span>
          <input type="checkbox" checked={showInactive} onChange={e => onShowInactiveChange(e.target.checked)} className="sr-only" />
        </label>
        <label className="flex items-center gap-3 h-11 px-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-all">
          {unassignedOnly
            ? <UserMinus className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            : <UserCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          }
          <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">
            {unassignedOnly ? 'Unassigned Only' : 'All Assignments'}
          </span>
          <input type="checkbox" checked={unassignedOnly} onChange={e => onUnassignedOnlyChange(e.target.checked)} className="sr-only" />
        </label>
      </div>
    </div>
  )
}
