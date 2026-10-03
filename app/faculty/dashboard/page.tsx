"use client"

import { useState, useEffect } from "react"
import { CalendarDays, FileText, Plus, User } from "lucide-react"
import { FacilityCarousel } from "./FacilityCarousel"
import { StatsCards } from "../_components/StatsCards"
import { QuickActions } from "../_components/QuickActions"
import { RecentReservations } from "../_components/RecentReservations"
import { DashboardCalendar } from "../_components/DashboardCalendar"
import { NotificationsWidget } from "../_components/NotificationsWidget"
import { ConnectedTopBar } from "../_components/ConnectedTopBar"
import { DashboardReviewBanner } from "@/components/shared/facilities/DashboardReviewBanner"
import { ReportEquipmentIssue } from "@/components/equipment/ReportEquipmentIssue"
import { useFacultyDashboard } from "@/hooks/faculty/useFacultyDashboard"

const quickActions = [
  {
    title: "New Reservation",
    description: "Book a facility for your class",
    icon: Plus,
    href: "/faculty/form",
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    title: "My Schedules",
    description: "View classes & reservations",
    icon: CalendarDays,
    href: "/faculty/schedules",
    color: "bg-indigo-500 hover:bg-indigo-600",
  },
  {
    title: "My Reservations",
    description: "View and manage your bookings",
    icon: FileText,
    href: "/faculty/reservations",
    color: "bg-green-500 hover:bg-green-600",
  },
  {
    title: "Update Profile",
    description: "Manage your information",
    icon: User,
    href: "/faculty/profile",
    color: "bg-orange-500 hover:bg-orange-600",
  },
]

export default function FacultyDashboard() {
  const { recentBookings, classSchedules, stats, notifications, facilities, loading } = useFacultyDashboard()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    // The "LIVE" indicator only displays a date (weekday/month/day/year), not a
    // clock time, so sub-minute precision was pure re-render churn — every child
    // in the grid below re-rendered every second for no visible change.
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40">
        <ConnectedTopBar title="Faculty Dashboard" />
      </div>

      <main className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-[#0B0E11]">
        <div className="mb-6"><DashboardReviewBanner reservationsPath="/faculty/reservations" /></div>
        {/* Brand Header & Live Date */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
              Faculty <span className="text-accent-brand">Dashboard</span>
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
              Faculty Timetable, Facility Bookings &amp; Reservation Overview
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ReportEquipmentIssue className="h-11" />
            <div className="flex items-center gap-4 bg-card px-5 py-3 rounded-2xl border border-border">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                LIVE: {now.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        <StatsCards stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {loading ? (
              <div className="h-64 rounded-2xl bg-muted animate-pulse" />
            ) : (
              <FacilityCarousel facilities={facilities} />
            )}
            <QuickActions actions={quickActions} />
            <RecentReservations reservations={recentBookings} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <DashboardCalendar reservations={recentBookings} classes={classSchedules} />
            <NotificationsWidget notifications={notifications} />
          </div>
        </div>
      </main>
    </div>
  )
}
