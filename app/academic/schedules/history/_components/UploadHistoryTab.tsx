'use client'

import { Upload, Loader2, Trash2, CheckSquare, Square } from 'lucide-react'
import { UploadRow } from './UploadRow'
import type { UploadRecord } from '@/hooks/academic-head/useScheduleHistory'
import { SkeletonList } from "@/components/ui/SkeletonList";


interface Props {
    uploads: UploadRecord[]
    loading: boolean
    selectedUploads: Set<string>
    actionLoading: string | null
    onToggleSelect: (id: string) => void
    onToggleAll: () => void
    onBatchDelete: () => void
    onClearSelection: () => void
    onSetConfirmAction: (action: { type: string; id: string; label: string }) => void
}

export function UploadHistoryTab({
    uploads,
    loading,
    selectedUploads,
    actionLoading,
    onToggleSelect,
    onToggleAll,
    onBatchDelete,
    onClearSelection,
    onSetConfirmAction,
}: Props) {
    return (
        <div className="space-y-4">
            {selectedUploads.size > 0 && (
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">{selectedUploads.size} selected</span>
                    <button
                        onClick={onBatchDelete}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete Selected
                    </button>
                    <button
                        onClick={onClearSelection}
                        className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        Clear
                    </button>
                </div>
            )}
            {loading ? (
                <SkeletonList />
            ) : uploads.length === 0 ? (
                <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-12 text-center">
                    <Upload className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No upload history yet</p>
                </div>
            ) : (
                <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/10">
                                    <th className="px-5 py-3.5 w-8">
                                        <button onClick={onToggleAll} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                            {selectedUploads.size === uploads.length && uploads.length > 0 ? (
                                                <CheckSquare className="h-4 w-4 text-ah-sti-cyan" />
                                            ) : (
                                                <Square className="h-4 w-4" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-3 py-3.5 w-8"></th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">File</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Entries</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Uploaded By</th>
                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uploads.map(upload => (
                                    <UploadRow
                                        key={upload.id}
                                        upload={upload}
                                        onSetConfirmAction={onSetConfirmAction}
                                        isSelected={selectedUploads.has(upload.id)}
                                        onToggleSelect={onToggleSelect}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-slate-200 dark:border-white/10 px-5 py-3 text-xs text-slate-500">
                        {uploads.length} upload{uploads.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}
        </div>
    )
}
