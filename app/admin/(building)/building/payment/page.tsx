"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { z } from "zod"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Clock, AlertCircle, Download, CreditCard, Loader2, Undo2, Wallet } from "lucide-react"
import { CreditBalanceCard } from "@/components/credits/CreditBalanceCard"
import { ApplyCreditWidget } from "@/components/checkout/ApplyCreditWidget"
import { ROUTES } from '@/lib/routes'
import { isTrustedCheckoutUrl } from '@/lib/payments/checkout-url'
import { SkeletonList } from "@/components/ui/SkeletonList";
import { generateRefundReceiptHtml } from "@/app/client/payment/_lib/refundReceipt"
import { generateReceiptHtml } from "@/app/client/payment/_lib/receipt"
import { downloadPaymentReceipt, downloadRefundReceipt } from "@/app/client/payment/_lib/downloadReceipt"
import { QrPaymentPanel } from "@/components/payments/QrPaymentPanel"
import { qrPanelStatus } from "@/lib/payments/qr-panel-status"
import { paymentStatusLabel } from "@/lib/enum-labels"


const isUuid = (v: unknown): v is string => z.string().uuid().safeParse(v).success

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
  paymongo_webhook_data?: Record<string, unknown> | null
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

const RETURN_PATH = ROUTES.buildingAdmin.payment

