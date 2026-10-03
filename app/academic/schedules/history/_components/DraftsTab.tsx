'use client'

import { FileSpreadsheet, Loader2, UploadCloud, Trash2, Search, AlertTriangle, CheckCircle2, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DAY_NAMES } from './UploadRow'
import type { DraftRecord } from '@/hooks/academic-head/useScheduleHistory'
import { SkeletonList } from "@/components/ui/SkeletonList";


interface Props {
    drafts: DraftRecord[]
    filteredDrafts: DraftRecord[]
    loading: boolean
    searchQuery: string
    selectedDrafts: Set<string>
    actionLoading: string | null
    onSearchChange: (q: string) => void
    onToggleSelect: (id: string) => void
    onToggleAll: () => void
    onBatchPublish: () => void
    onBatchDelete: () => void
    onSetConfirmAction: (action: { type: string; id: string; label: string }) => void
}

export function DraftsTab({
    drafts,
    filteredDrafts,
    loading,
    searchQuery,
    selectedDrafts,
    actionLoading,
    onSearchChange,
    onToggleSelect,
    onToggleAll,
    onBatchPublish,
    onBatchDelete,
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
                        placeholder="Search drafts by course, section, instructor, room, or department..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:border-ah-sti-cyan/50 focus:outline-none transition-colors"
                    />
                </div>
                {selectedDrafts.size > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onBatchPublish}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 px-4 py-3 bg-ah-sti-cyan hover:bg-ah-sti-cyan/90 text-[hsl(240,41%,12%)] rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {actionLoading === 'batch_publish_drafts' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                            Publish Selected ({selectedDrafts.size})
                        </button>
                        <button
                            onClick={onBatchDelete}
                            disabled={!!actionLoading}
                            className="flex items-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {actionLoading === 'batch_delete_drafts' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete Selected
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <SkeletonList />
            ) : filteredDrafts.length === 0 ? (
                <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-12 text-center">
                    <FileSpreadsheet className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">
                        {searchQuery ? 'No drafts match your search' : 'No drafts available'}
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
                                            {selectedDrafts.size === filteredDrafts.length && filteredDrafts.length > 0 ? (
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
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Notes</th>
                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDrafts.map(draft => (
                                    <tr key={draft.id} className={cn("border-b border-slate-100 dark:border-white/5 transition-colors", selectedDrafts.has(draft.id) ? "bg-ah-sti-cyan/5" : "hover:bg-slate-100 dark:hover:bg-white/[0.02]")}>
                                        <td className="px-5 py-3.5">
                                            <button onClick={() => onToggleSelect(draft.id)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                                {selectedDrafts.has(draft.id) ? (
                                                    <CheckSquare className="h-4 w-4 text-ah-sti-cyan" />
                                                ) : (
                                                    <Square className="h-4 w-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">{draft.course_code}</p>
                                            <p className="text-xs text-slate-500 truncate max-w-[150px]">{draft.course_name}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{draft.section}</td>
                                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{draft.instructor_name}</td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm text-slate-900 dark:text-white">{DAY_NAMES[draft.day_of_week]}</p>
                                            <p className="text-xs text-slate-500">{draft.start_time?.slice(0, 5)} – {draft.end_time?.slice(0, 5)}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300">{draft.facilities?.name ?? '—'}</td>
                                        <td className="px-5 py-3.5">
                                            {(draft.has_external_conflict || draft.has_internal_conflict) ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-red-500/10 text-red-400 border-red-500/20">
                                                    <AlertTriangle className="h-2.5 w-2.5" /> Conflict
                                                </span>
                                            ) : draft.validation_status === 'error' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-500/10 text-amber-500 border-amber-500/20">
                                                    <AlertTriangle className="h-2.5 w-2.5" /> Invalid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                    <CheckCircle2 className="h-2.5 w-2.5" /> Valid
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[200px] truncate">
                                            {draft.academic_head_review_notes ?? '—'}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => onSetConfirmAction({ type: 'publish-draft', id: draft.id, label: `Publish ${draft.course_code}` })}
                                                    disabled={!!actionLoading}
                                                    className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                                                    title="Publish"
                                                >
                                                    {actionLoading === 'publish_' + draft.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                                                </button>
                                                <button
                                                    onClick={() => onSetConfirmAction({ type: 'delete-draft', id: draft.id, label: `Delete draft ${draft.course_code}` })}
                                                    disabled={!!actionLoading}
                                                    className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                    title="Delete Forever"
                                                >
                                                    {actionLoading === 'delete_' + draft.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-slate-200 dark:border-white/10 px-5 py-3 text-xs text-slate-500">
                        Showing {filteredDrafts.length} of {drafts.length} drafts
                    </div>
                </div>
            )}
        </div>
    )
}
