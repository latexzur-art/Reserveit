'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Wallet, ChevronRight } from 'lucide-react'

interface CreditBalance {
  balanceCentavos: number
  balancePeso: string
}

export function CreditBalanceCard() {
  const [balance, setBalance] = useState<CreditBalance | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/credits/balance')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data?.balanceCentavos > 0) setBalance(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!balance) return null

  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center">
          <Wallet className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-blue-500/70">Session Credit Balance</p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">₱ {balance.balancePeso}</p>
        </div>
      </div>
      <Link
        href="/client/credits"
        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors"
      >
        View History <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
