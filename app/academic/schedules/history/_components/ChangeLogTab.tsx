'use client'

import { Loader2, Edit3, Trash2, GitCompare } from 'lucide-react'
import { DAY_NAMES } from './UploadRow'
import type { ModificationEntry, ScheduleRecord } from '@/hooks/academic-head/useScheduleHistory'
import { SkeletonList } from "@/components/ui/SkeletonList";


interface Props {
    modifications: ModificationEntry[]
    deletions: ScheduleRecord[]
    loading: boolean
    onCompare: (entry: ModificationEntry) => void
}

export function ChangeLogTab({
    modifications,
    deletions,
    loading,
    onCompare,
}: Props) {
    return (
        <div className="space-y-6">
            {loading ? (
                <SkeletonList />
            ) : (
                <>
                    {/* Modifications */}
                    <section>
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Edit3 className="h-4 w-4" />
                            Modifications ({modifications.length})
                        </h2>
                        {modifications.length === 0 ? (
                            <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-8 text-center">
                                <p className="text-slate-500 text-sm">No schedule modifications yet</p>
                            </div>
                        ) : (
                            <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-white/10">
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Course</th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Changed</th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Changes</th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Reason</th>
                                                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {modifications.map(mod => {
                                                const o = mod.original
                                                const n = mod.modified
                                                const changes: string[] = []
                                                if (n) {
                                                    if (o.facility_id !== n.facility_id) changes.push(`Room: ${o.facilities?.name ?? '?'} → ${n.facilities?.name ?? '?'}`)
                                                    if (o.day_of_week !== n.day_of_week) changes.push(`Day: ${DAY_NAMES[o.day_of_week]} → ${DAY_NAMES[n.day_of_week]}`)
                                                    if (o.start_time !== n.start_time || o.end_time !== n.end_time) changes.push(`Time: ${o.start_time?.slice(0, 5)}-${o.end_time?.slice(0, 5)} → ${n.start_time?.slice(0, 5)}-${n.end_time?.slice(0, 5)}`)
                                                    if (o.instructor_name !== n.instructor_name) changes.push(`Instructor: ${o.instructor_name} → ${n.instructor_name}`)
                                                    if (o.section !== n.section) changes.push(`Section: ${o.section} → ${n.section}`)
                                                }
                                                if (changes.length === 0) changes.push('Fields updated')

                                                return (
                                                    <tr key={o.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.02] transition-colors">
                                                        <td className="px-5 py-3.5">
                                                            <p className="text-sm font-medium text-slate-900 dark:text-white">{o.course_code} {o.section}</p>
                                                            <p className="text-xs text-slate-500">{o.departments?.code}</p>
                                                        </td>
                                                        <td className="px-5 py-3.5 text-sm text-slate-400">
                                                            {o.superseded_at ? new Date(o.superseded_at).toLocaleDateString() : '—'}
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            {changes.map((c, i) => (
                                                                <p key={i} className="text-xs text-cyan-400">{c}</p>
                                                            ))}
                                                        </td>
                                                        <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[200px] truncate">
                                                            {o.supersede_reason ?? '—'}
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center justify-end">
                                                                <button
                                                                    onClick={() => onCompare(mod)}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-ah-sti-cyan hover:bg-ah-sti-cyan/10 transition-colors"
                                                                >
                                                                    <GitCompare className="h-3.5 w-3.5" />
                                                                    Compare
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Deletions */}
                    <section>
                        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            Deletions ({deletions.length})
                        </h2>
                        {deletions.length === 0 ? (
                            <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-8 text-center">
                                <p className="text-slate-500 text-sm">No deleted schedules</p>
                            </div>
                        ) : (
                            <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-white/10">
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Course</th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Deleted</th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Day / Time</th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Room</th>
                                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deletions.map(del => (
                                                <tr key={del.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-5 py-3.5">
                                                        <p className="text-sm font-medium text-slate-600 dark:text-white/60 line-through">{del.course_code} {del.section}</p>
                                                        <p className="text-xs text-slate-600">{del.departments?.code}</p>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-sm text-slate-500">
                                                        {del.superseded_at ? new Date(del.superseded_at).toLocaleDateString() : '—'}
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <p className="text-sm text-slate-500">{DAY_NAMES[del.day_of_week]}</p>
                                                        <p className="text-xs text-slate-600">{del.start_time?.slice(0, 5)} – {del.end_time?.slice(0, 5)}</p>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-sm text-slate-500">{del.facilities?.name ?? '—'}</td>
                                                    <td className="px-5 py-3.5 text-xs text-slate-600 max-w-[200px] truncate">
                                                        {del.supersede_reason ?? '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    )
}
