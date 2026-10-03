"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { bookingStatusLabel } from "@/lib/enum-labels"
import type { AcademicReservationItem } from "@/hooks/academic-head/useAcademicReservations"
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Building,
  Hash,
  FileText,
  Users,
  AlertTriangle,
  Gauge,
} from "lucide-react"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  auto_approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  overridden: { label: "Overridden", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" },
  flagged: { label: "Flagged", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  pending_faculty_response: { label: "Action Required", className: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20" },
  auto_declined: { label: "Declined", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" },
  rejected: { label: "Declined", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-border" },
  cancellation_proposed: { label: "Cancellation Proposed", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" },
  completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
}

const ACTIONABLE_STATUSES = [
  "pending",
  "flagged",
  "auto_approved",
  "approved",
]

interface BookingDetailModalProps {
  booking: AcademicReservationItem | null
  open: boolean
  onClose: () => void
  onTakeAction: (booking: AcademicReservationItem) => void
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

export function BookingDetailModal({ booking, open, onClose, onTakeAction }: BookingDetailModalProps) {
  if (!booking) return null

  const canTakeAction = ACTIONABLE_STATUSES.includes(booking.status)
  const location = [
    booking.roomNumber ? `Room ${booking.roomNumber}` : null,
    booking.floorNumber ? `Floor ${booking.floorNumber}` : null,
    booking.buildingName,
  ].filter(Boolean).join(" · ")

  const statusInfo = STATUS_BADGE[booking.status] || { label: bookingStatusLabel(booking.status), className: "bg-muted text-muted-foreground border-border" }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-bold text-foreground">
              Booking Details
            </DialogTitle>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-lg text-xs font-semibold border",
                statusInfo.className
              )}
            >
              {statusInfo.label}
            </span>
          </div>
        </DialogHeader>

        <div className="divide-y divide-border">
          <div className="pb-3 space-y-1">
            <DetailRow icon={Hash} label="Reference Number" value={`#${booking.referenceNumber}`} />
            <DetailRow icon={Calendar} label="Date" value={booking.bookingDate} />
            <DetailRow
              icon={Clock}
              label="Time Slot"
              value={`${booking.startTime} - ${booking.endTime}${booking.durationMinutes ? ` (${booking.durationMinutes} min)` : ""}`}
            />
          </div>

          <div className="py-3 space-y-1">
            <DetailRow icon={MapPin} label="Facility" value={booking.facilityName} />
            <DetailRow icon={Building} label="Location" value={location} />
          </div>

          <div className="py-3 space-y-1">
            <DetailRow icon={User} label="Faculty / Requester" value={booking.facultyName} />
            {booking.facultyEmail && (
              <DetailRow icon={User} label="Email Address" value={booking.facultyEmail} />
            )}
            <DetailRow icon={Building} label="Department" value={`${booking.department}${booking.departmentCode ? ` (${booking.departmentCode})` : ""}`} />
          </div>

          <div className="py-3 space-y-1">
            <DetailRow icon={FileText} label="Booking Purpose" value={booking.purpose} />
            {booking.expectedAttendees && (
              <DetailRow icon={Users} label="Expected Attendees" value={`${booking.expectedAttendees} people`} />
            )}
            {booking.mismatchFlag && (
              <DetailRow
                icon={AlertTriangle}
                label="Mismatch Flag"
                value={<span className="text-amber-600 dark:text-amber-400 font-semibold">{booking.mismatchFlag}</span>}
              />
            )}
            {booking.decisionScore !== null && (
              <DetailRow
                icon={Gauge}
                label="AI Decision Score"
                value={`${booking.decisionScore}/100`}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} size="sm" className="h-9 px-4 text-xs font-semibold">
            Close
          </Button>
          {canTakeAction && (
            <Button
              size="sm"
              className="h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onTakeAction(booking)}
            >
              Take Action
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
