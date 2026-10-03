"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { z } from "zod"
import { Card } from "@/components/ui/card"
import { ConnectedTopBar } from "../_components/ConnectedTopBar"
import { Button } from "@/components/ui/button"
import { Check, Clock, AlertCircle, Download, CreditCard, Wallet, Receipt, Undo2 } from "lucide-react"
import { ApplyCreditWidget } from "@/components/checkout/ApplyCreditWidget"
import { generateRefundReceiptHtml } from "@/app/client/payment/_lib/refundReceipt"
import { generateReceiptHtml } from "@/app/client/payment/_lib/receipt"
import { downloadPaymentReceipt, downloadRefundReceipt } from "@/app/client/payment/_lib/downloadReceipt"
import { QrPaymentPanel } from "@/components/payments/QrPaymentPanel"
import { qrPanelStatus } from "@/lib/payments/qr-panel-status"
import { isTrustedCheckoutUrl } from '@/lib/payments/checkout-url'
import { paymentStatusLabel } from '@/lib/enum-labels'

const isUuid = (v: unknown): v is string => z.string().uuid().safeParse(v).success

type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded" | "cancelled" | "pending_review" | "refund_requested" | "refund_processing"

interface CostLineItem {
  label: string
  hours: number
  rate: number
  subtotal: number
  isFlatFee?: boolean
}

