'use client'

import { useState, useMemo } from 'react'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isSameMonth, format, addMonths, subMonths
} from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, MapPin, User, Calendar as CalendarIcon, Info } from 'lucide-react'
import type { AcademicReservationItem } from '@/hooks/academic-head/useAcademicReservations'
import { cn } from '@/lib/utils'
import { SkeletonList } from "@/components/ui/SkeletonList";
import { bookingStatusLabel } from "@/lib/enum-labels";


interface AcademicCalendarProps {
  bookings: AcademicReservationItem[]
  loading: boolean
}

// ── BRANDED DESIGN TOKENS ──
const STATUS_DOT: Record<string, string> = {
  auto_approved: 'bg-ah-sti-cyan shadow-[0_0_4px_var(--ah-sti-cyan)]',
  approved: 'bg-ah-sti-cyan shadow-[0_0_4px_var(--ah-sti-cyan)]',
  overridden: 'bg-ah-sti-cyan',
  completed: 'bg-sky-500',
  flagged: 'bg-yellow-600',
  pending: 'bg-ah-sti-yellow shadow-[0_0_4px_var(--ah-sti-yellow)]',
  pending_faculty_response: 'bg-orange-500',
  auto_declined: 'bg-red-600',
  rejected: 'bg-red-600',
  cancelled: 'bg-slate-400',
}

const STATUS_BADGE: Record<string, string> = {
  auto_approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  completed: 'bg-sky-500/10 text-sky-700 dark:text-blue-400 border-sky-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  flagged: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10',
  cancellation_proposed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
}

