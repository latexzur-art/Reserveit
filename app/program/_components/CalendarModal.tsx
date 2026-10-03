'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Maximize2, Minimize2, BookOpen, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface CalendarReservation {
  id: string
  date: string
  facility: string
  time: string
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'declined'
}

interface CalendarClassSchedule {
  id: string
  course_code: string
  course_name: string
  section: string
  day_of_week: number
  start_time: string
  end_time: string
  facility: { name: string; room_number: string; building: string }
}

interface CalendarEvent {
  id: string
  type: 'class' | 'reservation'
  label: string
  time: string
  status?: string
}

interface CalendarModalProps {
  trigger?: React.ReactNode
  reservations?: CalendarReservation[]
  classes?: CalendarClassSchedule[]
  inline?: boolean
  showClasses?: boolean
  title?: string
}

const isConfirmedStatus = (status?: string) =>
  !!status && ['confirmed', 'approved', 'auto_approved', 'overridden', 'completed', 'paid'].includes(status.toLowerCase())

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function CalendarModal({
  trigger,
  reservations = [],
  classes = [],
  inline = false,
  showClasses: showClassesProp,
  title = 'Facility Calendar',
}: CalendarModalProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [timezone, setTimezone] = useState('')

  const shouldShowClasses = showClassesProp ?? (classes.length > 0)

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = getDay(monthStart)
  const emptyCells = Array.from({ length: startDayOfWeek }, (_, i) => null)
  const today = new Date()

  // Expand class schedules into date-based events for the current month view
  const allEvents = useMemo(() => {
    const events = new Map<string, CalendarEvent[]>()

    // Reservations (already date-based)
    for (const r of reservations) {
      const key = r.date
      if (!events.has(key)) events.set(key, [])
      events.get(key)!.push({
        id: r.id,
        type: 'reservation',
        label: r.facility,
        time: r.time,
        status: r.status,
      })
    }

    // Class schedules (recurring by day_of_week)
    for (const day of calendarDays) {
      const dow = getDay(day)
      const dateKey = format(day, 'yyyy-MM-dd')
      const dayClasses = classes.filter(c => c.day_of_week === dow)

      for (const c of dayClasses) {
        // Check if within effective range
        if (c.start_time) {
          if (!events.has(dateKey)) events.set(dateKey, [])
          events.get(dateKey)!.push({
            id: `${c.id}-${dateKey}`,
            type: 'class',
            label: `${c.course_code} ${c.section}`,
            time: `${c.start_time?.slice(0, 5)} - ${c.end_time?.slice(0, 5)}`,
          })
        }
      }
    }

    return events
  }, [reservations, classes, calendarDays])

  const getEventsForDate = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd')
    return allEvents.get(key) ?? []
  }

  const previousMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))

  const calendarContent = (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={previousMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-bold text-card-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          {inline && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(true)} title="Expand calendar">
              <Maximize2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-1.5 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {emptyCells.map((_, index) => (
          <div key={`empty-${index}`} className="p-1.5 min-h-[72px]" />
        ))}

        {calendarDays.map(day => {
          const dayEvents = getEventsForDate(day)
          const isToday = isSameDay(day, today)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const hasClasses = dayEvents.some(e => e.type === 'class')

          return (
            <div
              key={day.toISOString()}
              className={`
                p-1.5 min-h-[72px] border rounded-xl cursor-pointer transition-all group overflow-hidden
                ${isToday
                  ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 ring-1 ring-blue-400/30'
                  : 'border-border/60 hover:bg-muted/50 hover:border-border'}
                ${isSelected ? 'ring-2 ring-blue-500 border-blue-400 dark:border-blue-600 bg-blue-500/10 dark:bg-blue-500/15' : ''}
                ${!isCurrentMonth ? 'opacity-40' : ''}
              `}
              onClick={() => setSelectedDate(day)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-card-foreground'}`}>
                  {format(day, 'd')}
                </span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5">
                    {hasClasses && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    {dayEvents.some(e => e.type === 'reservation' && isConfirmedStatus(e.status)) && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                    {dayEvents.some(e => e.type === 'reservation' && !isConfirmedStatus(e.status)) && (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium leading-none ${
                      event.type === 'class'
                        ? 'bg-sky-100/80 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 border border-sky-200 dark:border-sky-800'
                        : isConfirmedStatus(event.status)
                          ? 'bg-blue-500/10 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-400/30 dark:border-blue-700'
                          : 'bg-amber-500/10 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 border border-dashed border-amber-400/30 dark:border-amber-700'
                    }`}
                    title={`${event.label} — ${event.time}`}
                  >
                    {event.type === 'class' ? (
                      <BookOpen className="w-2.5 h-2.5 shrink-0 text-sky-600 dark:text-sky-400" />
                    ) : (
                      <MapPin className="w-2.5 h-2.5 shrink-0 text-blue-600 dark:text-blue-400" />
                    )}
                    <span className="truncate">{event.label}</span>
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[10px] text-muted-foreground font-medium">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="border-t border-border pt-4">
          <h3 className="font-bold text-sm text-card-foreground mb-3">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>
          <div className="space-y-2">
            {getEventsForDate(selectedDate).length > 0 ? (
              getEventsForDate(selectedDate).map(event => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                    event.type === 'class'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : isConfirmedStatus(event.status)
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                        : 'bg-amber-50/60 dark:bg-amber-950/30 border border-dashed border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-6 rounded-full ${
                      event.type === 'class'
                        ? 'bg-blue-500'
                        : isConfirmedStatus(event.status)
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                    }`} />
                    <div>
                      <p className="font-medium text-sm text-card-foreground">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.time}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${
                      event.type === 'class'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200'
                        : isConfirmedStatus(event.status)
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {event.type === 'class' ? 'Class' : (event.status ?? 'Reservation')}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No events for this date</p>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-border pt-3">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border border-blue-300 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-900/20" />
            <span className="text-muted-foreground">Today</span>
          </div>
          {shouldShowClasses && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Classes</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">Reservations</span>
          </div>
        </div>
      </div>
    </div>
  )

  // Modal expansion (triggered from inline expand button)
  const expandedDialog = (
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              {title}
            </div>
            <div className="text-sm font-normal text-muted-foreground">
              Timezone: {timezone}
            </div>
          </DialogTitle>
        </DialogHeader>
        {calendarContent}
      </DialogContent>
    </Dialog>
  )

  if (inline) {
    return (
      <>
        {calendarContent}
        {expandedDialog}
      </>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <CalendarIcon className="w-4 h-4" />
            View Calendar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              {title}
            </div>
            <div className="text-sm font-normal text-muted-foreground">
              Timezone: {timezone}
            </div>
          </DialogTitle>
        </DialogHeader>
        {calendarContent}
      </DialogContent>
    </Dialog>
  )
}