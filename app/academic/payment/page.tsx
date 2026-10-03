"use client"

import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState, useCallback, Suspense } from "react"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { ROUTES } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { Check, Clock, AlertCircle, Download, CreditCard, Receipt, Wallet, History, Undo2 } from "lucide-react"
import { ApplyCreditWidget } from "@/components/checkout/ApplyCreditWidget"
import { cn } from "@/lib/utils"
import { SkeletonList } from "@/components/ui/SkeletonList"
import { paymentStatusLabel } from "@/lib/enum-labels"
import { generateRefundReceiptHtml } from "@/app/client/payment/_lib/refundReceipt"
import { generateReceiptHtml } from "@/app/client/payment/_lib/receipt"
import { downloadPaymentReceipt, downloadRefundReceipt } from "@/app/client/payment/_lib/downloadReceipt"
import { QrPaymentPanel } from "@/components/payments/QrPaymentPanel"
import { qrPanelStatus } from "@/lib/payments/qr-panel-status"
import { isTrustedCheckoutUrl } from '@/lib/payments/checkout-url'


type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded" | "cancelled" | "pending_review" | "refund_requested" | "refund_processing"

interface CostLineItem {
  label: string
  hours: number
  rate: number
  subtotal: number
  isFlatFee?: boolean
}

interface PaymentRecord {
  id: string
  payment_reference: string
  amount: number
  currency: string
  payment_method: string
  payment_status: PaymentStatus
  description: string | null
  paymongo_checkout_url?: string | null
  paymongo_webhook_data?: Record<string, any> | null
  created_at: string
  updated_at: string
  qr_payer_name?: string | null
  qr_payer_contact_number?: string | null
  qr_reference_number?: string | null
  qr_review_notes?: string | null
  metadata?: {
    facility_name?: string
    booking_purpose?: string
    purpose?: string
    cost_breakdown?: CostLineItem[]
  } | null
  booking?: {
    id: string
    booking_reference: string
    booking_purpose: string
    purpose: string
    current_status: string
    organization_name?: string | null
    contact_number?: string | null
    user?: {
      full_name: string
      email: string
    } | null
  }
}

function AcademicHeadPaymentPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creditBalance, setCreditBalance] = useState<{ balanceCentavos: number; balancePeso: string } | null>(null)
  const [helpdeskContact, setHelpdeskContact] = useState("")

  // Notifications for topbar
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/academic-head/notifications?limit=5')
      if (res.ok) {
        const data = await res.json()
        const TYPE_MAP: Record<string, 'info' | 'warning' | 'success' | 'error'> = {
          booking: 'info', maintenance: 'warning', conflict: 'error', system: 'info',
          success: 'success', warning: 'warning', error: 'error', info: 'info',
        }
        const notifs = (data.notifications || []).map((n: any) => ({
          id: n.id,
          type: TYPE_MAP[n.type] ?? 'info',
          title: n.title || '',
          message: n.message || '',
          read: n.read ?? false,
          createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
        }))
        setNotifications(notifs)
        setUnreadCount(notifs.filter((n: any) => !n.read).length)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

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
    if (!paymentId) return
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
      refreshPaymentStatus(paymentId || pendingPaymentId!)
      localStorage.removeItem('paymongo_pending_payment_id')
      return
    }
    if (result === "failed") {
      setErrorMessage("PayMongo checkout did not complete. Please try again.")
      localStorage.removeItem('paymongo_pending_payment_id')
    } else if (result === "success") {
      setMessage("Payment completed. Refresh to see updated status.")
    }
  }, [searchParams])

  useEffect(() => { fetchPayments() }, [])

  // Real-time: auto-refresh when payments table changes
  useEffect(() => {
    const supabase = createSupabaseClient()
    const channel = supabase.channel('academic-payments-live')
      .on('postgres_changes', { event: '*', table: 'payments', schema: 'public' }, () => {
        fetchPayments()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const pendingPayments = payments.filter(p => p.payment_status === "pending" || p.payment_status === "failed" || p.payment_status === "pending_review")
  const completedPayments = payments.filter(p => p.payment_status === "completed")
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount)

  const getStatusLabel = (status: PaymentStatus) => {
    return paymentStatusLabel(status)
  }

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case "completed":        return <Check className="w-4 h-4 text-emerald-500" />
      case "pending":          return <Clock className="w-4 h-4 text-amber-500" />
      case "pending_review":   return <Clock className="w-4 h-4 text-sky-500" />
      case "processing":       return <Clock className="w-4 h-4 text-blue-500 animate-spin" />
      case "failed":           return <AlertCircle className="w-4 h-4 text-rose-500" />
      case "refunded":         return <Wallet className="w-4 h-4 text-purple-500" />
      case "cancelled":        return <AlertCircle className="w-4 h-4 text-slate-500" />
      case "refund_requested": return <AlertCircle className="w-4 h-4 text-orange-500" />
      case "refund_processing": return <Clock className="w-4 h-4 text-sky-500" />
      default:                 return <AlertCircle className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case "completed":        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      case "pending":          return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      case "pending_review":   return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
      case "processing":       return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      case "failed":           return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
      case "refunded":         return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      case "cancelled":        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
      case "refund_requested": return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
      case "refund_processing": return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
      default:                 return "bg-slate-500/10 text-slate-500 border-slate-500/20"
    }
  }

  const handlePayWithPaymongo = async (paymentId: string) => {
    setErrorMessage(null)
    setMessage(null)
    setIsProcessing(true)
    try {
      const response = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, returnPath: ROUTES.academic.payment }),
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">
            Payment &amp; <span className="text-accent-brand">Billing</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
            Academic Program Invoices, Session Credits, and Payment Records for STI College Lucena
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold rounded-xl">
            {payments.length} {payments.length === 1 ? 'Record' : 'Records'} Found
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5 bg-card border border-border/80 rounded-2xl shadow-xs transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Amount Due</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground mt-2">{formatCurrency(totalPending)}</p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>Pending &amp; failed invoices</span>
          </div>
        </Card>

        <Card className="p-5 bg-card border border-border/80 rounded-2xl shadow-xs transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Paid (YTD)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {formatCurrency(completedPayments.reduce((s, p) => s + p.amount, 0))}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{completedPayments.length} completed transactions</span>
          </div>
        </Card>

        <Card className="p-5 bg-card border border-border/80 rounded-2xl shadow-xs transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Session Credits</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          {creditBalance === null ? (
            <div className="h-8 w-28 bg-muted rounded-xl animate-pulse mt-2" />
          ) : (
            <p className="text-2xl font-bold tracking-tight text-foreground mt-2">
              ₱{Number(creditBalance.balancePeso).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <CreditCard className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              {creditBalance && creditBalance.balanceCentavos > 0 ? 'Available for next booking' : 'No credits available yet'}
            </span>
          </div>
        </Card>
      </div>

      {/* List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pt-2">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" /> Billing History
          </h2>
        </div>

        {message && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2.5">
            <Check className="w-4 h-4 shrink-0" /> {message}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
          </div>
        )}

        {isLoading ? (
          <SkeletonList />
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-border shadow-xs text-center p-8">
            <div className="w-12 h-12 rounded-2xl bg-muted/80 flex items-center justify-center text-muted-foreground mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No billing records found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Payment invoices and official receipts will automatically appear here once your room bookings are created and approved.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {payments.map((payment) => {
              const qrStatus = qrPanelStatus(payment.payment_method, payment.payment_status)
              return (
              <Card key={payment.id} className="group bg-card p-5 rounded-2xl border border-border shadow-xs hover:border-primary/40 transition-all duration-200">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary border border-primary/20">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-foreground leading-tight text-sm tracking-tight">
                          {payment.payment_reference}
                        </h3>
                        <Badge variant="outline" className="text-[11px] font-semibold">
                          {payment.booking?.booking_reference ?? "INVOICE"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground font-medium">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5",
                          getStatusColor(payment.payment_status)
                        )}>
                          {getStatusIcon(payment.payment_status)}
                          {getStatusLabel(payment.payment_status)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          Generated: {new Date(payment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-1 italic max-w-lg">
                        "{payment.description ?? `Payment for ${payment.booking?.booking_purpose ?? payment.booking?.purpose ?? "booking"}`}"
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-end gap-5 border-t lg:border-t-0 pt-4 lg:pt-0 border-border/60">
                    <div className="text-center sm:text-right w-full sm:w-auto">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Grand Total</p>
                      <p className="text-xl font-bold text-foreground tracking-tight">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs font-semibold text-primary">{payment.currency}</p>
                    </div>
                    
                    {(payment.payment_status === "pending" || payment.payment_status === "failed") && (
                      <ApplyCreditWidget
                        paymentId={payment.id}
                        paymentAmountCentavos={Math.round(payment.amount * 100)}
                        returnPath={ROUTES.academic.payment}
                        onApplied={(checkoutUrl, fullyCovered) => {
                          if (fullyCovered) fetchPayments()
                          else if (checkoutUrl && isTrustedCheckoutUrl(checkoutUrl)) {
                            try { localStorage.setItem('paymongo_pending_payment_id', payment.id) } catch {}
                            window.location.href = checkoutUrl
                          }
                        }}
                      />
                    )}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {payment.payment_method !== "qr_manual" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none h-9 text-xs font-semibold rounded-xl"
                          disabled={!(payment.payment_status === "pending" || payment.payment_status === "failed") || isProcessing}
                          onClick={() => handlePayWithPaymongo(payment.id)}
                        >
                          <CreditCard className="w-4 h-4 mr-1.5" /> Pay
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none h-9 text-xs font-semibold rounded-xl"
                        disabled={isProcessing}
                        onClick={() => refreshPaymentStatus(payment.id)}
                      >
                        Sync
                      </Button>
                      <Button
                        variant={payment.payment_status === "completed" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 sm:flex-none h-9 text-xs font-semibold rounded-xl"
                        disabled={payment.payment_status !== "completed"}
                        onClick={() => handleDownloadReceipt(payment)}
                      >
                        <Download className="w-4 h-4 mr-1.5" /> Receipt
                      </Button>

                      {(payment.payment_status === "refunded" || payment.payment_status === "refund_processing") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none h-9 text-xs font-semibold rounded-xl"
                          onClick={() => handleDownloadRefundReceipt(payment)}
                        >
                          <Undo2 className="w-4 h-4 mr-1.5" /> Refund Receipt
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

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
    </div>
  )
}

export default function AcademicHeadPaymentPage() {
  return (
    <Suspense fallback={
        <SkeletonList />
    }>
      <AcademicHeadPaymentPageInner />
    </Suspense>
  )
}