import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Calendar, Building } from "lucide-react"
import Link from "next/link"

interface Reservation {
  id: string
  facility: string
  date: string
  time: string
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'declined'
  building: string
  course_code?: string | null
  course_name?: string | null
  is_elective?: boolean
  elective_type?: string | null
}

interface RecentReservationsProps {
  reservations: Reservation[]
}

export function RecentReservations({ reservations }: RecentReservationsProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Calendar className="w-5 h-5" />
          Recent Reservations
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Your latest facility bookings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reservations.map((reservation) => (
            <div key={reservation.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-border">
                  <Building className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm text-card-foreground">{reservation.facility}</p>
                  <p className="text-xs text-muted-foreground">{reservation.building}</p>
                  {reservation.course_code && (
                    <p className="text-xs text-muted-foreground">
                      {reservation.course_code} — {reservation.course_name}
                      {reservation.is_elective && ` (Elective: ${reservation.elective_type})`}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-card-foreground">{reservation.date}</p>
                <p className="text-xs text-muted-foreground">{reservation.time}</p>
                <Badge
                  variant="outline"
                  className={`mt-1 ${
                    reservation.status === 'confirmed'
                      ? 'bg-green-50 text-green-800 ring-1 ring-green-600/20 dark:bg-green-900 dark:text-green-200'
                      : reservation.status === 'completed'
                      ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-600/20 dark:bg-blue-900 dark:text-blue-200'
                      : reservation.status === 'cancelled'
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      : reservation.status === 'declined'
                      ? 'bg-red-50 text-red-800 ring-1 ring-red-600/20 dark:bg-red-900 dark:text-red-200'
                      : 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-600/20 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}
                >
                  {reservation.status === 'confirmed' ? 'Confirmed'
                    : reservation.status === 'completed' ? 'Completed'
                    : reservation.status === 'cancelled' ? 'Cancelled'
                    : reservation.status === 'declined' ? 'Declined'
                    : 'Pending'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <Link href="/faculty/reservations">
          <Button variant="outline" className="w-full">
            View All Reservations
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}