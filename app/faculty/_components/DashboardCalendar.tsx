import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar as CalendarIcon } from "lucide-react"
import { CalendarModal } from '@/components/shared/CalendarModal'

interface Reservation {
  id: string
  facility: string
  date: string
  time: string
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'declined'
  building: string
}

interface ClassSchedule {
  id: string
  course_code: string
  course_name: string
  section: string
  day_of_week: number
  start_time: string
  end_time: string
  facility: { name: string; room_number: string; building: string }
}

interface DashboardCalendarProps {
  reservations: Reservation[]
  classes?: ClassSchedule[]
}

export function DashboardCalendar({ reservations, classes = [] }: DashboardCalendarProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <CalendarIcon className="w-5 h-5" />
          Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <CalendarModal reservations={reservations} classes={classes} inline={true} />
      </CardContent>
    </Card>
  )
}