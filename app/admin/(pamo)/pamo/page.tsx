'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, CheckCircle, Wrench, Clock, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react'
import { StatRibbon } from '@/components/admin/dashboard/StatRibbon'
import { LiveClock } from '@/components/admin/dashboard/LiveClock'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/lib/routes'
import { EquipmentByCategory } from '@/components/admin/pamo/EquipmentByCategory'
import { ItemsNeedingAttention } from '@/components/admin/pamo/ItemsNeedingAttention'
import { FacilityDistribution } from '@/components/admin/pamo/FacilityDistribution'
import { equipmentReportCategoryLabel } from '@/lib/enum-labels'

interface Stats { total: number; available: number; inUse: number; maintenance: number }
interface EscReport {
  id: string
  equipmentCode: string | null
  facilityName: string | null
  category: string
  description: string
  createdAt: string
}
interface EscSummary { open: number; latest: EscReport[] }
type LoadState = 'loading' | 'error' | 'ready'

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function PamoOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsState, setStatsState] = useState<LoadState>('loading')
  const [esc, setEsc] = useState<EscSummary | null>(null)
  const [escState, setEscState] = useState<LoadState>('loading')

  const loadStats = useCallback(async () => {
    setStatsState('loading')
    try {
      const res = await fetch('/api/admin/pamo/equipment/stats')
      if (!res.ok) throw new Error('stats')
      setStats(await res.json())
      setStatsState('ready')
    } catch {
      setStatsState('error')
    }
  }, [])

  const loadEsc = useCallback(async () => {
    setEscState('loading')
    try {
      const res = await fetch('/api/admin/pamo/reports/summary')
      if (!res.ok) throw new Error('reports')
      setEsc(await res.json())
      setEscState('ready')
    } catch {
      setEscState('error')
    }
  }, [])

  useEffect(() => { loadStats(); loadEsc() }, [loadStats, loadEsc])

  const s = stats ?? { total: 0, available: 0, inUse: 0, maintenance: 0 }
  const loadingStats = statsState === 'loading'
  const openCount = esc?.open ?? 0

  return (
    <div className="space-y-4">
      {/* Brand Header & Live Date */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            PAMO <span className="text-accent-brand">Inventory</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
            Purchasing and Asset Management Officer — Non-Tech Equipment Oversight
          </p>
        </div>

        <LiveClock />
      </div>

      {/* Inventory stats */}
      {statsState === 'error' ? (
        <ErrorPanel label="Couldn't load inventory stats." onRetry={loadStats} />
      ) : (
        <StatRibbon
          items={[
            { label: 'Total', value: loadingStats ? '—' : s.total, hint: 'All assets', icon: Package, href: ROUTES.pamo.equipment },
            { label: 'Available', value: loadingStats ? '—' : s.available, hint: 'Ready to use', icon: CheckCircle, href: `${ROUTES.pamo.equipment}?status=available` },
            { label: 'In Use', value: loadingStats ? '—' : s.inUse, hint: 'Checked out', icon: Clock, href: `${ROUTES.pamo.equipment}?status=inuse` },
            {
              label: 'Maintenance',
              value: loadingStats ? '—' : s.maintenance,
              hint: 'Under repair',
              icon: Wrench,
              href: `${ROUTES.pamo.equipment}?status=maintenance`,
              tone: statsState === 'ready' && s.maintenance > 0 ? 'warning' : 'default',
            },
          ]}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Escalated Reports</h2>
                {escState === 'ready' && openCount > 0 && (
                  <Badge className="border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400">{openCount} open</Badge>
                )}
              </div>
              <Link href={ROUTES.pamo.reports} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {escState === 'error' ? (
              <ErrorPanel label="Couldn't load escalated reports." onRetry={loadEsc} />
            ) : escState === 'loading' ? (
              <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">Loading escalated reports…</div>
            ) : openCount === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                No escalated reports awaiting you.
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
                {esc!.latest.map((r) => (
                  <Link
                    key={r.id}
                    href={ROUTES.pamo.reports}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-foreground">{r.equipmentCode || '—'}</span>
                        <Badge variant="outline" className="text-xs capitalize">{equipmentReportCategoryLabel(r.category)}</Badge>
                        {r.facilityName && <span className="truncate text-xs text-muted-foreground">· {r.facilityName}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{r.description}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                  </Link>
                ))}
                {openCount > esc!.latest.length && (
                  <Link href={ROUTES.pamo.reports} className="block p-3 text-center text-xs font-medium text-primary hover:bg-muted/50">
                    View {openCount - esc!.latest.length} more →
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* Items Needing Attention */}
          <ItemsNeedingAttention />

          {/* Equipment by Category */}
          <EquipmentByCategory />
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-4">
          {/* Facility Distribution */}
          <FacilityDistribution />

          {/* Primary actions */}
          <div className="flex flex-col gap-3">
            <Button asChild className="h-10 px-4 bg-yellow-500 hover:bg-yellow-400 text-[#060f1e] font-bold rounded-lg shadow-sm transition-all gap-2">
              <Link href={ROUTES.pamo.equipment}>
                <Package className="h-4 w-4" />
                Manage Non-Tech Equipment
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 px-4 rounded-lg border-border hover:bg-muted font-medium transition-all gap-2">
              <Link href={ROUTES.pamo.reports}>
                <ArrowRight className="h-4 w-4" />
                Review Issue Reports
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorPanel({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  )
}
