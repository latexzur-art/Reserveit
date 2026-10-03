"use client"

import React, { useMemo } from 'react'
import Link from 'next/link'
import { ConnectedClientTopBar } from '../_components/ConnectedClientTopBar'
import { CalendarModal } from '@/components/shared/CalendarModal'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Calendar, Info } from 'lucide-react'
import { useReservations } from '@/hooks/faculty/useReservations'
import { SkeletonList } from "@/components/ui/SkeletonList"
import { ROUTES } from '@/lib/routes'

export default function ClientCalendarPage() {
  const { bookings, loading } = useReservations()

  const EXCLUDED_STATUSES = useMemo(() => new Set(['rejected', 'cancelled', 'auto_declined']), [])

  const calendarReservations = useMemo(() => {
    return bookings
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
  }, [bookings, EXCLUDED_STATUSES])

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ConnectedClientTopBar title="Calendar View" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />

      <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Schedule <span className="text-yellow-600 dark:text-yellow-400">Calendar</span>
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              View your confirmed and pending facility reservation dates
            </p>
          </div>
        </div>

        <Card className="border border-border/80 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-5 sm:p-6 border-b border-border/50 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  Facility Reservations
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Interactive monthly calendar for your facility requests
                </CardDescription>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground">Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">Pending</span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6">
            {loading ? (
              <SkeletonList />
            ) : (
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <CalendarModal reservations={calendarReservations} inline={true} showClasses={false} title="Facility Calendar" />
              </div>
            )}

            {/* Info Notice */}
            <div className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
              <Info size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-800 dark:text-yellow-300 leading-relaxed">
                Only bookings without a pending payment are shown here.
                Check the <Link href={ROUTES.client.payment} className="font-semibold underline hover:text-yellow-900 dark:hover:text-yellow-200">Payments</Link> tab if a booking is missing.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}