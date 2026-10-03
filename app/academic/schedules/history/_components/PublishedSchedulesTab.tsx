'use client'

import { Calendar, Loader2, RotateCcw, Edit3, Trash2, Search, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DAY_NAMES } from './UploadRow'
import type { ScheduleRecord } from '@/hooks/academic-head/useScheduleHistory'
import { SkeletonList } from "@/components/ui/SkeletonList";


interface Props {
    schedules: ScheduleRecord[]
    filteredSchedules: ScheduleRecord[]
    loading: boolean
    searchQuery: string
    selectedSchedules: Set<string>
    actionLoading: string | null
    onSearchChange: (q: string) => void
    onToggleSelect: (id: string) => void
    onToggleAll: () => void
    onBatchRollback: () => void
    onEdit: (sched: ScheduleRecord) => void
    onSetConfirmAction: (action: { type: string; id: string; label: string }) => void
}

export function PublishedSchedulesTab({
    schedules,
    filteredSchedules,
    loading,
    searchQuery,
    selectedSchedules,
    actionLoading,
    onSearchChange,
    onToggleSelect,
    onToggleAll,
    onBatchRollback,
    onEdit,
    onSetConfirmAction,
}: Props) {
    return (
        <div className="space-y-4">
            {/* Search & Actions */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder="Search by course, section, instructor, room, or department..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:border-ah-sti-cyan/50 focus:outline-none transition-colors"
                    />
                </div>
                {selectedSchedules.size > 0 && (
                    <button
                        onClick={onBatchRollback}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border border-amber-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {actionLoading === 'batch_rollback' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Rollback Selected ({selectedSchedules.size})
                    </button>
                )}
            </div>

            {loading ? (
                <SkeletonList />
            ) : filteredSchedules.length === 0 ? (
                <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-12 text-center">
                    <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">
                        {searchQuery ? 'No schedules match your search' : 'No published schedules'}
                    </p>
                </div>
            ) : (
                <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/10">
                                    <th className="px-5 py-3.5 w-10">
                                        <button onClick={onToggleAll} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                            {selectedSchedules.size === filteredSchedules.length && filteredSchedules.length > 0 ? (
                                                <CheckSquare className="h-4 w-4 text-ah-sti-cyan" />
                                            ) : (
                                                <Square className="h-4 w-4" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Course</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Section</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Instructor</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Day / Time</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Room</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Dept</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Ver</th>
                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSchedules.map(sched => (
                                    <tr key={sched.id} className={cn("border-b border-slate-100 dark:border-white/5 transition-colors", selectedSchedules.has(sched.id) ? "bg-ah-sti-cyan/5" : "hover:bg-slate-100 dark:hover:bg-white/[0.02]")}>
                                        <td className="px-5 py-3.5">
                                            <button onClick={() => onToggleSelect(sched.id)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                                {selectedSchedules.has(sched.id) ? (
                                                    <CheckSquare className="h-4 w-4 text-ah-sti-cyan" />
                                                ) : (
                                                    <Square className="h-4 w-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">{sched.course_code}</p>
                                            <p className="text-xs text-slate-500 truncate max-w-[150px]">{sched.course_name}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{sched.section}</td>
                                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{sched.instructor_name}</td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm text-slate-900 dark:text-white">{DAY_NAMES[sched.day_of_week]}</p>
                                            <p className="text-xs text-slate-500">{sched.start_time?.slice(0, 5)} – {sched.end_time?.slice(0, 5)}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{sched.facilities?.name ?? '—'}</td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10">
                                                {sched.departments?.code ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-center text-xs text-slate-500">v{sched.version}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => onEdit(sched)}
                                                    className="p-1.5 rounded-md text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit3 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => onSetConfirmAction({ type: 'rollback-single', id: sched.id, label: `Rollback ${sched.course_code} ${sched.section}` })}
                                                    disabled={!!actionLoading}
                                                    className="p-1.5 rounded-md text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                                                    title="Rollback to Draft"
                                                >
                                                    {actionLoading === 'rollback_' + sched.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                                </button>
                                                <button
                                                    onClick={() => onSetConfirmAction({ type: 'delete-schedule', id: sched.id, label: `Delete ${sched.course_code} ${sched.section}` })}
                                                    className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                                                    title="Delete Forever"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-slate-200 dark:border-white/10 px-5 py-3 text-xs text-slate-500">
                        Showing {filteredSchedules.length} of {schedules.length} schedules
                    </div>
                </div>
            )}
        </div>
    )
}
