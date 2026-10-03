"use client"
import { SkeletonList } from "@/components/ui/SkeletonList";
// Trigger recompilation after clearing build cache

import { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { 
  Loader2, 
  Clock, 
  MapPin, 
  User, 
  BookOpen, 
  CalendarCheck, 
  Pencil, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  Clock3, 
  LayoutGrid, 
  List, 
  AlertTriangle 
} from "lucide-react"
import { ConnectedTopBar } from "../_components/ConnectedTopBar"
import { ScheduleEditModal } from "@/components/schedule/ScheduleEditModal"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_ABBR: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
}
const DAY_OF_WEEK_MAP: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
}

const START_HOUR = 7    // 7:00 AM
const END_HOUR = 19      // 7:00 PM
const TOTAL_HOURS = END_HOUR - START_HOUR
const HOUR_HEIGHT = 68  // pixels per hour row

interface LiveSlot {
  id: string
  day: string
  startTime: string   // raw "HH:MM"
  endTime: string     // raw "HH:MM"
  startDec: number    // decimal representation
  subject: string
  courseName: string
  section: string
  instructor: string
  room: string
  facilityId?: string
  yearLevel?: string
}

interface ChangeRequest {
  id: string
  original_schedule_id: string | null
  change_type: "modify" | "cancel" | "add"
  status: "draft" | "pending" | "approved" | "rejected" | "cancelled"
  reason: string
  new_course_code: string | null
  new_section: string | null
  review_notes: string | null
  created_at: string
}

