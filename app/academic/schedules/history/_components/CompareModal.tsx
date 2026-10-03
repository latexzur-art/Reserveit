'use client'

import { GitCompare, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DAY_FULL } from './UploadRow'
import type { ModificationEntry } from '@/hooks/academic-head/useScheduleHistory'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export function CompareModal({
    entry,
    onClose,
}: {
    entry: ModificationEntry
    onClose: () => void
}) {
    const o = entry.original
    const n = entry.modified

    const fields = [
        { label: 'Course Code', old: o.course_code, new: n?.course_code },
        { label: 'Course Name', old: o.course_name, new: n?.course_name },
        { label: 'Section', old: o.section, new: n?.section },
        { label: 'Instructor', old: o.instructor_name, new: n?.instructor_name },
        { label: 'Day', old: DAY_FULL[o.day_of_week], new: n ? DAY_FULL[n.day_of_week] : undefined },
        { label: 'Start Time', old: o.start_time?.slice(0, 5), new: n?.start_time?.slice(0, 5) },
        { label: 'End Time', old: o.end_time?.slice(0, 5), new: n?.end_time?.slice(0, 5) },
        { label: 'Room', old: o.facilities?.name ?? '—', new: n?.facilities?.name ?? '—' },
        { label: 'Department', old: o.departments?.name ?? '—', new: n?.departments?.name ?? '—' },
    ]

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="bg-white dark:bg-[#0a0f1e] border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
                <DialogHeader className="flex-row items-center gap-3 space-y-0 p-6 border-b border-slate-200 dark:border-white/10 text-left">
                    <GitCompare className="h-5 w-5 text-ah-sti-cyan shrink-0" />
                    <div>
                        <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Compare Versions</DialogTitle>
                        <DialogDescription className="text-sm text-slate-400">{o.course_code} {o.section} — v{o.version} → v{n?.version ?? '?'}</DialogDescription>
                    </div>
                </DialogHeader>

                <div className="p-6">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_2fr_auto_2fr] gap-3 mb-3 px-3">
                        <span className="text-xs text-slate-500 font-semibold uppercase">Field</span>
                        <span className="text-xs text-red-400/70 font-semibold uppercase">Original (v{o.version})</span>
                        <span />
                        <span className="text-xs text-emerald-400/70 font-semibold uppercase">Modified (v{n?.version ?? '?'})</span>
                    </div>

                    <div className="space-y-1">
                        {fields.map(field => {
                            const changed = field.old !== field.new
                            return (
                                <div
                                    key={field.label}
                                    className={cn(
                                        'grid grid-cols-[1fr_2fr_auto_2fr] gap-3 px-3 py-2.5 rounded-lg',
                                        changed ? 'bg-ah-sti-cyan/5 border border-ah-sti-cyan/20' : 'bg-slate-100 dark:bg-white/[0.01]'
                                    )}
                                >
                                    <span className="text-xs font-medium text-slate-400">{field.label}</span>
                                    <span className={cn('text-sm', changed ? 'text-red-400 line-through' : 'text-slate-700 dark:text-slate-300')}>
                                        {field.old}
                                    </span>
                                    <span className="flex items-center">
                                        {changed && <ArrowRight className="h-3.5 w-3.5 text-ah-sti-cyan" />}
                                    </span>
                                    <span className={cn('text-sm', changed ? 'text-emerald-400 font-medium' : 'text-slate-700 dark:text-slate-300')}>
                                        {field.new ?? '—'}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {o.supersede_reason && (
                        <div className="mt-4 p-3 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Reason for change:</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{o.supersede_reason}</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
