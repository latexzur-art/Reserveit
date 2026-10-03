'use client'

import { RotateCcw, Loader2, Trash2, Search, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DAY_NAMES } from './UploadRow'
import type { ScheduleRecord } from '@/hooks/academic-head/useScheduleHistory'
import { SkeletonList } from "@/components/ui/SkeletonList";


interface Props {
    rolledBack: ScheduleRecord[]
    filteredRolledBack: ScheduleRecord[]
    loading: boolean
    searchQuery: string
    selectedRolledBack: Set<string>
    actionLoading: string | null
    onSearchChange: (q: string) => void
    onToggleSelect: (id: string) => void
    onToggleAll: () => void
    onBatchPermanentDelete: () => void
    onSetConfirmAction: (action: { type: string; id: string; label: string }) => void
}

export function RolledBackTab({
    rolledBack,
    filteredRolledBack,
    loading,
    searchQuery,
    selectedRolledBack,
    actionLoading,
    onSearchChange,
    onToggleSelect,
    onToggleAll,
    onBatchPermanentDelete,
    onSetConfirmAction,
}: Props) {
    return (
        <div className="space-y-4">
            {/* Search & Batch Actions */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder="Search rolled-back schedules by course, section, instructor, room, or department..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:border-ah-sti-cyan/50 focus:outline-none transition-colors"
                    />
                </div>
                {selectedRolledBack.size > 0 && (
                    <button
                        onClick={onBatchPermanentDelete}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {actionLoading === 'batch_permanent_delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete Permanently ({selectedRolledBack.size})
                    </button>
                )}
            </div>

            {loading ? (
                <SkeletonList />
            ) : filteredRolledBack.length === 0 ? (
                <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-12 text-center">
                    <RotateCcw className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">
                        {searchQuery ? 'No rolled-back schedules match your search' : 'No rolled-back schedules'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                        Rolled-back schedules will appear here and can be permanently deleted.
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
                                            {selectedRolledBack.size === filteredRolledBack.length && filteredRolledBack.length > 0 ? (
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
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Rolled Back</th>
                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRolledBack.map(s => (
                                    <tr key={s.id} className={cn("border-b border-slate-100 dark:border-white/5 transition-colors", selectedRolledBack.has(s.id) ? "bg-red-500/5" : "hover:bg-slate-100 dark:hover:bg-white/[0.02]")}>
                                        <td className="px-5 py-3.5">
                                            <button onClick={() => onToggleSelect(s.id)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                                {selectedRolledBack.has(s.id) ? (
                                                    <CheckSquare className="h-4 w-4 text-ah-sti-cyan" />
                                                ) : (
                                                    <Square className="h-4 w-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">{s.course_code}</p>
                                            <p className="text-xs text-slate-500 truncate max-w-[150px]">{s.course_name}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{s.section}</td>
                                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{s.instructor_name}</td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm text-slate-900 dark:text-white">{DAY_NAMES[s.day_of_week]}</p>
                                            <p className="text-xs text-slate-500">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{s.facilities?.name ?? '—'}</td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm text-slate-700 dark:text-slate-300">{s.departments?.code ?? '—'}</p>
                                            <p className="text-xs text-slate-500">{s.departments?.name}</p>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {s.superseded_at ? (
                                                <p className="text-xs text-slate-400">{new Date(s.superseded_at).toLocaleDateString()}</p>
                                            ) : '—'}
                                            <p className="text-[10px] text-slate-600 dark:text-slate-500 mt-0.5">{s.supersede_reason}</p>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end">
                                                <button
                                                    onClick={() => onSetConfirmAction({ type: 'permanent-delete-single', id: s.id, label: `Permanently delete ${s.course_code}` })}
                                                    disabled={!!actionLoading}
                                                    className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                    title="Delete Permanently"
                                                >
                                                    {actionLoading === 'perm_delete_' + s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-slate-200 dark:border-white/10 px-5 py-3 text-xs text-slate-500">
                        Showing {filteredRolledBack.length} of {rolledBack.length} rolled-back schedules
                    </div>
                </div>
            )}
        </div>
    )
}
