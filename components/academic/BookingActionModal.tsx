"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, XCircle, RefreshCw, Ban } from "lucide-react"
import type { AcademicReservationItem } from "@/hooks/academic-head/useAcademicReservations"

interface BookingActionModalProps {
  booking: AcademicReservationItem | null
  open: boolean
  onClose: () => void
  reviewBooking: (id: string, action: "approve" | "reject", reason: string) => Promise<void>
  proposeChanges: (id: string, changes: { reason: string; proposed_date?: string; proposed_start_time?: string; proposed_end_time?: string; proposed_facility_id?: string }) => Promise<void>
  cancelBooking: (id: string, reason: string) => Promise<void>
  onSuccess: () => void
}

const REVIEW_STATUSES = ["pending", "flagged"]
const PROPOSE_STATUSES = ["pending", "flagged", "auto_approved", "approved"]
const CANCEL_STATUSES = ["auto_approved", "approved", "flagged", "pending", "pending_faculty_response"]

export function BookingActionModal({
  booking,
  open,
  onClose,
  reviewBooking,
  proposeChanges,
  cancelBooking,
  onSuccess,
}: BookingActionModalProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  // Review state
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve")
  const [reviewReason, setReviewReason] = useState("")

  // Propose state
  const [proposeReason, setProposeReason] = useState("")
  const [proposedDate, setProposedDate] = useState("")
  const [proposedStartTime, setProposedStartTime] = useState("")
  const [proposedEndTime, setProposedEndTime] = useState("")
  const [proposedFacilityId, setProposedFacilityId] = useState("")
  const [facilities, setFacilities] = useState<{ id: string; name: string; room_number: string | null }[]>([])

  useEffect(() => {
    if (!open) return
    fetch('/api/facilities')
      .then(r => r.ok ? r.json() : { facilities: [] })
      .then(d => setFacilities((d.facilities ?? []).map((f: any) => ({ id: f.id, name: f.name, room_number: f.room_number }))))
      .catch(() => {})
  }, [open])

  // Cancel state
  const [cancelReason, setCancelReason] = useState("")

  if (!booking) return null

  const canReview = REVIEW_STATUSES.includes(booking.status)
  const canPropose = PROPOSE_STATUSES.includes(booking.status)
  const canCancel = CANCEL_STATUSES.includes(booking.status)

  const defaultTab = canReview ? "review" : canPropose ? "propose" : "cancel"

  function resetForm() {
    setReviewAction("approve")
    setReviewReason("")
    setProposeReason("")
    setProposedDate("")
    setProposedStartTime("")
    setProposedEndTime("")
    setProposedFacilityId("")
    setCancelReason("")
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleReview() {
    if (reviewReason.length < 10) {
      toast({ title: "Reason too short", description: "Please provide at least 10 characters.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      if (!booking?.id) return
      await reviewBooking(booking.id, reviewAction, reviewReason)
      toast({ title: "Success", description: `Booking ${reviewAction}ed successfully.` })
      handleClose()
      onSuccess()
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Action failed.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePropose() {
    if (proposeReason.length < 10) {
      toast({ title: "Reason too short", description: "Please provide at least 10 characters.", variant: "destructive" })
      return
    }
    if (!proposedDate && !proposedStartTime && !proposedEndTime) {
      toast({ title: "No changes", description: "Provide at least one proposed change.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      if (!booking?.id) return
      await proposeChanges(booking.id, {
        reason: proposeReason,
        ...(proposedDate && { proposed_date: proposedDate }),
        ...(proposedStartTime && { proposed_start_time: proposedStartTime }),
        ...(proposedEndTime && { proposed_end_time: proposedEndTime }),
        ...(proposedFacilityId && { proposed_facility_id: proposedFacilityId }),
      })
      toast({ title: "Success", description: "Changes proposed to faculty." })
      handleClose()
      onSuccess()
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Action failed.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (cancelReason.length < 20) {
      toast({ title: "Reason too short", description: "Please provide at least 20 characters.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      if (!booking?.id) return
      await cancelBooking(booking.id, cancelReason)
      toast({ title: "Success", description: "Booking cancelled." })
      handleClose()
      onSuccess()
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Action failed.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ah-sti-blue dark:text-white">
            Take Action — #{booking.referenceNumber}
          </DialogTitle>
          <p className="text-xs text-slate-500">{booking.facilityName} · {booking.bookingDate}</p>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="mt-2">
          <TabsList className="w-full">
            {canReview && <TabsTrigger value="review" className="flex-1 text-xs font-bold">Review</TabsTrigger>}
            {canPropose && <TabsTrigger value="propose" className="flex-1 text-xs font-bold">Propose Changes</TabsTrigger>}
            {canCancel && <TabsTrigger value="cancel" className="flex-1 text-xs font-bold">Cancel</TabsTrigger>}
          </TabsList>

          {canReview && (
            <TabsContent value="review" className="space-y-4 mt-4">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={reviewAction === "approve" ? "default" : "outline"}
                  onClick={() => setReviewAction("approve")}
                  className={reviewAction === "approve" ? "bg-green-600 hover:bg-green-700 text-white flex-1" : "flex-1"}
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Approve
                </Button>
                <Button
                  type="button"
                  variant={reviewAction === "reject" ? "default" : "outline"}
                  onClick={() => setReviewAction("reject")}
                  className={reviewAction === "reject" ? "bg-red-600 hover:bg-red-700 text-white flex-1" : "flex-1"}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </Button>
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-500">Reason (min 10 characters)</Label>
                <Textarea
                  value={reviewReason}
                  onChange={e => setReviewReason(e.target.value)}
                  placeholder="Provide a reason for your decision..."
                  className="mt-1 min-h-[80px]"
                />
              </div>
              <Button
                onClick={handleReview}
                disabled={submitting}
                className="w-full bg-ah-sti-blue hover:bg-ah-sti-blue/90 text-white font-bold rounded-xl h-10"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Review
              </Button>
            </TabsContent>
          )}

          {canPropose && (
            <TabsContent value="propose" className="space-y-4 mt-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Current Schedule</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-400">Date</span>
                    <p className="font-bold text-foreground">{booking.bookingDate}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400">Time</span>
                    <p className="font-bold text-foreground">{booking.startTime} – {booking.endTime}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400">Room</span>
                    <p className="font-bold text-foreground">{booking.facilityName}{booking.roomNumber ? ` (Room ${booking.roomNumber})` : ''}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400">Booked by</span>
                    <p className="font-bold text-foreground">{booking.facultyName}</p>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-500">Proposed Date</Label>
                <Input
                  type="date"
                  value={proposedDate}
                  onChange={e => setProposedDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-500">Start Time</Label>
                  <Input
                    type="time"
                    value={proposedStartTime}
                    onChange={e => setProposedStartTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-500">End Time</Label>
                  <Input
                    type="time"
                    value={proposedEndTime}
                    onChange={e => setProposedEndTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-500">Alternative Facility (optional)</Label>
                <select
                  value={proposedFacilityId}
                  onChange={e => setProposedFacilityId(e.target.value)}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">Keep current facility</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-500">Reason (min 10 characters)</Label>
                <Textarea
                  value={proposeReason}
                  onChange={e => setProposeReason(e.target.value)}
                  placeholder="Explain why you are proposing these changes..."
                  className="mt-1 min-h-[80px]"
                />
              </div>
              <Button
                onClick={handlePropose}
                disabled={submitting}
                className="w-full bg-ah-sti-cyan hover:bg-ah-sti-cyan/90 text-white font-bold rounded-xl h-10"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Propose Changes
              </Button>
            </TabsContent>
          )}

          {canCancel && (
            <TabsContent value="cancel" className="space-y-4 mt-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-xs font-bold text-red-600 dark:text-red-400">
                  This will cancel the booking and notify the faculty member.
                </p>
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-500">Reason (min 20 characters)</Label>
                <Textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Provide a detailed reason for cancellation..."
                  className="mt-1 min-h-[80px]"
                />
              </div>
              <Button
                onClick={handleCancel}
                disabled={submitting}
                variant="destructive"
                className="w-full font-bold rounded-xl h-10"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Cancel Booking
              </Button>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
