'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface DangerWipeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  /** Phrase the user must type verbatim to enable the destructive action. */
  confirmPhrase: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void | Promise<void>
}

/**
 * Reusable "type the phrase to confirm" dialog for destructive wipes.
 * Stays open while `busy` so the caller controls closing after the request.
 */
export function DangerWipeDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmPhrase,
  confirmLabel = 'Wipe',
  busy = false,
  onConfirm,
}: DangerWipeDialogProps) {
  const [value, setValue] = useState('')

  // Reset the typed phrase whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) setValue('')
  }, [open])

  const matches = value.trim() === confirmPhrase

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-1 text-sm text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="danger-confirm" className="text-xs">
            Type <span className="font-mono font-bold text-foreground">{confirmPhrase}</span> to confirm
          </Label>
          <Input
            id="danger-confirm"
            autoComplete="off"
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
            placeholder={confirmPhrase}
            className="font-mono"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || busy}
            onClick={() => onConfirm()}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