function PaymentInner() {
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creditBalance, setCreditBalance] = useState<{ balanceCentavos: number; balancePeso: string } | null>(null)
  const [helpdeskContact, setHelpdeskContact] = useState("")

  const fetchCreditBalance = async () => {
    try {
      const res = await fetch('/api/credits/balance')
      if (res.ok) {
        const data = await res.json()
        setCreditBalance(data)
      }
    } catch (error) {
      console.error("Failed to fetch credit balance:", error)
    }
  }

  const fetchPayments = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      // scope=self ensures building admin sees only their own payments, not all-admin view
      const response = await fetch("/api/payments?scope=self")
      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data?.error || "Unable to load payments.")
        return
      }
      setPayments(data.payments ?? [])
      fetchCreditBalance()
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

  useEffect(() => {
    fetchPayments()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/payment-qr-codes')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled && data?.helpdeskContact) setHelpdeskContact(data.helpdeskContact) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const pendingPayments = payments.filter(
    (payment) => payment.payment_status === "pending" || payment.payment_status === "failed" || payment.payment_status === "pending_review",
  )
  const completedPayments = payments.filter((payment) => payment.payment_status === "completed")
  const totalPending = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount)

  const getStatusLabel = (status: PaymentStatus) => {
    return paymentStatusLabel(status)
  }

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case "completed":        return <Check className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 dark:text-emerald-400" />
      case "pending":          return <Clock className="w-4 h-4 md:w-5 md:h-5 text-amber-600 dark:text-amber-400" />
      case "pending_review":   return <Clock className="w-4 h-4 md:w-5 md:h-5 text-sky-600 dark:text-sky-400" />
      case "processing":       return <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin text-sky-600 dark:text-sky-400" />
      case "failed":           return <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-rose-600 dark:text-rose-400" />
      case "refunded":         return <Wallet className="w-4 h-4 md:w-5 md:h-5 text-purple-600 dark:text-purple-400" />
      case "cancelled":        return <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
      case "refund_requested": return <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-orange-600 dark:text-orange-400" />
      case "refund_processing": return <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-sky-600 dark:text-sky-400" />
      default:                 return <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case "completed":        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
      case "pending":          return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
      case "pending_review":   return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
      case "processing":       return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
      case "failed":           return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
      case "refunded":         return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
      case "cancelled":        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
      case "refund_requested": return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
      case "refund_processing": return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
      default:                 return "bg-muted text-muted-foreground border border-border"
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
        body: JSON.stringify({ paymentId, returnPath: RETURN_PATH }),
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
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
          Payment &amp; <span className="text-accent-brand">Billing</span>
        </h1>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
          Your facility reservation invoices, session credits, and payment records
        </p>
      </div>

      <CreditBalanceCard />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5 relative overflow-hidden group border-border bg-card shadow-xs rounded-xl">
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-rose-600 dark:text-rose-400">Amount Due</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{formatCurrency(totalPending)}</p>
              <p className="text-xs font-medium text-muted-foreground">Pending & overdue</p>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-lg border border-rose-500/20">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
        </Card>

        <Card className="p-5 relative overflow-hidden group border-border bg-card shadow-xs rounded-xl">
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">Total Paid (YTD)</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatCurrency(completedPayments.reduce((sum, p) => sum + p.amount, 0))}
              </p>
              <p className="text-xs font-medium text-muted-foreground">{completedPayments.length} transactions</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </Card>

        <Card className="p-5 relative overflow-hidden group border-border bg-card shadow-xs rounded-xl sm:col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-primary">Account Balance</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                ₱{creditBalance ? Number(creditBalance.balancePeso).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
              </p>
              <p className="text-xs font-medium text-muted-foreground">
                {creditBalance && creditBalance.balanceCentavos > 0 ? "Active session credit" : "No active credit"}
              </p>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/20">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
          </div>
        </Card>
      </div>

      {/* Billing History */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground tracking-tight">Billing History</h2>

        {message && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center gap-3 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 leading-tight">{message}</p>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 flex items-center gap-3 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-xs font-medium text-rose-800 dark:text-rose-300 leading-tight">{errorMessage}</p>
          </div>
        )}

        {isLoading ? (
          <Card className="p-12 flex flex-col items-center justify-center gap-3 bg-card border-dashed border border-border rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Fetching records...</p>
          </Card>
        ) : payments.length === 0 ? (
          <Card className="p-12 text-center bg-card border-dashed border border-border rounded-xl">
            <CreditCard className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No invoices found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">Payment invoices for your personal reservations will appear here.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {payments.map((payment) => {
              const qrStatus = qrPanelStatus(payment.payment_method, payment.payment_status)
              return (
              <Card key={payment.id} className="p-5 hover:border-primary/30 transition-all duration-200 bg-card border-border rounded-xl shadow-xs group">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-semibold text-foreground text-sm leading-none">{payment.payment_reference}</p>
                      <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.payment_status)}`}>
                        {getStatusIcon(payment.payment_status)}
                        <span>{getStatusLabel(payment.payment_status)}</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        {payment.booking?.booking_reference ?? "Invoice"} — {payment.description ?? "Payment for booking"}
                      </p>
                      <p className="text-xs text-muted-foreground/70">Issued on {new Date(payment.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4 sm:gap-6 lg:gap-3 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border">
                    <div className="text-left sm:text-right lg:text-right">
                      <p className="text-xl font-bold text-foreground leading-none">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1 uppercase">{payment.currency}</p>
                    </div>

                    {(payment.payment_status === "pending" || payment.payment_status === "failed") && (
                      <ApplyCreditWidget
                        paymentId={payment.id}
                        paymentAmountCentavos={Math.round(payment.amount * 100)}
                        returnPath={RETURN_PATH}
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

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      {payment.payment_method !== "qr_manual" && (
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 sm:flex-initial h-9 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all gap-1.5 shadow-xs"
                          disabled={!(payment.payment_status === "pending" || payment.payment_status === "failed") || isProcessing}
                          onClick={() => handlePayWithPaymongo(payment.id)}
                        >
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                          Pay Now
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-initial h-9 px-4 rounded-xl font-semibold text-xs text-foreground bg-card border-border hover:bg-accent hover:text-accent-foreground"
                        disabled={isProcessing}
                        onClick={() => refreshPaymentStatus(payment.id)}
                      >
                        Refresh
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 sm:flex-initial h-9 px-4 rounded-xl font-semibold text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors gap-1.5"
                        disabled={payment.payment_status !== "completed"}
                        onClick={() => handleDownloadReceipt(payment)}
                      >
                        <Download className="w-3.5 h-3.5" /> Receipt
                      </Button>

                      {(payment.payment_status === "refunded" || payment.payment_status === "refund_processing") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 sm:flex-initial h-9 px-4 rounded-xl font-semibold text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors gap-1.5"
                          onClick={() => handleDownloadRefundReceipt(payment)}
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Refund Receipt
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

export default function BuildingAdminPaymentPage() {
  return (
    <Suspense fallback={
      <SkeletonList />
    }>
      <PaymentInner />
    </Suspense>
  )
}