const STATUS_LABEL: Record<string, string> = {
  auto_approved: 'Approved', approved: 'Approved', overridden: 'Overridden',
  completed: 'Completed', flagged: 'Review', pending: 'Pending',
  pending_faculty_response: 'Action Req.',
  auto_declined: 'Declined', rejected: 'Declined', cancelled: 'Cancelled',
  cancellation_proposed: 'Cancel Proposed',
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDuration(minutes: number | null): string {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function AcademicCalendar({ bookings, loading }: AcademicCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)
  const paddedDays: (Date | null)[] = [...Array(startPad).fill(null), ...allDays]

  const byDate = useMemo(() => {
    const map = new Map<string, AcademicReservationItem[]>()
    bookings.forEach(b => {
      const existing = map.get(b.bookingDate) ?? []
      existing.push(b)
      map.set(b.bookingDate, existing)
    })
    return map
  }, [bookings])

  const today = new Date()
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
  const selectedBookings = selectedDateStr ? (byDate.get(selectedDateStr) ?? []) : []

  return (
    <div className="flex flex-col xl:flex-row gap-6">

      {/* ── CALENDAR GRID TERMINAL ── */}
      <div className="flex-1 bg-white dark:bg-[#0B0F17] rounded-[2rem] border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm">

        {/* Header/Navigation */}
        <div className="bg-[#050d36] dark:bg-[#15181E] p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 dark:bg-blue-500/10 rounded-xl">
              <CalendarIcon className="h-5 w-5 text-amber-500 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <p className="text-xs font-medium text-slate-300">Facility Schedule</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              aria-label="Previous month"
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1 text-xs font-bold text-amber-400 dark:text-blue-400 hover:text-amber-300 dark:hover:text-blue-300"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              aria-label="Next month"
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {/* Day Names */}
          <div className="grid grid-cols-7 mb-4">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="text-center text-xs font-bold text-slate-500 dark:text-slate-400 py-2">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <SkeletonList />
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {paddedDays.map((day, idx) => {
                if (!day) return <div key={`pad-${idx}`} className="aspect-square" />

                const dateStr = format(day, 'yyyy-MM-dd')
                const dayBookings = byDate.get(dateStr) ?? []
                const isToday = isSameDay(day, today)
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                const isCurrentMonth = isSameMonth(day, currentMonth)

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(day)}
                    aria-label={`${format(day, 'MMMM d, yyyy')}: ${dayBookings.length} booking${dayBookings.length === 1 ? '' : 's'}`}
                    aria-pressed={isSelected}
                    className={cn(
                      "group relative aspect-square md:min-h-[80px] p-2 rounded-2xl border transition-all flex flex-col items-center md:items-start",
                      !isCurrentMonth ? "opacity-20 pointer-events-none" : "opacity-100",
                      isSelected 
                        ? "bg-slate-500/10 dark:bg-slate-500/20 border-2 border-slate-400 dark:border-slate-300 ring-2 ring-slate-400/30 dark:ring-slate-300/30 shadow-xs z-10 scale-[1.02]" 
                        : isToday 
                        ? "bg-blue-500/5 dark:bg-blue-500/5 border-blue-500/30 dark:border-blue-500/30 ring-1 ring-blue-500/20 dark:ring-blue-500/20" 
                        : "bg-transparent border-slate-100 dark:border-white/[0.04] hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-500/5 dark:hover:bg-slate-500/5"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-bold mb-1",
                      isSelected ? "text-slate-900 dark:text-white" : "text-slate-900 dark:text-slate-200"
                    )}>
                      {format(day, 'd')}
                    </span>

                    {/* Indicator Dots */}
                    <div className="mt-auto flex flex-wrap gap-1 justify-center md:justify-start">
                      {dayBookings.slice(0, 3).map((b, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isSelected ? "bg-amber-500 dark:bg-blue-400" : (STATUS_DOT[b.status] || "bg-slate-400")
                          )}
                        />
                      ))}
                      {dayBookings.length > 3 && (
                        <span className={cn("text-xs font-bold leading-none", isSelected ? "text-amber-600 dark:text-blue-400" : "text-slate-400")}>
                          +{dayBookings.length - 3}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-x-6 gap-y-3">
            {[
              { color: 'bg-ah-sti-cyan', label: 'Approved' },
              { color: 'bg-ah-sti-yellow', label: 'Pending' },
              { color: 'bg-orange-500', label: 'Action Req' },
              { color: 'bg-red-600', label: 'Declined' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full", color)} />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── DAY DETAIL PANEL ── */}
      <div className="xl:w-[400px] flex flex-col bg-white dark:bg-[#0B0F17] rounded-[2rem] border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm h-fit">
        <div className="bg-slate-50 dark:bg-[#15181E] p-6 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Selection Required'}
            </h3>
            <div className="px-2 py-0.5 rounded-md bg-amber-500/10 dark:bg-blue-500/10 border border-amber-500/20 dark:border-blue-500/20">
              <span className="text-xs font-bold text-amber-600 dark:text-blue-400">{selectedBookings.length} Total</span>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Detailed Manifest</p>
        </div>

        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
          {!selectedDate ? (
            <div className="py-12 text-center">
              <Info className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Select date to view entries</p>
            </div>
          ) : selectedBookings.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 italic">No scheduled activities</p>
            </div>
          ) : (
            selectedBookings
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map(b => (
                <div
                  key={b.id}
                  className="group relative p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 hover:border-amber-500/30 dark:hover:border-blue-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 dark:bg-blue-500/10 text-amber-700 dark:text-blue-300 font-bold border border-amber-500/20 dark:border-blue-500/20">
                          {b.departmentCode || 'DEP'}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {b.facultyName}
                        </span>
                      </div>
                      <span className={cn(
                        "inline-block px-2 py-0.5 rounded-full text-xs font-semibold border",
                        STATUS_BADGE[b.status] || STATUS_BADGE.cancelled
                      )}>
                        {STATUS_LABEL[b.status] || bookingStatusLabel(b.status)}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-blue-400 whitespace-nowrap">
                      #{b.referenceNumber}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 border-t border-slate-100 dark:border-white/5 pt-3">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <MapPin className="h-4 w-4 text-amber-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {b.facilityName} {b.roomNumber && `· R-${b.roomNumber}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Clock className="h-4 w-4 text-amber-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {b.startTime} - {b.endTime}
                      </span>
                      {b.durationMinutes && (
                        <span className="text-xs font-medium opacity-70">({formatDuration(b.durationMinutes)})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <User className="h-4 w-4 text-amber-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{b.expectedAttendees || 0} Expected</span>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  )
}