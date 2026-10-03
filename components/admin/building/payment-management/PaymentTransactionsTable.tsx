"use client"

import type { BuildingTransaction } from '@/backend/admin/building/building.types'

// ─── Pure logic (testable) ───────────────────────────────────────────────────

export interface TransactionFilters {
  search?: string
  status?: string
  method?: string
}

export function filterTransactions(
  transactions: BuildingTransaction[],
  filters: TransactionFilters,
): BuildingTransaction[] {
  let result = transactions

  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      t =>
        (t.userName || '').toLowerCase().includes(q) ||
        (t.bookingReference || '').toLowerCase().includes(q) ||
        (t.paymentReference || '').toLowerCase().includes(q),
    )
  }

  if (filters.status) {
    result = result.filter(t => t.paymentStatus === filters.status)
  }

  if (filters.method) {
    result = result.filter(t => t.paymentMethod === filters.method)
  }

  return result
}

export interface PaymentStats {
  totalRevenue: number
  pendingAmount: number
  refundedAmount: number
  totalCount: number
}

export function computePaymentStats(transactions: BuildingTransaction[]): PaymentStats {
  return {
    totalRevenue: transactions
      .filter(t => t.paymentStatus === 'completed')
      .reduce((sum, t) => sum + t.amount, 0),
    pendingAmount: transactions
      .filter(t => t.paymentStatus === 'pending' || t.paymentStatus === 'pending_review' || t.paymentStatus === 'failed')
      .reduce((sum, t) => sum + t.amount, 0),
    refundedAmount: transactions
      .filter(t => t.paymentStatus === 'refunded')
      .reduce((sum, t) => sum + t.amount, 0),
    totalCount: transactions.length,
  }
}

export function exportTransactionsToCsv(transactions: BuildingTransaction[]): string {
  const headers = [
    'Payment Reference',
    'Booking Reference',
    'Client',
    'Facility',
    'Amount',
    'Currency',
    'Method',
    'Status',
    'Date',
  ]

  const rows = transactions.map(t => [
    t.paymentReference,
    t.bookingReference,
    t.userName || 'N/A',
    t.facilityName || 'N/A',
    t.amount.toString(),
    t.currency,
    t.paymentMethod,
    t.paymentStatus,
    t.createdAt || '',
  ])

  // OWASP CSV injection prevention: prefix cells that start with formula chars
  const sanitize = (val: string) => {
    if (/^[=+\-@\t\r]/.test(val)) return `'${val}`
    return val
  }
  const escape = (val: string) => `"${sanitize(val).replace(/"/g, '""')}"`

  // BOM for Excel UTF-8 compatibility (preserves ₱ sign)
  return '\uFEFF' + [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
}

// ─── Component ───────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Download,
  Search,
  TrendingUp,
  AlertCircle,
  Wallet,
  Hash,
  Clock,
  Loader2,
} from 'lucide-react'
import { StatsCard } from '@/components/admin/dashboard/StatsCard'
import { cn } from '@/lib/utils'
import { paymentStatusLabel } from '@/lib/enum-labels'

const METHOD_LABELS: Record<string, string> = {
  paymongo_card: 'Card',
  paymongo_gcash: 'GCash',
  paymongo_grab: 'GrabPay',
  paymongo_maya: 'Maya',
  cashier: 'Cashier',
  qr_manual: 'QR Manual',
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  pending_review: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  refunded: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  cancelled: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  refund_requested: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  refund_processing: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  processing: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
}

function isExpiredLink(t: BuildingTransaction): boolean {
  return t.paymentStatus === 'pending' && !!t.expiresAt && new Date(t.expiresAt) < new Date()
}

interface PaymentTransactionsTableProps {
  transactions: BuildingTransaction[]
  loading: boolean
  onRowClick?: (transaction: BuildingTransaction) => void
}

