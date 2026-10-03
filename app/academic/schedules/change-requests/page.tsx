"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Pencil,
  Trash2,
  Plus,
  Clock,
  AlertTriangle,
  X,
  History,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { SkeletonList } from "@/components/ui/SkeletonList";


const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_OPTIONS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
]

const CHANGE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  modify: { label: "Modify", icon: Pencil, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  cancel: { label: "Cancel", icon: Trash2, color: "text-red-500 bg-red-500/10 border-red-500/20" },
  add: { label: "Add New", icon: Plus, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
}

function formatTime(raw: string): string {
  if (!raw) return "—"
  const parts = raw.split(":")
  const h = parseInt(parts[0], 10)
  const m = parts[1] || "00"
  const suffix = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${suffix}`
}

interface ChangeRequest {
  id: string
  change_type: "modify" | "cancel" | "add"
  status: string
  reason: string
  created_at: string
  new_course_code: string | null
  new_course_name: string | null
  new_section: string | null
  new_instructor_name: string | null
  new_day_of_week: number | null
  new_start_time: string | null
  new_end_time: string | null
  new_facility_id: string | null
  affects_bookings: boolean
  affected_booking_ids: string[]
  original: {
    id: string
    course_code: string
    course_name: string
    section: string
    instructor_name: string
    day_of_week: number
    start_time: string
    end_time: string
    facilities: { name: string; room_number: string } | null
  } | null
  new_facility: { id: string; name: string; room_number: string } | null
  requester: { id: string; full_name: string; email: string } | null
  departments: { id: string; name: string } | null
}

interface EditFields {
  new_course_code: string
  new_course_name: string
  new_section: string
  new_instructor_name: string
  new_day_of_week: string
  new_start_time: string
  new_end_time: string
  new_facility_id: string
}

interface Facility {
  id: string
  name: string
  room_number: string
}

export default function ChangeRequestsReviewPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<Record<string, string>>({})

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, EditFields>>({})
  const [facilities, setFacilities] = useState<Facility[]>([])

  const loadRequests = useCallback(() => {
    setLoading(true)
    fetch("/api/schedules/change-requests/review")
      .then((r) => r.json())
      .then((data) => {
        setRequests(data.change_requests ?? [])
        setError(null)
      })
      .catch(() => setError("Failed to load change requests"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadRequests()
    fetch("/api/facilities?all=true")
      .then((r) => r.json())
      .then((data) => setFacilities(data.facilities ?? []))
      .catch(() => {})
  }, [loadRequests])

  const startEditing = (req: ChangeRequest) => {
    setEditingId(req.id)
    setEdits((prev) => ({
      ...prev,
      [req.id]: {
        new_course_code: req.new_course_code ?? req.original?.course_code ?? "",
        new_course_name: req.new_course_name ?? req.original?.course_name ?? "",
        new_section: req.new_section ?? req.original?.section ?? "",
        new_instructor_name: req.new_instructor_name ?? req.original?.instructor_name ?? "",
        new_day_of_week: String(req.new_day_of_week ?? req.original?.day_of_week ?? 1),
        new_start_time: (req.new_start_time ?? req.original?.start_time ?? "").slice(0, 5),
        new_end_time: (req.new_end_time ?? req.original?.end_time ?? "").slice(0, 5),
        new_facility_id: req.new_facility_id ?? "",
      },
    }))
  }

  const cancelEditing = () => {
    if (editingId) {
      setEdits((prev) => {
        const next = { ...prev }
        delete next[editingId]
        return next
      })
    }
    setEditingId(null)
  }

  const updateEdit = (id: string, field: keyof EditFields, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const handleAction = async (id: string, action: "approve" | "reject") => {
    if (action === "reject" && (!notes[id] || notes[id].trim().length < 5)) {
      setActionError((prev) => ({ ...prev, [id]: "Rejection requires notes (min 5 chars)" }))
      return
    }

    setActionLoading(id)
    setActionError((prev) => ({ ...prev, [id]: "" }))

    try {
      if (action === "approve" && edits[id]) {
        const e = edits[id]
        const patchBody: Record<string, any> = {
          new_course_code: e.new_course_code,
          new_course_name: e.new_course_name,
          new_section: e.new_section,
          new_instructor_name: e.new_instructor_name,
          new_day_of_week: parseInt(e.new_day_of_week),
          new_start_time: e.new_start_time.length === 5 ? e.new_start_time + ":00" : e.new_start_time,
          new_end_time: e.new_end_time.length === 5 ? e.new_end_time + ":00" : e.new_end_time,
        }
        if (e.new_facility_id) patchBody.new_facility_id = e.new_facility_id

        const patchRes = await fetch(`/api/schedules/change-requests/review/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        })

        if (!patchRes.ok) {
          const patchData = await patchRes.json()
          setActionError((prev) => ({ ...prev, [id]: patchData.error || "Failed to save modifications" }))
          return
        }
      }

      const res = await fetch(`/api/schedules/change-requests/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes[id] || undefined }),
      })

      const data = await res.json()
      if (!res.ok) {
        setActionError((prev) => ({ ...prev, [id]: data.error || "Action failed" }))
        return
      }

      setRequests((prev) => prev.filter((r) => r.id !== id))
      setEditingId(null)
    } catch {
      setActionError((prev) => ({ ...prev, [id]: "Network error" }))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-4 sm:px-6 py-8">
      {/* BRAND HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase text-[#050d36] dark:text-white">
            SCHEDULE <span className="text-accent-brand">CHANGES</span>
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
            Review modification, cancellation, and addition requests
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white dark:bg-[#15181E] px-6 py-3 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm">
          <History className="h-4 w-4 text-blue-500" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
            {requests.length} Pending Approval
          </span>
        </div>
      </div>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center text-red-500 font-black uppercase text-[10px] tracking-widest">
          {error}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-[2rem] py-16 px-8 text-center">
          <div className="p-4 bg-emerald-500/10 rounded-full w-fit mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">All requests processed</p>
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map((req) => {
            const typeConfig = CHANGE_TYPE_CONFIG[req.change_type]
            const TypeIcon = typeConfig.icon
            const isActioning = actionLoading === req.id
            const isEditing = editingId === req.id
            const editState = edits[req.id]

            return (
              <div key={req.id} className="group relative bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-3xl overflow-hidden shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/10 p-6">
                
                {/* Header Information */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <span className={cn("inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border shadow-sm", typeConfig.color)}>
                      <TypeIcon className="w-3.5 h-3.5" strokeWidth={3} />
                      {typeConfig.label}
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-white/5 rounded-full">
                       <User className="w-3 h-3 text-slate-400" />
                       <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">
                         {req.requester?.full_name ?? "Unknown"} • {req.departments?.name ?? "N/A"}
                       </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    SUBMITTED: {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_40px_1fr] gap-6 items-center mb-6">
                  {/* Current Record */}
                  <div className="relative p-5 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5">
                    <span className="absolute -top-2.5 left-4 px-2 bg-slate-50 dark:bg-[#1C2028] text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-white/5 rounded">Current State</span>
                    {req.original ? (
                      <div className="space-y-1.5 pt-2">
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{req.original.course_code} — {req.original.section}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{req.original.course_name}</p>
                        <p className="text-[10px] font-medium text-slate-400">{req.original.instructor_name}</p>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 mt-2">
                           <Clock className="w-3 h-3" />
                           {DAY_NAMES[req.original.day_of_week]} {formatTime(req.original.start_time)} – {formatTime(req.original.end_time)}
                        </div>
                        <p className="text-xs font-bold text-blue-500/70 uppercase tracking-wide mt-1">
                          {req.original.facilities?.name || req.original.facilities?.room_number || "NO FACILITY"}
                        </p>
                      </div>
                    ) : (
                      <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Initial Addition</p>
                      </div>
                    )}
                  </div>

                  {/* Visual Divider */}
                  <div className="flex justify-center">
                    {req.change_type === "cancel" ? (
                      <XCircle className="w-6 h-6 text-red-500/30" />
                    ) : (
                      <ArrowRight className="w-6 h-6 text-slate-300 dark:text-white/10" strokeWidth={3} />
                    )}
                  </div>

                  {/* Proposed Record */}
                  <div className={cn(
                    "relative p-5 rounded-2xl border transition-all",
                    isEditing ? "bg-blue-500/[0.03] border-blue-500/30 ring-4 ring-blue-500/5" : "bg-white dark:bg-black/40 border-slate-200 dark:border-white/[0.06]"
                  )}>
                    <span className="absolute -top-2.5 left-4 px-2 bg-white dark:bg-[#1C2028] text-[10px] font-black text-blue-500 uppercase tracking-widest border border-slate-200 dark:border-white/5 rounded">Proposed State</span>
                    
                    {req.change_type !== "cancel" ? (
                      isEditing && editState ? (
                        <div className="space-y-3 pt-2">
                           <div className="flex justify-end mb-1">
                             <button onClick={cancelEditing} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                             <Input value={editState.new_course_code} onChange={(e) => updateEdit(req.id, "new_course_code", e.target.value)} className="h-8 text-[9px] font-black uppercase bg-transparent" />
                             <Input value={editState.new_section} onChange={(e) => updateEdit(req.id, "new_section", e.target.value)} className="h-8 text-[9px] font-black uppercase bg-transparent" />
                           </div>
                           <Input value={editState.new_course_name} onChange={(e) => updateEdit(req.id, "new_course_name", e.target.value)} className="h-8 text-[9px] font-black uppercase bg-transparent" />
                           <Input value={editState.new_instructor_name} onChange={(e) => updateEdit(req.id, "new_instructor_name", e.target.value)} className="h-8 text-[9px] font-black uppercase bg-transparent" />
                           <div className="grid grid-cols-2 gap-2">
                             <Select value={editState.new_day_of_week} onValueChange={(v) => updateEdit(req.id, "new_day_of_week", v)}>
                               <SelectTrigger className="h-8 text-[9px] font-black uppercase bg-transparent"><SelectValue /></SelectTrigger>
                               <SelectContent className="dark:bg-[#15181E]">{DAY_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value} className="text-[9px] uppercase font-black">{d.label}</SelectItem>)}</SelectContent>
                             </Select>
                             <Select value={editState.new_facility_id} onValueChange={(v) => updateEdit(req.id, "new_facility_id", v)}>
                               <SelectTrigger className="h-8 text-[9px] font-black uppercase bg-transparent"><SelectValue /></SelectTrigger>
                               <SelectContent className="dark:bg-[#15181E]">{facilities.map((f) => <SelectItem key={f.id} value={f.id} className="text-[9px] uppercase font-black">{f.name || f.room_number}</SelectItem>)}</SelectContent>
                             </Select>
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                             <Input type="time" value={editState.new_start_time} onChange={(e) => updateEdit(req.id, "new_start_time", e.target.value)} className="h-8 text-[9px] font-black bg-transparent" />
                             <Input type="time" value={editState.new_end_time} onChange={(e) => updateEdit(req.id, "new_end_time", e.target.value)} className="h-8 text-[9px] font-black bg-transparent" />
                           </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 pt-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                              {req.new_course_code ?? req.original?.course_code ?? "—"} — {req.new_section ?? req.original?.section ?? "—"}
                            </p>
                            <button onClick={() => startEditing(req)} className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-all">
                              <Pencil className="w-3 h-3" strokeWidth={3} />
                            </button>
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{req.new_course_name ?? req.original?.course_name ?? ""}</p>
                          <p className="text-[10px] font-medium text-slate-400">{req.new_instructor_name ?? req.original?.instructor_name ?? ""}</p>
                          <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 dark:text-blue-400 mt-2">
                            <Clock className="w-3 h-3" />
                            {DAY_NAMES[req.new_day_of_week ?? req.original?.day_of_week ?? 0]}{" "}
                            {formatTime(req.new_start_time ?? req.original?.start_time ?? "")} –{" "}
                            {formatTime(req.new_end_time ?? req.original?.end_time ?? "")}
                          </div>
                          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wide mt-1">
                            {req.new_facility?.name || req.new_facility?.room_number || req.original?.facilities?.name || "—"}
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="py-10 text-center">
                        <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Marked for Deletion</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footnotes: Reason & Conflict Warnings */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                    <span className="text-xs font-semibold text-slate-400 tracking-wide mt-0.5">Rationale:</span>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">{req.reason}</p>
                  </div>

                  {req.affects_bookings && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-semibold text-amber-600 uppercase tracking-wide">
                      <AlertTriangle className="w-3.5 h-3.5" strokeWidth={3} />
                      Impacts {req.affected_booking_ids?.length ?? 0} Reservation(s)
                    </div>
                  )}
                </div>

                {/* Approval Logic */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-6 border-t border-slate-100 dark:border-white/5">
                  <div className="flex-1 w-full relative">
                    <Textarea
                      placeholder="Review notes (required for rejection)..."
                      value={notes[req.id] || ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      className="min-h-[80px] bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/[0.06] rounded-2xl text-xs font-medium focus:ring-blue-500/20"
                    />
                    {actionError[req.id] && (
                      <p className="text-xs text-red-500 font-semibold mt-1">{actionError[req.id]}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      onClick={() => handleAction(req.id, "reject")} 
                      disabled={isActioning} 
                      className="h-11 px-8 border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                      {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <XCircle className="w-3.5 h-3.5 mr-2" />}
                      Deny
                    </Button>
                    <Button 
                      onClick={() => handleAction(req.id, "approve")} 
                      disabled={isActioning} 
                      className="h-11 px-8 bg-[#050d36] dark:bg-emerald-600 hover:bg-[#050d36]/90 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/10"
                    >
                      {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
                      {isEditing ? "Modify & Approve" : "Authorize"}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}