import { CalendarRange } from "lucide-react"
import { CalendarModal } from './CalendarModal'

interface Reservation {
  id: string
  facility: string
  date: string
  time: string
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'declined'
  building: string
}

interface DashboardCalendarProps {
  reservations: Reservation[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  classes?: any[]
}

export function DashboardCalendar({ reservations, classes = [] }: DashboardCalendarProps) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarRange size={16} strokeWidth={1.75} className="text-slate-800 dark:text-slate-200" />
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 m-0 tracking-[-0.01em]">
            Calendar
          </h2>
        </div>
      </div>

      {/* Calendar — compact mode */}
      <div className="p-3">
        <CalendarModal 
          reservations={reservations} 
          classes={classes}
          inline={true} 
        />
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-border flex items-center gap-5">
        <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          Classes
        </span>
        <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          Reservations
        </span>
      </div>
    </div>
  )
}
