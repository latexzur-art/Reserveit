'use client'

import { useState } from 'react'
import { Copy, Check, AlertTriangle } from 'lucide-react'
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

interface ResetPasswordResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail: string
  temporaryPassword: string
  emailSent?: boolean
  notificationEmailUsed?: string | null
}

export const ResetPasswordResultDialog = ({
  open,
  onOpenChange,
  userEmail,
  temporaryPassword,
  emailSent,
  notificationEmailUsed,
}: ResetPasswordResultDialogProps) => {
  const [copied, setCopied] = useState<'email' | 'password' | null>(null)

  const copyToClipboard = async (value: string, kind: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // silently ignore clipboard errors
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Password reset — copy the new credentials</DialogTitle>
          <DialogDescription>
            The new temporary password will not be shown again. Share it with the user via a secure channel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Sign-in email</Label>
            <div className="flex gap-2">
              <Input value={userEmail} readOnly className="font-mono text-sm" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(userEmail, 'email')}
                aria-label="Copy email"
              >
                {copied === 'email' ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>New temporary password</Label>
            <div className="flex gap-2">
              <Input
                value={temporaryPassword}
                readOnly
                className="font-mono text-sm tracking-wider"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(temporaryPassword, 'password')}
                aria-label="Copy password"
              >
                {copied === 'password' ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>

          {emailSent && notificationEmailUsed ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
              <Check size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                Password email sent to <strong>{notificationEmailUsed}</strong>. The user will receive instructions in their inbox.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                {emailSent === false
                  ? 'Email could not be sent — no notification email is set for this user. Share the password below via a secure channel.'
                  : 'This password will not be shown again. The user must change it on their first sign-in via Sign in with Microsoft.'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