export function PaymentTransactionsTable({
  transactions,
  loading,
  onRowClick,
}: PaymentTransactionsTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')

  const filtered = useMemo(
    () => filterTransactions(transactions, { search, status: statusFilter, method: methodFilter }),
    [transactions, search, statusFilter, methodFilter],
  )

  const stats = useMemo(() => computePaymentStats(transactions), [transactions])

  const handleExport = () => {
    const csv = exportTransactionsToCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Revenue"
          value={`₱${stats.totalRevenue.toLocaleString()}`}
          icon={TrendingUp}
          variant="success"
        />
        <StatsCard
          title="Pending"
          value={`₱${stats.pendingAmount.toLocaleString()}`}
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Refunded"
          value={`₱${stats.refundedAmount.toLocaleString()}`}
          icon={Wallet}
          variant="destructive"
        />
        <StatsCard
          title="Transactions"
          value={stats.totalCount.toString()}
          icon={Hash}
          variant="primary"
        />
      </div>

      {/* Filters + Export */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, booking ref, or payment ref..."
            aria-label="Search transactions"
            className="pl-9 h-9 rounded-lg bg-card border-border font-medium text-xs shadow-xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 rounded-lg bg-card border-border font-medium text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-card shadow-lg">
            <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
            <SelectItem value="completed" className="text-xs">Completed</SelectItem>
            <SelectItem value="pending" className="text-xs">Pending</SelectItem>
            <SelectItem value="pending_review" className="text-xs">Pending Review</SelectItem>
            <SelectItem value="failed" className="text-xs">Failed</SelectItem>
            <SelectItem value="refunded" className="text-xs">Refunded</SelectItem>
            <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-36 h-9 rounded-lg bg-card border-border font-medium text-xs">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-card shadow-lg">
            <SelectItem value="all" className="text-xs">All Methods</SelectItem>
            <SelectItem value="paymongo_gcash" className="text-xs">GCash</SelectItem>
            <SelectItem value="paymongo_card" className="text-xs">Card</SelectItem>
            <SelectItem value="paymongo_maya" className="text-xs">Maya</SelectItem>
            <SelectItem value="paymongo_grab" className="text-xs">GrabPay</SelectItem>
            <SelectItem value="cashier" className="text-xs">Cashier</SelectItem>
            <SelectItem value="qr_manual" className="text-xs">QR Manual</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={handleExport}
          className="rounded-xl font-semibold text-xs h-9 bg-card border-border hover:bg-accent hover:text-accent-foreground gap-1.5"
        >
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Table */}
      <Card className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/40">
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground px-6 h-12">
                  Payment Ref
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">
                  Booking Ref
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">
                  Client
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">
                  Facility
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12 text-right">
                  Amount
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">
                  Method
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12 text-center">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase text-muted-foreground h-12">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length > 0 ? (
                filtered.map(t => (
                  <TableRow
                    key={t.id}
                    className={cn(
                      'border-border/40 transition-colors group',
                      onRowClick && 'cursor-pointer hover:bg-muted/30',
                    )}
                    onClick={() => onRowClick?.(t)}
                  >
                    <TableCell className="px-6 py-4 font-mono text-xs font-medium text-foreground">
                      {t.paymentReference}
                    </TableCell>
                    <TableCell className="py-4 font-mono text-xs text-muted-foreground">
                      {t.bookingReference}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">
                      {t.userName || 'N/A'}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {t.facilityName || 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-xs text-foreground">
                        ₱{t.amount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-foreground">
                        {METHOD_LABELS[t.paymentMethod] || t.paymentMethod}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {isExpiredLink(t) ? (
                        <Badge className="px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border-0 shadow-none bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Expired Link
                        </Badge>
                      ) : (
                        <Badge
                          className={cn(
                            'px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border-0 shadow-none',
                            STATUS_BADGE_CLASSES[t.paymentStatus],
                          )}
                        >
                          {paymentStatusLabel(t.paymentStatus)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-xs font-medium text-muted-foreground italic"
                  >
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
