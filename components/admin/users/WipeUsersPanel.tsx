'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Loader2, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { DangerWipeDialog } from '@/components/admin/DangerWipeDialog'

interface WipeUsersPanelProps {
  /** Called after a successful wipe so the parent can refresh its data. */
  onWiped?: () => void
}

export function WipeUsersPanel({ onWiped }: WipeUsersPanelProps) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [preservedRoles, setPreservedRoles] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const res = await fetch('/api/admin/users/wipe')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load')
      setAllowed(!!data.allowed)
      setReason(data.reason ?? null)
      setCount(data.count ?? 0)
      setPreservedRoles(data.preservedRoles ?? [])
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
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'WIPE USERS' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Wipe failed')
      toast({ title: 'Users wiped', description: `${data.deleted_count ?? 0} user(s) deleted.` })
      setDialogOpen(false)
      await refresh()
      onWiped?.()
    } catch (err: any) {
      toast({ title: 'Wipe failed', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-10 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    )
  }

  return (
    <Card className="p-8 border-2 border-destructive/30 bg-destructive/[0.03] space-y-6 max-w-3xl">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-destructive/10">
          <ShieldOff className="w-6 h-6 text-destructive" />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-tight text-destructive">Danger Zone — Wipe Users</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Permanently delete test user accounts. Staff and admin accounts are always preserved, along
            with your own account. This cannot be undone.
          </p>
        </div>
      </div>

      {!allowed ? (
        <div className="flex items-start gap-3 p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
            {reason || 'User wipe is disabled in this environment.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-border bg-card">
            <Badge variant="destructive" className="text-sm font-bold px-3 py-1">
              {count}
            </Badge>
            <span className="text-sm text-muted-foreground">
              user(s) will be deleted.
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Preserved roles</p>
            <div className="flex flex-wrap gap-2">
              {preservedRoles.map((r) => (
                <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
              ))}
            </div>
          </div>

          <Button
            variant="destructive"
            disabled={count === 0}
            onClick={() => setDialogOpen(true)}
            className="text-xs font-bold uppercase"
            aria-label={`Wipe ${count} users`}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Wipe {count} User(s)
          </Button>
        </>
      )}

      <DangerWipeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Wipe Users?"
        confirmPhrase="WIPE USERS"
        confirmLabel="Wipe Users"
        busy={busy}
        onConfirm={handleConfirm}
        description={
          <p>
            This permanently deletes <strong>{count} non-staff user(s)</strong>. Staff/admin accounts and
            your own account are preserved. This action <strong>cannot be undone</strong>.
          </p>
        }
      />
    </Card>
  )
}