interface ConflictDetail {
  conflictingCourse: string
  conflictingSection: string
  type: "room" | "instructor" | "section"
  detail: string
  overlapText: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(raw: string): string {
  const parts = raw.split(":")
  const h = parseInt(parts[0], 10)
  const m = parts[1] || "00"
  const suffix = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${suffix}`
}

function timeToDecimal(time: string): number {
  const parts = time.split(":")
  return parseInt(parts[0], 10) + parseInt(parts[1] || "0", 10) / 60
}

function extractYearLevel(section: string): string {
  const match = section.match(/\d/)
  if (!match) return ""
  const digit = match[0]
  switch (digit) {
    case '1': return "1st Year"
    case '2': return "2nd Year"
    case '3': return "3rd Year"
    case '4': return "4th Year"
    default: return ""
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ApprovedSchedulesPage() {
  const { user, loading: authLoading } = useAuth()
  const [slots, setSlots] = useState<LiveSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Controls list view expansion
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  // Layout views toggle state
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid")
  
  // Selected slot detail modal (for grid view)
  const [selectedSlot, setSelectedSlot] = useState<LiveSlot | null>(null)
  
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSlot, setModalSlot] = useState<LiveSlot | null>(null)
  const [modalChangeType, setModalChangeType] = useState<"modify" | "cancel" | "add">("modify")
  const [modalDefaultDay, setModalDefaultDay] = useState<string | undefined>()
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const departmentId = user?.department?.id
  const departmentName = user?.department?.name ?? "Department"

  const loadSchedules = useCallback(() => {
    if (!departmentId) return
    setLoading(true)
    fetch(`/api/schedules/live?limit=500&department_id=${departmentId}`)
      .then((r) => r.json())
      .then((data) => {
        const schedules = data.schedules ?? []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: LiveSlot[] = schedules.map((s: any) => ({
          id: s.id,
          day: DAY_OF_WEEK_MAP[s.day_of_week] ?? "Monday",
          startTime: (s.start_time ?? "").slice(0, 5),
          endTime: (s.end_time ?? "").slice(0, 5),
          startDec: timeToDecimal(s.start_time ?? "00:00"),
          subject: s.course_code || "Unknown",
          courseName: s.course_name || "",
          section: s.section || "",
          instructor: s.instructor_name || "",
          room: s.facilities?.name || s.facilities?.room_number || "",
          facilityId: s.facility_id || undefined,
          yearLevel: extractYearLevel(s.section || ""),
        }))
        setSlots(mapped)
        setError(null)
      })
      .catch(() => setError("Failed to load schedules"))
      .finally(() => setLoading(false))
  }, [departmentId])

  const loadChangeRequests = useCallback(() => {
    if (!departmentId) return
    fetch(`/api/schedules/change-requests?department_id=${departmentId}`)
      .then((r) => r.json())
      .then((data) => setChangeRequests(data.change_requests ?? []))
      .catch(() => {})
  }, [departmentId])

  useEffect(() => {
    if (authLoading) return
    loadSchedules()
    loadChangeRequests()
  }, [authLoading, loadSchedules, loadChangeRequests])

  // Pending change requests mapped by original_schedule_id
  const pendingByScheduleId = useMemo(() => {
    const map: Record<string, ChangeRequest> = {}
    for (const cr of changeRequests) {
      if (cr.status === "pending" && cr.original_schedule_id) {
        map[cr.original_schedule_id] = cr
      }
    }
    return map
  }, [changeRequests])

  // Conflict detection details map
  const conflictsMap = useMemo(() => {
    const map = new Map<string, ConflictDetail[]>()
    
    for (let i = 0; i < slots.length; i++) {
      const s1 = slots[i]
      const s1Start = s1.startDec
      const s1End = timeToDecimal(s1.endTime)
      
      for (let j = i + 1; j < slots.length; j++) {
        const s2 = slots[j]
        if (s1.day !== s2.day) continue
        
        const s2Start = s2.startDec
        const s2End = timeToDecimal(s2.endTime)
        
        // Overlap in time check
        const overlap = s1Start < s2End && s2Start < s1End
        if (!overlap) continue
        
        // Calculate overlapping time window
        const overlapStart = Math.max(s1Start, s2Start)
        const overlapEnd = Math.min(s1End, s2End)
        
        const formatDecimalTime = (dec: number): string => {
          const h = Math.floor(dec)
          const m = Math.round((dec - h) * 60)
          const suffix = h >= 12 ? "PM" : "AM"
          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
          const mStr = m === 0 ? "00" : m < 10 ? `0${m}` : m.toString()
          return `${h12}:${mStr} ${suffix}`
        }
        
        const overlapText = `${formatDecimalTime(overlapStart)} - ${formatDecimalTime(overlapEnd)}`
        
        // Check collisions (room, instructor, or section)
        const sameRoom = s1.room && s2.room && s1.room === s2.room
        const sameInstructor = s1.instructor && s2.instructor && s1.instructor === s2.instructor
        const sameSection = s1.section && s2.section && s1.section === s2.section
        
        if (sameRoom) {
          const d1: ConflictDetail = { conflictingCourse: s2.subject, conflictingSection: s2.section, type: "room", detail: s1.room, overlapText }
          const d2: ConflictDetail = { conflictingCourse: s1.subject, conflictingSection: s1.section, type: "room", detail: s1.room, overlapText }
          map.set(s1.id, [...(map.get(s1.id) || []), d1])
          map.set(s2.id, [...(map.get(s2.id) || []), d2])
        }
        if (sameInstructor) {
          const d1: ConflictDetail = { conflictingCourse: s2.subject, conflictingSection: s2.section, type: "instructor", detail: s1.instructor, overlapText }
          const d2: ConflictDetail = { conflictingCourse: s1.subject, conflictingSection: s1.section, type: "instructor", detail: s1.instructor, overlapText }
          map.set(s1.id, [...(map.get(s1.id) || []), d1])
          map.set(s2.id, [...(map.get(s2.id) || []), d2])
        }
        if (sameSection) {
          const d1: ConflictDetail = { conflictingCourse: s2.subject, conflictingSection: s2.section, type: "section", detail: s1.section, overlapText }
          const d2: ConflictDetail = { conflictingCourse: s1.subject, conflictingSection: s1.section, type: "section", detail: s1.section, overlapText }
          map.set(s1.id, [...(map.get(s1.id) || []), d1])
          map.set(s2.id, [...(map.get(s2.id) || []), d2])
        }
      }
    }
    
    return map
  }, [slots])

  // Group by day, sort by start time within each day
  const slotsByDay = useMemo(() => {
    const map: Record<string, LiveSlot[]> = {}
    DAYS.forEach((d) => { map[d] = [] })
    slots.forEach((s) => {
      if (map[s.day]) map[s.day].push(s)
    })
    DAYS.forEach((d) => {
      map[d].sort((a, b) => a.startDec - b.startDec)
    })
    return map
  }, [slots])

  // Layout positioning helper for Grid View columns (resolving side-by-side tracks)
  const positionDaySlots = useCallback((daySlots: LiveSlot[]) => {
    const sorted = [...daySlots].sort((a, b) => a.startDec - b.startDec)
    
    // Group slots into overlapping clusters
    const clusters: LiveSlot[][] = []
    sorted.forEach(slot => {
      let added = false
      for (const cluster of clusters) {
        const overlaps = cluster.some(cSlot => {
          const cStart = cSlot.startDec
          const cEnd = timeToDecimal(cSlot.endTime)
          const sStart = slot.startDec
          const sEnd = timeToDecimal(slot.endTime)
          return sStart < cEnd && cStart < sEnd
        })
        if (overlaps) {
          cluster.push(slot)
          added = true
          break
        }
      }
      if (!added) {
        clusters.push([slot])
      }
    })

    const positioned: (LiveSlot & {
      topPercent: number
      heightPercent: number
      leftPercent: number
      widthPercent: number
      isConflicting: boolean
    })[] = []

    clusters.forEach(cluster => {
      const tracks: LiveSlot[][] = []
      cluster.forEach(slot => {
        let trackIndex = -1
        for (let i = 0; i < tracks.length; i++) {
          const trackOverlaps = tracks[i].some(tSlot => {
            const tStart = tSlot.startDec
            const tEnd = timeToDecimal(tSlot.endTime)
            const sStart = slot.startDec
            const sEnd = timeToDecimal(slot.endTime)
            return sStart < tEnd && tStart < sEnd
          })
          if (!trackOverlaps) {
            trackIndex = i
            break
          }
        }
        if (trackIndex === -1) {
          tracks.push([slot])
          trackIndex = tracks.length - 1
        } else {
          tracks[trackIndex].push(slot)
        }
        
        const topPercent = ((slot.startDec - START_HOUR) / TOTAL_HOURS) * 100
        const endDec = timeToDecimal(slot.endTime)
        const heightPercent = ((endDec - slot.startDec) / TOTAL_HOURS) * 100

        positioned.push({
          ...slot,
          topPercent,
          heightPercent,
          leftPercent: trackIndex,
          widthPercent: tracks.length,
          isConflicting: conflictsMap.has(slot.id),
        })
      })
      
      // Resolve track layout percentage widths
      const clusterIds = cluster.map(s => s.id)
      const clusterPositioned = positioned.filter(p => clusterIds.includes(p.id))
      const trackCount = tracks.length
      clusterPositioned.forEach(p => {
        p.widthPercent = 100 / trackCount
        p.leftPercent = p.leftPercent * p.widthPercent
      })
    })

    return positioned
  }, [conflictsMap])

  const openEditModal = (slot: LiveSlot, type: "modify" | "cancel") => {
    setModalSlot(slot)
    setModalChangeType(type)
    setModalDefaultDay(undefined)
    setModalOpen(true)
  }

  const openAddModal = (day: string) => {
    setModalSlot(null)
    setModalChangeType("add")
    setModalDefaultDay(day)
    setModalOpen(true)
  }

  const handleModalSuccess = () => {
    setSuccessMsg("Change request submitted for academic head review.")
    loadChangeRequests()
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  // Count pending change requests
  const pendingCount = changeRequests.filter((cr) => cr.status === "pending").length

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="sticky top-0 z-40">
        <ConnectedTopBar title="Approved Schedules" breadcrumbs={[{ label: 'Dashboard' }]} />
      </div>

      {/* Header */}
      <div className="relative overflow-hidden px-8 py-8 border-b border-border/40 bg-card">
        <div className="absolute inset-0 bg-gradient-to-tr from-sti-blue/10 via-sti-blue/5 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 bg-sti-blue/10 rounded-2xl border border-sti-blue/20">
                <CalendarCheck className="w-6 h-6 text-sti-blue" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">APPROVED <span className="text-accent-brand">SCHEDULES</span></h1>
            </div>
            <p className="text-base text-muted-foreground flex items-center gap-2">
              <span className="font-medium text-foreground/80">{departmentName}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              <span>{slots.length} approved class schedule{slots.length !== 1 ? "s" : ""}</span>
              {pendingCount > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                  <span className="text-amber-500 font-semibold">{pendingCount} pending change{pendingCount !== 1 ? "s" : ""}</span>
                </>
              )}
            </p>
          </div>

          {/* Controls toggle view */}
          <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl border border-border/40 w-fit shrink-0 self-start md:self-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
                viewMode === "grid"
                  ? "bg-card text-foreground shadow-sm border border-border/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Weekly Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
                viewMode === "list"
                  ? "bg-card text-foreground shadow-sm border border-border/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-3.5 h-3.5" />
              Agenda List
            </button>
          </div>
        </div>
      </div>

      {/* Success notification */}
      {successMsg && (
        <div className="mx-8 mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center space-y-2 max-w-sm">
              <p className="font-semibold text-base">Error Loading Schedules</p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full text-center px-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 mb-6 rounded-full bg-muted flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No Approved Schedules</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              We couldn't find any approved schedules for {departmentName} yet. Upload a schedule and submit it for academic head approval.
            </p>
          </div>
        ) : viewMode === "list" ? (
          /* ──────────────── LIST / AGENDA VIEW ──────────────── */
          <div className="h-full overflow-auto p-6 md:p-8 bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
              {DAYS.map((day) => (
                <div key={day} className="flex flex-col space-y-4">
                  {/* Day header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between pb-3 border-b border-border/60 bg-background/50 backdrop-blur-md pt-2">
                    <span className="text-sm font-bold text-foreground/80 uppercase tracking-widest">
                      {DAY_ABBR[day]}
                    </span>
                    <span className="flex items-center justify-center px-2.5 py-0.5 rounded-full bg-sti-blue/10 border border-sti-blue/20 text-xs text-sti-blue font-semibold">
                      {slotsByDay[day].length}
                    </span>
                  </div>

                  {/* Schedule list items */}
                  <div className="flex flex-col gap-3 min-h-[100px] pb-4">
                    {slotsByDay[day].length === 0 ? (
                      <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-border/60 bg-background/30">
                        <span className="text-xs text-muted-foreground/50 font-medium">No classes</span>
                      </div>
                    ) : (
                      slotsByDay[day].map((slot) => {
                        const isExpanded = expandedId === slot.id
                        const pendingCR = pendingByScheduleId[slot.id]
                        const isConflicting = conflictsMap.has(slot.id)
                        return (
                          <div
                            key={slot.id}
                            onClick={() => setExpandedId(prev => prev === slot.id ? null : slot.id)}
                            className={cn(
                              "group relative flex flex-col gap-2.5 rounded-xl border p-4 transition-all duration-200 cursor-pointer bg-card",
                              isConflicting
                                ? "border-destructive/40 bg-destructive/5 hover:border-destructive/60 dark:border-destructive/30"
                                : pendingCR
                                ? "border-amber-400/60 bg-amber-500/5 hover:border-amber-400"
                                : "border-border/60 hover:border-sti-blue/50 dark:hover:border-sti-blue/30",
                              isExpanded
                                ? isConflicting
                                  ? "ring-2 ring-destructive/20 border-destructive/80"
                                  : "ring-2 ring-sti-blue/20 border-sti-blue"
                                : "hover:-translate-y-[1px]"
                            )}
                            title={isExpanded ? undefined : `${slot.subject} - ${slot.courseName}\n${slot.section}\n${slot.instructor}\n${slot.room}`}
                          >
                            <div className="flex justify-between items-start gap-3 w-full">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-foreground leading-tight">
                                  {slot.subject}
                                </p>
                                {slot.courseName && (
                                  <p className={cn(
                                    "text-[11px] font-medium text-muted-foreground mt-0.5",
                                    isExpanded ? "break-words" : "truncate"
                                  )}>
                                    {slot.courseName}
                                  </p>
                                )}
                                {slot.yearLevel && (
                                  <p className="text-[10px] text-sti-blue font-semibold mt-1 uppercase tracking-wider">
                                    {slot.yearLevel}
                                  </p>
                                )}
                              </div>
                              <span className={cn(
                                "shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset whitespace-nowrap",
                                isConflicting
                                  ? "bg-destructive/10 text-destructive ring-destructive/20"
                                  : "bg-sti-blue/10 text-sti-blue ring-sti-blue/20 dark:bg-sti-blue/20 dark:text-sti-blue-light"
                              )}>
                                {slot.section}
                              </span>
                            </div>

                            <div className="space-y-2 mt-1">
                              {/* Time section */}
                              <div className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border/40 w-fit">
                                <Clock className="w-3.5 h-3.5 text-sti-blue/80" />
                                <span className="text-foreground/80">{formatTime(slot.startTime)}</span>
                                <span className="text-muted-foreground/50">–</span>
                                <span className="text-foreground/80">{formatTime(slot.endTime)}</span>
                              </div>

                              {/* Details fields */}
                              <div className="flex flex-col gap-1.5 pt-1">
                                {slot.instructor && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground/90">
                                    <User className="w-3.5 h-3.5 shrink-0" />
                                    <span className={cn("font-medium", !isExpanded && "truncate")}>{slot.instructor}</span>
                                  </div>
                                )}
                                {slot.room && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground/90">
                                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                                    <span className={cn("font-medium", !isExpanded && "truncate")}>{slot.room}</span>
                                  </div>
                                )}
                              </div>

                              {/* Conflict Alerts */}
                              {isConflicting && conflictsMap.has(slot.id) && (
                                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] mt-2">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                                    <span>Conflicts Detected:</span>
                                  </div>
                                  <ul className="list-disc pl-4 space-y-1 mt-1 opacity-90">
                                    {conflictsMap.get(slot.id)!.map((c, idx) => (
                                      <li key={idx} className="leading-snug">
                                        <strong className="capitalize">{c.type}</strong> ({c.overlapText}):{" "}
                                        {c.type === "room" && `Room ${c.detail} is also booked by ${c.conflictingCourse} (${c.conflictingSection})`}
                                        {c.type === "instructor" && `Instructor ${c.detail} is also teaching ${c.conflictingCourse} (${c.conflictingSection})`}
                                        {c.type === "section" && `Section ${c.detail} is also scheduled for ${c.conflictingCourse} (${c.conflictingSection})`}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {pendingCR && (
                                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 w-fit mt-1">
                                  <Clock3 className="w-3 h-3" />
                                  <span>Pending {pendingCR.change_type}</span>
                                </div>
                              )}
                            </div>

                            {/* Action buttons (expanded) */}
                            {isExpanded && !pendingCR && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditModal(slot, "modify") }}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/70 hover:text-sti-blue transition-colors px-2.5 py-1.5 rounded-lg hover:bg-sti-blue/10"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditModal(slot, "cancel") }}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/70 hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}

                    {/* Add button */}
                    <button
                      onClick={() => openAddModal(day)}
                      className="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-dashed border-border/60 bg-background/30 text-xs text-muted-foreground/60 hover:text-sti-blue hover:border-sti-blue/40 hover:bg-sti-blue/5 transition-all cursor-pointer font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ──────────────── GRID TIMETABLE VIEW ──────────────── */
          <div className="h-full overflow-auto p-6 md:p-8 bg-muted/20">
            <div className="min-w-[960px] bg-card rounded-2xl border border-border shadow-sm flex flex-col h-[760px] overflow-hidden">
              {/* Grid Header row */}
              <div className="grid grid-cols-[100px_1fr] border-b border-border bg-muted/30">
                <div className="border-r border-border h-12 flex items-center justify-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Time
                </div>
                <div className="grid grid-cols-6 h-12">
                  {DAYS.map((day) => (
                    <div key={day} className="flex items-center justify-between px-4 border-r border-border last:border-r-0">
                      <span className="text-xs font-bold text-foreground/80 uppercase tracking-widest">
                        {DAY_ABBR[day]}
                      </span>
                      <span className="flex items-center justify-center px-2 py-0.5 rounded-full bg-sti-blue/10 border border-sti-blue/20 text-[10px] text-sti-blue font-semibold">
                        {slotsByDay[day].length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid Body */}
              <div className="flex-1 overflow-y-auto relative grid grid-cols-[100px_1fr]">
                {/* Hours rows column */}
                <div className="relative border-r border-border bg-muted/5">
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i).map((hour) => (
                    <div 
                      key={hour} 
                      className="border-b border-border/40 relative flex items-start justify-center pt-2 text-[10px] font-bold text-muted-foreground/80"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    >
                      {formatTime(`${hour}:00`)}
                    </div>
                  ))}
                </div>

                {/* Main grid background / items container */}
                <div className="relative h-[816px] grid grid-cols-6" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
                  {/* Horizontal gridlines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => i).map((idx) => (
                    <div
                      key={idx}
                      className="absolute left-0 right-0 border-b border-border/40 pointer-events-none"
                      style={{
                        top: `${idx * HOUR_HEIGHT}px`,
                        height: `${HOUR_HEIGHT}px`,
                      }}
                    />
                  ))}

                  {/* Daily Columns */}
                  {DAYS.map((day) => {
                    const positionedSlots = positionDaySlots(slotsByDay[day])
                    return (
                      <div key={day} className="relative border-r border-border last:border-r-0 h-full">
                        {/* Hover placeholder to quickly add schedule */}
                        {positionedSlots.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted/5 opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openAddModal(day)}
                              className="flex items-center gap-1 text-xs text-sti-blue font-bold hover:underline cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                          </div>
                        )}

                        {positionedSlots.map((slot) => {
                          const pendingCR = pendingByScheduleId[slot.id]
                          return (
                            <div
                              key={slot.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedSlot(slot)
                              }}
                              style={{
                                top: `${slot.topPercent}%`,
                                height: `${slot.heightPercent}%`,
                                left: `${slot.leftPercent}%`,
                                width: `${slot.widthPercent}%`,
                              }}
                              className={cn(
                                "absolute p-2.5 rounded-lg border text-xs transition-all flex flex-col justify-between overflow-hidden cursor-pointer",
                                slot.isConflicting
                                  ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 dark:border-destructive/30"
                                  : pendingCR
                                  ? "border-amber-400 bg-amber-500/10 hover:border-amber-500 text-amber-600 dark:text-amber-400"
                                  : "border-sti-blue/20 bg-sti-blue-light/25 hover:border-sti-blue/40 text-foreground dark:bg-slate-900/60 dark:border-slate-800 dark:hover:border-sti-blue/60",
                                "z-10 hover:shadow-lg hover:-translate-y-[1px]"
                              )}
                            >
                              <div className="min-w-0 flex-1 flex flex-col justify-between h-full select-none">
                                <div>
                                  <div className="flex items-start justify-between gap-1">
                                    <p className="font-bold text-[11px] leading-tight truncate">
                                      {slot.subject}
                                    </p>
                                    <span className={cn(
                                      "shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded",
                                      slot.isConflicting
                                        ? "bg-destructive/20 text-destructive"
                                        : "bg-sti-blue/10 text-sti-blue dark:bg-sti-blue/20 dark:text-sti-blue-light"
                                    )}>
                                      {slot.section}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate">
                                    {slot.courseName}
                                  </p>
                                </div>

                                <div className="mt-1 space-y-0.5 border-t border-border/40 pt-1 text-[9px]">
                                  <div className="flex items-center gap-1 font-semibold">
                                    <Clock className="w-3 h-3 text-sti-blue/70 shrink-0" />
                                    <span className="truncate">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                                  </div>
                                  {slot.room && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <MapPin className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                      <span className="truncate">{slot.room}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Warning indicators */}
                              {slot.isConflicting && (
                                <div className="absolute top-1 right-1 flex items-center justify-center">
                                  <span className="animate-pulse w-2 h-2 rounded-full bg-destructive inline-block" />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details Dialog for Grid view elements */}
      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between gap-3">
              <span className="truncate">{selectedSlot?.subject}</span>
              <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-sti-blue/10 text-sti-blue dark:bg-sti-blue/20 dark:text-sti-blue-light border border-sti-blue/20">
                {selectedSlot?.section}
              </span>
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1 text-left">
              {selectedSlot?.courseName}
            </DialogDescription>
          </DialogHeader>

          {/* Details fields grid */}
          <div className="space-y-4 py-4">
            {selectedSlot && conflictsMap.has(selectedSlot.id) && (
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <span>Scheduling Conflict Detected:</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 mt-1 opacity-90">
                  {conflictsMap.get(selectedSlot.id)!.map((c, idx) => (
                    <li key={idx} className="leading-snug">
                      <strong className="capitalize">{c.type}</strong> ({c.overlapText}):{" "}
                      {c.type === "room" && `Room ${c.detail} is also booked by ${c.conflictingCourse} (${c.conflictingSection})`}
                      {c.type === "instructor" && `Instructor ${c.detail} is also teaching ${c.conflictingCourse} (${c.conflictingSection})`}
                      {c.type === "section" && `Section ${c.detail} is also scheduled for ${c.conflictingCourse} (${c.conflictingSection})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Time</p>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Clock className="w-4 h-4 text-sti-blue" />
                  <span>{selectedSlot && formatTime(selectedSlot.startTime)} - {selectedSlot && formatTime(selectedSlot.endTime)}</span>
                </div>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Day</p>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarCheck className="w-4 h-4 text-sti-blue" />
                  <span>{selectedSlot?.day}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-border/20">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="text-sm">
                  <span className="text-xs text-muted-foreground block leading-none">Instructor</span>
                  <span className="font-semibold text-foreground">{selectedSlot?.instructor || "No instructor assigned"}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-border/20">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="text-sm">
                  <span className="text-xs text-muted-foreground block leading-none">Room</span>
                  <span className="font-semibold text-foreground">{selectedSlot?.room || "No room assigned"}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <DialogClose asChild>
              <button 
                type="button" 
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 rounded-xl border border-border transition-colors cursor-pointer"
              >
                Close
              </button>
            </DialogClose>
            {selectedSlot && !pendingByScheduleId[selectedSlot.id] && (
              <div className="flex flex-1 gap-2 w-full">
                <button
                  onClick={() => {
                    const s = selectedSlot;
                    setSelectedSlot(null);
                    openEditModal(s, "modify");
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-foreground bg-card hover:bg-muted/50 rounded-xl border border-border transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    const s = selectedSlot;
                    setSelectedSlot(null);
                    openEditModal(s, "cancel");
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <ScheduleEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        slot={modalSlot}
        changeType={modalChangeType}
        defaultDay={modalDefaultDay}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
