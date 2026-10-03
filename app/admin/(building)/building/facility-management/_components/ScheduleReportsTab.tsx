"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, X, Monitor, Wrench, Snowflake } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { labelFor, scheduleIssueCategoryLabel, scheduleIssueStatusLabel } from "@/lib/enum-labels"

/* ─── Types ─── */

interface ScheduleReport {
  id: string
  scheduleType: string
  scheduleId: string
  facilityId: string | null
  facilityName: string | null
  courseCode: string | null
  section: string | null
  scheduleDate: string | null
  startTime: string | null
  endTime: string | null
  dayOfWeek: number | null
  reportedBy: string
  reportedByName: string | null
  category: string
  noticedAt: string | null
  whatHappened: string
  whatToCorrect: string | null
  equipmentType?: string | null
  isTech?: boolean | null
  isHvac?: boolean | null
  status: string
  resolutionNotes: string | null
  resolvedBy: string | null
  resolvedByName: string | null
  resolvedAt: string | null
  escalatedEquipmentReportId: string | null
  escalatedTo: string | null
  escalatedAt: string | null
  createdAt: string
  updatedAt: string
}

interface ActivityLog {
  id: string
  reportId: string
  action: string
  oldStatus: string | null
  newStatus: string | null
  notes: string | null
  performedBy: string
  performedByName: string | null
  createdAt: string
}

interface Equipment {
  id: string
  equipment_code: string | null
  name: string | null
  equipment_type?: { name: string } | null
}

interface Attachment {
  id: string
  reportId: string
  publicUrl: string
  sortOrder: number
  caption: string | null
}

