"use client"

import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { CalendarModal } from '@/components/shared/CalendarModal'
import { FacilityAvailabilityBrowser } from '../_components/FacilityAvailabilityBrowser'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Calendar, Loader2, Info } from 'lucide-react'
import { useMySchedules } from '@/hooks/shared/useMySchedules'
import { SkeletonList } from "@/components/ui/SkeletonList";


export default function FacultyCalendarPage() {
  const { reservations: bookings, loading } = useMySchedules()

  const EXCLUDED_STATUSES = new Set(['rejected', 'cancelled', 'auto_declined'])

  // Map to CalendarModal format
  const calendarReservations = bookings
    .filter(b => !EXCLUDED_STATUSES.has(b.current_status))
    .map(b => ({
      id: b.id,
      date: b.booking_date,
      facility: b.facility_name,
      time: b.start_time && b.end_time ? `${b.start_time} - ${b.end_time}` : 'Time TBD',
      status: (['auto_approved', 'approved', 'overridden', 'completed', 'paid'].includes(b.current_status)
        ? 'confirmed'
        : 'pending') as 'confirmed' | 'pending',
  }))

  return (
    <div className="faculty-calendar-page min-h-screen bg-slate-50 dark:bg-card transition-colors duration-300">
      <ConnectedTopBar title="Calendar" breadcrumbs={[{ label: 'Dashboard' }]} />

      <main className="container faculty-calendar-container mx-auto px-4 py-6 md:py-10 max-w-[1600px]">
        {/* Header Section for Mobile Clarity */}
        <div className="mb-8 block xl:hidden">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Schedule <span className="text-accent-brand">Calendar</span>
          </h1>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
            Browse availability and manage your time slots
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 items-start">
          
          {/* Left: My bookings calendar */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-none rounded-2xl overflow-hidden transition-all duration-300">
            <CardHeader className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tighter">
                    <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                      <Calendar className="w-5 h-5 text-accent-brand" />
                    </div>
                    My Reservations
                  </CardTitle>
                  <CardDescription className="text-sm font-medium text-slate-500 dark:text-slate-400 pl-1">
                    Your confirmed and pending bookings — local timezone
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-4 md:p-8">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-[350px] md:h-[500px] space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <Loader2 className="w-10 h-10 animate-spin text-accent-brand relative" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing Calendar...</p>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CalendarModal reservations={calendarReservations} inline={true} />
                </div>
              )}
              
              {/* Quick Legend for Mobile */}
              <div className="mt-6 flex items-center gap-4 px-2 py-3 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending</span>
                </div>
                <div className="ml-auto hidden sm:flex items-center gap-1 text-xs text-slate-400">
                  <Info size={12} />
                  <span>Click a date for details</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right: Facility availability browser */}
          <div className="xl:sticky xl:top-24 transition-all duration-300">
            <div className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-none rounded-2xl overflow-hidden">
               <div className="p-1"> {/* Wrapper to maintain the inner browser's styling */}
                  <FacilityAvailabilityBrowser />
               </div>
            </div>
            
            {/* Contextual Tip Card */}
            <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-500 dark:to-indigo-600 text-white shadow-lg shadow-blue-500/20 hidden xl:block">
              <h4 className="font-bold uppercase tracking-widest text-xs mb-2">Pro Tip</h4>
              <p className="text-sm text-blue-50 font-medium leading-relaxed opacity-90">
                You can browse facility availability on the right to find an open slot before starting your formal reservation request.
              </p>
            </div>
          </div>
          
        </div>
      </main>

      {/* Responsive Adjustments Helper — scoped to this page only via .faculty-calendar-page
          so it can't leak into other pages that also use Tailwind's global .container utility */}
      <style jsx global>{`
        /* Ensure the Calendar component within CalendarModal respects dark mode and fills container */
        .faculty-calendar-page .calendar-container {
          width: 100% !important;
          border-radius: 1rem !important;
        }

        @media (max-width: 768px) {
          .faculty-calendar-page .faculty-calendar-container {
            padding-left: 1rem;
            padding-right: 1rem;
          }
        }
      `}</style>
    </div>
  )
}