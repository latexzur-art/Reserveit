import { Building2, CalendarDays } from "lucide-react"
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

const BADGE: Record<string, string> = {
  confirmed: "bg-green-50 text-green-800 ring-1 ring-green-600/20 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
  pending: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
  completed: "bg-blue-50 text-blue-800 ring-1 ring-blue-600/20 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  declined: "bg-red-50 text-red-800 ring-1 ring-red-600/20 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
}

function formatDate(raw: string): string {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
}

export function RecentReservations({ reservations }: RecentReservationsProps) {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
      {/* Section header */}
      <div className="border-b border-slate-200 dark:border-border flex justify-between items-center px-5 pt-4 pb-3.5 shadow-sm">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 m-0 tracking-[-0.01em]">
          Recent Reservations
        </h2>
        <Link
          href="/program/reservations"
          className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:underline transition-all duration-200"
        >
          View all &rarr;
        </Link>
      </div>

      {/* Table */}
      {reservations.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm font-medium text-muted-foreground mb-2">No reservations yet</p>
          <Link
            href="/program/form"
            className="text-[13px] font-medium text-blue-600 dark:text-blue-500 no-underline"
          >
            Make a reservation &rarr;
          </Link>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-muted/50">
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-muted-foreground">Room</th>
              <th className="text-center px-6 py-3 text-[11px] font-semibold text-muted-foreground">Building</th>
              <th className="text-center px-6 py-3 text-[11px] font-semibold text-muted-foreground">Course</th>
              <th className="text-center px-6 py-3 text-[11px] font-semibold text-muted-foreground">Date &amp; time</th>
              <th className="text-right px-6 py-3 text-[11px] font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => {
              const badgeClass = BADGE[r.status] ?? BADGE.pending
              const label = r.status.charAt(0).toUpperCase() + r.status.slice(1)
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 dark:border-border hover:bg-slate-50 dark:hover:bg-muted/30"
                >
                  <td className="text-left px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Building2 className="w-[18px] h-[18px] text-slate-900 dark:text-slate-100" strokeWidth={1.75} />
                      </div>
                      <span className="text-sm font-medium text-foreground">{r.facility}</span>
                    </div>
                  </td>
                  <td className="text-center px-6 py-3">
                    <span className="text-[13px] text-muted-foreground">{r.building}</span>
                  </td>
                  <td className="text-center px-6 py-3">
                    {r.course_code ? (
                      <>
                        <div className="text-[13px] font-medium text-foreground">{r.course_code} — {r.course_name}</div>
                        {r.is_elective && <div className="text-xs text-muted-foreground">Elective: {r.elective_type}</div>}
                      </>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-center px-6 py-3">
                    <div className="text-[13px] font-medium text-foreground mb-[3px]">{formatDate(r.date)}</div>
                    <div className="text-xs text-muted-foreground">{r.time}</div>
                  </td>
                  <td className="text-right px-6 py-3">
                    <span className={`inline-block text-[11px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap ${badgeClass}`}>
                      {label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
