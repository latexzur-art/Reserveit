"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, ShieldAlert, Wrench, Archive, CheckCircle2, XCircle } from "lucide-react"
import { useFacilityModeration } from "@/hooks/admin/building"
import { useToast } from "@/hooks/use-toast"
import { formatEnumLabel, labelFor } from "@/lib/enum-labels"

export function AdminReviewsModerationPanel() {
  const {
    reviews, issueReports, filters, setFilters, loading,
    moderateReview, postWarningFromIssue, convertToMaintenance, dismissIssueReport,
  } = useFacilityModeration()
  const { toast } = useToast()
  const [subTab, setSubTab] = useState<"reviews" | "issues">("reviews")

  const facilityOptions = useMemo(
    () => Array.from(new Map(reviews.map(r => [r.facilityId, r.facilityName || r.facilityId])).entries()),
    [reviews]
  )

  return (
    <div className="space-y-6">
      <Tabs value={subTab} onValueChange={v => setSubTab(v as "reviews" | "issues")}>
        <TabsList>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          <TabsTrigger value="issues">Open Issues ({issueReports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={filters.rating ? String(filters.rating) : "all"} onValueChange={v => setFilters(f => ({ ...f, rating: v === "all" ? undefined : Number(v) }))}>
              <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-xl text-sm"><SelectValue placeholder="All Ratings" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                {[5, 4, 3, 2, 1].map(r => <SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.facilityId || "all"} onValueChange={v => setFilters(f => ({ ...f, facilityId: v === "all" ? undefined : v }))}>
              <SelectTrigger className="h-9 w-auto min-w-[150px] rounded-xl text-sm"><SelectValue placeholder="All Facilities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Facilities</SelectItem>
                {facilityOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.status || "all"} onValueChange={v => setFilters(f => ({ ...f, status: v === "all" ? undefined : (v as any) }))}>
              <SelectTrigger className="h-9 w-auto min-w-[140px] rounded-xl text-sm"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.hasIssue === undefined ? "all" : String(filters.hasIssue)}
              onValueChange={v => setFilters(f => ({ ...f, hasIssue: v === "all" ? undefined : v === "true" }))}
            >
              <SelectTrigger className="h-9 w-auto min-w-[160px] rounded-xl text-sm"><SelectValue placeholder="Issue Reported" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Issue: Any</SelectItem>
                <SelectItem value="true">Issue: Yes</SelectItem>
                <SelectItem value="false">Issue: No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3">Facility</th>
                  <th className="text-left p-3">Rating</th>
                  <th className="text-left p-3">Comment</th>
                  <th className="text-left p-3">Issue</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">Loading…</td></tr>
                ) : reviews.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No reviews match your filters.</td></tr>
                ) : reviews.map(r => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="p-3">{r.userName}</td>
                    <td className="p-3">{r.facilityName}</td>
                    <td className="p-3 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {r.rating}
                    </td>
                    <td className="p-3 max-w-xs truncate">{r.comment || "—"}</td>
                    <td className="p-3">
                      {r.issueReported ? <Badge variant="destructive" className="text-[10px]">{r.issueCategory}</Badge> : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className="text-[10px]">{formatEnumLabel(r.status)}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1.5">
                        {r.status !== "published" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => moderateReview(r.id, "published")}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Publish
                          </Button>
                        )}
                        {r.status !== "archived" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => moderateReview(r.id, "archived")}>
                            <Archive className="w-3 h-3 mr-1" /> Archive
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-3">
          {loading ? (
            <p className="text-center p-6 text-muted-foreground text-sm">Loading…</p>
          ) : issueReports.length === 0 ? (
            <p className="text-center p-6 text-muted-foreground text-sm">No open issue reports.</p>
          ) : issueReports.map(report => (
            <div key={report.id} className="rounded-xl border border-border/50 p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="destructive" className="text-[10px]">{labelFor('facility_issue_category', report.category)}</Badge>
                  <p className="text-sm font-bold">{report.facilityName}</p>
                </div>
                <p className="text-sm text-muted-foreground">{report.details}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Reported by {report.reportedByName || "Unknown"}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => postWarningFromIssue(report)}>
                  <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Post Warning
                </Button>
                <Button size="sm" className="text-xs" onClick={() => convertToMaintenance(report.id)}>
                  <Wrench className="w-3.5 h-3.5 mr-1.5" /> Convert to Maintenance
                </Button>
                <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => dismissIssueReport(report.id)}>
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> Dismiss
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