/* ─── Constants ─── */

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  under_review: { label: "Under Review", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  dismissed: { label: "Dismissed", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  escalated: { label: "Escalated", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
}

const CATEGORY_LABELS: Record<string, string> = {
  wrong_room: "Wrong Room",
  time_conflict: "Time Conflict",
  missing_session: "Missing Session",
  incorrect_time: "Incorrect Time",
  instructor_mismatch: "Instructor Mismatch",
  not_updated: "Not Updated",
  other: "Other",
}

const ESCALATION_CATEGORIES = [
  { value: "broken", label: "Broken" },
  { value: "missing", label: "Missing" },
  { value: "malfunction", label: "Malfunction" },
  { value: "other", label: "Other" },
] as const

/** Allowed status transitions from the policy. */
const TRANSITIONS: Record<string, string[]> = {
  pending: ["under_review", "dismissed"],
  under_review: ["resolved", "dismissed", "escalated"],
  escalated: ["resolved", "dismissed", "under_review"],
  resolved: ["under_review"],
  dismissed: [],
}

const PAGE_SIZE = 20

/* ─── Component ─── */

export function ScheduleReportsTab() {
  const [reports, setReports] = useState<ScheduleReport[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activityLogs, setActivityLogs] = useState<Record<string, ActivityLog[]>>({})
  const [logsLoading, setLogsLoading] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({})
  const [deletingAttachment, setDeletingAttachment] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  // Status update state
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})

  // Escalation dialog state
  const [escalateReport, setEscalateReport] = useState<ScheduleReport | null>(null)
  const [escalateEquipment, setEscalateEquipment] = useState<Equipment[]>([])
  const [escalateEquipmentId, setEscalateEquipmentId] = useState<string>("")
  const [escalateCategory, setEscalateCategory] = useState<string>("other")
  const [escalateDescription, setEscalateDescription] = useState("")
  const [escalateLoading, setEscalateLoading] = useState(false)

  const { toast } = useToast()

  /* ── Fetch reports ── */

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : ""
      const res = await fetch(`/api/admin/schedule-reports${qs}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setReports(data.reports || [])
      setPage(0)
    } catch {
      toast({ title: "Error", description: "Failed to load schedule reports", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => {
    load()
  }, [load])

  /* ── Fetch activity logs for a report ── */

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)

    // Fetch activity logs if not cached
    if (!activityLogs[id]) {
      setLogsLoading(id)
      try {
        const res = await fetch(`/api/admin/schedule-reports/${id}/logs`)
        if (res.ok) {
          const data = await res.json()
          setActivityLogs((prev) => ({ ...prev, [id]: data.logs || [] }))
        }
      } finally {
        setLogsLoading(null)
      }
    }

    // Fetch attachments if not cached
    if (!attachments[id]) {
      try {
        const res = await fetch(`/api/admin/schedule-reports/${id}/attachments`)
        if (res.ok) {
          const data = await res.json()
          setAttachments((prev) => ({ ...prev, [id]: data.attachments || [] }))
        }
      } catch {
        // Silently fail — attachments are optional
      }
    }
  }

  /* ── Delete attachment ── */

  const deleteAttachment = async (reportId: string, attachmentId: string) => {
    setDeletingAttachment(attachmentId)
    try {
      const res = await fetch(
        `/api/admin/schedule-reports/${reportId}/attachments/${attachmentId}`,
        { method: "DELETE" },
      )
      if (res.ok) {
        setAttachments((prev) => ({
          ...prev,
          [reportId]: (prev[reportId] || []).filter((a) => a.id !== attachmentId),
        }))
        toast({ title: "Attachment deleted" })
      } else {
        const d = await res.json().catch(() => ({}))
        toast({ title: "Error", description: d.error || "Delete failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete attachment", variant: "destructive" })
    } finally {
      setDeletingAttachment(null)
    }
  }

  /* ── Status update ── */

  const updateStatus = async (id: string, newStatus: string) => {
    const notes = resolutionNotes[id]?.trim() || undefined
    if ((newStatus === "resolved" || newStatus === "dismissed") && !notes) {
      // Prompt for notes inline — they'll see the textarea
      toast({
        title: "Resolution notes required",
        description: "Enter resolution notes before resolving or dismissing.",
        variant: "destructive",
      })
      return
    }

    const res = await fetch(`/api/admin/schedule-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, resolutionNotes: notes }),
    })

    if (res.ok) {
      toast({ title: "Status updated" })
      setResolutionNotes((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      load()
      // Refresh activity logs if expanded
      if (expandedId === id) {
        setActivityLogs((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        const logRes = await fetch(`/api/admin/schedule-reports/${id}/logs`)
        if (logRes.ok) {
          const data = await logRes.json()
          setActivityLogs((prev) => ({ ...prev, [id]: data.logs || [] }))
        }
      }
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: "Error", description: d.error || "Update failed", variant: "destructive" })
    }
  }

  /* ── Escalation ── */

  const openEscalate = async (report: ScheduleReport) => {
    setEscalateReport(report)
    setEscalateEquipmentId("")
    setEscalateCategory("other")
    setEscalateDescription(report.whatHappened)

    if (report.facilityId) {
      try {
        const res = await fetch(`/api/facilities/${report.facilityId}/equipment`)
        if (res.ok) {
          const data = await res.json()
          setEscalateEquipment(data.equipment || [])
        }
      } catch {
        setEscalateEquipment([])
      }
    } else {
      setEscalateEquipment([])
    }
  }

  const submitEscalate = async () => {
    if (!escalateReport) return
    setEscalateLoading(true)
    try {
      const body: Record<string, unknown> = {
        facilityId: escalateReport.facilityId,
        category: escalateCategory,
        description: escalateDescription,
        isTech: escalateReport.isTech ?? false,
      }
      if (escalateEquipmentId) {
        body.equipmentId = escalateEquipmentId
      }

      const res = await fetch(`/api/admin/schedule-reports/${escalateReport.id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast({ title: "Report escalated" })
        setEscalateReport(null)
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        toast({ title: "Error", description: d.error || "Escalation failed", variant: "destructive" })
      }
    } finally {
      setEscalateLoading(false)
    }
  }

  /* ── Pagination ── */

  const totalPages = Math.ceil(reports.length / PAGE_SIZE)
  const paged = reports.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  /* ── Helpers ── */

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTime = (t: string | null) => {
    if (!t) return ""
    const [h, m] = t.split(":").map(Number)
    const ampm = h >= 12 ? "PM" : "AM"
    const hr = h % 12 || 12
    return `${hr}:${String(m).padStart(2, "0")} ${ampm}`
  }

  /* ── Render ── */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            Schedule issue reports filed by faculty and academic heads. Triage by reviewing, resolving, or escalating.
          </p>
        </div>
        <Button variant="outline" className="h-11" onClick={load}>
          <RefreshCw size={16} className="mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-auto min-w-[140px] rounded-xl text-sm font-medium border-border/40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {reports.length} report{reports.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Date Filed</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Tech</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="inline animate-spin mr-2" size={16} /> Loading…
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  No schedule reports.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((r) => {
                const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending
                const transitions = TRANSITIONS[r.status] || []
                const isExpanded = expandedId === r.id

                return (
                  <Fragment key={r.id}>
                    {/* Main row */}
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => toggleExpand(r.id)}
                    >
                      <TableCell className="w-8">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(r.createdAt)}</TableCell>
                      <TableCell className="text-sm">{r.reportedByName || "—"}</TableCell>
                      <TableCell className="text-sm">{labelFor('schedule_type', r.scheduleType)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {CATEGORY_LABELS[r.category] || scheduleIssueCategoryLabel(r.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.category === "equipment_issue" ? (
                          <div className="flex items-center gap-1">
                            {r.isTech ? (
                              <Badge className="text-[10px] border-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
                                <Monitor className="w-3 h-3" />
                                Tech
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] border-0 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 gap-1">
                                <Wrench className="w-3 h-3" />
                                Non-tech
                              </Badge>
                            )}
                            {r.isHvac && (
                              <Badge className="text-[10px] border-0 bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 gap-1">
                                <Snowflake className="w-3 h-3" />
                                HVAC
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.facilityName || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] border-0 ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Escalate button for pending/under_review */}
                          {(r.status === "pending" || r.status === "under_review") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => openEscalate(r)}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Escalate
                            </Button>
                          )}

                          {/* Status transition select */}
                          {transitions.length > 0 && (
                            <Select onValueChange={(v) => updateStatus(r.id, v)}>
                              <SelectTrigger className="h-7 w-[130px] text-xs">
                                <SelectValue placeholder="Set…" />
                              </SelectTrigger>
                              <SelectContent>
                                {transitions.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {STATUS_BADGE[s]?.label || scheduleIssueStatusLabel(s)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <TableRow key={`${r.id}-detail`}>
                        <TableCell colSpan={9} className="bg-muted/30 p-0">
                          <div className="p-4 space-y-4">
                            {/* Report details */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  What happened
                                </p>
                                <p className="text-foreground">{r.whatHappened}</p>
                              </div>
                              {r.whatToCorrect && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    What to correct
                                  </p>
                                  <p className="text-foreground">{r.whatToCorrect}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Noticed at
                                </p>
                                <p className="text-foreground">{formatDate(r.noticedAt)}</p>
                              </div>
                              {r.courseCode && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Course / Section
                                  </p>
                                  <p className="text-foreground">
                                    {r.courseCode}
                                    {r.section ? ` — ${r.section}` : ""}
                                  </p>
                                </div>
                              )}
                              {r.scheduleDate && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Schedule date
                                  </p>
                                  <p className="text-foreground">
                                    {formatDate(r.scheduleDate)}
                                    {r.startTime ? ` ${formatTime(r.startTime)}` : ""}
                                    {r.endTime ? ` – ${formatTime(r.endTime)}` : ""}
                                  </p>
                                </div>
                              )}
                              {r.resolutionNotes && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Resolution notes
                                  </p>
                                  <p className="text-foreground">{r.resolutionNotes}</p>
                                </div>
                              )}
                            </div>

                            {/* Attachments */}
                            {attachments[r.id] && attachments[r.id].length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-medium text-muted-foreground">
                                  Attached Photos ({attachments[r.id].length})
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                  {attachments[r.id].map((att) => (
                                    <div key={att.id} className="group relative">
                                      <a
                                        href={att.publicUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <img
                                          src={att.publicUrl}
                                          alt={`Report attachment ${att.sortOrder + 1}`}
                                          className="w-full h-24 object-cover rounded-lg border border-border/50"
                                          loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
                                      </a>
                                      <button
                                        type="button"
                                        className="absolute top-1 right-1 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                        disabled={deletingAttachment === att.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          e.preventDefault()
                                          deleteAttachment(r.id, att.id)
                                        }}
                                        title="Delete attachment"
                                      >
                                        {deletingAttachment === att.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <X className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Resolution notes input for pending/under_review */}
                            {(r.status === "pending" ||
                              r.status === "under_review" ||
                              r.status === "escalated" ||
                              r.status === "resolved") && (
                              <div className="max-w-md">
                                <Label className="text-xs font-medium text-muted-foreground">
                                  Resolution notes
                                </Label>
                                <Textarea
                                  placeholder="Enter notes before resolving or dismissing…"
                                  className="mt-1 text-sm"
                                  rows={2}
                                  value={resolutionNotes[r.id] || ""}
                                  onChange={(e) =>
                                    setResolutionNotes((prev) => ({
                                      ...prev,
                                      [r.id]: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            )}

                            {/* Activity log */}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Activity log
                              </p>
                              {logsLoading === r.id ? (
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                  <Loader2 className="animate-spin" size={14} /> Loading log…
                                </p>
                              ) : (activityLogs[r.id] || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No activity recorded.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {(activityLogs[r.id] || []).map((log) => (
                                    <div
                                      key={log.id}
                                      className="flex items-center gap-2 text-xs text-muted-foreground"
                                    >
                                      <span className="font-mono text-[10px] text-muted-foreground/60">
                                        {new Date(log.createdAt).toLocaleString()}
                                      </span>
                                      <span className="font-medium text-foreground">
                                        {log.action}
                                      </span>
                                      {log.oldStatus && log.newStatus && (
                                        <span>
                                          {STATUS_BADGE[log.oldStatus]?.label || scheduleIssueStatusLabel(log.oldStatus)}
                                          {" → "}
                                          {STATUS_BADGE[log.newStatus]?.label || scheduleIssueStatusLabel(log.newStatus)}
                                        </span>
                                      )}
                                      {log.performedByName && (
                                        <span>by {log.performedByName}</span>
                                      )}
                                      {log.notes && (
                                        <span className="italic">— {log.notes}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Escalation Dialog */}
      <Dialog
        open={!!escalateReport}
        onOpenChange={(open) => {
          if (!open) setEscalateReport(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Escalate Report
              {escalateReport && (
                <span className="text-muted-foreground font-normal text-sm ml-2">
                  #{escalateReport.id.slice(0, 8)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tech classification hint */}
            {escalateReport?.category === "equipment_issue" && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Classification:</span>
                {escalateReport.isTech ? (
                  <Badge className="text-[10px] border-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
                    <Monitor className="w-3 h-3" />
                    Tech (IT Admin)
                  </Badge>
                ) : (
                  <Badge className="text-[10px] border-0 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 gap-1">
                    <Wrench className="w-3 h-3" />
                    Non-tech (PAMO)
                  </Badge>
                )}
              </div>
            )}

            {/* Equipment picker (only if facility has equipment) */}
            {escalateEquipment.length > 0 && (
              <div>
                <Label className="text-sm">Equipment (optional)</Label>
                <Select value={escalateEquipmentId} onValueChange={setEscalateEquipmentId}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder="Select equipment…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {escalateEquipment.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.equipment_code || eq.name || eq.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category */}
            <div>
              <Label className="text-sm">Category</Label>
              <Select value={escalateCategory} onValueChange={setEscalateCategory}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESCALATION_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm">Description</Label>
              <Textarea
                className="mt-1 text-sm"
                rows={3}
                value={escalateDescription}
                onChange={(e) => setEscalateDescription(e.target.value)}
                placeholder="Describe the issue for escalation…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEscalateReport(null)}
              disabled={escalateLoading}
            >
              Cancel
            </Button>
            <Button onClick={submitEscalate} disabled={escalateLoading || !escalateDescription.trim()}>
              {escalateLoading && <Loader2 className="animate-spin mr-2" size={14} />}
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
