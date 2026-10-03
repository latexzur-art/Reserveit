'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CalendarX, GraduationCap, Database, Loader2, Trash2, ShieldOff, Download } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { DangerWipeDialog } from '@/components/admin/DangerWipeDialog'

type Tier = 'bookings' | 'schedules' | 'curriculum' | 'all'
type Counts = Record<string, number>

interface TierDef {
  tier: Tier
  label: string
  description: string
  icon: React.ElementType
  /** Count keys (from the dry-run) to surface on the card. */
  countKeys: string[]
}

const TIERS: TierDef[] = [
  {
    tier: 'bookings',
    label: 'Bookings & Payments',
    description: 'All reservations (paid and unpaid), payment records, credits, and booking history.',
    icon: CalendarX,
    countKeys: ['bookings', 'payments'],
  },
  {
    tier: 'schedules',
    label: 'Class Schedules',
    description: 'Class schedules, schedule uploads, staging entries, and change requests.',
    icon: CalendarX,
    countKeys: ['class_schedules', 'schedule_uploads'],
  },
  {
    tier: 'curriculum',
    label: 'Curriculum',
    description: 'Courses, course uploads, and term course activations. Academic terms are kept.',
    icon: GraduationCap,
    countKeys: ['courses', 'course_uploads'],
  },
  {
    tier: 'all',
    label: 'Wipe ALL Data',
    description: 'Bookings, schedules, curriculum, maintenance, logs, notifications, and messages. Users, roles, and facility config are preserved.',
    icon: Database,
    countKeys: ['bookings', 'class_schedules', 'courses', 'maintenance_records', 'notifications', 'messages'],
  },
]

export function DangerZoneTab() {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [counts, setCounts] = useState<Counts>({})
  const [activeTier, setActiveTier] = useState<Tier | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloadingBackup, setDownloadingBackup] = useState(false)

  const handleBackup = async () => {
    setDownloadingBackup(true)
    try {
      const res = await fetch('/api/admin/building/data-wipe/backup')
      if (!res.ok) throw new Error('Failed to generate backup')
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reserveit-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({ title: 'Backup Successful', description: 'Database backup downloaded.' })
      return true
    } catch (err: any) {
      toast({ title: 'Backup Failed', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setDownloadingBackup(false)
    }
  }

  const refresh = async () => {
    try {
      const res = await fetch('/api/admin/building/data-wipe')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load')
      setAllowed(!!data.allowed)
      setReason(data.reason ?? null)
      setCounts(data.counts ?? {})
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleConfirm = async () => {
    if (!activeTier) return
    setBusy(true)
    
    // Automatically export a backup before deletion
    const backupSuccess = await handleBackup()
    if (!backupSuccess) {
      setBusy(false)
      return
    }

    try {
      const res = await fetch('/api/admin/building/data-wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: activeTier, confirm: `WIPE ${activeTier.toUpperCase()}` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Wipe failed')

      const total = Object.values(data.deleted ?? {}).reduce(
        (sum: number, n) => sum + (typeof n === 'number' ? n : 0),
        0,
      )
      toast({ title: 'Data wiped', description: `${total} record(s) deleted.` })
      setActiveTier(null)
      await refresh()
    } catch (err: any) {
      toast({ title: 'Wipe failed', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-10 rounded-[2.5rem] border-border bg-card shadow-none flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    )
  }

  const activeDef = TIERS.find((t) => t.tier === activeTier)

  return (
    <Card className="p-10 rounded-[2.5rem] border-2 border-destructive/30 bg-destructive/[0.03] shadow-none space-y-8">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-destructive/10">
          <ShieldOff className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight text-red-600 dark:text-red-400">Danger Zone</h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 max-w-xl">
            Destructive testing tools. These permanently delete data and cannot be undone.
          </p>
        </div>
      </div>

      {!allowed && (
        <div className="flex items-start gap-3 p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
            {reason || 'Data wipe is disabled in this environment.'}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between p-6 rounded-2xl border border-border bg-card">
        <div>
          <h4 className="text-sm font-black uppercase tracking-tight text-foreground">Manual Backup</h4>
          <p className="text-[11px] font-medium text-muted-foreground mt-1">Download a full JSON backup of the core database tables at any time.</p>
        </div>
        <Button variant="outline" onClick={handleBackup} disabled={downloadingBackup}>
          {downloadingBackup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download Backup
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TIERS.map((def) => {
          const Icon = def.icon
          const isAll = def.tier === 'all'
          return (
            <div
              key={def.tier}
              className={`flex flex-col gap-4 p-6 rounded-2xl border ${
                isAll ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isAll ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`} />
                <h4 className="text-xs font-black uppercase tracking-tight text-foreground">{def.label}</h4>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground leading-relaxed flex-1">
                {def.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {def.countKeys.map((key) => (
                  <Badge key={key} variant="secondary" className="text-[9px] font-bold uppercase">
                    {key.replace(/_/g, ' ')}: {counts[key] ?? 0}
                  </Badge>
                ))}
              </div>
              <Button
                variant="destructive"
                disabled={!allowed}
                onClick={() => setActiveTier(def.tier)}
                className="w-full text-[10px] font-black uppercase"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isAll ? 'Wipe Everything' : `Wipe ${def.label}`}
              </Button>
            </div>
          )
        })}
      </div>

      {activeDef && (
        <DangerWipeDialog
          open={!!activeTier}
          onOpenChange={(o) => { if (!o) setActiveTier(null) }}
          title={`Wipe ${activeDef.label}?`}
          confirmPhrase={`WIPE ${activeDef.tier.toUpperCase()}`}
          confirmLabel="Wipe Data"
          busy={busy}
          onConfirm={handleConfirm}
          description={
            <>
              <p>
                This permanently deletes <strong>{activeDef.label.toLowerCase()}</strong> from the
                database. This action <strong>cannot be undone</strong>.
              </p>
              <div className="flex flex-wrap gap-2">
                {activeDef.countKeys.map((key) => (
                  <Badge key={key} variant="outline" className="text-[10px]">
                    {key.replace(/_/g, ' ')}: {counts[key] ?? 0}
                  </Badge>
                ))}
              </div>
            </>
          }
        />
      )}
    </Card>
  )
}
