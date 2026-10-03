"use client"

import { useState, useEffect } from "react"
import { CalendarDays, FileText, Plus, LayoutGrid } from "lucide-react"
import { FacilityCarousel } from "./FacilityCarousel"
import { StatsCards } from "../_components/StatsCards"
import { QuickActions } from "../_components/QuickActions"
import { RecentReservations } from "../_components/RecentReservations"
import { DashboardCalendar } from "../_components/DashboardCalendar"
import { NotificationsWidget } from "../_components/NotificationsWidget"
import { PendingUploadsWidget } from "../_components/PendingUploadsWidget"
import { ConnectedTopBar } from "../_components/ConnectedTopBar"
import { DashboardReviewBanner } from "@/components/shared/facilities/DashboardReviewBanner"
import { ReportEquipmentIssue } from "@/components/equipment/ReportEquipmentIssue"
import { useProgramHeadDashboard } from "@/app/program/_hooks/useProgramHeadDashboard"

const quickActions = [
  {
    title: "New Reservation",
    description: "Book a facility for your class",
    icon: Plus,
    href: "/program/form",
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    title: "My Reservations",
    description: "View and manage your bookings",
    icon: FileText,
    href: "/program/reservations",
    color: "bg-green-500 hover:bg-green-600",
  },
  {
    title: "Check Availability",
    description: "See when rooms are free",
    icon: CalendarDays,
    href: "/program/calendar",
    color: "bg-indigo-500 hover:bg-indigo-600",
  },
  {
    title: "Schedule Management",
    description: "Upload and manage faculty schedules",
    icon: LayoutGrid,
    href: "/program/schedules/uploads",
    color: "bg-slate-700 hover:bg-slate-800",
  },
]

export default function ProgramHeadDashboard() {
  const { recentBookings, stats, notifications, facilities, pendingUploads, loading } = useProgramHeadDashboard()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-6 p-4 sm:p-8 lg:p-12">

      {/* Sticky topbar */}
      <div className="sticky top-0 z-40 -mx-4 sm:-mx-8 lg:-mx-12 -mt-4 sm:-mt-8 lg:-mt-12 mb-8">
        <ConnectedTopBar title="Dashboard" />
      </div>

      <DashboardReviewBanner reservationsPath="/program/reservations" />

      {/* Brand Header & Live Date */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Program Head <span className="text-accent-brand">Dashboard</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
            Program Operations &amp; Faculty Booking Oversight for STI College Lucena
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <ReportEquipmentIssue className="h-11" />
          <div className="flex items-center gap-4 bg-card px-5 py-3 rounded-2xl border border-border w-fit shadow-sm">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </div>
            <span className="text-xxs font-black uppercase tracking-wider text-foreground">
              LIVE: {now.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <StatsCards stats={stats} />

      {/* Body — left (2/3) + right (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="h-64 rounded-3xl bg-muted animate-pulse border border-border" />
          ) : (
            <FacilityCarousel facilities={facilities} />
          )}
          <QuickActions actions={quickActions} />
          <RecentReservations reservations={recentBookings} />
        </div>

        <div className="space-y-6">
          <DashboardCalendar reservations={recentBookings} />
          <PendingUploadsWidget uploads={pendingUploads} />
          <NotificationsWidget notifications={notifications} />
        </div>
      </div>
    </div>
  )
}