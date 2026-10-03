"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, AlertTriangle, Trash2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { TimeSlotPicker } from "@/components/ui/TimeSlotPicker"

const DAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
]

interface ScheduleSlot {
  id: string
  day: string
  startTime: string
  endTime: string
  subject: string
  courseName: string
  section: string
  instructor: string
  room: string
  facilityId?: string
}

interface Facility {
  id: string
  name: string
  room_number: string
}

type ChangeType = "modify" | "cancel" | "add"

interface ScheduleEditModalProps {
  open: boolean
  onClose: () => void
  slot: ScheduleSlot | null
  changeType: ChangeType
  defaultDay?: string // day name for "add" mode
  onSuccess: () => void
}

const DAY_NAME_TO_NUM: Record<string, string> = {
  Monday: "1", Tuesday: "2", Wednesday: "3",
  Thursday: "4", Friday: "5", Saturday: "6",
}

export function ScheduleEditModal({
  open,
  onClose,
  slot,
  changeType,
  defaultDay,
  onSuccess,
}: ScheduleEditModalProps) {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Instructors for dropdown
  const [instructors, setInstructors] = useState<{ id: string; full_name: string; department_code: string | null }[]>([])
  const [loadingInstructors, setLoadingInstructors] = useState(false)

  // Occupied slots for selected facility + day
  const [occupiedSlots, setOccupiedSlots] = useState<{ start: string; end: string; reason: string }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Section schedules for the same section + day (to detect section overlaps)
  const [sectionSlots, setSectionSlots] = useState<{ start: string; end: string; courseCode: string; id: string }[]>([])
  const [loadingSectionSlots, setLoadingSectionSlots] = useState(false)

  // Instructor schedules for the same instructor + day (to detect professor overlaps)
  const [instructorSlots, setInstructorSlots] = useState<{ start: string; end: string; courseCode: string; section: string; id: string }[]>([])
  const [loadingInstructorSlots, setLoadingInstructorSlots] = useState(false)

  // Form state
  const [courseCode, setCourseCode] = useState("")
  const [courseName, setCourseName] = useState("")
  const [section, setSection] = useState("")
  const [instructorName, setInstructorName] = useState("")
  const [dayOfWeek, setDayOfWeek] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [facilityId, setFacilityId] = useState("")
  const [roomAction, setRoomAction] = useState<"retain" | "change">("retain")
  const [reason, setReason] = useState("")

  // Original session duration (minutes) — used to auto-adjust end time on modify
  const originalDurationMins = (changeType === "modify" && slot?.startTime && slot?.endTime)
    ? (() => {
        const [sh, sm] = slot.startTime.split(":").map(Number)
        const [eh, em] = slot.endTime.split(":").map(Number)
        return (eh * 60 + em) - (sh * 60 + sm)
      })()
    : null

  const durationLabel = originalDurationMins != null && originalDurationMins > 0
    ? originalDurationMins >= 60
      ? `${Math.floor(originalDurationMins / 60)}h${originalDurationMins % 60 > 0 ? ` ${originalDurationMins % 60}m` : ""}`
      : `${originalDurationMins}m`
    : null

  // Populate form when slot changes
  useEffect(() => {
    if (changeType === "add") {
      setCourseCode("")
      setCourseName("")
      setSection("")
      setInstructorName("none")
      setDayOfWeek(defaultDay ? DAY_NAME_TO_NUM[defaultDay] ?? "" : "")
      setStartTime("")
      setEndTime("")
      setFacilityId("")
      setReason("")
    } else if (slot) {
      setCourseCode(slot.subject)
      setCourseName(slot.courseName)
      setSection(slot.section)
      setInstructorName(slot.instructor || "none")
      setDayOfWeek(DAY_NAME_TO_NUM[slot.day] ?? "")
      setStartTime(slot.startTime)
      setEndTime(slot.endTime)
      setRoomAction(slot.facilityId ? "retain" : "change")
      setFacilityId(slot.facilityId ?? "")
      setReason("")
    }
    setError(null)
  }, [slot, changeType, defaultDay, open])

  // Auto-adjust end time to preserve original duration when start time changes
  useEffect(() => {
    if (changeType !== "modify" || originalDurationMins == null || originalDurationMins <= 0) return
    if (!startTime) return
    const [sh, sm] = startTime.split(":").map(Number)
    if (isNaN(sh) || isNaN(sm)) return
    const newEndMins = sh * 60 + sm + originalDurationMins
    const newEndH = Math.floor(newEndMins / 60) % 24
    const newEndM = newEndMins % 60
    const newEnd = `${String(newEndH).padStart(2, "0")}:${String(newEndM).padStart(2, "0")}`
    setEndTime(newEnd)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime])

  // Fetch facilities for room dropdown
  useEffect(() => {
    if (!open) return
    setLoadingFacilities(true)
    fetch("/api/facilities")
      .then((r) => r.json())
      .then((data) => setFacilities(data.facilities ?? []))
      .catch(() => setFacilities([]))
      .finally(() => setLoadingFacilities(false))
  }, [open])

  // Fetch instructors for dropdown
  useEffect(() => {
    if (!open) return
    setLoadingInstructors(true)
    fetch("/api/instructors")
      .then((r) => r.json())
      .then((data) => setInstructors(data.instructors ?? []))
      .catch(() => setInstructors([]))
      .finally(() => setLoadingInstructors(false))
  }, [open])

  // Fetch occupied time slots when facility + day are selected
  useEffect(() => {
    const effectiveFacilityId = changeType === "modify" && roomAction === "retain" ? slot?.facilityId : facilityId;
    if (!open || changeType === "cancel" || !effectiveFacilityId || !dayOfWeek) {
      setOccupiedSlots([])
      return
    }
    setLoadingSlots(true)
    fetch(`/api/schedules/live?facility_id=${effectiveFacilityId}&day_of_week=${dayOfWeek}`)
      .then((r) => r.json())
      .then((data) => {
        const schedules: { id: string; start_time: string; end_time: string; course_code: string; section: string }[] = data.schedules ?? []
        const blocked = schedules
          // Exclude the schedule being modified so user can keep their own slot
          .filter((s) => !(changeType === "modify" && slot?.id && s.id === slot.id))
          .map((s) => ({
            start: s.start_time.slice(0, 5),
            end: s.end_time.slice(0, 5),
            reason: `${s.course_code} ${s.section}`,
          }))
        setOccupiedSlots(blocked)
      })
      .catch(() => setOccupiedSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [open, facilityId, dayOfWeek, changeType, slot?.id, roomAction])

  // Fetch section schedules for section overlap detection
  useEffect(() => {
    if (!open || changeType === "cancel" || !section.trim() || !dayOfWeek) {
      setSectionSlots([])
      return
    }
    setLoadingSectionSlots(true)
    fetch(`/api/schedules/live?day_of_week=${dayOfWeek}`)
      .then((r) => r.json())
      .then((data) => {
        const schedules: { id: string; start_time: string; end_time: string; course_code: string; section: string }[] = data.schedules ?? []
        const sectionNorm = section.trim().toUpperCase()
        const filtered = schedules
          .filter((s) => s.section?.toUpperCase() === sectionNorm)
          .filter((s) => !(changeType === "modify" && slot?.id && s.id === slot.id))
          .map((s) => ({
            id: s.id,
            start: s.start_time.slice(0, 5),
            end: s.end_time.slice(0, 5),
            courseCode: s.course_code,
          }))
        setSectionSlots(filtered)
      })
      .catch(() => setSectionSlots([]))
      .finally(() => setLoadingSectionSlots(false))
  }, [open, section, dayOfWeek, changeType, slot?.id])

  // Fetch instructor schedules for professor overlap detection
  useEffect(() => {
    const isAssigned = instructorName && instructorName !== "none"
    if (!open || changeType === "cancel" || !isAssigned || !dayOfWeek) {
      setInstructorSlots([])
      return
    }
    setLoadingInstructorSlots(true)
    fetch(`/api/schedules/live?day_of_week=${dayOfWeek}`)
      .then((r) => r.json())
      .then((data) => {
        const schedules: { id: string; start_time: string; end_time: string; course_code: string; section: string; instructor_name: string }[] = data.schedules ?? []
        const instNorm = instructorName.trim().toLowerCase()
        const filtered = schedules
          .filter((s) => s.instructor_name?.trim().toLowerCase() === instNorm)
          .filter((s) => !(changeType === "modify" && slot?.id && s.id === slot.id))
          .map((s) => ({
            id: s.id,
            start: s.start_time.slice(0, 5),
            end: s.end_time.slice(0, 5),
            courseCode: s.course_code,
            section: s.section,
          }))
        setInstructorSlots(filtered)
      })
      .catch(() => setInstructorSlots([]))
      .finally(() => setLoadingInstructorSlots(false))
  }, [open, instructorName, dayOfWeek, changeType, slot?.id])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for this change.")
      return
    }

    if (changeType !== "cancel") {
      if (!courseCode.trim() || !section.trim() || !dayOfWeek || !startTime || !endTime) {
        setError("Course code, section, day, start time, and end time are required.")
        return
      }
      if (startTime >= endTime) {
        setError("End time must be after start time.")
        return
      }
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, any> = {
        change_type: changeType,
        reason: reason.trim(),
      }

      if (changeType !== "add" && slot) {
        payload.original_schedule_id = slot.id
      }

      if (changeType !== "cancel") {
        payload.new_course_code = courseCode.trim()
        payload.new_course_name = courseName.trim()
        payload.new_section = section.trim()
        payload.new_instructor_name = instructorName === "none" ? "" : instructorName.trim()
        payload.new_day_of_week = parseInt(dayOfWeek)
        payload.new_start_time = startTime.length === 5 ? startTime + ":00" : startTime
        payload.new_end_time = endTime.length === 5 ? endTime + ":00" : endTime
        
        const finalFacilityId = changeType === "modify" && roomAction === "retain" ? slot?.facilityId : facilityId;
        if (finalFacilityId) payload.new_facility_id = finalFacilityId
      }

      const res = await fetch("/api/schedules/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to submit change request")
        return
      }

      onSuccess()
      onClose()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const title =
    changeType === "add"
      ? "Add New Schedule"
      : changeType === "cancel"
        ? "Cancel Schedule"
        : "Modify Schedule"

  const description =
    changeType === "cancel"
      ? "This will submit a request to remove this schedule. The academic head must approve."
      : "Changes will be submitted for academic head approval before going live."

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh] rounded-2xl border border-border/80 bg-background shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            {changeType === "cancel" && <Trash2 className="w-5 h-5 text-red-500" />}
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div 
          className="flex-1 overflow-y-auto p-6 py-4 space-y-4 custom-scrollbar"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {changeType !== "cancel" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="courseCode" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Course Code *</Label>
                  <Input
                    id="courseCode"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CS401"
                    className="h-12 rounded-2xl border-border/60 bg-card px-4 text-xs font-bold focus:ring-2 placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="section" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Section *</Label>
                  <Input
                    id="section"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. CS4A"
                    className="h-12 rounded-2xl border-border/60 bg-card px-4 text-xs font-bold focus:ring-2 placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="courseName" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Course Name</Label>
                <Input
                  id="courseName"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Software Engineering"
                  className="h-12 rounded-2xl border-border/60 bg-card px-4 text-xs font-bold focus:ring-2 placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="instructor" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Instructor</Label>
                <Select value={instructorName} onValueChange={setInstructorName}>
                  <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-card px-4 text-xs font-bold focus:ring-2 focus-visible:ring-0">
                    <SelectValue placeholder={loadingInstructors ? "Loading..." : "Select instructor"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/40 shadow-2xl max-h-[300px]">
                    <SelectItem value="none" className="rounded-xl text-xs font-bold mb-0.5 last:mb-0 text-muted-foreground">
                      No Instructor (Unassigned)
                    </SelectItem>
                    {instructors.map((inst) => (
                      <SelectItem key={inst.id} value={inst.full_name} className="rounded-xl text-xs font-bold mb-0.5 last:mb-0">
                        {inst.full_name} {inst.department_code ? `(${inst.department_code})` : ''}
                      </SelectItem>
                    ))}
                    {instructorName && instructorName !== "none" && !instructors.some((i) => i.full_name === instructorName) && (
                      <SelectItem value={instructorName} className="rounded-xl text-xs font-bold mb-0.5 last:mb-0">
                        {instructorName} (Current)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Day of Week *</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-card px-4 text-xs font-bold focus:ring-2 focus-visible:ring-0">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value} className="rounded-xl text-xs font-bold mb-0.5 last:mb-0">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    // Combine all known conflicts so they appear as struck-out in the time picker dropdown
                    const allBlockedRanges = [
                      ...occupiedSlots,
                      ...sectionSlots.map(s => ({ start: s.start, end: s.end, reason: `Section busy (${s.courseCode})` })),
                      ...instructorSlots.map(s => ({ start: s.start, end: s.end, reason: `Instructor busy (${s.courseCode})` })),
                    ]
                    return (
                      <>
                        <TimeSlotPicker
                          displayAs="dropdown"
                          value={startTime}
                          onChange={setStartTime}
                          blockedRanges={allBlockedRanges}
                          label="Start Time *"
                          disabled={loadingSlots || loadingSectionSlots || loadingInstructorSlots}
                        />
                        <TimeSlotPicker
                          displayAs="dropdown"
                          value={endTime}
                          onChange={setEndTime}
                          blockedRanges={allBlockedRanges}
                          minTime={startTime}
                          label="End Time *"
                          disabled={loadingSlots || loadingSectionSlots || loadingInstructorSlots}
                        />
                      </>
                    )
                  })()}
                </div>
                {durationLabel && (
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Original duration: <span className="font-black text-foreground">{durationLabel}</span> — end time auto-adjusts to match.
                  </p>
                )}
              </div>

              {/* Conflict Status Panel */}
              {(() => {
                const effectiveFacilityId = changeType === "modify" && roomAction === "retain" ? slot?.facilityId : facilityId
                const hasTimeSelection = startTime && endTime && startTime < endTime
                const isLoading = loadingSlots || loadingSectionSlots || loadingInstructorSlots

                // Check room conflict: does selected time overlap any occupied slot?
                const roomConflicts = hasTimeSelection
                  ? occupiedSlots.filter((s) => startTime < s.end && endTime > s.start)
                  : []

                // Check section overlap: does selected time overlap any section slot?
                const sectionConflicts = hasTimeSelection
                  ? sectionSlots.filter((s) => startTime < s.end && endTime > s.start)
                  : []

                // Check instructor overlap: does selected time overlap professor's other classes?
                const instructorConflicts = hasTimeSelection
                  ? instructorSlots.filter((s) => startTime < s.end && endTime > s.start)
                  : []

                const hasRoomConflict = roomConflicts.length > 0
                const hasSectionConflict = sectionConflicts.length > 0
                const hasInstructorConflict = instructorConflicts.length > 0
                const allClear = hasTimeSelection && !hasRoomConflict && !hasSectionConflict && !hasInstructorConflict

                const hasAssignedInstructor = instructorName && instructorName !== "none"

                if (!effectiveFacilityId && !section.trim() && !hasAssignedInstructor) return null
                if (!dayOfWeek) return null

                return (
                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      Conflict Status
                      {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                    </div>

                    {!hasTimeSelection && !isLoading && (
                      <p className="text-[11px] text-muted-foreground font-medium">Select a start and end time to check for conflicts.</p>
                    )}

                    {hasTimeSelection && !isLoading && (
                      <div className="space-y-2">
                        {/* Overall status */}
                        {allClear && (
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-bold">No conflicts — this time slot is available.</span>
                          </div>
                        )}

                        {/* Room conflict */}
                        {effectiveFacilityId && (
                          <div className="space-y-1">
                            <div className={"flex items-center gap-2 " + (hasRoomConflict ? "text-red-500" : "text-emerald-600 dark:text-emerald-400")}>
                              {hasRoomConflict
                                ? <XCircle className="w-3.5 h-3.5 shrink-0" />
                                : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                              <span className="text-[11px] font-bold">
                                {hasRoomConflict ? "Room conflict detected" : "Room is free at this time"}
                              </span>
                            </div>
                            {hasRoomConflict && (
                              <div className="flex flex-wrap gap-1.5 pl-5">
                                {roomConflicts.map((s, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg px-2 py-0.5">
                                    {s.start} – {s.end} <span className="opacity-75">({s.reason})</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section overlap */}
                        {section.trim() && (
                          <div className="space-y-1">
                            <div className={"flex items-center gap-2 " + (hasSectionConflict ? "text-red-500" : "text-emerald-600 dark:text-emerald-400")}>
                              {hasSectionConflict
                                ? <XCircle className="w-3.5 h-3.5 shrink-0" />
                                : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                              <span className="text-[11px] font-bold">
                                {hasSectionConflict
                                  ? `Section ${section} has an overlapping class`
                                  : `Section ${section} has no overlapping classes`}
                              </span>
                            </div>
                            {hasSectionConflict && (
                              <div className="flex flex-wrap gap-1.5 pl-5">
                                {sectionConflicts.map((s, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg px-2 py-0.5">
                                    {s.start} – {s.end} <span className="opacity-75">({s.courseCode})</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Instructor overlap */}
                        {hasAssignedInstructor ? (
                          <div className="space-y-1">
                            <div className={"flex items-center gap-2 " + (hasInstructorConflict ? "text-red-500" : "text-emerald-600 dark:text-emerald-400")}>
                              {hasInstructorConflict
                                ? <XCircle className="w-3.5 h-3.5 shrink-0" />
                                : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                              <span className="text-[11px] font-bold">
                                {hasInstructorConflict
                                  ? `${instructorName} is already teaching at this time`
                                  : `${instructorName} is available at this time`}
                              </span>
                            </div>
                            {hasInstructorConflict && (
                              <div className="flex flex-wrap gap-1.5 pl-5">
                                {instructorConflicts.map((s, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg px-2 py-0.5">
                                    {s.start} – {s.end} <span className="opacity-75">({s.courseCode} {s.section})</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground/60">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-medium italic">No instructor assigned — instructor check skipped.</span>
                          </div>
                        )}

                        {/* All occupied slots (reference) */}
                        {occupiedSlots.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-border/30">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Other occupied slots (room)</p>
                            <div className="flex flex-wrap gap-1.5">
                              {occupiedSlots.map((s, i) => (
                                <span
                                  key={i}
                                  className={"inline-flex items-center gap-1 text-[10px] font-bold border rounded-lg px-2 py-0.5 " +
                                    (roomConflicts.some(r => r.start === s.start && r.end === s.end)
                                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20")}
                                >
                                  {s.start} – {s.end} <span className="opacity-75">({s.reason})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Room / Facility *</Label>
                
                {changeType === "modify" && slot?.facilityId && (
                  <div className="flex gap-2 p-1 bg-muted/40 rounded-xl border border-border/40 w-full mb-2">
                    <Button
                      type="button"
                      variant={roomAction === "retain" ? "default" : "ghost"}
                      onClick={() => setRoomAction("retain")}
                      className={cn(
                        "flex-1 h-9 text-xs font-bold rounded-lg transition-all",
                        roomAction === "retain" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Retain ({slot.room || "Current"})
                    </Button>
                    <Button
                      type="button"
                      variant={roomAction === "change" ? "default" : "ghost"}
                      onClick={() => setRoomAction("change")}
                      className={cn(
                        "flex-1 h-9 text-xs font-bold rounded-lg transition-all",
                        roomAction === "change" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Change Room
                    </Button>
                  </div>
                )}

                {(changeType === "add" || roomAction === "change" || !slot?.facilityId) && (
                  <Select value={facilityId} onValueChange={setFacilityId}>
                    <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-card px-4 text-xs font-bold focus:ring-2 focus-visible:ring-0">
                      <SelectValue placeholder={loadingFacilities ? "Loading..." : "Select room"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                      {facilities.map((f) => (
                        <SelectItem key={f.id} value={f.id} className="rounded-xl text-xs font-bold mb-0.5 last:mb-0">
                          {f.name || f.room_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}

          {/* Cancel mode: show what's being cancelled */}
          {changeType === "cancel" && slot && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-1.5 text-xs text-foreground font-semibold">
              <p><span className="text-muted-foreground font-medium block text-[9px] uppercase tracking-wider">Course</span> {slot.subject} — {slot.courseName}</p>
              <p><span className="text-muted-foreground font-medium block text-[9px] uppercase tracking-wider">Section</span> {slot.section}</p>
              <p><span className="text-muted-foreground font-medium block text-[9px] uppercase tracking-wider">Instructor</span> {slot.instructor}</p>
              <p><span className="text-muted-foreground font-medium block text-[9px] uppercase tracking-wider">Day</span> {slot.day}</p>
              <p><span className="text-muted-foreground font-medium block text-[9px] uppercase tracking-wider">Time</span> {slot.startTime} – {slot.endTime}</p>
              <p><span className="text-muted-foreground font-medium block text-[9px] uppercase tracking-wider">Room</span> {slot.room}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                changeType === "cancel"
                  ? "Why should this schedule be removed?"
                  : "Why is this change needed?"
              }
              rows={3}
              className="rounded-2xl border-border/60 bg-card p-4 text-xs font-bold focus:ring-2 placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 text-xs text-red-500 bg-red-500/10 rounded-2xl p-4 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-border/40 gap-2 bg-muted/20 shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={submitting}
            className="rounded-xl h-11 px-6 text-xs font-black uppercase tracking-wider text-foreground hover:bg-muted/80 border border-border"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            variant={changeType === "cancel" ? "destructive" : "default"}
            className={cn(
              "rounded-xl h-11 px-6 text-xs font-black uppercase tracking-wider",
              changeType !== "cancel" && "bg-sti-blue hover:bg-sti-blue/90 text-white border border-sti-blue/20"
            )}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {changeType === "cancel"
              ? "Submit Cancellation Request"
              : "Submit for Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
