/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, Fragment } from 'react'
import {
  Loader2,
  FileText,
  User,
  Clock,
  Building2,
  BookOpen,
  ChevronRight,
  Copy,
  Check,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOG_ACTION_CONFIG } from './batch-constants'

interface CourseLogsFeedProps {
  logs: any[]
  total: number
  loading: boolean
  page: number
  onPageChange: (p: number) => void
}

const PAGE_SIZE = 20
const MAX_COURSE_CHIPS = 4

interface CourseRef { course_code: string; course_name?: string }
interface ClearedBatch {
  status?: string
  fileName?: string | null
  totalEntries?: number
  departmentName?: string | null
  departmentCode?: string | null
  courses?: CourseRef[]
}

function isCleared(action: string) {
  return action === 'upload_history_cleared'
}

/** Distinct department codes/names referenced by a log entry. */
function getDepartments(action: string, details: Record<string, any> = {}): string[] {
  if (isCleared(action)) {
    const batches = (details.batches ?? []) as ClearedBatch[]
    return [...new Set(batches.map(b => b.departmentCode || b.departmentName).filter(Boolean) as string[])]
  }
  const dept = details.departmentCode || details.departmentName
  return dept ? [dept] : []
}

/** Courses affected by this action, flattened across batches for 'cleared'. */
function getCourses(action: string, details: Record<string, any> = {}): CourseRef[] {
  if (isCleared(action)) {
    const batches = (details.batches ?? []) as ClearedBatch[]
    return batches.flatMap(b => b.courses ?? [])
  }
  return (details.courses ?? []) as CourseRef[]
}

/** True once a log entry's details include the actual department/course-list payload (added after the Logs feature shipped). Older rows only have summary counters. */
function hasCourseDetail(action: string, details: Record<string, any> = {}): boolean {
  return isCleared(action) ? Array.isArray(details.batches) : Array.isArray(details.courses)
}

/** Headline count for the "Affected" column. */
function getAffectedLabel(action: string, details: Record<string, any> = {}): string {
  if (isCleared(action)) {
    const count = details.count ?? (details.batches ?? []).length
    return `${count} upload${count === 1 ? '' : 's'} cleared`
  }
  const n = details.approvedCount ?? details.rejectedCount ?? details.sentBackCount ?? getCourses(action, details).length
  return `${n} course${n === 1 ? '' : 's'}`
}

function getNote(details: Record<string, any> = {}): string | null {
  return details.reason || details.notes || null
}

function CourseChips({ courses, legacy }: { courses: CourseRef[]; legacy: boolean }) {
  if (courses.length === 0) {
    return (
      <span className="text-[10px] text-slate-400 italic">
        {legacy ? 'No course detail logged for this older entry' : '—'}
      </span>
    )
  }
  const shown = courses.slice(0, MAX_COURSE_CHIPS)
  const remaining = courses.length - shown.length
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((c, i) => (
        <span
          key={`${c.course_code}-${i}`}
          title={c.course_name ?? c.course_code}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-[9px] font-mono font-bold text-slate-600 dark:text-slate-300"
        >
          {c.course_code}
        </span>
      ))}
      {remaining > 0 && (
        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-[9px] font-bold text-slate-500">
          +{remaining} more
        </span>
      )}
    </div>
  )
}

