import { describe, it, expect } from 'vitest'
import {
  filterTransactions,
  computePaymentStats,
  exportTransactionsToCsv,
} from '@/components/admin/building/payment-management/PaymentTransactionsTable'
import type { BuildingTransaction } from '@/backend/admin/building/building.types'

const tx = (overrides: Partial<BuildingTransaction> = {}): BuildingTransaction => ({
  id: '1',
  paymentReference: 'PAY-20260801-001',
  bookingId: 'b1',
  bookingReference: 'BK-2026-001',
  userId: 'u1',
  userName: 'Juan Dela Cruz',
  amount: 1500,
  currency: 'PHP',
  paymentMethod: 'paymongo_gcash',
  paymentStatus: 'completed',
  facilityName: 'Gymnasium',
  bookingDate: '2026-08-01',
  createdAt: '2026-08-01T10:00:00Z',
  expiresAt: null,
  qrReferenceNumber: null,
  qrPayerName: null,
  qrScreenshotUrl: null,
  qrAccountName: null,
  qrAccountNumber: null,
  qrPayerAccountName: null,
  qrPayerAccountNumber: null,
  ...overrides,
})

const transactions: BuildingTransaction[] = [
  tx(),
  tx({ id: '2', paymentReference: 'PAY-20260801-002', bookingReference: 'BK-2026-002', userName: 'Maria Santos', amount: 2000, paymentStatus: 'pending', paymentMethod: 'qr_manual', facilityName: 'Auditorium' }),
  tx({ id: '3', paymentReference: 'PAY-20260802-001', bookingReference: 'BK-2026-003', userName: 'Pedro Reyes', amount: 800, paymentStatus: 'failed', paymentMethod: 'paymongo_card', facilityName: 'Lab 1' }),
  tx({ id: '4', paymentReference: 'PAY-20260802-002', bookingReference: 'BK-2026-004', userName: 'Ana Cruz', amount: 3000, paymentStatus: 'refunded', paymentMethod: 'paymongo_maya', facilityName: 'Gymnasium' }),
  tx({ id: '5', paymentReference: 'PAY-20260803-001', bookingReference: 'BK-2026-005', userName: 'Juan Dela Cruz', amount: 500, paymentStatus: 'completed', paymentMethod: 'cashier', facilityName: 'Conference Room' }),
]

describe('filterTransactions', () => {
  it('returns all transactions when no filters are applied', () => {
    expect(filterTransactions(transactions, {})).toHaveLength(5)
  })

  it('filters by search term matching userName', () => {
    const result = filterTransactions(transactions, { search: 'maria' })
    expect(result).toHaveLength(1)
    expect(result[0].userName).toBe('Maria Santos')
  })

  it('filters by search term matching bookingReference', () => {
    const result = filterTransactions(transactions, { search: 'BK-2026-003' })
    expect(result).toHaveLength(1)
    expect(result[0].bookingReference).toBe('BK-2026-003')
  })

  it('filters by search term matching paymentReference', () => {
    const result = filterTransactions(transactions, { search: 'PAY-20260802' })
    expect(result).toHaveLength(2)
  })

  it('filters by payment status', () => {
    const result = filterTransactions(transactions, { status: 'completed' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.paymentStatus === 'completed')).toBe(true)
  })

  it('filters by payment method', () => {
    const result = filterTransactions(transactions, { method: 'qr_manual' })
    expect(result).toHaveLength(1)
    expect(result[0].paymentMethod).toBe('qr_manual')
  })

  it('combines search and status filters', () => {
    const result = filterTransactions(transactions, { search: 'juan', status: 'completed' })
    expect(result).toHaveLength(2)
  })

  it('treats empty string filters as no filter', () => {
    expect(filterTransactions(transactions, { search: '', status: '', method: '' })).toHaveLength(5)
  })

  it('returns empty array when nothing matches', () => {
    expect(filterTransactions(transactions, { search: 'nonexistent' })).toHaveLength(0)
  })

  it('handles null/undefined userName without crashing', () => {
    const withNull = [tx({ userName: null as any, bookingReference: null as any })]
    expect(() => filterTransactions(withNull, { search: 'test' })).not.toThrow()
    expect(filterTransactions(withNull, { search: 'test' })).toHaveLength(0)
  })
})

describe('computePaymentStats', () => {
  it('computes total revenue from completed transactions', () => {
    const stats = computePaymentStats(transactions)
    expect(stats.totalRevenue).toBe(2000) // 1500 + 500
  })

  it('computes total pending amount including pending_review and failed', () => {
    const stats = computePaymentStats(transactions)
    expect(stats.pendingAmount).toBe(2800) // pending (2000) + failed (800)
  })

  it('computes total refunded amount', () => {
    const stats = computePaymentStats(transactions)
    expect(stats.refundedAmount).toBe(3000)
  })

  it('counts total transactions', () => {
    const stats = computePaymentStats(transactions)
    expect(stats.totalCount).toBe(5)
  })

  it('handles empty transactions', () => {
    const stats = computePaymentStats([])
    expect(stats.totalRevenue).toBe(0)
    expect(stats.pendingAmount).toBe(0)
    expect(stats.refundedAmount).toBe(0)
    expect(stats.totalCount).toBe(0)
  })
})

describe('exportTransactionsToCsv', () => {
  it('generates CSV with header row', () => {
    const csv = exportTransactionsToCsv([transactions[0]])
    const lines = csv.split('\n')
    expect(lines[0]).toContain('Payment Reference')
    expect(lines[0]).toContain('Booking Reference')
    expect(lines[0]).toContain('Client')
    expect(lines[0]).toContain('Amount')
    expect(lines[0]).toContain('Method')
    expect(lines[0]).toContain('Status')
  })

  it('includes transaction data in CSV rows', () => {
    const csv = exportTransactionsToCsv([transactions[0]])
    const lines = csv.split('\n')
    expect(lines[1]).toContain('PAY-20260801-001')
    expect(lines[1]).toContain('BK-2026-001')
    expect(lines[1]).toContain('Juan Dela Cruz')
  })

  it('generates correct number of rows', () => {
    const csv = exportTransactionsToCsv(transactions)
    const lines = csv.split('\n').filter(l => l.trim())
    expect(lines).toHaveLength(6) // 1 header + 5 data rows
  })

  it('handles empty transactions array', () => {
    const csv = exportTransactionsToCsv([])
    const lines = csv.split('\n').filter(l => l.trim())
    expect(lines).toHaveLength(1) // header only
  })

  it('starts with UTF-8 BOM for Excel compatibility', () => {
    const csv = exportTransactionsToCsv([transactions[0]])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
  })

  it('sanitizes formula-injection characters in cell values', () => {
    const malicious = tx({ id: '99', userName: '=cmd("calc")', bookingReference: '+SUM(A1)', facilityName: '-DROP' })
    const csv = exportTransactionsToCsv([malicious])
    // Formula chars are prefixed with single quote to prevent Excel formula injection
    expect(csv).toContain("'=cmd")
    expect(csv).toContain("'+SUM(A1)")
    expect(csv).toContain("'-DROP")
  })
})
