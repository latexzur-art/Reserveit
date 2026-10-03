"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { z } from "zod"
import { Card } from "@/components/ui/card"
import { ConnectedClientTopBar } from "../_components/ConnectedClientTopBar"
import { Button } from "@/components/ui/button"
import { Check, Clock, AlertCircle, Download, CreditCard, Receipt, History, RefreshCcw, Wallet, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"

import { ApplyCreditWidget } from "@/components/checkout/ApplyCreditWidget"
import { ROUTES } from '@/lib/routes'
import { isTrustedCheckoutUrl } from '@/lib/payments/checkout-url'
import { generateReceiptHtml, type PaymentRecord, type PaymentStatus } from './_lib/receipt'
import { generateRefundReceiptHtml } from './_lib/refundReceipt'
import { downloadPaymentReceipt, downloadRefundReceipt } from './_lib/downloadReceipt'
import { SkeletonList } from "@/components/ui/SkeletonList"
import { QrPaymentPanel } from "@/components/payments/QrPaymentPanel"
import { qrPanelStatus } from "@/lib/payments/qr-panel-status"
import { paymentStatusLabel } from "@/lib/enum-labels"

const isUuid = (v: unknown): v is string => z.string().uuid().safeParse(v).success

function ClientPaymentPageInner() {
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creditBalance, setCreditBalance] = useState<{ balanceCentavos: number; balancePeso: string } | null>(null)
  const [helpdeskContact, setHelpdeskContact] = useState("")
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null)

  const fetchPayments = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const response = await fetch("/api/payments")
      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data?.error || "Unable to load payments.")
        return
      }
      setPayments(data.payments ?? [])
    } catch {
      setErrorMessage("Unable to load payments. Please try again later.")
    } finally {
      setIsLoading(false)
    }
  }

  const refreshPaymentStatus = async (paymentId: string) => {
    if (!isUuid(paymentId)) {
      setErrorMessage("Missing or invalid payment ID for status refresh.")
      try { localStorage.removeItem('paymongo_pending_payment_id') } catch {}
      return
    }
    setIsProcessing(true)
    setErrorMessage(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/paymongo/status/${paymentId}`)
      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data?.error || "Unable to refresh payment status.")
        return
      }
      setMessage(data?.message || "Payment status refreshed.")
      await fetchPayments()
    } catch {
      setErrorMessage("Unable to refresh payment status. Please try again later.")
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    const result = searchParams.get("paymongo_result")
    const paymentId = searchParams.get("paymentId")
    const pendingPaymentId = typeof window !== "undefined" ? localStorage.getItem('paymongo_pending_payment_id') : null

    if (result === "success" && (paymentId || pendingPaymentId)) {
      const idToRefresh = paymentId || pendingPaymentId!
      refreshPaymentStatus(idToRefresh)
      localStorage.removeItem('paymongo_pending_payment_id')
      return
    }

    if (result === "failed") {
      setErrorMessage("PayMongo checkout did not complete. Please try again.")
      localStorage.removeItem('paymongo_pending_payment_id')
    } else if (result === "success") {
      setMessage("PayMongo checkout completed successfully. Refresh your payments to see the updated status.")
    }
  }, [searchParams])

  useEffect(() => { fetchPayments() }, [])

  // Real-time: auto-refresh when payments table changes
  useEffect(() => {
    const supabase = createSupabaseClient()
    const channel = supabase.channel('client-payments-live')
      .on('postgres_changes', { event: '*', table: 'payments', schema: 'public' }, () => {
        fetchPayments()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/credits/balance')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled) setCreditBalance(data ?? { balanceCentavos: 0, balancePeso: '0.00' }) })
      .catch(() => { if (!cancelled) setCreditBalance({ balanceCentavos: 0, balancePeso: '0.00' }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/payment-qr-codes')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled && data?.helpdeskContact) setHelpdeskContact(data.helpdeskContact) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const pendingPayments = useMemo(() => payments.filter(p => p.payment_status === "pending" || p.payment_status === "failed" || p.payment_status === "pending_review"), [payments])
  const completedPayments = useMemo(() => payments.filter(p => p.payment_status === "completed"), [payments])
  const totalPending = useMemo(() => pendingPayments.reduce((sum, p) => sum + p.amount, 0), [pendingPayments])
  const totalPaidYTD = useMemo(() => completedPayments.reduce((sum, p) => sum + p.amount, 0), [completedPayments])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount)

  const getStatusLabel = (status: PaymentStatus) => {
    return paymentStatusLabel(status)
  }

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case "completed":        return <Check className="w-3.5 h-3.5 text-emerald-500" />
      case "pending":          return <Clock className="w-3.5 h-3.5 text-amber-500" />
      case "pending_review":   return <Clock className="w-3.5 h-3.5 text-sky-500" />
      case "processing":       return <RefreshCcw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
      case "failed":           return <AlertCircle className="w-3.5 h-3.5 text-destructive" />
      case "refunded":         return <Wallet className="w-3.5 h-3.5 text-purple-500" />
      case "cancelled":        return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
      case "refund_requested": return <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
      case "refund_processing": return <RefreshCcw className="w-3.5 h-3.5 text-sky-500" />
      default:                 return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case "completed":        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
      case "pending":          return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
      case "pending_review":   return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
      case "processing":       return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
      case "failed":           return "bg-destructive/10 text-destructive border-destructive/20"
      case "refunded":         return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
      case "cancelled":        return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20"
      case "refund_requested": return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20"
      case "refund_processing": return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
      default:                 return "bg-muted text-muted-foreground border-border/50"
    }
  }

  const handlePayWithPaymongo = async (paymentId: string) => {
    if (!isUuid(paymentId)) {
      setErrorMessage("Invalid payment id.")
      return
    }
    setErrorMessage(null)
    setMessage(null)
    setIsProcessing(true)
    try {
      const response = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, returnPath: ROUTES.client.payment }),
      })
      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data?.error || "Unable to create PayMongo checkout session.")
        return
      }
      if (data?.checkoutUrl) {
        if (!isTrustedCheckoutUrl(data.checkoutUrl)) {
          setErrorMessage("Received an untrusted checkout URL. Please contact support.")
          return
        }
        try { localStorage.setItem('paymongo_pending_payment_id', paymentId) } catch {}
        window.location.href = data.checkoutUrl
        return
      }
      setErrorMessage("PayMongo did not return a checkout URL.")
    } catch {
      setErrorMessage("Unable to contact PayMongo. Please try again later.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadReceipt = (payment: PaymentRecord) => {
    downloadPaymentReceipt(payment)
  }

  const handleDownloadRefundReceipt = async (payment: PaymentRecord) => {
    try {
      const response = await fetch(`/api/payments/${payment.id}/refund`)
      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data?.error || "Unable to load refund details.")
        return
      }
      downloadRefundReceipt(payment, data.refund)
    } catch {
      setErrorMessage("Unable to load refund details.")
    }
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ConnectedClientTopBar title="Payments" breadcrumbs={[{ label: "Dashboard", href: ROUTES.client.dashboard }]} />

      <main className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 pb-24">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Payment &amp; <span className="text-yellow-600 dark:text-yellow-400">Billing</span>
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              View your invoices, session credits, and payment history
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <Card className="p-5 sm:p-6 bg-card border border-border/80 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground">Amount Due</p>
              <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{formatCurrency(totalPending)}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Pending &amp; failed invoices</span>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 bg-card border border-border/80 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground">Total Paid (YTD)</p>
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{formatCurrency(totalPaidYTD)}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>{completedPayments.length} completed transactions</span>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 bg-card border border-border/80 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground">Session Credits</p>
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            {creditBalance === null ? (
              <div className="h-8 w-28 bg-muted/60 rounded-lg animate-pulse my-1" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                ₱{Number(creditBalance.balancePeso).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            )}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CreditCard className="w-3.5 h-3.5 text-blue-500" />
              <span>{creditBalance && creditBalance.balanceCentavos > 0 ? 'Available for next booking' : 'No active credits'}</span>
            </div>
          </Card>
        </div>

        {/* History Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History size={16} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Payment History
            </h2>
          </div>

          {message && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check size={16} /> {message}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive flex items-center gap-2">
              <AlertCircle size={16} /> {errorMessage}
            </div>
          )}

          {isLoading ? (
            <SkeletonList />
          ) : payments.length === 0 ? (
            <Card className="p-12 text-center border-border/80 rounded-2xl shadow-xs">
              <Receipt className="w-10 h-10 text-muted-foreground opacity-40 mx-auto mb-3" />
              <p className="text-xs font-medium text-muted-foreground">No payment records found</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {payments.map((payment) => {
                const qrStatus = qrPanelStatus(payment.payment_method, payment.payment_status)
                return (
                <Card key={payment.id} className="p-5 sm:p-6 bg-card border border-border/80 rounded-2xl shadow-xs hover:border-primary/50 transition-all overflow-hidden">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-foreground text-sm sm:text-base">{payment.payment_reference}</p>
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          getStatusColor(payment.payment_status)
                        )}>
                          {getStatusIcon(payment.payment_status)}
                          <span>{getStatusLabel(payment.payment_status)}</span>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-primary">
                        {payment.booking?.booking_reference ?? "System Invoice"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.description ?? `Payment for ${payment.booking?.booking_purpose ?? "Facility Use"}`}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto border-t lg:border-t-0 border-border/50 pt-4 lg:pt-0">
                      <div className="text-left sm:text-right lg:pr-4">
                        <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{formatCurrency(payment.amount)}</p>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">{payment.currency} PHP</p>
                      </div>

                      {(payment.payment_status === "pending" || payment.payment_status === "failed") && (
                        <ApplyCreditWidget
                          paymentId={payment.id}
                          paymentAmountCentavos={Math.round(payment.amount * 100)}
                          returnPath={ROUTES.client.payment}
                          onApplied={(checkoutUrl, fullyCovered) => {
                            if (fullyCovered) {
                              fetchPayments()
                            } else if (checkoutUrl && isTrustedCheckoutUrl(checkoutUrl)) {
                              try { localStorage.setItem('paymongo_pending_payment_id', payment.id) } catch {}
                              window.location.href = checkoutUrl
                            }
                          }}
                        />
                      )}

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {payment.payment_method !== "qr_manual" && (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={!(payment.payment_status === "pending" || payment.payment_status === "failed") || isProcessing}
                            onClick={() => handlePayWithPaymongo(payment.id)}
                            className="h-9 px-4 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex-1 sm:flex-none shadow-xs"
                          >
                            <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Pay
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => refreshPaymentStatus(payment.id)}
                          className="h-9 px-3 rounded-xl border-border/80 text-xs font-semibold hover:bg-muted/40"
                        >
                          <RefreshCcw className={cn("w-3.5 h-3.5 mr-1.5", isProcessing && "animate-spin")} /> Sync
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={payment.payment_status !== "completed"}
                          onClick={() => handleDownloadReceipt(payment)}
                          className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
                        </Button>

                        {(payment.payment_status === "refunded" || payment.payment_status === "refund_processing") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadRefundReceipt(payment)}
                            className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          >
                            <Undo2 className="w-3.5 h-3.5 mr-1.5" /> Refund Receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Refund confirmation — shown when BA has uploaded proof */}
                  {payment.payment_status === "refund_processing" && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      <div className="bg-sky-50 dark:bg-sky-500/10 rounded-xl border border-sky-500/20 p-4 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">Refund Processed — Please Confirm</p>
                        <p className="text-xs text-sky-700 dark:text-sky-300">
                          A refund has been processed for this payment. Please check your account and confirm whether you received it.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={confirmingPayment === payment.id}
                          onClick={async () => {
                            const targetBookingId = payment.booking_id ?? payment.booking?.id
                            if (!targetBookingId) {
                              setErrorMessage("Unable to identify booking for refund confirmation.")
                              return
                            }
                            setConfirmingPayment(payment.id)
                            try {
                              const res = await fetch(`/api/bookings/${targetBookingId}/confirm-refund`, { method: "POST" })
                              if (res.ok) { setMessage("Refund confirmed. Thank you!"); fetchPayments() }
                              else { const d = await res.json().catch(() => ({})); setErrorMessage(d?.error ?? "Failed to confirm") }
                            } finally { setConfirmingPayment(null) }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-9 px-4 gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" /> Confirm Receipt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={confirmingPayment === payment.id}
                          onClick={async () => {
                            const targetBookingId = payment.booking_id ?? payment.booking?.id
                            if (!targetBookingId) {
                              setErrorMessage("Unable to identify booking for refund dispute.")
                              return
                            }
                            setConfirmingPayment(payment.id)
                            try {
                              const res = await fetch(`/api/bookings/${targetBookingId}/dispute-refund`, { method: "POST" })
                              if (res.ok) { setMessage("Dispute submitted. The building admin will contact you."); fetchPayments() }
                              else { const d = await res.json().catch(() => ({})); setErrorMessage(d?.error ?? "Failed to dispute") }
                            } finally { setConfirmingPayment(null) }
                          }}
                          className="border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl text-xs font-bold h-9 px-4 gap-1.5"
                        >
                          <AlertCircle className="w-3.5 h-3.5" /> I Did Not Receive This
                        </Button>
                      </div>
                    </div>
                  )}

                  {qrStatus && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <QrPaymentPanel
                        paymentId={payment.id}
                        payerNameDefault={payment.qr_payer_name ?? payment.booking?.user?.full_name ?? ""}
                        payerContactDefault={payment.qr_payer_contact_number ?? payment.booking?.contact_number ?? ""}
                        currentStatus={qrStatus}
                        qrReferenceNumber={payment.qr_reference_number ?? undefined}
                        rejectionReason={payment.qr_review_notes ?? undefined}
                        helpdeskContact={helpdeskContact}
                        onSubmitted={fetchPayments}
                      />
                    </div>
                  )}
                </Card>
              )})}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function ClientPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ClientPaymentPageInner />
    </Suspense>
  )
}