'use client'

import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import type { DirectoryPayment } from '@/backend/admin/building/building.types'
import { paymentStatusLabel } from '@/lib/enum-labels'

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  refunded: 'bg-purple-100 text-purple-700',
}

const METHOD_LABELS: Record<string, string> = {
  paymongo_card: 'Card',
  paymongo_gcash: 'GCash',
  paymongo_grab: 'GrabPay',
  paymongo_maya: 'Maya',
  cashier: 'Cashier',
}

interface Props {
  payments: DirectoryPayment[]
  loading: boolean
}

export function PaymentsTab({ payments, loading }: Props) {
  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  }

  if (!payments.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No payment records found.</p>
  }

  const totalPaid = payments
    .filter(p => p.paymentStatus === 'completed')
    .reduce((sum, p) => sum + p.totalAmount, 0)

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted/50 px-3 py-2 flex justify-between items-center">
        <span className="text-xs text-muted-foreground font-medium">Total Paid</span>
        <span className="text-sm font-bold">₱{totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
      </div>
      <ScrollArea className="h-64">
        <div className="space-y-2 pr-2">
          {payments.map(p => (
            <div key={p.id} className="rounded-lg border border-border p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-mono font-bold text-muted-foreground">{p.paymentReference}</p>
                <Badge className={`text-[10px] border-none shrink-0 ${STATUS_COLORS[p.paymentStatus] ?? 'bg-muted text-muted-foreground'}`}>
                  {paymentStatusLabel(p.paymentStatus)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  ₱{p.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Booking: {p.bookingReference || '—'}</span>
                {p.paidAt && (
                  <span>{new Date(p.paidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
