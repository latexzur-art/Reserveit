"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Loader2,
  ChevronDown,
  Maximize2,
  CheckCircle2,
  XCircle,
  QrCode,
  User,
  Hash,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  ChevronsUpDown,
  ChevronsUp,
} from "lucide-react"

interface Submission {
  id: string
  payer_name: string
  reference_number: string
  screenshot_url: string | null
  submitted_at: string
  qr_code?: { label: string }
}

interface ReviewPayment {
  id: string
  payment_reference: string
  amount: number
  payment_status: "pending_review" | "refund_requested" | "refund_processing" | "disputed"
  qr_payer_name?: string
  qr_reference_number?: string
  qr_screenshot_url?: string | null
  qr_payer_account_name?: string | null
  qr_payer_account_number?: string | null
  qr_code?: { label: string; account_name?: string | null; account_number?: string | null }
  booking: { booking_reference: string }
  submissions: Submission[]
}

export function NeedsReviewQueue() {
  const [payments, setPayments] = useState<ReviewPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSubmissions, setExpandedSubmissions] = useState<string | null>(null)
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ReviewPayment | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/building/payments/needs-review")
      const data = await res.json()
      const list: ReviewPayment[] = data.payments ?? []
      setPayments(list)

      // Initialize collapsed state: expand first item, collapse remaining items if multiple exist
      const initialMap: Record<string, boolean> = {}
      list.forEach((p, idx) => {
        initialMap[p.id] = idx !== 0
      })
      setCollapsedCards(initialMap)

      if (selectedIndex >= list.length && list.length > 0) {
        setSelectedIndex(list.length - 1)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedIndex])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const activePayment = payments[selectedIndex] || payments[0]

  const toggleCardCollapse = (id: string) => {
    setCollapsedCards(prev => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const toggleAllCollapse = () => {
    const allCollapsed = payments.every(p => collapsedCards[p.id])
    const newMap: Record<string, boolean> = {}
    payments.forEach(p => {
      newMap[p.id] = !allCollapsed
    })
    setCollapsedCards(newMap)
  }

  const verify = async (id: string) => {
    setBusyId(id)
    try {
      await fetch(`/api/admin/building/payments/${id}/qr-verify`, { method: "POST" })
      await fetchQueue()
    } finally {
      setBusyId(null)
    }
  }

  const openReject = (payment: ReviewPayment) => {
    setRejectReason("")
    setRejectTarget(payment)
  }

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    const target = rejectTarget
    setBusyId(target.id)
    try {
      await fetch(`/api/admin/building/payments/${target.id}/qr-reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      await fetchQueue()
    } finally {
      setBusyId(null)
    }
  }

  // Keyboard Shortcuts (V to verify, R to reject, J/K or arrows to navigate items)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        rejectTarget !== null ||
        lightboxImage !== null ||
        ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)
      ) {
        return
      }

      if (!activePayment) return

      if (e.key === "v" || e.key === "V") {
        if (activePayment.payment_status === "pending_review" && busyId !== activePayment.id) {
          e.preventDefault()
          verify(activePayment.id)
        }
      } else if (e.key === "r" || e.key === "R") {
        if (activePayment.payment_status === "pending_review" && busyId !== activePayment.id) {
          e.preventDefault()
          openReject(activePayment)
        }
      } else if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex(prev => {
          const next = prev < payments.length - 1 ? prev + 1 : prev
          if (payments[next]) {
            setCollapsedCards(cMap => ({ ...cMap, [payments[next].id]: false }))
          }
          return next
        })
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex(prev => {
          const next = prev > 0 ? prev - 1 : prev
          if (payments[next]) {
            setCollapsedCards(cMap => ({ ...cMap, [payments[next].id]: false }))
          }
          return next
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activePayment, busyId, payments, rejectTarget, lightboxImage])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-accent-brand" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Loading payment review queue…
        </span>
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <Card className="p-8 text-center border border-border/60 bg-card rounded-2xl space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">Review Queue Clear</h3>
          <p className="text-xs text-muted-foreground">Nothing needs review right now.</p>
        </div>
      </Card>
    )
  }

  const allAreCollapsed = payments.every(p => collapsedCards[p.id])

  return (
    <div className="space-y-4">
      {/* ── Queue Header Banner with Collapse All & Hotkeys ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 border border-border/50 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Awaiting Review Queue ({payments.length})
          </span>
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-[10px] font-bold uppercase">
            {payments.filter(p => p.payment_status === "pending_review").length} Pending
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Global Collapse All / Expand All Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAllCollapse}
            className="h-7 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
          >
            {allAreCollapsed ? (
              <>
                <ChevronsUpDown className="w-3.5 h-3.5 text-accent-brand" /> Expand All
              </>
            ) : (
              <>
                <ChevronsUp className="w-3.5 h-3.5 text-accent-brand" /> Collapse All
              </>
            )}
          </Button>

          {/* Keyboard shortcut hint pill */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium text-muted-foreground border-l border-border/60 pl-3">
            <span className="text-xs font-semibold text-foreground">Hotkeys:</span>
            <span className="bg-card border border-border/60 rounded px-1.5 py-0.5 font-mono text-[10px]">V</span> Verify
            <span className="bg-card border border-border/60 rounded px-1.5 py-0.5 font-mono text-[10px]">R</span> Reject
            <span className="bg-card border border-border/60 rounded px-1.5 py-0.5 font-mono text-[10px]">J/K</span> Navigate
          </div>
        </div>
      </div>

      {/* ── Multi-Item Queue Stack List ── */}
      <div className="space-y-3">
        {payments.map((p, idx) => {
          const isCollapsed = !!collapsedCards[p.id]
          const isSelected = idx === selectedIndex

          return (
            <Card
              key={p.id}
              className={`border transition-all duration-200 bg-card rounded-2xl overflow-hidden shadow-xs ${
                isSelected
                  ? "border-accent-brand/60 ring-1 ring-accent-brand/20"
                  : "border-border/60 hover:border-border"
              }`}
            >
              {/* ── Clickable Collapsible Header Summary Bar ── */}
              <div
                onClick={() => {
                  setSelectedIndex(idx)
                  toggleCardCollapse(p.id)
                }}
                className="p-4 cursor-pointer hover:bg-muted/20 transition-colors flex flex-wrap items-center justify-between gap-3 select-none"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted border border-border/60 flex items-center justify-center font-mono text-xs font-bold text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <div>
                    <h2 className="font-mono text-sm font-bold text-foreground tracking-tight">
                      {p.booking.booking_reference} — {p.payment_reference}
                    </h2>
                    {isCollapsed && p.qr_payer_name && (
                      <p className="text-xs font-medium text-muted-foreground mt-0.5">
                        <strong className="text-foreground">{p.qr_payer_name}</strong> · {p.qr_code?.label || "QR"} · Ref: {p.qr_reference_number}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-black tracking-tight text-foreground font-mono">
                    ₱{p.amount.toLocaleString()}
                  </span>
                  <Badge variant={p.payment_status === "refund_requested" ? "destructive" : p.payment_status === "disputed" ? "destructive" : "secondary"}>
                    {p.payment_status === "refund_requested"
                      ? "AH-approved cancellation — full refund owed"
                      : p.payment_status === "disputed"
                        ? "Client disputed — re-upload proof"
                        : "Awaiting proof review"}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedIndex(idx)
                      toggleCardCollapse(p.id)
                    }}
                    title={isCollapsed ? "Expand workbench" : "Collapse workbench"}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isCollapsed ? "" : "rotate-180"
                      }`}
                    />
                  </Button>
                </div>
              </div>

              {/* ── Expanded 2-Column Split Workbench ── */}
              {!isCollapsed && (
                <div className="p-5 border-t border-border/40 space-y-5 bg-card">
                  {p.payment_status === "pending_review" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* ── LEFT COLUMN: Screenshot Proof Viewer Workbench (5 cols) ── */}
                      <div className="lg:col-span-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-accent-brand" /> Payment Receipt Proof
                          </span>
                          {p.qr_screenshot_url && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[11px] font-semibold gap-1 text-accent-brand hover:text-accent-brand"
                                >
                                  <Maximize2 className="w-3 h-3" /> Full View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 bg-slate-950 border-slate-800">
                                <DialogHeader>
                                  <DialogTitle className="text-sm font-mono text-white">
                                    Proof Screenshot — {p.booking.booking_reference}
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="flex items-center justify-center p-2">
                                  <img
                                    src={p.qr_screenshot_url}
                                    alt="Payment screenshot full view"
                                    className="max-h-[75vh] object-contain rounded-lg border border-slate-800"
                                  />
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>

                        <div className="relative group rounded-xl border border-border/60 bg-muted/30 p-3 flex flex-col items-center justify-center min-h-[320px] overflow-hidden">
                          {p.qr_screenshot_url ? (
                            <div className="relative w-full flex justify-center">
                              <img
                                src={p.qr_screenshot_url}
                                alt="Payment screenshot"
                                className="max-w-xs max-h-[360px] object-contain rounded-lg border border-border/80 shadow-md transition-transform group-hover:scale-[1.01]"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="text-xs font-bold shadow-lg"
                                  onClick={() => setLightboxImage(p.qr_screenshot_url!)}
                                >
                                  <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Inspect Image
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-12 space-y-2 text-muted-foreground">
                              <ImageIcon className="w-10 h-10 mx-auto opacity-40" />
                              <p className="text-xs font-medium">No screenshot attached</p>
                            </div>
                          )}
                        </div>

                        {/* Previous Submissions Drawer */}
                        {p.submissions.length > 1 && (
                          <div className="space-y-2 pt-2 border-t border-border/40">
                            <button
                              type="button"
                              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                              aria-expanded={expandedSubmissions === p.id}
                              onClick={() =>
                                setExpandedSubmissions(
                                  expandedSubmissions === p.id ? null : p.id,
                                )
                              }
                            >
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform ${
                                  expandedSubmissions === p.id ? "rotate-180" : ""
                                }`}
                                aria-hidden="true"
                              />
                              Previous submissions ({p.submissions.length - 1})
                            </button>

                            {expandedSubmissions === p.id && (
                              <div className="pl-3 border-l-2 border-accent-brand/40 space-y-2 py-1">
                                {p.submissions.slice(0, -1).map(s => (
                                  <div
                                    key={s.id}
                                    className="text-xs text-muted-foreground space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40"
                                  >
                                    <p className="font-semibold text-foreground">
                                      {s.payer_name} · {s.qr_code?.label || "QR"}
                                    </p>
                                    <p className="font-mono text-[11px]">
                                      Ref: {s.reference_number}
                                    </p>
                                    <p className="text-[10px]">
                                      {new Date(s.submitted_at).toLocaleString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── RIGHT COLUMN: Transaction & Verification Metadata (7 cols) ── */}
                      <div className="lg:col-span-7 space-y-4">
                        {/* Prominent Payer Detail Card */}
                        <div className="bg-muted/20 border border-border/60 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-border/40 pb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-accent-brand" /> Submitted Payer Profile
                            </span>
                            <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-0 text-[10px] font-semibold">
                              {p.qr_code?.label || "Payment Method"}
                            </Badge>
                          </div>

                          <p className="text-sm text-foreground">
                            <strong>{p.qr_payer_name}</strong> · {p.qr_code?.label} · Ref: {p.qr_reference_number}
                          </p>

                          {(p.qr_code?.account_name || p.qr_code?.account_number) && (
                            <p className="text-xs text-muted-foreground">
                              Account: {p.qr_code.account_name} {p.qr_code.account_number && <span className="font-mono">({p.qr_code.account_number})</span>}
                            </p>
                          )}

                          {(p.qr_payer_account_name || p.qr_payer_account_number) && (
                            <p className="text-xs text-muted-foreground">
                              Payer account: {p.qr_payer_account_name} {p.qr_payer_account_number && <span className="font-mono">({p.qr_payer_account_number})</span>}
                            </p>
                          )}
                        </div>

                        {/* Validation Safeguard Alert */}
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-0.5">
                            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                              Reference Verification Checklist
                            </p>
                            <p className="text-emerald-800/80 dark:text-emerald-300/80">
                              Confirm that the submitted reference number matches your merchant bank transaction statement before clicking Verify.
                            </p>
                          </div>
                        </div>

                        {/* ── Action Buttons Workbench Bar ── */}
                        <div className="pt-4 border-t border-border/60 flex flex-wrap gap-3 items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              disabled={busyId === p.id}
                              onClick={() => verify(p.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 h-9 rounded-xl gap-2 shadow-xs"
                            >
                              {busyId === p.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Verify
                              <span className="bg-emerald-700/60 font-mono text-[10px] px-1.5 py-0.5 rounded text-white font-normal">
                                V
                              </span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === p.id}
                              onClick={() => openReject(p)}
                              className="border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 font-bold text-xs px-4 h-9 rounded-xl gap-2 shadow-xs"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                              <span className="bg-muted border border-border font-mono text-[10px] px-1.5 py-0.5 rounded text-muted-foreground font-normal">
                                R
                              </span>
                            </Button>
                          </div>

                          <span className="text-[11px] font-medium text-muted-foreground">
                            Target: <span className="font-mono text-foreground font-semibold">{p.payment_reference}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {p.payment_status === "refund_requested" && (
                    <p className="text-sm text-muted-foreground">
                      Open this row&apos;s booking in the payment list below to confirm the refund with evidence.
                    </p>
                  )}

                  {p.payment_status === "disputed" && (
                    <div className="space-y-3">
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5">
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-rose-900 dark:text-rose-200">
                            Client Disputed This Refund
                          </p>
                          <p className="text-rose-800/80 dark:text-rose-300/80">
                            The client reports they did not receive the refund. Open this payment in the detail dialog to re-upload proof and resolve the dispute.
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Open this row&apos;s booking in the payment list below and use <strong>Resolve Dispute</strong> to re-upload refund proof.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Rejection Dialog */}
      <AlertDialog
        open={rejectTarget !== null}
        onOpenChange={open => {
          if (!open) setRejectTarget(null)
        }}
      >
        <AlertDialogContent className="rounded-2xl border-border bg-card shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Reject payment proof for {rejectTarget?.booking.booking_reference}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Explain what&apos;s wrong with the submitted proof. This reason is shown to the renter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="reject-reason" className="text-xs font-semibold">
              Rejection reason
            </Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Reference number does not match our bank statement records"
              className="rounded-xl text-xs min-h-[90px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs font-semibold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!rejectReason.trim()}
              onClick={confirmReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold"
            >
              Confirm reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox Image Preview Dialog */}
      {lightboxImage && (
        <Dialog
          open={lightboxImage !== null}
          onOpenChange={open => {
            if (!open) setLightboxImage(null)
          }}
        >
          <DialogContent className="max-w-4xl max-h-[95vh] p-4 bg-slate-950 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-xs font-mono text-white flex items-center justify-between">
                <span>Receipt Screenshot Inspector</span>
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
    </div>
  )
}
