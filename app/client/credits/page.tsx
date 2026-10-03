'use client'

import { useState, useEffect } from 'react'
import { Wallet, ChevronLeft, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import Link from 'next/link'
import { ConnectedClientTopBar } from '../_components/ConnectedClientTopBar'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import { SkeletonList } from '@/components/ui/SkeletonList'

interface CreditEntry {
  id: string
  amount_centavos: number
  event_type: string
  source: string
  reason: string | null
  source_booking_id: string | null
  applied_to_booking_id: string | null
  expires_at: string | null
  created_at: string
}

const SOURCE_LABEL: Record<string, string> = {
  force_majeure: 'Force Majeure',
  alternative_declined: 'Declined Reschedule',
  admin_manual: 'Admin Issued',
  checkout_application: 'Applied at Checkout',
}

const EVENT_LABEL: Record<string, string> = {
  issued: 'Credit Issued',
  applied: 'Credit Applied',
  expired: 'Credit Expired',
  voided: 'Credit Voided',
}

export default function ClientCreditsPage() {
  const [entries, setEntries] = useState<CreditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 20

  useEffect(() => {
    setLoading(true)
    fetch(`/api/credits/history?limit=${pageSize}&offset=${page * pageSize}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return
        setEntries(data.entries ?? [])
        setTotal(data.total ?? 0)
        setBalance(data.balanceCentavos ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen bg-card">
      <ConnectedClientTopBar />

      <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Link
            href={ROUTES.client.payment}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mb-4"
          >
            <ChevronLeft className="w-3 h-3" /> Back to Payments
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-foreground">Rental <span className="text-yellow-600 dark:text-yellow-400">Credits</span></h1>
          <p className="text-[10px] font-black text-muted-foreground mt-1 uppercase tracking-[0.3em]">
            Credits can be applied to any paid booking at checkout
          </p>
        </div>

        {/* Balance card */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 bg-yellow-500/20 rounded-2xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-700 dark:text-yellow-400">Current Balance</p>
            <p className="text-3xl font-black text-yellow-600 dark:text-yellow-400">₱ {(balance / 100).toFixed(2)}</p>
          </div>
        </div>

        {/* History table */}
        {loading ? (
          <SkeletonList />
        ) : entries.length === 0 ? (
          <div className="bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-neutral-300 dark:border-white/10 p-16 text-center">
            <Wallet className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">No session credits yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-3xl border border-neutral-200 dark:border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {total} transaction{total !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-white/5">
              {entries.map(entry => {
                const isPositive = entry.amount_centavos > 0
                const amountPeso = Math.abs(entry.amount_centavos / 100).toFixed(2)
                return (
                  <div key={entry.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                        isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
                      )}>
                        {isPositive
                          ? <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                          : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {EVENT_LABEL[entry.event_type] ?? entry.event_type}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {SOURCE_LABEL[entry.source] ?? entry.source}
                          {entry.reason ? ` — ${entry.reason}` : ''}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          <p className="text-[9px] text-slate-400">
                            {new Date(entry.created_at).toLocaleDateString('en-PH', {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className={cn(
                      'text-sm font-black flex-shrink-0',
                      isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {isPositive ? '+' : '−'}₱{amountPeso}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4">
            <button
              disabled={page <= 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-6 py-2 rounded-xl border border-neutral-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Prev
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              className="px-6 py-2 rounded-xl border border-neutral-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
