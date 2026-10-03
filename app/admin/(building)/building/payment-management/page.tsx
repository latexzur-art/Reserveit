"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PaymentSettingsPanel } from "@/components/admin/building/payment-management/PaymentSettingsPanel"
import { NeedsReviewQueue } from "@/components/admin/building/payment-management/NeedsReviewQueue"
import { PaymentTransactionsTable } from "@/components/admin/building/payment-management/PaymentTransactionsTable"
import { PaymentDetailDialog } from "@/components/admin/building/payment-management/PaymentDetailDialog"
import { useBuildingPayments } from "@/hooks/admin/building/useBuildingPayments"
import type { BuildingTransaction } from "@/backend/admin/building/building.types"
import {
  Receipt,
  Eye,
  ClipboardList,
  Settings,
  AlertCircle,
  Download,
  ShieldCheck,
  ImageIcon,
} from "lucide-react"

export default function PaymentManagementPage() {
  const { transactions, loading, error, refresh } = useBuildingPayments()
  const [selectedTransaction, setSelectedTransaction] = useState<BuildingTransaction | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleRowClick = (transaction: BuildingTransaction) => {
    setSelectedTransaction(transaction)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* ── Page Title Bar (Strict Two-Tone Compliance) ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
          Payment <span className="text-accent-brand">Management</span>
        </h1>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
          Transactions, proof review, audit trail, and payment settings
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-xs font-medium text-rose-800 dark:text-rose-300">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            className="text-xs font-bold text-rose-700 dark:text-rose-300 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Main Navigation Tabs ── */}
      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="rounded-xl bg-muted/50 p-1 h-auto gap-1 border border-border/40">
          <TabsTrigger
            value="transactions"
            className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-xs gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5 text-accent-brand" /> Transactions
          </TabsTrigger>
          <TabsTrigger
            value="review"
            className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-xs gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-accent-brand" /> Needs Review
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-xs gap-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5 text-accent-brand" /> Audit Trail
          </TabsTrigger>
          <TabsTrigger
            value="proofs"
            className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-xs gap-1.5"
          >
            <ImageIcon className="w-3.5 h-3.5 text-accent-brand" /> Proofs
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-lg text-xs font-semibold px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-xs gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-accent-brand" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* ─── Transactions Tab ─── */}
        <TabsContent value="transactions">
          <PaymentTransactionsTable
            transactions={transactions}
            loading={loading}
            onRowClick={handleRowClick}
          />
        </TabsContent>

        {/* ─── Needs Review Tab ─── */}
        <TabsContent value="review">
          <NeedsReviewQueue />
        </TabsContent>

        {/* ─── Audit Tab ─── */}
        <TabsContent value="audit">
          <AuditView transactions={transactions} loading={loading} />
        </TabsContent>

        {/* ─── Proofs Tab ─── */}
        <TabsContent value="proofs">
          <ProofsGallery transactions={transactions} loading={loading} onCardClick={handleRowClick} />
        </TabsContent>

        {/* ─── Settings Tab ─── */}
        <TabsContent value="settings">
          <PaymentSettingsPanel />
        </TabsContent>
      </Tabs>

      <PaymentDetailDialog
        transaction={selectedTransaction}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRefresh={refresh}
      />
    </div>
  )
}

// ─── Audit View (Dedicated Immutable Audit Log & State Transition View) ─────

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, TrendingUp, Wallet, Clock, Loader2, FileSpreadsheet } from "lucide-react"
import { StatsCard } from "@/components/admin/dashboard/StatsCard"
import { cn } from "@/lib/utils"
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/enum-labels"

const AUDIT_STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  pending_review: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  failed: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  refunded: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  cancelled: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  refund_requested: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  refund_processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
}

function isExpired(t: BuildingTransaction): boolean {
  return t.paymentStatus === "pending" && !!t.expiresAt && new Date(t.expiresAt) < new Date()
}

