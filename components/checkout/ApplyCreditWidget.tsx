'use client'

import { useState, useEffect } from 'react'
import { Wallet, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  paymentId: string
  paymentAmountCentavos: number
  returnPath?: string
  onApplied: (checkoutUrl: string | null, fullyCovered: boolean) => void
}

export function ApplyCreditWidget({ paymentId, paymentAmountCentavos, returnPath, onApplied }: Props) {
  const [balanceCentavos, setBalanceCentavos] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/credits/balance')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.balanceCentavos > 0) setBalanceCentavos(data.balanceCentavos)
      })
      .catch(() => {})
  }, [])

  if (!balanceCentavos) return null

  const maxApplicable = Math.min(balanceCentavos, paymentAmountCentavos)
  const maxPeso = (maxApplicable / 100).toFixed(2)
  const availPeso = (balanceCentavos / 100).toFixed(2)

  const parsedCentavos = Math.round(parseFloat(inputValue || '0') * 100)
  const isValid = parsedCentavos > 0 && parsedCentavos <= maxApplicable
  const netCentavos = paymentAmountCentavos - parsedCentavos
  const fullyCovered = isValid && netCentavos === 0

  const handleApply = async () => {
    if (!isValid) return
    setApplying(true)
    setError(null)
    try {
      const res = await fetch('/api/paymongo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          applyCreditCentavos: parsedCentavos,
          returnPath: returnPath ?? '/client/payment',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to apply credit')
      onApplied(data.checkoutUrl ?? null, data.fullyCoveredByCredit === true)
    } catch (err: any) {
      setError(err.message)
      setApplying(false)
    }
  }

  return (
    <div className="border border-blue-200 dark:border-blue-500/30 rounded-2xl overflow-hidden mb-4">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
            You have ₱{availPeso} in session credits
          </span>
        </div>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-blue-400" />}
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-4 bg-white dark:bg-slate-900/50 border-t border-blue-100 dark:border-blue-500/20">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
              Apply Credit <span className="text-slate-400 normal-case font-normal">(max ₱{maxPeso})</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₱</span>
                <input
                  type="number"
                  min="0"
                  max={maxPeso}
                  step="0.01"
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setError(null) }}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500/40"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInputValue(maxPeso)}
                className="rounded-xl text-[10px] font-black uppercase tracking-widest px-4 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"
              >
                Max
              </Button>
            </div>
          </div>

          {parsedCentavos > 0 && isValid && (
            <div className={cn(
              'rounded-xl px-3 py-2 text-[10px]',
              fullyCovered
                ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-300'
                : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            )}>
              {fullyCovered
                ? 'This booking will be fully covered by credit. No PayMongo payment required.'
                : `Net amount to pay via PayMongo: ₱${(netCentavos / 100).toFixed(2)}`}
            </div>
          )}

          {error && (
            <p className="text-[10px] text-red-500 font-black">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setExpanded(false); setInputValue(''); setError(null) }}
              className="rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!isValid || applying}
              className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
            >
              {applying
                ? <><Loader2 className="w-3 h-3 animate-spin mr-2" />Applying...</>
                : fullyCovered ? 'Apply & Confirm' : 'Apply & Continue'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
