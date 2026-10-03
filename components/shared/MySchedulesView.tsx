"use client"

import { useState, useMemo } from 'react'
import {
  BookOpen, Filter, List, CalendarDays, GraduationCap,
  Clock, ChevronLeft, ChevronRight, X, Layers, User, MapPin, AlertTriangle
} from 'lucide-react'
import { useMySchedules, type ScheduleEvent } from '@/hooks/shared/useMySchedules'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { addDays, startOfWeek, format, isSameDay, differenceInWeeks, startOfMonth } from 'date-fns'
import { cn } from '@/lib/utils'
import { ReportScheduleIssueDialog } from '@/components/schedule/ReportScheduleIssueDialog'
import { bookingStatusLabel } from '@/lib/enum-labels'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const PASTEL_PALETTE = [
  { bg: 'bg-emerald-500/10 dark:bg-emerald-900/25', border: 'border-emerald-500/30 dark:border-emerald-700/50', text: 'text-emerald-900 dark:text-emerald-200' },
  { bg: 'bg-sky-500/10 dark:bg-sky-900/25', border: 'border-sky-500/30 dark:border-sky-700/50', text: 'text-sky-900 dark:text-sky-200' },
  { bg: 'bg-purple-500/10 dark:bg-purple-900/25', border: 'border-purple-500/30 dark:border-purple-700/50', text: 'text-purple-900 dark:text-purple-200' },
  { bg: 'bg-amber-500/10 dark:bg-amber-900/25', border: 'border-amber-500/30 dark:border-amber-700/50', text: 'text-amber-900 dark:text-amber-200' },
  { bg: 'bg-rose-500/10 dark:bg-rose-900/25', border: 'border-rose-500/30 dark:border-rose-700/50', text: 'text-rose-900 dark:text-rose-200' },
  { bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-900/25', border: 'border-fuchsia-500/30 dark:border-fuchsia-700/50', text: 'text-fuchsia-900 dark:text-fuchsia-200' },
  { bg: 'bg-lime-500/10 dark:bg-lime-900/25', border: 'border-lime-500/30 dark:border-lime-700/50', text: 'text-lime-900 dark:text-lime-200' },
  { bg: 'bg-cyan-500/10 dark:bg-cyan-900/25', border: 'border-cyan-500/30 dark:border-cyan-700/50', text: 'text-cyan-900 dark:text-cyan-200' },
]

const RES_CARD = {
  bg: 'bg-orange-500/10 dark:bg-orange-900/25',
  border: 'border-orange-500/40 dark:border-orange-600/60 border-dashed',
  text: 'text-orange-900 dark:text-orange-200',
}

function getPastel(i: number) { return PASTEL_PALETTE[i % PASTEL_PALETTE.length] }

const STI_COURSE_MAP: Record<string, string> = {
  CITE1004: 'Data Structures & Algorithms',
  CITE1003: 'Computer Programming 2',
  COSC1003: 'Object-Oriented Programming',
  COSC1001: 'Introduction to Computing',
  COSC1006: 'Discrete Mathematics',
  GEDC1002: 'World Literature',
  GEDC1006: 'Readings in Philippine History',
  GEDC1016: 'Art Appreciation',
  GEDC1014: 'Ethics',
  GEDC1008: 'Purposive Communication',
  STIC1002: 'STI Corporate Culture & Values',
  PHED1007: 'Physical Fitness & Self-Defense',
  PHED1005: 'Rhythmic Activities',
  NSTP1008: 'National Service Training Program 2',
  CITE1010: 'Database Management Systems 1',
}

function getCourseDisplayName(code?: string, name?: string): string {
  if (name && name !== code) return name
  if (code && STI_COURSE_MAP[code]) return STI_COURSE_MAP[code]
  return name || code || 'Unspecified Course'
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function fmtAmPm(t: string) {
  const [hStr, mStr] = t.split(':')
  let h = parseInt(hStr); const m = mStr ?? '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12; else if (h > 12) h -= 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}

function getMonthOptions() {
  const options = []
  const now = new Date()
  const start = startOfMonth(addDays(now, -365 / 2)) // ~6 months ago
  for (let i = 0; i < 12; i++) {
    const d = addDays(start, i * 31) // approx
    const date = startOfMonth(d)
    options.push({
      label: format(date, 'MMMM yyyy'),
      value: format(date, 'yyyy-MM'),
      date
    })
  }
  return options.filter((v, i, a) => a.findIndex(t => t.value === v.value) === i)
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */
const STAT_ICON_BG: Record<string, string> = {
  'bg-blue-500': 'bg-primary/10 text-primary',
  'bg-indigo-500': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  'bg-emerald-500': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'bg-violet-500': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number | string; sub?: string; color: string
}) {
  const iconBg = STAT_ICON_BG[color] ?? 'bg-muted text-foreground'
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 group hover:border-border/80 transition-all shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-foreground tracking-tight mt-1">{value}</p>
          {sub && <p className="text-xs font-medium text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={cn("p-3 rounded-xl shrink-0 transition-transform", iconBg)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function EventDetailPanel({ event, onClose, onReport }: { event: ScheduleEvent; onClose: () => void; onReport: (event: ScheduleEvent) => void }) {
  const isClass = event.type === 'class'
  const venueLabel = [event.facility, event.room ? `Room ${event.room}` : null].filter(Boolean).join(' · ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/50">
          <span className="text-xs font-bold text-muted-foreground">
            {isClass ? 'Academic Session Details' : 'Reservation Details'}
          </span>
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Title */}
        <div className="px-6 py-4">
          <h3 className="text-xl font-bold text-foreground tracking-tight">
            {isClass
              ? `${event.courseCode}${event.section ? ` • ${event.section}` : ''}`
              : event.facility}
          </h3>
          {(isClass ? event.courseName : event.subtitle) && (
            <p className="text-xs font-medium text-muted-foreground mt-1">
              {isClass ? event.courseName : event.subtitle}
            </p>
          )}
        </div>

        {/* Info cards */}
        <div className="px-6 pb-5 space-y-3">
          {isClass && (event.departmentCode || event.department) && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background text-muted-foreground shrink-0 border border-border/50">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">Program / Department</p>
                <p className="text-xs font-semibold text-foreground truncate">
                  {event.departmentCode ? `${event.departmentCode} — ${event.department ?? ''}` : event.department}
                </p>
              </div>
            </div>
          )}

          {isClass && event.instructor && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background text-muted-foreground shrink-0 border border-border/50">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">Instructor</p>
                <p className="text-xs font-semibold text-foreground truncate">{event.instructor}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background text-muted-foreground shrink-0 border border-border/50">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">Time Slot</p>
              <p className="text-xs font-semibold text-foreground truncate">
                {event.date ? format(new Date(event.date + 'T00:00:00'), 'MMMM d, yyyy') : DAY_LABELS_FULL[event.day_of_week]}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                {event.date ? `${DAY_LABELS_FULL[event.day_of_week]} • ` : ''}{fmtAmPm(event.start_time)} – {fmtAmPm(event.end_time)}
              </p>
            </div>
          </div>

          {venueLabel && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background text-muted-foreground shrink-0 border border-border/50">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">Venue</p>
                <p className="text-xs font-semibold text-foreground truncate">{venueLabel}</p>
              </div>
            </div>
          )}

          {!isClass && event.status && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background text-muted-foreground shrink-0 border border-border/50">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                <p className="text-xs font-semibold text-foreground capitalize truncate">{bookingStatusLabel(event.status)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Report Issue */}
        <button
          onClick={() => onReport(event)}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500/10 dark:bg-amber-500/10 border-t border-border text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          Report Issue
        </button>

        {/* Dismiss button */}
        <button
          onClick={onClose}
          className="w-full px-6 py-3.5 bg-card border-t border-border text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Weekly Timetable                                                   */
/* ------------------------------------------------------------------ */
function WeeklyTimetable({
  events, weekStart, onEventClick,
}: {
  events: ScheduleEvent[]; weekStart: Date; onEventClick: (e: ScheduleEvent) => void
}) {
  const visibleDays = [1, 2, 3, 4, 5, 6]
  const today = new Date()

  // Program / Department color mapping
  const programColorMap = useMemo(() => {
    const programs = [...new Set(events.filter(e => e.type === 'class').map(e => e.departmentCode || e.department || e.courseCode?.slice(0, 4) || 'General Academic'))]
    const map = new Map<string, number>()
    programs.forEach((p, i) => map.set(p, i))
    return map
  }, [events])

  const eventsByDay = useMemo(() => {
    const map = new Map<number, ScheduleEvent[]>()
    for (const d of visibleDays) map.set(d, [])
    for (const e of events) {
      if (e.day_of_week === undefined || !map.has(e.day_of_week)) continue

      const dayDate = addDays(weekStart, e.day_of_week)
      const dayDateStr = format(dayDate, 'yyyy-MM-dd')

      if (e.type === 'reservation') {
        if (e.date !== dayDateStr) {
          continue
        }
      } else if (e.type === 'class') {
        if (e.effectiveStart && dayDateStr < e.effectiveStart) {
          continue
        }
        if (e.effectiveEnd && dayDateStr > e.effectiveEnd) {
          continue
        }
      }

      map.get(e.day_of_week)!.push(e)
    }
    for (const list of map.values()) {
      list.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
    }
    return map
  }, [events, weekStart])

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="grid grid-cols-6 bg-muted/40">
        {visibleDays.map((d, i) => {
          const dayDate = addDays(weekStart, d)
          const isToday = isSameDay(dayDate, today)
          return (
            <div
              key={d}
              className={cn(
                "flex flex-col items-center py-3.5",
                i > 0 && "border-l border-border/50",
                isToday && "bg-emerald-500/10 dark:bg-emerald-950/20"
              )}
            >
              <span className={cn(
                "text-xs font-semibold",
                isToday ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground"
              )}>
                {DAY_LABELS_FULL[d]}
              </span>
              <span className={cn(
                "text-2xl font-bold mt-0.5 leading-none",
                isToday ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
              )}>
                {format(dayDate, 'd')}
              </span>
            </div>
          )
        })}
      </div>
      <div className="border-t border-border/50" />
      <div className="grid grid-cols-6 min-h-[480px]">
        {visibleDays.map((d, i) => {
          const dayDate = addDays(weekStart, d)
          const isToday = isSameDay(dayDate, today)
          const dayEvents = eventsByDay.get(d) ?? []
          return (
            <div
              key={d}
              className={cn(
                "p-2 space-y-2",
                i > 0 && "border-l border-border/40",
                isToday && "bg-emerald-500/5 dark:bg-emerald-950/10"
              )}
            >
              {dayEvents.length === 0 ? (
                <div className="h-full min-h-[60px]" />
              ) : dayEvents.map(event => {
                const programKey = event.type === 'class' ? (event.departmentCode || event.department || event.courseCode?.slice(0, 4) || 'General Academic') : ''
                const palette = event.type === 'class' ? getPastel(programColorMap.get(programKey) ?? 0) : RES_CARD
                const heading = event.type === 'class'
                  ? getCourseDisplayName(event.courseCode, event.courseName)
                  : (event.facility || event.title)
                const sub = event.type === 'class'
                  ? [event.courseCode, event.section].filter(Boolean).join(' • ')
                  : event.subtitle
                const meta = event.type === 'class' ? event.instructor : null
                const venue = event.type === 'class'
                  ? [event.facility, event.room ? `Room ${event.room}` : null].filter(Boolean).join(' · ')
                  : event.building
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventClick({ ...event, date: format(dayDate, 'yyyy-MM-dd') })}
                    className={cn(
                      "w-full text-left rounded-xl border px-3 py-2.5 transition-all cursor-pointer hover:shadow-sm hover:scale-[1.01]",
                      palette.bg, palette.border, palette.text
                    )}
                    title={`${heading} (${programKey}) • ${fmtAmPm(event.start_time)} – ${fmtAmPm(event.end_time)}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold tracking-tight truncate leading-tight">{heading}</p>
                      {event.type === 'class' && (
                        <span className="text-[10px] font-bold opacity-80 px-1 py-0.2 rounded bg-current/10 shrink-0">
                          {programKey}
                        </span>
                      )}
                    </div>
                    {sub && <p className="text-[11px] font-semibold opacity-90 truncate leading-tight mt-0.5">{sub}</p>}
                    {meta && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <User className="w-3 h-3 opacity-70 shrink-0" />
                        <span className="text-[11px] font-medium opacity-85 truncate">{meta}</span>
                      </div>
                    )}
                    {venue && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 opacity-70 shrink-0" />
                        <span className="text-[11px] font-medium opacity-85 truncate">{venue}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-current/15">
                      <Clock className="w-3 h-3 opacity-70 shrink-0" />
                      <span className="text-[11px] font-medium tabular-nums opacity-85">{fmtAmPm(event.start_time)} – {fmtAmPm(event.end_time)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  List View                                                          */
/* ------------------------------------------------------------------ */
function ListView({ events, onEventClick }: { events: ScheduleEvent[]; onEventClick: (e: ScheduleEvent) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<number, ScheduleEvent[]>()
    for (const e of events) {
      if (!map.has(e.day_of_week)) map.set(e.day_of_week, [])
      map.get(e.day_of_week)!.push(e)
    }
    for (const [, evts] of map) evts.sort((a, b) => a.start_time.localeCompare(b.start_time))
    return new Map([...map.entries()].sort((a, b) => a[0] - b[0]))
  }, [events])

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-muted-foreground">
        <CalendarDays className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">No schedules match your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {[...grouped.entries()].map(([dow, evts]) => (
        <div key={dow}>
          <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            {DAY_LABELS_FULL[dow]}
            <span className="text-xs font-normal text-muted-foreground">({evts.length} {evts.length === 1 ? 'item' : 'items'})</span>
          </h3>
          <div className="space-y-2">
            {evts.map(event => {
              const heading = event.type === 'class'
                ? getCourseDisplayName(event.courseCode, event.courseName)
                : event.title
              const sub = event.type === 'class'
                ? [event.courseCode, event.section].filter(Boolean).join(' • ')
                : event.subtitle
              const programTag = event.type === 'class' ? (event.departmentCode || event.department) : null

              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all hover:border-primary/50 bg-card shadow-xs",
                    event.type === 'class' ? 'border-border' : 'border-border border-dashed'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-1.5 h-10 rounded-full", event.type === 'class' ? 'bg-primary' : 'bg-amber-500')} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground tracking-tight">{heading}</p>
                          {programTag && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-2 py-0">
                              {programTag}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">{sub}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-foreground">{fmtAmPm(event.start_time)} – {fmtAmPm(event.end_time)}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-0.5">{event.facility}{event.room ? ` · ${event.room}` : ''}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main View Export                                                   */
/* ------------------------------------------------------------------ */
export function MySchedulesView() {
  const data = useMySchedules()
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)
  const [reportEvent, setReportEvent] = useState<ScheduleEvent | null>(null)

  const weekStart = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 0 })
    return addDays(start, weekOffset * 7)
  }, [weekOffset])

  const monthOptions = useMemo(() => getMonthOptions(), [])

  const handleMonthChange = (val: string) => {
    data.setMonthFilter(val)
    if (val && viewMode === 'calendar') {
      const [year, month] = val.split('-').map(Number)
      const targetDate = new Date(year, month - 1, 1)
      const todayStart = startOfWeek(new Date(), { weekStartsOn: 0 })
      const targetStart = startOfWeek(targetDate, { weekStartsOn: 0 })
      const diff = differenceInWeeks(targetStart, todayStart)
      setWeekOffset(diff)
    }
  }

  const activeProgramColors = useMemo(() => {
    const classEvents = data.events.filter(e => e.type === 'class')
    const progsInEvents = [...new Set(classEvents.map(e => e.departmentCode || e.department || e.courseCode?.slice(0, 4) || 'General Academic'))]
    const deptCodes = data.departments.map(d => d.code || d.name).filter(Boolean)
    const combined = [...new Set([...deptCodes, ...progsInEvents])].sort()

    return combined.map((prog, idx) => ({
      program: prog,
      palette: getPastel(idx)
    }))
  }, [data.events, data.departments])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            All <span className="text-primary">Schedules</span>
          </h1>
          <p className="text-xs font-medium text-muted-foreground mt-1">
            Academic Program Class Schedules &amp; Facility Reservations for STI College Lucena
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={viewMode === 'calendar' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setViewMode('calendar')} 
            className="gap-1.5 text-xs font-semibold rounded-xl h-9"
          >
            <CalendarDays className="w-4 h-4" /> Calendar
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setViewMode('list')} 
            className="gap-1.5 text-xs font-semibold rounded-xl h-9"
          >
            <List className="w-4 h-4" /> List
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Total Classes" value={data.totalClasses} sub="This term" color="bg-blue-500" />
        <StatCard icon={GraduationCap} label="Courses" value={data.uniqueCourses} sub="Unique subjects" color="bg-indigo-500" />
        <StatCard icon={Clock} label="Active Today" value={data.activeToday} sub={`${data.classesToday} classes + reservations`} color="bg-emerald-500" />
        <StatCard icon={Layers} label="Departments" value={data.departments.length} sub={data.departments.map(d => d.code).join(', ') || '—'} color="bg-violet-500" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Filter Schedules</span>
          {(data.departmentFilter || data.courseFilter || data.sectionFilter || data.dayFilter || data.monthFilter) && (
            <button onClick={() => { data.setDepartmentFilter(''); data.setCourseFilter(''); data.setSectionFilter(''); data.setDayFilter(''); data.setMonthFilter('') }} className="ml-auto text-xs text-primary font-semibold hover:underline">Clear all</button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <select 
            value={data.departmentFilter} 
            onChange={e => data.setDepartmentFilter(e.target.value)} 
            className="h-10 border border-border rounded-xl px-3 text-xs font-medium bg-background text-foreground focus:ring-2 focus:ring-primary outline-none min-w-[160px]"
          >
            <option value="">All Programs / Departments</option>
            {data.departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
          </select>
          <select 
            value={data.courseFilter} 
            onChange={e => data.setCourseFilter(e.target.value)} 
            className="h-10 border border-border rounded-xl px-3 text-xs font-medium bg-background text-foreground focus:ring-2 focus:ring-primary outline-none min-w-[140px]"
          >
            <option value="">All Courses</option>
            {data.courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={data.sectionFilter} 
            onChange={e => data.setSectionFilter(e.target.value)} 
            className="h-10 border border-border rounded-xl px-3 text-xs font-medium bg-background text-foreground focus:ring-2 focus:ring-primary outline-none min-w-[130px]"
          >
            <option value="">All Sections</option>
            {data.sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select 
            value={data.dayFilter} 
            onChange={e => data.setDayFilter(e.target.value)} 
            className="h-10 border border-border rounded-xl px-3 text-xs font-medium bg-background text-foreground focus:ring-2 focus:ring-primary outline-none min-w-[120px]"
          >
            <option value="">All Days</option>
            {[1, 2, 3, 4, 5, 6, 0].map(d => <option key={d} value={String(d)}>{DAY_LABELS_FULL[d]}</option>)}
          </select>
          <select 
            value={data.monthFilter} 
            onChange={e => handleMonthChange(e.target.value)} 
            className="h-10 border border-border rounded-xl px-3 text-xs font-medium bg-background text-foreground focus:ring-2 focus:ring-primary outline-none min-w-[150px]"
          >
            <option value="">All Months</option>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <label className="h-10 flex items-center gap-2 px-3.5 rounded-xl border border-border bg-background cursor-pointer select-none transition-colors hover:bg-muted/50">
            <input type="checkbox" checked={data.showReservations} onChange={e => data.setShowReservations(e.target.checked)} className="rounded border-border accent-primary" />
            <span className="text-xs font-medium text-foreground">Show Reservations</span>
          </label>
        </div>
      </div>

      {data.loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-xs font-medium text-muted-foreground">Loading schedules…</p>
          </div>
        </div>
      ) : viewMode === 'calendar' ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o - 1)} className="rounded-xl h-9"><ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline ml-1">Previous</span></Button>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{format(addDays(weekStart, 1), 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}</p>
              {weekOffset !== 0 && <button className="text-xs font-semibold text-primary hover:underline mt-0.5" onClick={() => setWeekOffset(0)}>Back to this week</button>}
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o + 1)} className="rounded-xl h-9"><span className="hidden sm:inline mr-1">Next</span> <ChevronRight className="w-4 h-4" /></Button>
          </div>
          <WeeklyTimetable events={data.events} weekStart={weekStart} onEventClick={setSelectedEvent} />
          
          {/* Dynamic Program Color Legend */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 mt-4 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Color Legend (by Academic Program / Department)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {activeProgramColors.map(({ program, palette }) => (
                <div
                  key={program}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold",
                    palette.bg, palette.border, palette.text
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-current opacity-80" />
                  <span>{program}</span>
                </div>
              ))}
              {data.showReservations && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-orange-500/40 bg-orange-500/10 text-orange-900 dark:text-orange-200 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Facility Reservation
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <ListView events={data.events} onEventClick={setSelectedEvent} />
      )}

      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onReport={(e) => {
            setSelectedEvent(null)
            setReportEvent(e)
          }}
        />
      )}

      {reportEvent && (
        <ReportScheduleIssueDialog
          event={reportEvent}
          open={!!reportEvent}
          onOpenChange={(o) => {
            if (!o) setReportEvent(null)
          }}
        />
      )}
    </div>
  )
}