function AuditView({
  transactions,
  loading,
}: {
  transactions: BuildingTransaction[]
  loading: boolean
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const filtered = useMemo(() => {
    let result = transactions
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        t =>
          (t.userName || "").toLowerCase().includes(q) ||
          (t.bookingReference || "").toLowerCase().includes(q) ||
          (t.paymentReference || "").toLowerCase().includes(q),
      )
    }
    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "expired_link") {
        result = result.filter(isExpired)
      } else {
        result = result.filter(t => t.paymentStatus === statusFilter)
      }
    }
    return result
  }, [transactions, search, statusFilter])

  const stats = useMemo(
    () => ({
      totalRevenue: transactions
        .filter(t => t.paymentStatus === "completed")
        .reduce((s, t) => s + t.amount, 0),
      failed: transactions.filter(t => t.paymentStatus === "failed").length,
      refunded: transactions.filter(t => t.paymentStatus === "refunded").length,
      expiredLinks: transactions.filter(isExpired).length,
    }),
    [transactions],
  )

  const handleExportAudit = () => {
    const headers = [
      "Payment Reference",
      "Booking Reference",
      "Client",
      "Facility",
      "Amount",
      "Payment Method",
      "Audit Status",
      "Timestamp",
    ]
    const rows = filtered.map(t => [
      t.paymentReference,
      t.bookingReference,
      t.userName || "N/A",
      t.facilityName || "N/A",
      `₱${t.amount.toLocaleString()}`,
      t.paymentMethod,
      isExpired(t) ? "Expired Link" : paymentStatusLabel(t.paymentStatus),
      t.createdAt || "",
    ])
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payment-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* High-Level Audit Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Revenue" value={`₱${stats.totalRevenue.toLocaleString()}`} icon={TrendingUp} variant="success" />
        <StatsCard title="Failed" value={stats.failed.toString()} icon={AlertCircle} variant="destructive" />
        <StatsCard title="Refunded" value={stats.refunded.toString()} icon={Wallet} variant="warning" />
        <StatsCard title="Expired Links" value={stats.expiredLinks.toString()} icon={Clock} variant="warning" />
      </div>

      {/* Filter and Export Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by client or reference..."
              aria-label="Search audit log"
              className="pl-9 h-9 rounded-lg bg-card border-border font-medium text-xs shadow-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9 rounded-lg bg-card border-border font-medium text-xs">
              <SelectValue placeholder="Filter Event Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-card shadow-lg">
              <SelectItem value="all" className="text-xs">All Entries</SelectItem>
              <SelectItem value="completed" className="text-xs">Completed</SelectItem>
              <SelectItem value="failed" className="text-xs">Failed</SelectItem>
              <SelectItem value="refunded" className="text-xs">Refunded</SelectItem>
              <SelectItem value="expired_link" className="text-xs">Expired Link</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={handleExportAudit}
          className="rounded-xl font-semibold text-xs h-9 bg-card border-border hover:bg-accent hover:text-accent-foreground gap-1.5 shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4 text-accent-brand" /> Export Audit Log
        </Button>
      </div>

      {/* Audit Log Table */}
      <Card className="rounded-2xl border border-border/60 bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/40">
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground px-6 h-12">TXN ID</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Client / Reference</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Facility</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12 text-center">Amount</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">Method</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length > 0 ? (
                filtered.map(t => (
                  <TableRow key={t.id} className="border-border/40 hover:bg-muted/30 transition-colors">
                    <TableCell className="px-6 py-4 font-mono text-xs text-muted-foreground font-medium">
                      {t.paymentReference}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-foreground">{t.userName || "N/A"}</span>
                        <span className="text-xs font-mono text-muted-foreground">{t.bookingReference}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">{t.facilityName || "N/A"}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-xs text-foreground font-mono">₱{t.amount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">{paymentMethodLabel(t.paymentMethod)}</TableCell>
                    <TableCell className="text-center">
                      {isExpired(t) ? (
                        <Badge className="px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border border-amber-500/20 shadow-none bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Expired Link
                        </Badge>
                      ) : (
                        <Badge
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border shadow-none",
                            AUDIT_STATUS_BADGE[t.paymentStatus],
                          )}
                        >
                          {paymentStatusLabel(t.paymentStatus)}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-xs font-medium text-muted-foreground italic">
                    No transactions found matching criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

// ─── Proofs Gallery (Grid of payment proof screenshots) ──────────────────────

const PROOF_STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  pending_review: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  failed: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  refunded: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  cancelled: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  refund_requested: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  refund_processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
}

function ProofsGallery({
  transactions,
  loading,
  onCardClick,
}: {
  transactions: BuildingTransaction[]
  loading: boolean
  onCardClick: (t: BuildingTransaction) => void
}) {
  const proofs = useMemo(() => transactions.filter(t => t.qrScreenshotUrl), [transactions])
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set())

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (proofs.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed">
        <ImageIcon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground">No payment proofs uploaded yet</p>
        <p className="text-xs text-muted-foreground mt-1">QR payment screenshots will appear here once clients submit proof.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">{proofs.length} proof{proofs.length !== 1 ? 's' : ''}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {proofs.map(t => (
          <Card
            key={t.id}
            className="p-3 cursor-pointer hover:border-primary/30 transition-all"
            onClick={() => onCardClick(t)}
          >
            {brokenIds.has(t.id) ? (
              <div className="w-full aspect-video rounded-lg border border-dashed flex items-center justify-center text-muted-foreground mb-3">
                <div className="text-center">
                  <ImageIcon className="w-6 h-6 mx-auto mb-1" />
                  <p className="text-[10px]">Screenshot unavailable</p>
                </div>
              </div>
            ) : (
              <img
                src={t.qrScreenshotUrl!}
                alt={`Proof for ${t.paymentReference}`}
                className="w-full aspect-video object-cover rounded-lg border mb-3"
                onError={() => setBrokenIds(prev => new Set(prev).add(t.id))}
              />
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs font-semibold text-foreground truncate">{t.paymentReference}</p>
                <Badge className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium capitalize border-0 shrink-0", PROOF_STATUS_BADGE[t.paymentStatus])}>
                  {paymentStatusLabel(t.paymentStatus)}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{t.bookingReference} · {t.userName}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground">₱{t.amount.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</p>
              </div>
              {t.qrReferenceNumber && (
                <p className="text-[10px] text-muted-foreground font-mono truncate">Ref: {t.qrReferenceNumber}</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
