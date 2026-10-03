"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleTopBar } from '@/components/shared/RoleTopBar'
import { isTrustedCheckoutUrl } from '@/lib/payments/checkout-url'
import { ROUTES } from '@/lib/routes'
import { UserProfile } from "@/components/layout/shared/UserProfile"
import { useFacultyLayout } from "../_components/FacultyLayoutContext"
import { Button } from "@/components/ui/button"
import { Check, Clock, AlertCircle, Download, CreditCard, Loader2, Wallet, Receipt, Undo2 } from "lucide-react"
import { ApplyCreditWidget } from "@/components/checkout/ApplyCreditWidget"
import { SkeletonList } from "@/components/ui/SkeletonList";
import { generateRefundReceiptHtml } from "@/app/client/payment/_lib/refundReceipt"
import { generateReceiptHtml } from "@/app/client/payment/_lib/receipt"
import { downloadPaymentReceipt, downloadRefundReceipt } from "@/app/client/payment/_lib/downloadReceipt"
import { QrPaymentPanel } from "@/components/payments/QrPaymentPanel"
import { qrPanelStatus } from "@/lib/payments/qr-panel-status"
import { paymentStatusLabel } from "@/lib/enum-labels"

import { useRouter } from "next/navigation"
import { useFacultyNotifications } from '@/hooks/faculty/useFacultyNotifications'

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

function PaymentInner() {
  const { toggleMobileMenu } = useFacultyLayout()
  const router = useRouter()
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useFacultyNotifications()
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
    } catch (error) {
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
    } catch (error) {
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
    const channel = supabase.channel('faculty-payments-live')
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

  const pendingPayments = payments.filter(
    (payment) => payment.payment_status === "pending" || payment.payment_status === "failed" || payment.payment_status === "pending_review",
  )
  const completedPayments = payments.filter((payment) => payment.payment_status === "completed")
  const totalPending = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount)
  }

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
      case "completed":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
      case "pending":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
      case "pending_review":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20"
      case "failed":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
      case "processing":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20"
      case "refunded":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20"
      case "cancelled":
        return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20"
      case "refund_requested":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20"
      case "refund_processing":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20"
      default:
        return "bg-muted/10 text-muted-foreground border border-border/50"
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
        body: JSON.stringify({ paymentId, returnPath: '/faculty/payment' }),
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
    } catch (error) {
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <RoleTopBar
        title="Payment & Billing"
        portalTitle="Faculty Portal"
        breadcrumbs={[{ label: "Dashboard" }]}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkNotificationRead={markRead}
        onMarkAllNotificationsRead={markAllRead}
        onClearAllNotifications={clearAll}
        onOpenMessageCenter={() => router.push(ROUTES.faculty.notifications)}
        onMobileMenuToggle={() => toggleMobileMenu()}
        formRoute={ROUTES.faculty.form}
        calendarRoute={ROUTES.faculty.calendar}
        profileMenu={<UserProfile settingsRoute={ROUTES.faculty.profile} />}
      />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Payment &amp; <span className="text-accent-brand">Billing</span>
          </h1>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
            Manage invoices, session credits, and track your financial transactions
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="group hover:shadow-lg transition-shadow relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-rose-500 uppercase tracking-wider">Amount Due</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-card-foreground tracking-tighter">{formatCurrency(totalPending)}</p>
              <div className="mt-2 flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-rose-500" />
                <p className="text-xs font-bold text-muted-foreground uppercase">Pending & Failed Invoices</p>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-shadow relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Total Paid (YTD)</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-card-foreground tracking-tighter">
                {formatCurrency(completedPayments.reduce((sum, p) => sum + p.amount, 0))}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-500" />
                <p className="text-xs font-bold text-muted-foreground uppercase">{completedPayments.length} Completed Transactions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-shadow relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-blue-500 uppercase tracking-wider">Session Credits</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {creditBalance === null ? (
                <div className="h-8 w-28 bg-muted rounded-lg animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-card-foreground tracking-tighter">
                  ₱{Number(creditBalance.balancePeso).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <CreditCard className="w-3 h-3 text-blue-500" />
                <p className="text-xs font-bold text-muted-foreground uppercase">
                  {creditBalance && creditBalance.balanceCentavos > 0 ? 'Available for Next Booking' : 'No Credits Yet'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing History Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Billing History</h2>
          </div>

          {message && (
            <div className="rounded-xl border border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/5 p-4 flex items-center gap-3 animate-in fade-in zoom-in-95">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm font-bold text-green-800 dark:text-green-400 leading-tight">{message}</p>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-4 flex items-center gap-3 animate-in fade-in zoom-in-95">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-sm font-bold text-red-800 dark:text-red-400 leading-tight">{errorMessage}</p>
            </div>
          )}

          {isLoading ? (
            <Card className="p-12 flex flex-col items-center justify-center gap-4 bg-white dark:bg-slate-900 border-dashed border-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Fetching records...</p>
            </Card>
          ) : payments.length === 0 ? (
            <Card className="p-12 text-center bg-white dark:bg-slate-900 border-dashed border-2 border-slate-200 dark:border-white/5">
              <CreditCard className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">No invoices found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Pending payment invoices will appear here once booking approval is created.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {payments.map((payment) => {
                const qrStatus = qrPanelStatus(payment.payment_method, payment.payment_status)
                return (
                <Card key={payment.id} className="p-4 md:p-6 hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-all duration-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 group">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* Left Side: Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">{payment.payment_reference}</p>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(payment.payment_status)}`}>
                          {getStatusIcon(payment.payment_status)}
                          <span>{getStatusLabel(payment.payment_status)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {payment.booking?.booking_reference ?? "Invoice"} — {payment.description ?? `Payment for booking`}
                        </p>
                        <p className="text-xs text-slate-400 font-medium">Issued on {new Date(payment.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Right Side: Actions & Amount */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4 sm:gap-6 lg:gap-3 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5">
                      <div className="text-left sm:text-right lg:text-right">
                        <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{payment.currency}</p>
                      </div>

                      {(payment.payment_status === "pending" || payment.payment_status === "failed") && (
                        <ApplyCreditWidget
                          paymentId={payment.id}
                          paymentAmountCentavos={Math.round(payment.amount * 100)}
                          returnPath="/faculty/payment"
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
                            className="flex-1 sm:flex-initial h-9 px-4 font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-500/10"
                            disabled={!(payment.payment_status === "pending" || payment.payment_status === "failed") || isProcessing}
                            onClick={() => handlePayWithPaymongo(payment.id)}
                          >
                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3 mr-2" />}
                            Pay Now
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 sm:flex-initial h-9 px-4 font-bold uppercase tracking-wider text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                          disabled={isProcessing}
                          onClick={() => refreshPaymentStatus(payment.id)}
                        >
                          Refresh
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 sm:flex-initial h-9 px-4 font-bold uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                          disabled={payment.payment_status !== "completed"}
                          onClick={() => handleDownloadReceipt(payment)}
                        >
                          <Download className="w-3 h-3 mr-2" /> Receipt
                        </Button>

                        {(payment.payment_status === "refunded" || payment.payment_status === "refund_processing") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 sm:flex-initial h-9 px-4 font-bold uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                            onClick={() => handleDownloadRefundReceipt(payment)}
                          >
                            <Undo2 className="w-3 h-3 mr-2" /> Refund Receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {qrStatus && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
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

export default function Payment() {
  return (
    <Suspense fallback={
      <SkeletonList />
    }>
      <PaymentInner />
    </Suspense>
  )
}