"use client"

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { CalendarDays, Plus, FileText, CreditCard, Clock, CheckCircle, AlertCircle, Loader2, Sparkles, ArrowRight, Zap } from 'lucide-react'
import { ConnectedClientTopBar } from '../_components/ConnectedClientTopBar'
import { DashboardReviewBanner } from '@/components/shared/facilities/DashboardReviewBanner'
import { useReservations } from '@/hooks/faculty/useReservations'
import { CalendarModal } from '@/components/shared/CalendarModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from "@/lib/utils"
import { ROUTES } from '@/lib/routes'
import { SkeletonList } from "@/components/ui/SkeletonList"

const QUICK_ACTIONS = [
  {
    title: 'New Booking',
    description: 'Reserve gymnasium or lab',
    icon: Plus,
    href: ROUTES.client.booking,
    badgeColor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
  {
    title: 'My Bookings',
    description: 'View and manage requests',
    icon: FileText,
    href: ROUTES.client.bookings,
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  {
    title: 'Calendar',
    description: 'Check reserved dates',
    icon: CalendarDays,
    href: ROUTES.client.calendar,
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  {
    title: 'Payments',
    description: 'View invoices & pay',
    icon: CreditCard,
    href: ROUTES.client.payment,
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
]

const LiveClock = React.memo(function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  if (!now) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center gap-3 bg-card border border-border/80 px-4 py-2.5 rounded-xl shadow-xs"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
      </span>
      <span className="text-xs font-semibold text-foreground tracking-wide">
        {now.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' })} | {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
})

export default function ClientDashboard() {
  const { bookings, loading } = useReservations()

  const { pending, approved, needsPayment, nextBooking, calendarReservations } = useMemo(() => {
    const pendingCount = bookings.filter(b => b.current_status === 'pending' || b.current_status === 'flagged').length
    const approvedCount = bookings.filter(b => ['approved', 'auto_approved', 'overridden'].includes(b.current_status)).length
    const paymentCount = bookings.filter(b =>
      ['approved', 'auto_approved'].includes(b.current_status) && (b as any).requires_payment
    ).length

    const sortedNext = [...bookings]
      .filter(b => ['approved', 'auto_approved', 'overridden', 'pending'].includes(b.current_status))
      .sort((a, b) => a.booking_date.localeCompare(b.booking_date))[0]

    const calRes = bookings.map(b => ({
      id: b.id,
      date: b.booking_date,
      facility: b.facility_name,
      time: `${b.start_time} - ${b.end_time}`,
      status: (['auto_approved', 'approved', 'overridden', 'completed', 'paid'].includes(b.current_status)
        ? 'confirmed'
        : 'pending') as 'confirmed' | 'pending',
    }))

    return {
      pending: pendingCount,
      approved: approvedCount,
      needsPayment: paymentCount,
      nextBooking: sortedNext,
      calendarReservations: calRes,
    }
  }, [bookings])

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ConnectedClientTopBar title="Dashboard" breadcrumbs={[]} />

      <main className="p-4 sm:p-8 max-w-[1400px] mx-auto pb-24">
        <div className="mb-6">
          <DashboardReviewBanner reservationsPath="/client/bookings" />
        </div>

        {/* Header & Live Date */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Client <span className="text-yellow-600 dark:text-yellow-400">Dashboard</span>
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              External facility rental requests and reservation overview
            </p>
          </div>

          <LiveClock />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <Card className="p-5 border-border/80 rounded-2xl shadow-xs relative overflow-hidden group">
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Pending</p>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-2xl font-bold tracking-tight text-foreground">{pending}</p>
                )}
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">Awaiting Review</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/80 rounded-2xl shadow-xs relative overflow-hidden group">
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Approved</p>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-2xl font-bold tracking-tight text-foreground">{approved}</p>
                )}
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">Total Confirmed</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/80 rounded-2xl shadow-xs relative overflow-hidden group sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Payments Due</p>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-2xl font-bold tracking-tight text-foreground">{needsPayment}</p>
                )}
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-0.5">Action Required</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Payment Warning Banner */}
        {needsPayment > 0 && (
          <div className="mb-8 flex flex-col sm:flex-row items-center justify-between bg-amber-500/10 border border-amber-500/25 rounded-2xl px-5 py-3.5">
            <div className="flex items-center gap-3 text-amber-800 dark:text-amber-300 text-xs font-semibold mb-3 sm:mb-0">
              <div className="p-1.5 bg-amber-500 rounded-lg text-white">
                <CreditCard className="w-4 h-4" />
              </div>
              <span>You have {needsPayment} payment{needsPayment > 1 ? 's' : ''} due for upcoming reservations.</span>
            </div>
            <Link href={ROUTES.client.payment}>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-5 font-semibold text-xs h-9 shadow-xs">
                Proceed to Payment <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Quick Actions + Next Booking */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-border/80 rounded-2xl shadow-xs overflow-hidden">
              <CardHeader className="p-5 border-b border-border/50">
                <CardTitle className="text-sm font-semibold text-foreground">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUICK_ACTIONS.map(action => (
                  <Link key={action.href} href={action.href}>
                    <div className="group rounded-xl p-4 border border-border/60 hover:border-primary/40 bg-card hover:bg-accent/40 transition-all duration-200 h-full flex flex-col justify-between">
                      <div className={cn("p-2 rounded-lg w-fit mb-3 border", action.badgeColor)}>
                        <action.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-xs">{action.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{action.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {nextBooking && (
              <Card className="p-6 bg-card border border-border/80 rounded-2xl shadow-xs relative overflow-hidden">
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full mb-4">
                    <span className="text-[11px] font-semibold text-yellow-600 dark:text-yellow-400">Upcoming Booking</span>
                  </div>
                  <p className="text-xl font-bold tracking-tight text-foreground mb-1">{nextBooking.facility_name}</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">{nextBooking.booking_date}</p>
                    <p>{nextBooking.start_time} – {nextBooking.end_time}</p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-border/50">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">Purpose of Request</p>
                    <p className="text-xs text-foreground/90 line-clamp-2">{nextBooking.purpose}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Mini Calendar */}
          <div className="lg:col-span-2">
            <Card className="border-border/80 rounded-2xl shadow-xs overflow-hidden h-full">
              <CardHeader className="p-5 border-b border-border/50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Your Calendar</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs text-muted-foreground font-medium">Confirmed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs text-muted-foreground font-medium">Pending</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                {loading ? (
                  <SkeletonList />
                ) : (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <CalendarModal reservations={calendarReservations} inline={true} showClasses={false} title="Facility Calendar" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}