interface PaymongoWebhookData {
  credit_only?: boolean
  data?: {
    attributes?: {
      billing?: { name?: string; email?: string; phone?: string; number?: string }
      payments?: Array<{ data?: { attributes?: { source?: { type?: string; card?: { brand?: string; last4?: string } } } }; attributes?: { source?: { type?: string; card?: { brand?: string; last4?: string } } } }>
    }
  }
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

function ProgramHeadPaymentInner() {
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creditBalance, setCreditBalance] = useState<{ balanceCentavos: number; balancePeso: string } | null>(null)
  const [helpdeskContact, setHelpdeskContact] = useState("")

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
      localStorage.removeItem('paymongo_pending_payment_id')
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
    const channel = supabase.channel('program-payments-live')
      .on('postgres_changes', { event: '*', table: 'payments', schema: 'public' }, () => {
        fetchPayments()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/payment-qr-codes')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled && data?.helpdeskContact) setHelpdeskContact(data.helpdeskContact) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/credits/balance')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled) setCreditBalance(data ?? { balanceCentavos: 0, balancePeso: '0.00' }) })
      .catch(() => { if (!cancelled) setCreditBalance({ balanceCentavos: 0, balancePeso: '0.00' }) })
    return () => { cancelled = true }
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
      case "completed":        return <Check className="w-5 h-5 text-emerald-500" />
      case "pending":          return <Clock className="w-5 h-5 text-amber-500" />
      case "pending_review":   return <Clock className="w-5 h-5 text-sky-500" />
      case "processing":       return <Clock className="w-5 h-5 text-sky-500 animate-spin" />
      case "failed":           return <AlertCircle className="w-5 h-5 text-rose-500" />
      case "refunded":         return <Wallet className="w-5 h-5 text-purple-500" />
      case "cancelled":        return <AlertCircle className="w-5 h-5 text-slate-500" />
      case "refund_requested": return <AlertCircle className="w-5 h-5 text-orange-500" />
      case "refund_processing": return <Clock className="w-5 h-5 text-sky-500" />
      default:                 return <AlertCircle className="w-5 h-5 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case "completed":        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
      case "pending":          return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
      case "pending_review":   return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
      case "processing":       return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
      case "failed":           return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
      case "refunded":         return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
      case "cancelled":        return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20"
      case "refund_requested": return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20"
      case "refund_processing": return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
      default:                 return "bg-muted/10 text-muted-foreground border border-border/50"
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
        body: JSON.stringify({ paymentId, returnPath: '/program/payment' }),
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
    <div className="min-h-screen bg-background">
      <ConnectedTopBar title="Payment & Billing" breadcrumbs={[{ label: "Dashboard" }]} />

      <main className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">
            Payment &amp; <span className="text-accent-brand">Billing</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
            Manage your payment methods, program invoices, and billing history
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <Card className="relative overflow-hidden p-6 bg-card border-slate-200 dark:border-slate-800/60 shadow-sm group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-10 transition-opacity">
              <Wallet className="w-24 h-24 text-slate-900 dark:text-white" />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Amount Due</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(totalPending)}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="p-1.5 bg-rose-500/10 rounded-md"><AlertCircle className="w-3 h-3 text-rose-500" /></span>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Pending & Failed Invoices</p>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-6 bg-card border-slate-200 dark:border-slate-800/60 shadow-sm group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-10 transition-opacity">
              <Receipt className="w-24 h-24 text-slate-900 dark:text-white" />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Paid (YTD)</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                {formatCurrency(completedPayments.reduce((s, p) => s + p.amount, 0))}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/10 rounded-md"><Check className="w-3 h-3 text-emerald-500" /></span>
                <p className="text-[10px] font-bold text-slate-500 uppercase">{completedPayments.length} Completed Transactions</p>
              </div>
            </div>
          </Card>

          <Card className="relative overflow-hidden p-6 bg-card border-slate-200 dark:border-slate-800/60 shadow-sm group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-10 transition-opacity">
              <CreditCard className="w-24 h-24 text-slate-900 dark:text-white" />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Session Credits</p>
              {creditBalance === null ? (
                <div className="h-9 w-28 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse mt-1" />
              ) : (
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                  ₱{Number(creditBalance.balancePeso).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <span className="p-1.5 bg-blue-500/10 rounded-md"><CreditCard className="w-3 h-3 text-blue-500" /></span>
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  {creditBalance && creditBalance.balanceCentavos > 0 ? 'Available for Next Booking' : 'No Credits Yet'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Billing History</h2>

          {message && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>
          )}
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
          )}

          {isLoading ? (
            <Card className="p-6 text-center">Loading payment records...</Card>
          ) : payments.length === 0 ? (
            <Card className="p-6 text-center">No invoices found. Payment invoices appear here once your booking is approved.</Card>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const qrStatus = qrPanelStatus(payment.payment_method, payment.payment_status)
                return (
                <Card key={payment.id} className="p-4 hover:shadow-md transition-shadow border-border/50">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-foreground">{payment.payment_reference}</p>
                          <p className="text-sm text-muted-foreground">{payment.booking?.booking_reference ?? "Invoice"}</p>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(payment.payment_status)}`}>
                          {getStatusIcon(payment.payment_status)}
                          <span>{getStatusLabel(payment.payment_status)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {payment.description ?? `Payment for ${payment.booking?.booking_purpose ?? payment.booking?.purpose ?? "booking"}`}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <p className="font-bold text-lg text-foreground">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{payment.currency}</p>
                      </div>
                      {(payment.payment_status === "pending" || payment.payment_status === "failed") && (
                        <ApplyCreditWidget
                          paymentId={payment.id}
                          paymentAmountCentavos={Math.round(payment.amount * 100)}
                          returnPath="/program/payment"
                          onApplied={(checkoutUrl, fullyCovered) => {
                            if (fullyCovered) fetchPayments()
                            else if (checkoutUrl && isTrustedCheckoutUrl(checkoutUrl)) {
                              try { localStorage.setItem('paymongo_pending_payment_id', payment.id) } catch {}
                              window.location.href = checkoutUrl
                            }
                          }}
                        />
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {payment.payment_method !== "qr_manual" && (
                          <Button
                            variant="outline" size="sm" className="gap-2 whitespace-nowrap"
                            disabled={!(payment.payment_status === "pending" || payment.payment_status === "failed") || isProcessing}
                            onClick={() => handlePayWithPaymongo(payment.id)}
                          >
                            <CreditCard className="w-4 h-4" /> Pay
                          </Button>
                        )}
                        <Button
                          variant="secondary" size="sm" className="gap-2 whitespace-nowrap"
                          disabled={isProcessing}
                          onClick={() => refreshPaymentStatus(payment.id)}
                        >
                          Refresh
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="gap-2 whitespace-nowrap"
                          disabled={payment.payment_status !== "completed"}
                          onClick={() => handleDownloadReceipt(payment)}
                        >
                          <Download className="w-4 h-4" /> Receipt
                        </Button>

                        {(payment.payment_status === "refunded" || payment.payment_status === "refund_processing") && (
                          <Button
                            variant="ghost" size="sm" className="gap-2 whitespace-nowrap"
                            onClick={() => handleDownloadRefundReceipt(payment)}
                          >
                            <Undo2 className="w-4 h-4" /> Refund Receipt
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
      </main>
    </div>
  )
}

export default function ProgramHeadPayment() {
  return (
    <Suspense>
      <ProgramHeadPaymentInner />
    </Suspense>
  )
}
