'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

interface DecisionRow {
  id: string
  final_score: number | null
  decision: string
  decision_reason: string | null
  hard_constraints_passed: boolean
  created_at: string
  booking: {
    id: string
    booking_reference: string
    booking_date: string
    start_time: string
    end_time: string
    booking_purpose: string
    user: {
      full_name: string
      email: string
    }
  }
}

export default function RecentDecisionsPanel() {
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/recent-decisions?limit=20')
        if (!res.ok) throw new Error('Failed to load decisions')
        const data = await res.json()
        setDecisions(data.decisions ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500 py-4">{error}</p>
  }

  if (decisions.length === 0) {
    return (
      <p className="text-center text-slate-400 py-8 text-sm">
        No booking decisions recorded yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-3 px-4 text-slate-500 font-medium">Reference</th>
            <th className="text-left py-3 px-4 text-slate-500 font-medium">Requester</th>
            <th className="text-left py-3 px-4 text-slate-500 font-medium">Date</th>
            <th className="text-left py-3 px-4 text-slate-500 font-medium">Score</th>
            <th className="text-left py-3 px-4 text-slate-500 font-medium">Decision</th>
            <th className="text-left py-3 px-4 text-slate-500 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((row) => (
            <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
              <td className="py-3 px-4 font-mono text-xs text-sti-navy font-medium">
                {row.booking?.booking_reference ?? '—'}
              </td>
              <td className="py-3 px-4">
                <p className="font-medium text-slate-700">{row.booking?.user?.full_name ?? '—'}</p>
                <p className="text-xs text-slate-400">{row.booking?.booking_purpose}</p>
              </td>
              <td className="py-3 px-4 text-slate-500 text-xs">
                {row.booking?.booking_date ?? '—'}
              </td>
              <td className="py-3 px-4">
                <ScoreDisplay score={row.final_score} />
              </td>
              <td className="py-3 px-4">
                <DecisionBadge decision={row.decision} />
              </td>
              <td className="py-3 px-4 text-xs text-slate-400 max-w-[200px] truncate" title={row.decision_reason ?? ''}>
                {row.decision_reason ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScoreDisplay({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-300 text-xs">—</span>
  if (score >= 80) {
    return (
      <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
        <TrendingUp className="h-3 w-3" />
        {score}/100
      </span>
    )
  }
  if (score >= 50) {
    return (
      <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
        <Minus className="h-3 w-3" />
        {score}/100
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
      <TrendingDown className="h-3 w-3" />
      {score}/100
    </span>
  )
}

function DecisionBadge({ decision }: { decision: string }) {
  const map: Record<string, { label: string; className: string }> = {
    auto_approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    flagged: { label: 'Flagged', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    auto_declined: { label: 'Declined', className: 'bg-red-100 text-red-700 border-red-200' },
    routed_to_manual: { label: 'Manual', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  }
  const config = map[decision] ?? { label: decision, className: 'bg-slate-100 text-slate-500' }
  return <Badge className={`text-xs ${config.className}`}>{config.label}</Badge>
}