export function CourseLogsFeed({ logs, total, loading, page, onPageChange }: CourseLogsFeedProps) {
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handleCopy = (logId: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(logId)
    setTimeout(() => {
      setCopiedId(null)
    }, 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-500" />
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Loading Logs...</p>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-slate-50 dark:bg-white/[0.01] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/[0.05]">
        <FileText className="h-12 w-12 mb-4 text-slate-300 dark:text-slate-800" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No action logs recorded</p>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#050d36] dark:bg-[#15181E] border-b border-white/5">
              <th className="w-12 px-4 py-4"></th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300">Action</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300">Department</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300">Actor</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300">Affected Courses</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {logs.map((log) => {
              const cfg = LOG_ACTION_CONFIG[log.action] ?? { label: log.action, color: 'bg-slate-100 text-slate-600 border-slate-200' }
              const depts = getDepartments(log.action, log.details)
              const courses = getCourses(log.action, log.details)
              const note = getNote(log.details)
              const isExpanded = !!expandedLogs[log.id]

              return (
                <Fragment key={log.id}>
                  <tr
                    onClick={() => toggleExpand(log.id)}
                    className={cn(
                      "group transition-colors align-top cursor-pointer select-none",
                      isExpanded
                        ? "bg-slate-50/70 dark:bg-white/[0.02]"
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                    )}
                  >
                    <td className="w-12 px-4 py-4 text-center">
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 text-slate-400 transition-transform mx-auto",
                          isExpanded && "rotate-90 text-blue-500"
                        )}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight border', cfg.color)}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {depts.length === 0 ? '—' : depts.length === 1 ? depts[0] : `${depts.length} Depts`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <User className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide">{log.actorName ?? 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-[360px]">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 mb-1.5">
                        <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {getAffectedLabel(log.action, log.details)}
                          {!hasCourseDetail(log.action, log.details) && <span className="text-slate-400 font-normal"> (legacy estimate)</span>}
                        </span>
                      </div>
                      <CourseChips courses={courses} legacy={!hasCourseDetail(log.action, log.details)} />
                      {note && <p className="mt-1.5 text-xs italic text-slate-400 line-clamp-1">&quot;{note}&quot;</p>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400 dark:text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</span>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-50/30 dark:bg-white/[0.005] border-b border-slate-100 dark:border-white/5">
                      <td colSpan={6} className="px-6 py-5">
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-5">
                          {/* Upper Grid: Metadata & Actions */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-[#111622]/40 rounded-2xl p-4 border border-slate-200/50 dark:border-white/[0.04]">
                            <div>
                              <span className="block text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Academic Period</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mt-0.5 block">
                                {log.details?.termName || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Department</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mt-0.5 block">
                                {log.details?.departmentName || (depts.length > 0 ? depts.join(', ') : '—')}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Actor Email</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 block truncate">
                                {log.actorEmail || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Target Upload ID</span>
                              {log.targetId ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                                    {log.targetId}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCopy(log.id, log.targetId)
                                    }}
                                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-500 transition-colors"
                                    title="Copy Target ID"
                                  >
                                    {copiedId === log.id ? (
                                      <Check className="h-3 w-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                  {copiedId === log.id && (
                                    <span className="text-[8px] font-bold text-emerald-500 animate-fade-in uppercase">Copied!</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 block">—</span>
                              )}
                            </div>
                          </div>

                          {/* Uploader Notes */}
                          {log.details?.uploaderNotes && (
                            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.01] text-xs leading-relaxed font-medium">
                              <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="block text-[9px] font-black uppercase tracking-wider mb-1 text-slate-400 dark:text-slate-500">Uploader Notes:</span>
                                  <span className="italic text-slate-700 dark:text-slate-300">&quot;{log.details.uploaderNotes}&quot;</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Rejection / revision comments */}
                          {note && (
                            <div className={cn(
                              "p-4 rounded-2xl border text-xs leading-relaxed font-medium",
                              log.action.includes('rejected')
                                ? "bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/20"
                                : log.action.includes('sent_back')
                                ? "bg-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-500/20"
                                : "bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            )}>
                              <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="block text-[9px] font-black uppercase tracking-wider mb-1 opacity-75">Revision Notes / Reason:</span>
                                  <span className="italic">&quot;{note}&quot;</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Courses display */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                                All Affected Courses ({courses.length})
                              </span>
                              <div className="flex gap-3 text-[9px] font-black uppercase text-slate-500">
                                {log.details?.approvedCount !== undefined && (
                                  <span className="text-emerald-500">Approved: {log.details.approvedCount}</span>
                                )}
                                {log.details?.rejectedCount !== undefined && (
                                  <span className="text-red-500">Rejected: {log.details.rejectedCount}</span>
                                )}
                                {log.details?.sentBackCount !== undefined && (
                                  <span className="text-orange-500">Sent Back: {log.details.sentBackCount}</span>
                                )}
                              </div>
                            </div>

                            {courses.length === 0 ? (
                              <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.05] text-center text-[10px] text-slate-400 italic">
                                No course details logged for this entry
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                                {courses.map((c, i) => (
                                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.05] hover:border-slate-200 dark:hover:border-white/[0.1] transition-all">
                                    <BookOpen className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 leading-none mb-1">{c.course_code}</span>
                                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate uppercase leading-none">{c.course_name || 'No Course Name'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {logs.map((log) => {
          const cfg = LOG_ACTION_CONFIG[log.action] ?? { label: log.action, color: 'bg-slate-100 text-slate-600 border-slate-200' }
          const depts = getDepartments(log.action, log.details)
          const courses = getCourses(log.action, log.details)
          const note = getNote(log.details)
          const isExpanded = !!expandedLogs[log.id]

          return (
            <div
              key={log.id}
              onClick={() => toggleExpand(log.id)}
              className={cn(
                "bg-white dark:bg-[#15181E] border rounded-2xl p-4 space-y-3 cursor-pointer select-none transition-all",
                isExpanded ? "border-blue-500 dark:border-blue-500 animate-in fade-in" : "border-slate-200 dark:border-white/[0.08]"
              )}
            >
              <div className="flex justify-between items-center">
                <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border', cfg.color)}>{cfg.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-slate-500">{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '—'}</span>
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 text-slate-400 transition-transform",
                      isExpanded && "rotate-90 text-blue-500"
                    )}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] font-bold uppercase text-slate-500">
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3" /> {log.actorName ?? 'Unknown'}
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" /> {depts.length === 0 ? '—' : depts.length === 1 ? depts[0] : `${depts.length} Depts`}
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-500">{getAffectedLabel(log.action, log.details)}</p>
                <CourseChips courses={courses} legacy={!hasCourseDetail(log.action, log.details)} />
                {note && !isExpanded && <p className="text-[10px] italic text-slate-400 line-clamp-1">&quot;{note}&quot;</p>}
              </div>

              {isExpanded && (
                <div
                  className="pt-3 border-t border-slate-100 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200"
                  onClick={(e) => e.stopPropagation()} // Prevent collapse when clicking inner elements
                >
                  {/* Mobile Metadata */}
                  <div className="space-y-2 text-[10px] bg-slate-50 dark:bg-[#111622]/40 rounded-xl p-3 border border-slate-200/50 dark:border-white/[0.04]">
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase">Period:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{log.details?.termName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase">Dept:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                        {log.details?.departmentName || (depts.length > 0 ? depts.join(', ') : '—')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase">Email:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{log.actorEmail || '—'}</span>
                    </div>
                    {log.targetId && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 dark:text-slate-500 font-bold uppercase">Target ID:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{log.targetId}</span>
                          <button
                            onClick={() => handleCopy(log.id, log.targetId)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] text-slate-500"
                          >
                            {copiedId === log.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Uploader Notes */}
                  {log.details?.uploaderNotes && (
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.01] text-[11px] font-medium leading-relaxed">
                      <span className="block text-[8px] font-black uppercase tracking-wider mb-0.5 text-slate-400 dark:text-slate-500">Uploader Notes:</span>
                      <span className="italic text-slate-700 dark:text-slate-300">&quot;{log.details.uploaderNotes}&quot;</span>
                    </div>
                  )}

                  {/* Rejection / revision comments */}
                  {note && (
                    <div className={cn(
                      "p-3 rounded-xl border text-[11px] font-medium leading-relaxed",
                      log.action.includes('rejected')
                        ? "bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/20"
                        : log.action.includes('sent_back')
                        ? "bg-orange-500/5 text-orange-600 dark:text-orange-400 border-orange-500/20"
                        : "bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    )}>
                      <span className="block text-[8px] font-black uppercase tracking-wider mb-0.5 opacity-75">Notes / Reason:</span>
                      <span className="italic">&quot;{note}&quot;</span>
                    </div>
                  )}

                  {/* All Courses grid */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
                      <span>All Courses ({courses.length})</span>
                      <div className="flex gap-2">
                        {log.details?.approvedCount !== undefined && <span className="text-emerald-500">A: {log.details.approvedCount}</span>}
                        {log.details?.rejectedCount !== undefined && <span className="text-red-500">R: {log.details.rejectedCount}</span>}
                        {log.details?.sentBackCount !== undefined && <span className="text-orange-500">S: {log.details.sentBackCount}</span>}
                      </div>
                    </div>
                    {courses.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">No courses logged</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {courses.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.05]">
                            <BookOpen className="h-3 w-3 text-blue-500 flex-shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[9px] font-mono font-bold text-slate-700 dark:text-slate-300 leading-none mb-0.5">{c.course_code}</span>
                              <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 truncate uppercase leading-none">{c.course_name || '—'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-white/10 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
