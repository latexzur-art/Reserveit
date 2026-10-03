'use client'

import { Calendar, Clock, CalendarDays, CheckCircle, GitPullRequest, FileUp, GraduationCap } from "lucide-react"
import { StatsCard } from "@/components/admin/dashboard/StatsCard"

interface StatsCardsProps {
  stats: {
    totalReservations: number
    pendingRequests: number
    upcomingBookings: number
    activeReservations: number
    totalClasses?: number
    activeToday?: number
    pendingChangeRequests?: number
    approvedSchedules?: number
    pendingUploadsCount?: number
  }
}

const CARDS = [
  {
    key: "totalReservations" as const,
    label: "Total Reservations",
    icon: Calendar,
    subtitle: "Lifetime bookings",
    variant: "primary" as const,
    href: "/program/reservations",
  },
  {
    key: "pendingRequests" as const,
    label: "Pending Requests",
    icon: Clock,
    subtitle: "Awaiting approval",
    variant: "warning" as const,
    href: "/program/requests",
  },
  {
    key: "upcomingBookings" as const,
    label: "Upcoming Bookings",
    icon: CalendarDays,
    subtitle: "Scheduled this week",
    variant: "success" as const,
    href: "/program/calendar",
  },
  {
    key: "activeToday" as const,
    label: "Active Today",
    icon: CheckCircle,
    subtitle: "Reservations + Classes",
    variant: "default" as const,
  },
]

const XL_GRID_COLS: Record<number, string> = {
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
  7: "xl:grid-cols-7",
}

export function StatsCards({ stats }: StatsCardsProps) {
  const hasExtra = stats.pendingChangeRequests !== undefined
  const hasClasses = stats.totalClasses !== undefined
  const hasPendingUploads = (stats.pendingUploadsCount ?? 0) > 0 || stats.pendingUploadsCount !== undefined

  const extraCardCount = (hasClasses ? 1 : 0) + (hasExtra ? 1 : 0) + (hasPendingUploads ? 1 : 0)
  const xlGridColsClass = XL_GRID_COLS[4 + extraCardCount]

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${xlGridColsClass} gap-4`}>
      {CARDS.map((c) => (
        <StatsCard
          key={c.key}
          title={c.label}
          value={stats[c.key] ?? 0}
          subtitle={c.subtitle}
          icon={c.icon}
          variant={c.variant}
          href={c.href}
        />
      ))}
      {hasClasses && (
        <StatsCard
          title="Total Classes"
          value={stats.totalClasses!}
          subtitle="This academic term"
          icon={GraduationCap}
          variant="primary"
          href="/program/curriculum"
        />
      )}
      {hasExtra && (
        <StatsCard
          title="Change Requests"
          value={stats.pendingChangeRequests!}
          subtitle="Pending review"
          icon={GitPullRequest}
          variant="warning"
          href="/program/requests"
        />
      )}
      {hasPendingUploads && (
        <StatsCard
          title="Pending Uploads"
          value={stats.pendingUploadsCount!}
          subtitle="Awaiting approval"
          icon={FileUp}
          variant="destructive"
          href="/program/schedules/uploads"
        />
      )}
    </div>
  )
}
