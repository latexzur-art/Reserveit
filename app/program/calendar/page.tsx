"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { CalendarModal } from '../_components/CalendarModal'
import { FacilityAvailabilityBrowser } from '../_components/FacilityAvailabilityBrowser'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Calendar, BookOpen, Clock } from 'lucide-react'
import { useReservations } from '@/hooks/faculty/useReservations'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { SessionTypePill } from '@/lib/schedule/sessionType'
import { useRefetchOnFocus } from '@/hooks/shared/useRefetchOnFocus'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS = [1, 2, 3, 4, 5, 6] // Mon–Sat

export default function ProgramHeadCalendarPage() {
  const { bookings, loading } = useReservations()
  const { user } = useAuth()

  // ── Class Schedules ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [schedules, setSchedules] = useState<any[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(true)

// eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchSchedules = useCallback(() => {
    if (!user?.department?.id) return
    fetch(`/api/schedules/live?limit=500&department_id=${user.department.id}`)
      .then(r => r.json())
      .then(data => setSchedules(data.schedules ?? []))
      .catch(() => {})
      .finally(() => setSchedulesLoading(false))
  }, [user?.department?.id])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])
  // Pick up schedules published by an academic head while this page is open.
  useRefetchOnFocus(fetchSchedules)

  // Group schedules by day_of_week (Mon=1 … Sat=6)
  const schedulesByDay = useMemo(() => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<number, any[]> = {}
    WEEKDAYS.forEach(d => { map[d] = [] })
    schedules.forEach(s => {
      const day = s.day_of_week
      if (WEEKDAYS.includes(day)) map[day].push(s)
    })
    // Sort each day by start_time
    WEEKDAYS.forEach(d => {
      map[d].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    })
    return map
  }, [schedules])

  // ── My Reservations Calendar ─────────────────────────────────────────────
  const EXCLUDED_STATUSES = new Set(['rejected', 'cancelled', 'auto_declined'])
  const calendarReservations = bookings
    .filter(b => !EXCLUDED_STATUSES.has(b.current_status))
    .map(b => ({
    id: b.id,
    date: b.booking_date,
    facility: b.facility_name,
    time: `${b.start_time} - ${b.end_time}`,
    status: (['auto_approved', 'approved', 'overridden', 'completed', 'paid'].includes(b.current_status)
      ? 'confirmed'
      : 'pending') as 'confirmed' | 'pending',
  }))

  return (
    <div className="min-h-screen bg-background">
      <ConnectedTopBar title="Calendar" breadcrumbs={[{ label: 'Dashboard' }]} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Top row: reservations calendar + availability browser */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                My Reservations
              </CardTitle>
              <CardDescription>Your confirmed and pending room bookings</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-48 rounded-xl bg-muted animate-pulse border border-border" />
              ) : (
                <CalendarModal reservations={calendarReservations} inline={true} />
              )}
            </CardContent>
          </Card>

          <FacilityAvailabilityBrowser />
        </div>

        {/* Bottom: Department class schedule weekly grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              Department's Weekly Class Schedule
            </CardTitle>
            <CardDescription>
              Approved recurring class schedules for your department
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schedulesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {WEEKDAYS.map(day => (
                  <div key={day} className="space-y-2">
                    <div className="h-3 w-10 rounded bg-muted animate-pulse" />
                    <div className="h-16 rounded-lg bg-muted animate-pulse border border-border" />
                  </div>
                ))}
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-xl">
                <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No approved class schedules yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload and submit a schedule for academic head approval.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {WEEKDAYS.map(day => (
                  <div key={day} className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      {DAY_NAMES[day]}
                    </div>
                    <div className="space-y-1.5 min-h-[60px]">
                      {schedulesByDay[day].length === 0 ? (
                        <div className="text-xs text-muted-foreground/40 px-1 pt-1">—</div>
                      ) : (
                        schedulesByDay[day].map(s => (
                          <div
                            key={s.id}
                            className="rounded-lg border bg-amber-500/5 border-amber-500/20 p-2 text-xs space-y-0.5"
                          >
                            <p className="font-semibold text-foreground leading-tight truncate" title={s.course_name}>
                              {s.course_code}
                            </p>
                            <div className="flex items-center gap-1">
                              <p className="text-muted-foreground truncate">{s.section}</p>
                              <SessionTypePill value={s.session_type ?? null} />
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="w-2.5 h-2.5 shrink-0" />
                              {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                            </div>
                            {s.facilities?.name && (
                              <p className="text-[10px] text-muted-foreground truncate" title={s.facilities.name}>
                                {s.facilities.name}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
