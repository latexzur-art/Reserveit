import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, CalendarDays, CheckCircle, TrendingUp, BookOpen, GraduationCap } from "lucide-react"

interface StatsCardsProps {
  stats: {
    totalReservations: number
    pendingRequests: number
    upcomingBookings: number
    activeReservations: number
    totalClasses?: number
    activeToday?: number       // combined classes + reservations happening today
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  // If class data is available, use combined activeToday; otherwise fall back to reservation-only
  const activeTodayValue = stats.activeToday ?? stats.activeReservations

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      <Card className="group hover:shadow-lg transition-shadow relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-card-foreground">Total Reservations</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-card-foreground">{stats.totalReservations}</div>
          <p className="text-xs text-muted-foreground">
            <TrendingUp className="inline h-3 w-3 mr-1" />
            All bookings
          </p>
        </CardContent>
      </Card>

      {stats.totalClasses !== undefined && (
        <Card className="group hover:shadow-lg transition-shadow relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-card-foreground">Total Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{stats.totalClasses}</div>
            <p className="text-xs text-muted-foreground">Assigned this term</p>
          </CardContent>
        </Card>
      )}

      <Card className="group hover:shadow-lg transition-shadow relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-card-foreground">Pending Requests</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-card-foreground">{stats.pendingRequests}</div>
          <p className="text-xs text-muted-foreground">Awaiting approval</p>
        </CardContent>
      </Card>

      <Card className="group hover:shadow-lg transition-shadow relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-card-foreground">Upcoming Bookings</CardTitle>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-card-foreground">{stats.upcomingBookings}</div>
          <p className="text-xs text-muted-foreground">This week</p>
        </CardContent>
      </Card>

      <Card className="group hover:shadow-lg transition-shadow relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-card-foreground">Active Today</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-card-foreground">{activeTodayValue}</div>
          <p className="text-xs text-muted-foreground">
            {stats.totalClasses !== undefined ? 'Classes + reservations' : 'Currently in use'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}