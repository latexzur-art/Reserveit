'use client'

import { useState } from 'react'
import { Loader2, PlusCircle, Edit3, Trash2, FileText, ChevronDown, ChevronUp, GitCompare, Code } from 'lucide-react'
import { DAY_NAMES, DAY_FULL } from './UploadRow'
import { useActivityLogs } from '@/hooks/academic-head/useActivityLogs'
import type { ActivityLogItem } from '@/hooks/academic-head/useActivityLogs'
import { cn } from '@/lib/utils'
import { SkeletonList } from "@/components/ui/SkeletonList";


export function ActivityLogsTab() {
    const { logs, loading, error } = useActivityLogs()
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    if (loading) {
        return (
            <SkeletonList />
        )
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm">
                Error loading activity logs: {error}
            </div>
        )
    }

    if (logs.length === 0) {
        return (
            <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-8 text-center">
                <p className="text-slate-500 text-sm">No activity logs found</p>
            </div>
        )
    }

    return (
        <div className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10">
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-10"></th>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Course / Details</th>
                            <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Timestamp</th>
                            <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => {
                            const isExpanded = expandedRows.has(log.id)
                            return (
                                <LogEntryRow
                                    key={log.id}
                                    log={log}
                                    isExpanded={isExpanded}
                                    onToggle={() => toggleRow(log.id)}
                                />
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function LogEntryRow({ log, isExpanded, onToggle }: { log: ActivityLogItem, isExpanded: boolean, onToggle: () => void }) {
    const [showRawJson, setShowRawJson] = useState(false)
    
    const renderTypeBadge = () => {
        switch (log.type) {
            case 'ADDITION':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400"><PlusCircle className="h-3.5 w-3.5" /> Addition</span>
            case 'MODIFICATION':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400"><Edit3 className="h-3.5 w-3.5" /> Modification</span>
            case 'DELETION':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400"><Trash2 className="h-3.5 w-3.5" /> Deletion</span>
            case 'CHANGE_REQUEST':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400"><FileText className="h-3.5 w-3.5" /> Change Request</span>
        }
    }

    const renderSummary = () => {
        if (log.type === 'ADDITION' || log.type === 'DELETION') {
            const d = log.details
            return (
                <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{d.course_code} {d.section}</p>
                    <p className="text-xs text-slate-500">{d.instructor_name || 'No instructor'} • {d.facilities?.name || 'No room'}</p>
                </div>
            )
        }
        if (log.type === 'MODIFICATION') {
            const o = log.details.original
            return (
                <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{o.course_code} {o.section}</p>
                    <p className="text-xs text-slate-500">Schedule updated to version {o.version + 1}</p>
                </div>
            )
        }
        if (log.type === 'CHANGE_REQUEST') {
            const cr = log.details
            const sched = cr.class_schedules
            return (
                <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {sched ? `${sched.course_code} ${sched.section}` : 'New Schedule Request'}
                    </p>
                    <p className="text-xs text-slate-500">Requested by {cr.users?.full_name}</p>
                </div>
            )
        }
    }

    const renderFormattedDetails = () => {
        if (log.type === 'ADDITION' || log.type === 'DELETION') {
            const d = log.details
            const dayName = d.day_of_week !== undefined ? (DAY_FULL[d.day_of_week] || 'Day ' + d.day_of_week) : 'Unknown Day'
            const roomName = d.facilities?.name || d.room || 'No Room Assigned'
            const deptName = d.departments?.name || d.department_id || 'No Department'
            const timeText = (d.start_time && d.end_time) ? `${formatTime(d.start_time)} - ${formatTime(d.end_time)}` : 'No Time'

            return (
                <div className="bg-slate-100 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-xl p-4 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {log.type === 'ADDITION' ? 'Addition Details' : 'Deletion/Removal Details'}
                        </h4>
                        <span className={cn(
                            "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                            log.type === 'ADDITION' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        )}>
                            {log.type === 'ADDITION' ? 'Staged' : 'Removed'}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                            <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Course Code & Name</span>
                            <span className="text-slate-200 font-medium block">{d.course_code} {d.course_name ? `— ${d.course_name}` : ''}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Section</span>
                            <span className="text-slate-200 font-medium block">{d.section || 'None'}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Room / Facility</span>
                            <span className="text-slate-200 font-medium block">{roomName}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Instructor</span>
                            <span className="text-slate-200 font-medium block">{d.instructor_name || 'No Instructor Assigned'}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Schedule</span>
                            <span className="text-slate-200 font-medium block">{dayName}, {timeText}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Department</span>
                            <span className="text-slate-200 font-medium block truncate" title={deptName}>{deptName}</span>
                        </div>
                    </div>
                </div>
            )
        }

        if (log.type === 'MODIFICATION') {
            const orig = log.details.original
            const mod = log.details.modified

            if (!orig || !mod) {
                return <p className="text-slate-400 text-xs italic p-4">Missing modification nodes.</p>
            }

            const changes = getChangesList(orig, mod)

            return (
                <div className="bg-slate-100 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-xl p-4 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modification Summary</h4>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                            Changed Fields ({changes.length})
                        </span>
                    </div>
                    
                    {changes.length === 0 ? (
                        <p className="text-slate-500 text-xs italic py-2">No fields were altered (metadata only update).</p>
                    ) : (
                        <div className="space-y-2">
                            {changes.map((ch, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-black/20 border border-slate-200 dark:border-white/[0.02] gap-2 text-xs">
                                    <div className="w-24 shrink-0">
                                        <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider block">{ch.field}</span>
                                    </div>
                                    <div className="flex-1 flex items-center flex-wrap gap-2 text-slate-700 dark:text-slate-300">
                                        <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/10 truncate max-w-[180px]" title={ch.from}>
                                            {ch.from}
                                        </span>
                                        <span className="text-slate-500">→</span>
                                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/10 truncate max-w-[180px]" title={ch.to}>
                                            {ch.to}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )
        }

        if (log.type === 'CHANGE_REQUEST') {
            const cr = log.details
            const sched = cr.class_schedules
            const reqRoom = cr.facilities?.name || 'No Room Assigned'
            const reqDayName = cr.new_day_of_week !== null ? (DAY_FULL[cr.new_day_of_week] || 'Day ' + cr.new_day_of_week) : ''
            const reqTimeText = (cr.new_start_time && cr.new_end_time) ? `${formatTime(cr.new_start_time)} - ${formatTime(cr.new_end_time)}` : ''

            const getStatusBadgeColor = (status: string) => {
                switch (status?.toLowerCase()) {
                    case 'approved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    case 'rejected': return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                }
            }

            // Diff calculations for modifications inside change request
            const crChanges: { field: string; from: string; to: string }[] = []
            if (cr.change_type === 'modify' && sched) {
                if (cr.new_course_code && cr.new_course_code !== sched.course_code) {
                    crChanges.push({ field: 'Course Code', from: sched.course_code, to: cr.new_course_code })
                }
                if (cr.new_section && cr.new_section !== sched.section) {
                    crChanges.push({ field: 'Section', from: sched.section, to: cr.new_section })
                }
                if (cr.new_instructor_name !== undefined && cr.new_instructor_name !== sched.instructor_name) {
                    crChanges.push({ field: 'Instructor', from: sched.instructor_name || 'None', to: cr.new_instructor_name || 'None' })
                }
                const schedRoom = sched.facilities?.name || 'None'
                if (cr.new_facility_id && cr.facilities?.name !== sched.facilities?.name) {
                    crChanges.push({ field: 'Room', from: schedRoom, to: reqRoom })
                }
                if (cr.new_day_of_week !== null && cr.new_day_of_week !== sched.day_of_week) {
                    crChanges.push({ 
                        field: 'Day', 
                        from: DAY_FULL[sched.day_of_week] || String(sched.day_of_week), 
                        to: reqDayName 
                    })
                }
                if ((cr.new_start_time && cr.new_start_time !== sched.start_time) || (cr.new_end_time && cr.new_end_time !== sched.end_time)) {
                    crChanges.push({ 
                        field: 'Time', 
                        from: `${formatTime(sched.start_time)} - ${formatTime(sched.end_time)}`, 
                        to: `${formatTime(cr.new_start_time)} - ${formatTime(cr.new_end_time)}` 
                    })
                }
            }

            return (
                <div className="bg-slate-100 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-xl p-4 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Change Request Details
                        </h4>
                        <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border", getStatusBadgeColor(cr.status))}>
                            {cr.status || 'Pending'}
                        </span>
                    </div>
                    
                    <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-0.5">
                                <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Request Type</span>
                                <span className="text-slate-200 font-bold uppercase tracking-wide">
                                    {cr.change_type === 'add' ? 'New Schedule Addition' : cr.change_type === 'modify' ? 'Schedule Modification' : 'Schedule Deletion/Cancel'}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Requester</span>
                                <span className="text-slate-200 font-medium block">{cr.users?.full_name || cr.requested_by}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-1 bg-black/20 p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.02]">
                            <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider mb-1">Reason for Request</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium italic block">&ldquo;{cr.reason}&rdquo;</span>
                        </div>

                        {cr.change_type === 'modify' && sched && crChanges.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Proposed Changes</span>
                                <div className="space-y-2">
                                    {crChanges.map((ch, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded bg-black/10 gap-2 border border-slate-200 dark:border-white/[0.01]">
                                            <span className="font-bold text-slate-400 uppercase text-[9px] w-20 shrink-0">{ch.field}</span>
                                            <div className="flex-1 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                <span className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/10 truncate max-w-[150px]">{ch.from}</span>
                                                <span>→</span>
                                                <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/10 truncate max-w-[150px]">{ch.to}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {cr.change_type === 'add' && (
                            <div className="space-y-2">
                                <span className="text-slate-500 block uppercase font-semibold text-[10px] tracking-wider">Proposed Schedule</span>
                                <div className="grid grid-cols-2 gap-3 bg-black/10 p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.01]">
                                    <div>
                                        <span className="text-[9px] text-slate-500 block">COURSE</span>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{cr.new_course_code} {cr.new_course_name ? `— ${cr.new_course_name}` : ''}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-slate-500 block">SECTION</span>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{cr.new_section}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-slate-500 block">ROOM</span>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{reqRoom}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-slate-500 block">SCHEDULE</span>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{reqDayName}, {reqTimeText}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
        }

        return null
    }

    return (
        <>
            <tr className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={onToggle}>
                <td className="px-5 py-3.5">
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                    {renderTypeBadge()}
                </td>
                <td className="px-5 py-3.5">
                    {renderSummary()}
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end">
                        <span className="text-xs text-ah-sti-cyan hover:underline" onClick={(e) => { e.stopPropagation(); onToggle()}}>
                            {isExpanded ? 'Hide Details' : 'View Details'}
                        </span>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-slate-100 dark:bg-white/[0.01] border-b border-slate-100 dark:border-white/5">
                    <td colSpan={5} className="px-5 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
                            {/* Visualized/Formatted Data Column */}
                            <div>
                                {renderFormattedDetails()}
                            </div>
                            
                            {/* Meta & Raw Disclosure Column */}
                            <div className="space-y-4">
                                <div className="bg-slate-100 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-xl p-4">
                                    <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3 tracking-wider">Context Information</h4>
                                    <div className="space-y-2 text-slate-700 dark:text-slate-300 text-xs">
                                        <p><span className="text-slate-500 w-24 inline-block font-semibold">Log ID:</span> <span className="font-mono bg-black/30 px-1 rounded">{log.id}</span></p>
                                        <p><span className="text-slate-500 w-24 inline-block font-semibold">Timestamp:</span> {new Date(log.timestamp).toLocaleString()}</p>
                                        <p><span className="text-slate-500 w-24 inline-block font-semibold">Action Type:</span> <span className="font-bold text-slate-200">{log.type}</span></p>
                                    </div>
                                </div>
                                
                                {log.type === 'MODIFICATION' && (
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 flex items-start gap-3">
                                        <GitCompare className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                                        <div>
                                            <div className="text-blue-400 font-bold text-xs uppercase tracking-wide mb-1">
                                                Change Summary
                                            </div>
                                            <p className="text-[11px] text-blue-200/80 leading-relaxed">
                                                Altered values are displayed side-by-side. Unchanged attributes remain unmodified in the schedule record.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Disclosure for Power Users */}
                                <div className="border border-slate-100 dark:border-white/5 rounded-xl overflow-hidden">
                                    <button 
                                        onClick={() => setShowRawJson(!showRawJson)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-white/[0.01] hover:bg-slate-100 dark:hover:bg-white/[0.03] text-xs font-semibold text-slate-400 transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5"><Code className="h-3.5 w-3.5 text-slate-500" /> Developer Raw Data (JSON)</span>
                                        {showRawJson ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                                    </button>
                                    {showRawJson && (
                                        <div className="p-3 bg-black/50 border-t border-slate-100 dark:border-white/5">
                                            <pre className="text-[10px] text-slate-400 font-mono overflow-x-auto max-w-full max-h-48 scrollbar-thin">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}

function formatTime(timeStr: string) {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr
    let hr = parseInt(parts[0], 10)
    const min = parts[1]
    const ampm = hr >= 12 ? 'PM' : 'AM'
    hr = hr % 12
    if (hr === 0) hr = 12
    return `${hr.toString().padStart(2, '0')}:${min} ${ampm}`
}

function getChangesList(original: any, modified: any) {
    const changes: { field: string; from: string; to: string }[] = []
    
    if (original.course_code !== modified.course_code) {
        changes.push({ field: 'Course Code', from: original.course_code, to: modified.course_code })
    }
    if (original.course_name !== modified.course_name) {
        changes.push({ field: 'Course Name', from: original.course_name || 'None', to: modified.course_name || 'None' })
    }
    if (original.section !== modified.section) {
        changes.push({ field: 'Section', from: original.section, to: modified.section })
    }
    if (original.instructor_name !== modified.instructor_name) {
        changes.push({ field: 'Instructor', from: original.instructor_name || 'None', to: modified.instructor_name || 'None' })
    }
    
    const origRoom = original.facilities?.name || original.room || 'None'
    const modRoom = modified.facilities?.name || modified.room || 'None'
    if (original.facility_id !== modified.facility_id || origRoom !== modRoom) {
        changes.push({ field: 'Room', from: origRoom, to: modRoom })
    }
    
    if (original.day_of_week !== modified.day_of_week) {
        changes.push({ 
            field: 'Day', 
            from: DAY_FULL[original.day_of_week] || String(original.day_of_week), 
            to: DAY_FULL[modified.day_of_week] || String(modified.day_of_week) 
        })
    }
    
    if (original.start_time !== modified.start_time || original.end_time !== modified.end_time) {
        changes.push({ 
            field: 'Time', 
            from: `${formatTime(original.start_time)} - ${formatTime(original.end_time)}`, 
            to: `${formatTime(modified.start_time)} - ${formatTime(modified.end_time)}` 
        })
    }
    
    return changes
}

