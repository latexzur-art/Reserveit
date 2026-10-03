'use client'

import { Calendar, CheckCircle2, Lock, Unlock, Edit, Trash2, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AcademicTerm } from '@/hooks/shared/useAcademicTerms'

interface TermsTableProps {
  terms: AcademicTerm[]
  onEdit: (term: AcademicTerm) => void
  onDelete: (term: AcademicTerm) => void
  onSetActive: (term: AcademicTerm) => void
}

const TERM_TYPE_LABELS: Record<string, string> = {
  first_semester: '1st Semester',
  second_semester: '2nd Semester',
  summer: 'Summer',
  midyear: 'Midyear',
}

const TERM_TYPE_COLORS: Record<string, string> = {
  first_semester: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  second_semester: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  summer: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  midyear: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
}

export function TermsTable({ terms, onEdit, onDelete, onSetActive }: TermsTableProps) {
  if (terms.length === 0) {
    return (
      <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
        <Calendar className="h-8 w-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-700 dark:text-slate-300 text-xs font-semibold">No Academic Terms Found</p>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Create your first term to get started.</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <th className="px-5 py-3.5">Term</th>
            <th className="px-5 py-3.5">Academic Year</th>
            <th className="px-5 py-3.5">Type</th>
            <th className="px-5 py-3.5">Dates</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
          {terms.map((term) => (
            <tr
              key={term.id}
              className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white leading-tight">{term.term_name}</p>
                    <p className="text-[11px] font-mono text-slate-400">{term.term_code}</p>
                  </div>
                </div>
              </td>

              <td className="px-5 py-3.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{term.academic_year}</span>
              </td>

              <td className="px-5 py-3.5">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                    TERM_TYPE_COLORS[term.term_type] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                  )}
                >
                  {TERM_TYPE_LABELS[term.term_type] || term.term_type}
                </span>
              </td>

              <td className="px-5 py-3.5">
                <div className="text-slate-600 dark:text-slate-300 font-medium">
                  <div>{new Date(term.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div className="text-[11px] text-slate-400">to {new Date(term.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
              </td>

              <td className="px-5 py-3.5">
                <div className="flex items-center gap-1.5">
                  {term.is_active && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </span>
                  )}
                  {term.is_schedule_locked && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      <Lock className="h-3 w-3" />
                      Locked
                    </span>
                  )}
                  {!term.is_active && !term.is_schedule_locked && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                      <Unlock className="h-3 w-3" />
                      Inactive
                    </span>
                  )}
                </div>
              </td>

              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  {!term.is_active && (
                    <Button
                      onClick={() => onSetActive(term)}
                      variant="ghost"
                      size="sm"
                      title="Set as Active Period"
                      className="h-8 px-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
                    >
                      <PlayCircle className="h-3.5 w-3.5 mr-1" />
                      Set Active
                    </Button>
                  )}
                  <Button
                    onClick={() => onEdit(term)}
                    variant="ghost"
                    size="icon"
                    title="Edit Term"
                    className="w-8 h-8 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => onDelete(term)}
                    variant="ghost"
                    size="icon"
                    title="Delete Term"
                    className="w-8 h-8 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg disabled:opacity-30"
                    disabled={term.is_active}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
