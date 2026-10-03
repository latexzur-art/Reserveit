'use client'

import { useState } from 'react'
import { Wallet, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'

interface Props {
  userId: string
  userName: string
  userEmail: string
  onClose: () => void
  onIssued?: () => void
}

export function IssueCreditModal({ userId, userName, userEmail, onClose, onIssued }: Props) {
  const { toast } = useToast()
  const [amountInput, setAmountInput] = useState('')
  const [source, setSource] = useState<'force_majeure' | 'admin_manual'>('force_majeure')
  const [reason, setReason] = useState('')
  const [bookingRef, setBookingRef] = useState('')
  const [cancelBooking, setCancelBooking] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const parsedCentavos = Math.round(parseFloat(amountInput || '0') * 100)
  const isValid = parsedCentavos > 0 && reason.trim().length >= 5

  const handleSubmit = async () => {
    if (!isValid) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/issue-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_centavos: parsedCentavos,
          reason: reason.trim(),
          source,
          source_booking_id: bookingRef.trim() || undefined,
          cancel_booking: cancelBooking,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to issue credit')
      toast({
        title: 'Credit Issued',
        description: `₱${(parsedCentavos / 100).toFixed(2)} credited to ${userName}. New balance: ₱${data.newBalancePeso}.`,
      })
      onIssued?.()
      onClose()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Issue Session Credit
          </DialogTitle>
          <DialogDescription>
            Credit session time to <strong>{userName}</strong> ({userEmail})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="credit-amount">
              Credit Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
              <Input
                id="credit-amount"
                type="number"
                min="0"
                step="0.01"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Source</Label>
            <div className="flex gap-2">
              <TooltipProvider>
                <Button
                  type="button"
                  variant={source === 'force_majeure' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSource('force_majeure')}
                >
                  Force Majeure
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[200px] text-xs">For facility issues beyond control: weather, power outages, natural disasters, or emergency closures.</p>
                    </TooltipContent>
                  </Tooltip>
                </Button>
              </TooltipProvider>
              <TooltipProvider>
                <Button
                  type="button"
                  variant={source === 'admin_manual' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSource('admin_manual')}
                >
                  Admin Manual
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[200px] text-xs">Manual credit issued by an administrator for corrections, goodwill, or special circumstances.</p>
                    </TooltipContent>
                  </Tooltip>
                </Button>
              </TooltipProvider>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="credit-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="credit-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. User contacted helpdesk after hospitalization — verified by ticket #HD-2026-0033"
            />
          </div>

          {/* Optional booking link */}
          <div className="space-y-2">
            <Label htmlFor="credit-booking-id">Booking ID (optional)</Label>
            <Input
              id="credit-booking-id"
              type="text"
              value={bookingRef}
              onChange={e => setBookingRef(e.target.value)}
              placeholder="UUID of the original booking"
            />
            {bookingRef.trim() && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cancel-booking"
                  checked={cancelBooking}
                  onCheckedChange={(checked) => setCancelBooking(checked === true)}
                />
                <Label htmlFor="cancel-booking" className="text-sm text-muted-foreground font-normal">
                  Also cancel this booking (status → cancelled)
                </Label>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !isValid}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {submitting ? 'Issuing...' : 'Issue Credit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
