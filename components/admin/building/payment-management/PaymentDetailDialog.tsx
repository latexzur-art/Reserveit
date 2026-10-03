"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  CreditCard,
  QrCode,
  User,
  Building2,
  Calendar,
  ImageIcon,
  Maximize2,
  CheckCircle2,
  XCircle,
  UploadCloud,
} from "lucide-react"
import { DiscretionaryRefundDialog } from "./DiscretionaryRefundDialog"
import type { BuildingTransaction } from "@/backend/admin/building/building.types"
import { cn } from "@/lib/utils"
import { paymentStatusLabel } from "@/lib/enum-labels"

const METHOD_LABELS: Record<string, string> = {
  paymongo_card: "Credit / Debit Card",
  paymongo_gcash: "GCash",
  paymongo_grab: "GrabPay",
  paymongo_maya: "Maya",
  cashier: "Cash (Cashier)",
  qr_manual: "QR Manual Payment",
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending_review: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  failed: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  refunded: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  refund_requested: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  refund_processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  disputed: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
}

interface RefundInfo {
  amount: number
  reference_number: string | null
  screenshot_url: string | null
  destination_name: string
  destination_contact_number: string
  destination_qr_url?: string | null
  justification_note: string | null
  trigger_type: string
  recorded_at: string
}

interface Props {
  transaction: BuildingTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh?: () => void
}

