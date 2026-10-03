'use client'
import { SkeletonList } from "@/components/ui/SkeletonList";
/**
 * Schedule Calendar View — Academic Head
 * Features:
 * - Specific "Console" style header
 * - Light Mode: Yellow accents (#FACC15)
 * - Dark Mode: Blue accents (#0072bc)
 * - Full Device Responsiveness
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRefetchOnFocus } from '@/hooks/shared/useRefetchOnFocus'
import { createClient } from '@/lib/supabase/client'
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Filter,
    Loader2,
    CalendarDays,
    RotateCcw,
    ChevronDown,
    MapPin,
    Clock,
    User,
    Info,
} from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SessionTypePill } from '@/lib/schedule/sessionType'
import {
    startOfWeek,
    addWeeks,
    addDays,
    format,
    isSameDay,
    startOfDay,
} from 'date-fns'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7AM to 7PM

type ViewMode = 'week' | '3day' | 'day'

const DEPT_COLORS: Record<string, string> = {
    'BSIT': 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-100',
    'BSCS': 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-100',
    'BSHM': 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-100',
    'BSTM': 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-100',
    'BMMA': 'bg-cyan-50 border-cyan-200 text-cyan-900 dark:bg-cyan-950/40 dark:border-cyan-900 dark:text-cyan-100',
    'BSBA': 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-100',
    'ACT': 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/40 dark:border-orange-900 dark:text-orange-100',
    'SHS': 'bg-slate-100 border-slate-200 text-slate-900 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-100',
    'GEN': 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-300',
}

interface SchoolEvent {
    id: string
    booking_date: string
    start_time: string
    end_time: string
    event_name: string
    facility_id: string
    facilities: { name: string; room_number: string } | null
}

interface LiveSchedule {
    id: string
    course_code: string
    course_name: string
    section: string
    session_type: string | null
    instructor_name: string
    day_of_week: number
    start_time: string
    end_time: string
    facility_id: string
    facilities: { name: string; room_number: string } | null
    departments: { id: string; code: string; name: string } | null
}

export default function ScheduleCalendarPage() {
    const supabase = createClient()
    const [schedules, setSchedules] = useState<LiveSchedule[]>([])
    const [loading, setLoading] = useState(true)
    const [facilityFilter, setFacilityFilter] = useState<string>('')
    const [deptFilter, setDeptFilter] = useState<string>('')
    const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([])
    const [allDepartments, setAllDepartments] = useState<{ id: string; name: string; code: string }[]>([])
    const [schoolEvents, setSchoolEvents] = useState<SchoolEvent[]>([])
    const [scheduleExceptions, setScheduleExceptions] = useState<Map<string, string>>(new Map())

    const [currentDate, setCurrentDate] = useState<Date>(new Date())
    const [viewMode, setViewMode] = useState<ViewMode>('week')
    const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null)
    const [selectedSchedule, setSelectedSchedule] = useState<LiveSchedule | null>(null)

    const { visibleDays } = useMemo(() => {
        const start = startOfDay(currentDate)
        let days: Date[]
        switch (viewMode) {
            case 'day': days = [start]; break
            case '3day': days = [start, addDays(start, 1), addDays(start, 2)]; break
            case 'week':
            default:
                const weekStart = startOfWeek(start, { weekStartsOn: 1 })
                days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))
                break
        }
        return { visibleDays: days }
    }, [currentDate, viewMode])

    useEffect(() => {
        async function loadMetadata() {
            const [facsRes, deptsRes] = await Promise.all([
                supabase.from('facilities').select('id, name').eq('is_active', true).order('name'),
                supabase.from('departments').select('id, name, code').order('name')
            ])
            setFacilities(facsRes.data ?? [])
            setAllDepartments((deptsRes.data as any) ?? [])
            const eventsRes = await fetch('/api/academic-head/schedule-events')
            if (eventsRes.ok) {
                const eventsData = await eventsRes.json()
                setSchoolEvents(eventsData.events || [])
            }
        }
        loadMetadata()
    }, [supabase])

    const loadSchedules = useCallback(async () => {
        setLoading(true)
        let query = supabase.from('class_schedules').select(`id, course_code, course_name, section, session_type, instructor_name, day_of_week, start_time, end_time, facility_id, facilities(name, room_number), departments(id, code, name)` ).eq('is_active', true).order('day_of_week').order('start_time')
        if (facilityFilter) query = query.eq('facility_id', facilityFilter)
        if (deptFilter) query = query.eq('department_id', deptFilter)
        const { data } = await query
        setSchedules((data as any) ?? [])
        setLoading(false)
    }, [supabase, facilityFilter, deptFilter])

    useEffect(() => { loadSchedules() }, [loadSchedules])
    useRefetchOnFocus(loadSchedules)

    const departments = useMemo(() => {
        return [...allDepartments].sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [allDepartments])

    const byDay = useMemo(() => {
        const map = new Map<number, LiveSchedule[]>()
        for (const s of schedules) {
            if (!map.has(s.day_of_week)) map.set(s.day_of_week, [])
            map.get(s.day_of_week)!.push(s)
        }
        return map
    }, [schedules])

    useEffect(() => {
        if (visibleDays.length === 0) return
        const dates = visibleDays.map(d => format(d, 'yyyy-MM-dd')).join(',')
        fetch(`/api/academic-head/schedule-exceptions?dates=${dates}`)
            .then(r => r.json())
            .then(data => {
                const map = new Map<string, string>()
                for (const ex of (data.exceptions ?? [])) {
                    map.set(`${ex.schedule_id}_${ex.exception_date}`, ex.reason as string)
                }
                setScheduleExceptions(map)
            }).catch(() => {})
    }, [visibleDays])

    const schoolEventsByDate = useMemo(() => {
        const map = new Map<string, SchoolEvent[]>()
        for (const e of schoolEvents) {
            const key = e.booking_date
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(e)
        }
        return map
    }, [schoolEvents])

    const legendDepts = useMemo(() => Object.entries(DEPT_COLORS), [])

    const goToPrevious = useCallback(() => setCurrentDate(prev => viewMode === 'week' ? addWeeks(prev, -1) : addDays(prev, -1)), [viewMode])
    const goToNext = useCallback(() => setCurrentDate(prev => viewMode === 'week' ? addWeeks(prev, 1) : addDays(prev, 1)), [viewMode])
    const goToToday = useCallback(() => setCurrentDate(new Date()), [])
    const isToday = isSameDay(currentDate, new Date())

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
            if (e.key === 'ArrowLeft') goToPrevious()
            if (e.key === 'ArrowRight') goToNext()
            if (e.key === 't' || e.key === 'T') goToToday()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [goToPrevious, goToNext, goToToday])

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#060A11] transition-colors duration-500">
            <div className="p-4 sm:p-6 lg:p-10 max-w-[1700px] mx-auto space-y-8">
                
                {/* Custom Console Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">SCHEDULE <span className="text-accent-brand">CALENDAR</span></h1>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
                            Live Academic Timetable &amp; Room Availability Grid
                        </p>
                    </div>

                    {/* View Controls & Status Badge */}
                    <div className="flex flex-wrap items-center gap-3">
                        {!loading && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {schedules.length} Class{schedules.length === 1 ? '' : 'es'} Active
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm backdrop-blur-md">
                            <input
                                type="date"
                                value={format(currentDate, 'yyyy-MM-dd')}
                                onChange={e => e.target.value && setCurrentDate(new Date(e.target.value))}
                                aria-label="Jump to specific date"
                                title="Jump to date"
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all"
                            />
                            <button onClick={goToPrevious} aria-label="Previous period" title="Previous (Left Arrow)" className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all">
                                <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                            </button>
                            <button onClick={goToToday} disabled={isToday} aria-label="Go to today" title="Go to today (Key: T)" className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                                isToday 
                                    ? "opacity-50 grayscale" 
                                    : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm"
                            )}>
                                Today
                            </button>
                            <button onClick={goToNext} aria-label="Next period" title="Next (Right Arrow)" className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all">
                                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                            </button>
                        </div>

                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm backdrop-blur-md">
                            {(['week', '3day', 'day'] as ViewMode[]).map(mode => (
                                <button key={mode} onClick={() => setViewMode(mode)} aria-label={`Switch to ${mode} view`} className={cn(
                                    "px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
                                    viewMode === mode 
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm" 
                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                )}>
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Filter Grid & Department Legend */}
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white/60 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm backdrop-blur-sm">
                        <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <select value={facilityFilter} onChange={e => setFacilityFilter(e.target.value)} aria-label="Filter schedules by room or facility" className="w-full pl-11 pr-10 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white appearance-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all cursor-pointer">
                                <option value="">All Rooms</option>
                                {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                        </div>

                        <div className="relative group">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} aria-label="Filter schedules by department" className="w-full pl-11 pr-10 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-900 dark:text-white appearance-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all cursor-pointer">
                                <option value="">All Departments</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                        </div>

                        {(facilityFilter || deptFilter) && (
                            <button onClick={() => { setFacilityFilter(''); setDeptFilter('') }} className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all border border-slate-200 dark:border-white/10 shadow-sm">
                                <RotateCcw className="h-4 w-4" />
                                Reset Filters
                            </button>
                        )}
                    </div>

                    {/* Department Color Legend Bar */}
                    <div className="flex flex-wrap items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <span className="text-slate-400 dark:text-slate-500 mr-1">Department Colors:</span>
                        {legendDepts.map(([code, colorClass]) => (
                            <span key={code} className={cn("px-2 py-0.5 rounded-md border text-[9px] font-bold", colorClass)}>
                                {code}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Calendar Grid Area */}
                {loading ? (
                    <SkeletonList />
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 shadow-xl overflow-hidden">
                        <div className="overflow-x-auto scrollbar-hide">
                            <div className={cn(
                                "grid min-w-[1000px] lg:min-w-full",
                                viewMode === 'day' ? "grid-cols-[80px_1fr]" : viewMode === '3day' ? "grid-cols-[80px_repeat(3,1fr)]" : "grid-cols-[80px_repeat(6,1fr)]"
                            )}>
                                {/* Time column spacer */}
                                <div className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-950 border-r border-slate-100 dark:border-white/5" />

                                {/* Header Days */}
                                {visibleDays.map(date => {
                                    const isCurrent = isSameDay(date, new Date())
                                    return (
                                        <div key={date.toISOString()} className={cn(
                                            "p-4 text-center border-b border-r border-slate-100 dark:border-white/5 transition-colors relative",
                                            isCurrent ? "bg-slate-50 dark:bg-slate-800/50" : "bg-white dark:bg-slate-900"
                                        )}>
                                            <p className={cn("text-xs font-semibold uppercase tracking-wide", isCurrent ? "text-slate-900 dark:text-white" : "text-slate-500")}>
                                                {format(date, 'EEEE')}
                                            </p>
                                            <p className={cn("text-2xl font-bold tracking-tight mt-1", isCurrent ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300")}>
                                                {format(date, 'd')}
                                            </p>
                                            {isCurrent && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-900 dark:bg-white rounded-t-full shadow-lg" />}
                                        </div>
                                    )
                                })}

                                {/* Grid Body */}
                                {HOURS.map(hour => (
                                    <div key={hour} className="contents">
                                        <div className="sticky left-0 z-20 bg-white dark:bg-slate-900 p-4 text-xs font-medium text-slate-500 text-right border-r border-b border-slate-100 dark:border-white/5">
                                            {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                                        </div>
                                        {visibleDays.map(date => {
                                            const dayEvents = (schoolEventsByDate.get(format(date, 'yyyy-MM-dd')) ?? []).filter(e => parseInt(e.start_time.split(':')[0]) === hour)
                                            const daySchedules = (byDay.get(date.getDay()) ?? []).filter(s => parseInt(s.start_time.split(':')[0]) === hour)

                                            return (
                                                <div key={`${date.toISOString()}-${hour}`} className="border-r border-b border-slate-100 dark:border-white/5 p-2 min-h-[130px] hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                                                    {dayEvents.map(e => (
                                                        <button key={e.id} onClick={() => setSelectedEvent(e)} className="w-full mb-2 p-3 bg-rose-500 text-white rounded-xl text-left hover:brightness-110 transition-all shadow-md group">
                                                            <p className="text-xs font-semibold tracking-tight truncate leading-none mb-1">Blocked: {e.event_name}</p>
                                                            <p className="text-xs font-medium opacity-90 flex items-center gap-1.5">
                                                                <Clock className="w-3 h-3" /> {e.start_time.slice(0, 5)} - {e.end_time.slice(0, 5)}
                                                            </p>
                                                        </button>
                                                    ))}

                                                    {daySchedules.map(s => {
                                                        const dateStr = format(date, 'yyyy-MM-dd')
                                                        const isSuspended = scheduleExceptions.has(`${s.id}_${dateStr}`)
                                                        return (
                                                            <div key={s.id} onClick={() => setSelectedSchedule(s)} className={cn(
                                                                "p-3 rounded-xl border transition-all cursor-pointer mb-2 group hover:border-slate-400 dark:hover:border-white/30 hover:shadow-md",
                                                                isSuspended ? "opacity-30 grayscale cursor-not-allowed" : DEPT_COLORS[s.departments?.code ?? ''] || DEPT_COLORS['GEN']
                                                            )}>
                                                                <div className="flex justify-between items-start gap-1">
                                                                    <p className="text-sm font-bold tracking-tight truncate leading-tight">{s.course_code}</p>
                                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 dark:bg-white/10 rounded-md p-0.5">
                                                                        <ChevronRight className="w-3 h-3" />
                                                                    </div>
                                                                </div>
                                                                <p className="text-xs font-medium opacity-80 mt-0.5 leading-snug line-clamp-2" title={s.course_name}>{s.course_name}</p>
                                                                <div className="flex items-center gap-1.5 mt-2">
                                                                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10">{s.section}</span>
                                                                    <SessionTypePill value={s.session_type ?? null} />
                                                                </div>
                                                                <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-white/10 space-y-1.5">
                                                                    <p className="text-xs font-medium truncate flex items-center gap-1.5 leading-none opacity-90">
                                                                        <User className="w-3 h-3 opacity-60" /> {s.instructor_name}
                                                                    </p>
                                                                    <p className="text-xs font-medium truncate flex items-center gap-1.5 leading-none opacity-90">
                                                                        <MapPin className="w-3 h-3 opacity-60" /> {s.facilities?.name}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-white/5">
                            <div className="flex flex-wrap items-center gap-4">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Program Codes:</span>
                                {legendDepts.map(([dept, color]) => (
                                    <div key={dept} className={cn("px-2.5 py-1 rounded-md text-xs font-medium border", color)}>
                                        {dept}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Event Modal */}
            <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl p-0 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-white/5">
                        <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Facility Restriction</DialogTitle>
                    </div>
                    {selectedEvent && (
                        <div className="p-6 space-y-6">
                            <div className="space-y-1.5">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedEvent.event_name}</h3>
                                <p className="text-sm font-medium text-rose-600 dark:text-rose-400">Reserved Asset</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5">
                                    <MapPin className="w-4 h-4 text-slate-500 mb-1.5" />
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedEvent.facilities?.name}</p>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5">
                                    <Clock className="w-4 h-4 text-slate-500 mb-1.5" />
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedEvent.start_time.slice(0,5)} - {selectedEvent.end_time.slice(0,5)}</p>
                                </div>
                            </div>
                            <Button onClick={() => setSelectedEvent(null)} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl font-semibold">Close</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Schedule Modal */}
            <Dialog open={!!selectedSchedule} onOpenChange={(open) => !open && setSelectedSchedule(null)}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl p-0 overflow-hidden">
                    {selectedSchedule && (
                        <>
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                                <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Session Details</DialogTitle>
                                <span className={cn("px-2.5 py-1 rounded-md text-xs font-semibold border", DEPT_COLORS[selectedSchedule.departments?.code ?? ''] || "bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300")}>{selectedSchedule.departments?.code ?? 'GEN'}</span>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1.5">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedSchedule.course_code} • {selectedSchedule.section}</h3>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-snug">{selectedSchedule.course_name}</p>
                                </div>
                                <div className="space-y-2">
                                    {[
                                        { icon: User, label: "Instructor", val: selectedSchedule.instructor_name },
                                        { icon: Clock, label: "Time Slot", val: `${DAY_NAMES[selectedSchedule.day_of_week]}, ${selectedSchedule.start_time.slice(0,5)} - ${selectedSchedule.end_time.slice(0,5)}` },
                                        { icon: MapPin, label: "Venue", val: selectedSchedule.facilities?.name }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5">
                                            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-white/10">
                                                <item.icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.val}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button onClick={() => setSelectedSchedule(null)} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl font-semibold">Close Details</Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}