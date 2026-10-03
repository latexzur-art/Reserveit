'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { OversightBooking } from '@/hooks/admin/useOversight'

interface OverrideDialogProps {
  booking: OversightBooking
  onClose: () => void
  onSuccess: () => void
}

type OverrideAction = 'cancel' | 'reschedule' | 'change_facility'

export default function OverrideDialog({ booking, onClose, onSuccess }: OverrideDialogProps) {
  const [action, setAction] = useState<OverrideAction>('cancel')
  const [reason, setReason] = useState('')
  const [newDate, setNewDate] = useState(booking.booking_date)
  const [newStart, setNewStart] = useState(booking.start_time)
  const [newEnd, setNewEnd] = useState(booking.end_time)
  const [newFacilityId, setNewFacilityId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!reason.trim()) {
      setError('Please provide a reason for the override.')
      return
    }

    setLoading(true)
    setError(null)

    const payload: Record<string, unknown> = {
      booking_id: booking.id,
      action,
      reason,
    }

    if (action === 'reschedule') {
      payload.new_values = { booking_date: newDate, start_time: newStart, end_time: newEnd }
    } else if (action === 'change_facility') {
      if (!newFacilityId.trim()) {
        setError('Please enter a facility ID.')
        setLoading(false)
        return
      }
      payload.new_values = { facility_id: newFacilityId }
    }

    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Override failed')
        return
      }

      onSuccess()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sti-navy">
            Override Booking — {booking.booking_reference}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Override Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as OverrideAction)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cancel">Cancel Booking</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
                <SelectItem value="change_facility">Change Facility</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {action === 'reschedule' && (
            <div className="space-y-3">
              <div>
                <Label>New Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {action === 'change_facility' && (
            <div>
              <Label>New Facility ID</Label>
              <Input
                placeholder="Enter facility UUID"
                value={newFacilityId}
                onChange={(e) => setNewFacilityId(e.target.value)}
                className="mt-1.5 font-mono text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">
                Enter the UUID of the replacement facility.
              </p>
            </div>
          )}

          <div>
            <Label>Reason (required)</Label>
            <Textarea
              placeholder="Explain why this override is necessary..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1.5 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className={
              action === 'cancel'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gradient-to-r from-sti-navy to-sti-blue text-white'
            }
          >
            {loading ? 'Processing…' : `Confirm ${action === 'cancel' ? 'Cancellation' : action === 'reschedule' ? 'Reschedule' : 'Facility Change'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