export function PaymentDetailDialog({ transaction, open, onOpenChange, onRefresh }: Props) {
  const [refund, setRefund] = useState<RefundInfo | null>(null)
  const [loadingRefund, setLoadingRefund] = useState(false)
  const [refundError, setRefundError] = useState(false)
  const [qrImgBroken, setQrImgBroken] = useState(false)
  const [refundImgBroken, setRefundImgBroken] = useState(false)

  const [busyAction, setBusyAction] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  // Proof upload state
  const [proofOpen, setProofOpen] = useState(false)
  const [proofRef, setProofRef] = useState("")
  const [proofUrl, setProofUrl] = useState("")
  const [uploadingProof, setUploadingProof] = useState(false)

  // Dispute resolve state
  const [disputeProofOpen, setDisputeProofOpen] = useState(false)
  const [disputeProofRef, setDisputeProofRef] = useState("")
  const [disputeProofUrl, setDisputeProofUrl] = useState("")
  const [uploadingDisputeProof, setUploadingDisputeProof] = useState(false)

  const needsRefundFetch = transaction?.paymentStatus === "refunded"
    || transaction?.paymentStatus === "refund_processing"
    || transaction?.paymentStatus === "refund_requested"
    || transaction?.paymentStatus === "disputed"

  useEffect(() => {
    if (!open || !transaction || !needsRefundFetch) {
      setRefund(null)
      setRefundError(false)
      return
    }

    let cancelled = false
    setLoadingRefund(true)
    setRefundError(false)
    fetch(`/api/payments/${transaction.id}/refund`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch refund details")
        return res.json()
      })
      .then(data => {
        if (!cancelled && data?.refund) setRefund(data.refund)
      })
      .catch(() => {
        if (!cancelled) setRefundError(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingRefund(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, transaction?.id, transaction?.paymentStatus])

  if (!transaction) return null

  const isQr = transaction.paymentMethod === "qr_manual" || transaction.paymentMethod === "qr"
  const isPendingReview = transaction.paymentStatus === "pending_review"

  const handleVerify = async () => {
    setBusyAction(true)
    try {
      await fetch(`/api/admin/building/payments/${transaction.id}/qr-verify`, { method: "POST" })
      onRefresh?.()
      onOpenChange(false)
    } finally {
      setBusyAction(false)
    }
  }

  const handleUploadProof = async () => {
    if (!proofRef.trim() || !proofUrl.trim()) return
    setBusyAction(true)
    try {
      await fetch(`/api/admin/building/payments/${transaction.id}/refund-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_number: proofRef.trim(), screenshot_url: proofUrl.trim() }),
      })
      setProofOpen(false)
      onRefresh?.()
      onOpenChange(false)
    } finally {
      setBusyAction(false)
    }
  }

  const handleResolveDispute = async () => {
    if (!disputeProofRef.trim() || !disputeProofUrl.trim()) return
    setBusyAction(true)
    try {
      await fetch(`/api/admin/building/payments/${transaction.id}/resolve-dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_number: disputeProofRef.trim(), screenshot_url: disputeProofUrl.trim() }),
      })
      setDisputeProofOpen(false)
      onRefresh?.()
      onOpenChange(false)
    } finally {
      setBusyAction(false)
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return
    setBusyAction(true)
    try {
      await fetch(`/api/admin/building/payments/${transaction.id}/qr-reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      setRejectOpen(false)
      onRefresh?.()
      onOpenChange(false)
    } finally {
      setBusyAction(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl p-0 bg-card border-border/80 shadow-2xl max-w-lg max-h-[88vh] flex flex-col overflow-hidden">
          {/* ── Fixed Sticky Modal Header (No Clipping) ── */}
          <DialogHeader className="p-6 pb-4 border-b border-border/60 shrink-0 bg-card">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Payment Details
                </DialogTitle>
                <p className="font-mono text-xs font-semibold text-muted-foreground mt-1">
                  {transaction.paymentReference} · Booking: {transaction.bookingReference}
                </p>
              </div>
              <Badge
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border shadow-none shrink-0",
                  STATUS_BADGE_CLASSES[transaction.paymentStatus],
                )}
              >
                {paymentStatusLabel(transaction.paymentStatus)}
              </Badge>
            </div>
          </DialogHeader>

          {/* ── Scrollable Body Content ── */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Prominent Amount Callout */}
            <div className="text-center bg-muted/20 border border-border/60 rounded-xl p-4 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Transaction Amount
              </p>
              <p className="text-3xl font-black tracking-tight text-foreground font-mono">
                ₱{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">{transaction.currency}</p>
            </div>

            {/* Core Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-card border border-border/60 rounded-xl p-4">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3 h-3 text-accent-brand" /> Client
                </p>
                <p className="font-bold text-foreground text-sm">{transaction.userName || "N/A"}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-accent-brand" /> Facility
                </p>
                <p className="font-bold text-foreground text-sm">{transaction.facilityName || "N/A"}</p>
              </div>
              <div className="space-y-0.5 pt-2 border-t border-border/40">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3 text-accent-brand" /> Payment Method
                </p>
                <p className="font-semibold text-foreground">
                  {METHOD_LABELS[transaction.paymentMethod] || transaction.paymentMethod}
                </p>
              </div>
              <div className="space-y-0.5 pt-2 border-t border-border/40">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-accent-brand" /> Date Created
                </p>
                <p className="font-semibold text-foreground">
                  {new Date(transaction.createdAt).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* QR Payment Details & Proof Viewer */}
            {isQr && (
              <div className="space-y-3 bg-muted/20 border border-border/60 rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-border/40 pb-2">
                  <QrCode className="w-3.5 h-3.5 text-accent-brand" /> QR Payment Details
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {transaction.qrPayerName && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Payer Name</p>
                      <p className="font-bold text-foreground">{transaction.qrPayerName}</p>
                    </div>
                  )}
                  {transaction.qrReferenceNumber && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Reference Number</p>
                      <p className="font-mono font-bold text-foreground">{transaction.qrReferenceNumber}</p>
                    </div>
                  )}
                  {transaction.qrAccountName && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Account Name</p>
                      <p className="font-semibold text-foreground">{transaction.qrAccountName}</p>
                    </div>
                  )}
                  {transaction.qrAccountNumber && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Account Number</p>
                      <p className="font-mono font-semibold text-foreground">{transaction.qrAccountNumber}</p>
                    </div>
                  )}
                  {transaction.qrPayerAccountName && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Payer Account Name</p>
                      <p className="font-semibold text-foreground">{transaction.qrPayerAccountName}</p>
                    </div>
                  )}
                  {transaction.qrPayerAccountNumber && (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Payer Account Number</p>
                      <p className="font-mono font-semibold text-foreground">{transaction.qrPayerAccountNumber}</p>
                    </div>
                  )}
                </div>

                {transaction.qrScreenshotUrl && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-accent-brand" /> Payment Screenshot
                      </p>
                      {!qrImgBroken && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] font-semibold gap-1 text-accent-brand hover:text-accent-brand"
                          onClick={() => setLightboxImage(transaction.qrScreenshotUrl!)}
                        >
                          <Maximize2 className="w-3 h-3" /> Expand View
                        </Button>
                      )}
                    </div>

                    {qrImgBroken ? (
                      <div className="flex items-center gap-2 p-4 rounded-xl border border-dashed border-border text-muted-foreground">
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-xs font-medium">Screenshot unavailable (link expired)</span>
                      </div>
                    ) : (
                      <div className="relative group rounded-xl border border-border/60 bg-slate-950 p-2 flex justify-center overflow-hidden">
                        <img
                          src={transaction.qrScreenshotUrl}
                          alt="Payment screenshot"
                          className="rounded-lg max-h-52 object-contain w-full transition-transform group-hover:scale-[1.01]"
                          onError={() => setQrImgBroken(true)}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs font-bold shadow-lg"
                            onClick={() => setLightboxImage(transaction.qrScreenshotUrl!)}
                          >
                            <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Inspect Image
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Refund Details — shown for refund_requested, refund_processing, refunded, disputed */}
            {(transaction.paymentStatus === "refunded" || transaction.paymentStatus === "refund_processing" || transaction.paymentStatus === "refund_requested" || transaction.paymentStatus === "disputed") && (
              <div className="space-y-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-200">
                    Refund Record
                  </p>
                  {transaction.paymentStatus === "refund_requested" && (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">Upload Proof Required</Badge>
                  )}
                  {transaction.paymentStatus === "refund_processing" && (
                    <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px]">Awaiting Client Confirmation</Badge>
                  )}
                  {transaction.paymentStatus === "disputed" && (
                    <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px]">Client Disputed — Action Required</Badge>
                  )}
                </div>
                {loadingRefund ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400" />
                  </div>
                ) : refundError ? (
                  <p className="text-xs text-rose-500 italic">
                    Failed to load refund details. Try reopening the dialog.
                  </p>
                ) : refund ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Refund Amount</p>
                      <p className="font-bold text-foreground font-mono text-sm">
                        ₱{refund.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Destination</p>
                      <p className="font-semibold text-foreground">{refund.destination_name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{refund.destination_contact_number}</p>
                    </div>
                    {refund.destination_qr_url && (
                      <div className="space-y-1.5 col-span-2 p-3 bg-muted/40 rounded-xl border border-border/60">
                        <p className="text-[11px] text-muted-foreground uppercase font-bold flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                          Renter Refund QR Reference
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="relative w-20 h-20 rounded-lg border border-slate-700 bg-slate-950 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-sm group">
                            <img
                              src={refund.destination_qr_url}
                              alt="Renter Refund QR Reference"
                              className="max-w-full max-h-full object-contain rounded transition-transform group-hover:scale-105"
                            />
                            <button
                              type="button"
                              onClick={() => setLightboxImage(refund.destination_qr_url!)}
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                              title="Inspect Full QR"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-foreground">Scan with GCash / Maya</p>
                            <p className="text-[11px] text-muted-foreground">Scan to send refund directly to {refund.destination_name} ({refund.destination_contact_number}).</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setLightboxImage(refund.destination_qr_url!)}
                              className="h-6 px-2 text-[11px] text-primary hover:text-primary font-medium"
                            >
                              <Maximize2 className="w-3 h-3 mr-1" /> View Full QR
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    {refund.reference_number && (
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-muted-foreground uppercase font-semibold">Reference Number</p>
                        <p className="font-mono font-bold text-foreground">{refund.reference_number}</p>
                      </div>
                    )}
                    {refund.screenshot_url && (
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-muted-foreground uppercase font-semibold">Proof Screenshot</p>
                        <a href={refund.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-accent-brand underline text-xs">View Screenshot</a>
                      </div>
                    )}
                    {refund.justification_note && (
                      <div className="space-y-0.5 col-span-2">
                        <p className="text-[11px] text-muted-foreground uppercase font-semibold">Justification</p>
                        <p className="text-xs text-foreground bg-card p-2 rounded-lg border border-border/40">{refund.justification_note}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No refund details available.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Sticky Action Buttons Footer ── */}
          <div className="p-4 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-between gap-3">
            {isPendingReview ? (
              <div className="flex items-center gap-2 w-full justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={busyAction}
                    onClick={handleVerify}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 h-9 rounded-xl gap-1.5 shadow-xs"
                  >
                    {busyAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Verify Payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyAction}
                    onClick={() => {
                      setRejectReason("")
                      setRejectOpen(true)
                    }}
                    className="border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 font-bold text-xs px-4 h-9 rounded-xl gap-1.5 shadow-xs"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Proof
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs font-semibold">
                  Close
                </Button>
              </div>
            ) : transaction.paymentStatus === "refund_requested" ? (
              <div className="flex items-center justify-between w-full">
                <Button
                  size="sm"
                  disabled={busyAction}
                  onClick={() => { setProofRef(""); setProofUrl(""); setProofOpen(true) }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 h-9 rounded-xl gap-1.5 shadow-xs"
                >
                  {busyAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Upload Proof
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs font-semibold">
                  Close
                </Button>
              </div>
            ) : transaction.paymentStatus === "refund_processing" ? (
              <div className="flex items-center justify-between w-full">
                <p className="text-xs text-muted-foreground italic">Awaiting client confirmation</p>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs font-semibold">
                  Close
                </Button>
              </div>
            ) : transaction.paymentStatus === "disputed" ? (
              <div className="flex items-center justify-between w-full">
                <Button
                  size="sm"
                  disabled={busyAction}
                  onClick={() => { setDisputeProofRef(""); setDisputeProofUrl(""); setDisputeProofOpen(true) }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 h-9 rounded-xl gap-1.5 shadow-xs"
                >
                  {busyAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  Resolve Dispute
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs font-semibold">
                  Close
                </Button>
              </div>
            ) : transaction.paymentStatus === "completed" ? (
              <div className="flex items-center justify-between w-full">
                <DiscretionaryRefundDialog
                  paymentId={transaction.id}
                  totalAmount={transaction.amount}
                  onSuccess={() => {
                    onRefresh?.()
                    onOpenChange(false)
                  }}
                  trigger={
                    <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold h-9">
                      Discretionary Refund
                    </Button>
                  }
                />
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs font-semibold">
                  Close
                </Button>
              </div>
            ) : (
              <div className="flex justify-end w-full">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs font-semibold">
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Modal inside Detail Dialog */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent className="rounded-2xl border-border bg-card shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Reject payment proof for {transaction.bookingReference}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Explain what&apos;s wrong with the submitted proof. This reason is shown to the renter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="detail-reject-reason" className="text-xs font-semibold">
              Rejection reason
            </Label>
            <Textarea
              id="detail-reject-reason"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Reference number does not match our bank statement records"
              className="rounded-xl text-xs min-h-[90px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!rejectReason.trim() || busyAction}
              onClick={handleRejectConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold"
            >
              Confirm reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox Dialog inside Detail Dialog */}
      {lightboxImage && (
        <Dialog open={lightboxImage !== null} onOpenChange={open => { if (!open) setLightboxImage(null) }}>
          <DialogContent className="max-w-4xl max-h-[95vh] p-4 bg-slate-950 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-xs font-mono text-white">
                Receipt Screenshot Inspector — {transaction.paymentReference}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-2">
              <img
                src={lightboxImage}
                alt="Enlarged payment proof screenshot"
                className="max-h-[80vh] object-contain rounded-lg border border-slate-800"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Proof Upload Dialog */}
      <AlertDialog open={proofOpen} onOpenChange={setProofOpen}>
        <AlertDialogContent className="rounded-2xl border-border bg-card shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Upload Refund Proof
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Provide the reference number and screenshot of the outgoing transfer for {transaction.bookingReference}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="proof-ref" className="text-xs font-semibold">Reference Number <span className="text-destructive">*</span></Label>
              <Input
                id="proof-ref"
                value={proofRef}
                onChange={e => setProofRef(e.target.value)}
                placeholder="Bank/GCash/Maya reference number"
                className="rounded-xl text-xs h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirmation Picture / Screenshot <span className="text-destructive">*</span></Label>
              {proofUrl ? (
                <div className="flex items-center gap-3 p-2.5 bg-muted/30 border border-border rounded-xl">
                  <img
                    src={proofUrl}
                    alt="Proof Preview"
                    className="w-16 h-16 object-contain rounded-lg border bg-background"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Proof Attached
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setProofUrl("")}
                        className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                      >
                        Change / Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label
                    htmlFor="proof-file-upload"
                    className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-border hover:border-emerald-500/50 rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors text-center"
                  >
                    {uploadingProof ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                        Uploading proof...
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 text-muted-foreground mb-1" />
                        <span className="text-xs font-semibold text-foreground">Upload Transfer Screenshot</span>
                        <span className="text-[10px] text-muted-foreground">PNG, JPG or WebP (max 5MB)</span>
                      </>
                    )}
                  </label>
                  <input
                    id="proof-file-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingProof}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploadingProof(true)
                      try {
                        const formData = new FormData()
                        formData.append("file", file)
                        const res = await fetch("/api/payments/screenshot-upload", {
                          method: "POST",
                          body: formData,
                        })
                        const data = await res.json()
                        if (res.ok && data?.url) {
                          setProofUrl(data.url)
                        }
                      } catch {
                        // ignore
                      } finally {
                        setUploadingProof(false)
                      }
                    }}
                    className="hidden"
                  />
                  <div className="relative flex items-center justify-center py-0.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-card px-2">or paste URL</span>
                  </div>
                  <Input
                    id="proof-url"
                    value={proofUrl}
                    onChange={e => setProofUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl text-xs h-9"
                  />
                </div>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!proofRef.trim() || !proofUrl.trim() || busyAction}
              onClick={handleUploadProof}
              className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold"
            >
              {busyAction ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Upload & Notify Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dispute Resolve Dialog */}
      <AlertDialog open={disputeProofOpen} onOpenChange={setDisputeProofOpen}>
        <AlertDialogContent className="rounded-2xl border-border bg-card shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Resolve Dispute — Re-upload Refund Proof
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              The client disputed this refund. Provide new proof for {transaction.bookingReference} to re-send the refund notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="dispute-proof-ref" className="text-xs font-semibold">Reference Number <span className="text-destructive">*</span></Label>
              <Input
                id="dispute-proof-ref"
                value={disputeProofRef}
                onChange={e => setDisputeProofRef(e.target.value)}
                placeholder="Bank/GCash/Maya reference number"
                className="rounded-xl text-xs h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirmation Picture / Screenshot <span className="text-destructive">*</span></Label>
              {disputeProofUrl ? (
                <div className="flex items-center gap-3 p-2.5 bg-muted/30 border border-border rounded-xl">
                  <img
                    src={disputeProofUrl}
                    alt="Dispute Proof Preview"
                    className="w-16 h-16 object-contain rounded-lg border bg-background"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Proof Attached
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisputeProofUrl("")}
                        className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                      >
                        Change / Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label
                    htmlFor="dispute-proof-file-upload"
                    className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-border hover:border-rose-500/50 rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors text-center"
                  >
                    {uploadingDisputeProof ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                        Uploading proof...
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 text-muted-foreground mb-1" />
                        <span className="text-xs font-semibold text-foreground">Upload Transfer Screenshot</span>
                        <span className="text-[10px] text-muted-foreground">PNG, JPG or WebP (max 5MB)</span>
                      </>
                    )}
                  </label>
                  <input
                    id="dispute-proof-file-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingDisputeProof}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploadingDisputeProof(true)
                      try {
                        const formData = new FormData()
                        formData.append("file", file)
                        const res = await fetch("/api/payments/screenshot-upload", {
                          method: "POST",
                          body: formData,
                        })
                        const data = await res.json()
                        if (res.ok && data?.url) {
                          setDisputeProofUrl(data.url)
                        }
                      } catch {
                        // ignore
                      } finally {
                        setUploadingDisputeProof(false)
                      }
                    }}
                    className="hidden"
                  />
                  <div className="relative flex items-center justify-center py-0.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-card px-2">or paste URL</span>
                  </div>
                  <Input
                    id="dispute-proof-url"
                    value={disputeProofUrl}
                    onChange={e => setDisputeProofUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl text-xs h-9"
                  />
                </div>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!disputeProofRef.trim() || !disputeProofUrl.trim() || busyAction}
              onClick={handleResolveDispute}
              className="bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold"
            >
              {busyAction ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Re-send Proof & Notify Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
