'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, UserPlus, CheckCircle2, Banknote, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Facility {
  id: string
  name: string
  room_number: string | null
}

interface User {
  id: string
  full_name: string
  email: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function WalkInBookingDialog({ open, onClose, onSuccess }: Props) {
  // Step management
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form')

  // User search
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [searchingUsers, setSearchingUsers] = useState(false)

  // Booking details
  const [facilityId, setFacilityId] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [purpose, setPurpose] = useState('')

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'cashier' | 'qr_manual'>('cashier')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')

  // Facilities list
  const [facilities, setFacilities] = useState<Facility[]>([])

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdBookingRef, setCreatedBookingRef] = useState<string | null>(null)

  // Fetch facilities on mount
  useEffect(() => {
    if (!open) return
    fetch('/api/admin/building/facilities?status=available&pageSize=200')
      .then(r => r.ok ? r.json() : { facilities: [] })
      .then(d => setFacilities((d.facilities ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        room_number: f.roomNumber ?? f.room_number ?? null,
      }))))
      .catch(() => {})
  }, [open])

  // Debounced user search
  useEffect(() => {
    if (userQuery.length < 2) { setUserResults([]); return }
    const timer = setTimeout(async () => {
      setSearchingUsers(true)
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userQuery)}&pageSize=10`)
        if (res.ok) {
          const data = await res.json()
          setUserResults((data.users ?? []).map((u: any) => ({
            id: u.id,
            full_name: u.full_name ?? u.fullName ?? 'Unknown',
            email: u.email ?? '',
          })))
        }
      } catch { /* ignore */ }
      finally { setSearchingUsers(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [userQuery])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('form')
      setUserQuery('')
      setUserResults([])
      setSelectedUser(null)
      setFacilityId('')
      setBookingDate('')
      setStartTime('')
      setEndTime('')
      setPurpose('')
      setPaymentMethod('cashier')
      setPaymentAmount('')
      setReceiptNumber('')
      setError(null)
      setCreatedBookingRef(null)
    }
  }, [open])

  const isFormValid =
    !!selectedUser &&
    !!facilityId &&
    !!bookingDate &&
    !!startTime &&
    !!endTime &&
    !!purpose.trim() &&
    !!paymentAmount &&
    Number(paymentAmount) > 0

  const handleSubmit = async () => {
    if (!isFormValid) return
    setSubmitting(true)
    setError(null)

    try {
      // 1. Create the manual booking
      const bookingRes = await fetch('/api/admin/building/bookings/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser!.id,
          bookingType: 'internal',
          bookingPurpose: 'walk_in',
          bookingDate,
          startTime,
          endTime,
          purpose: purpose.trim(),
          facilityIds: [facilityId],
          paymentAmount: Number(paymentAmount),
          paymentMethod,
        }),
      })

      if (!bookingRes.ok) {
        const data = await bookingRes.json()
        throw new Error(data.error ?? 'Failed to create booking')
      }

      const booking = await bookingRes.json()
      setCreatedBookingRef(booking.booking_reference ?? booking.id)
      setStep('done')
      onSuccess()
    } catch (err: any) {
      setError(err?.message ?? 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-black uppercase tracking-tight text-foreground">
                WALK-IN <span className="text-accent-brand">BOOKING</span>
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                Create a booking with immediate payment
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'done' ? (
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-foreground">Booking Created</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Reference: <span className="font-bold text-foreground">{createdBookingRef}</span>
                </p>
              </div>
            </div>
            <Button
              onClick={onClose}
              className="w-full rounded-xl h-11 font-bold uppercase text-xs tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* User Search */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Select User <span className="text-red-500">*</span>
              </Label>
              {selectedUser ? (
                <div className="flex items-center justify-between h-11 px-3 rounded-xl border border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/10">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{selectedUser.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedUser(null); setUserQuery('') }}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground shrink-0"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={userQuery}
                    onChange={e => setUserQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="rounded-xl h-11 text-xs"
                  />
                  {searchingUsers && (
                    <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  {userResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {userResults.map(u => (
                        <button
                          key={u.id}
                          onClick={() => { setSelectedUser(u); setUserResults([]); setUserQuery('') }}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                        >
                          <p className="text-sm font-bold text-foreground">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Facility */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Facility <span className="text-red-500">*</span>
              </Label>
              <Select value={facilityId} onValueChange={setFacilityId}>
                <SelectTrigger className="rounded-xl h-11 text-xs">
                  <SelectValue placeholder="Select a facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  className="rounded-xl h-11 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Start <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="rounded-xl h-11 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  End <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="rounded-xl h-11 text-xs"
                />
              </div>
            </div>

            {/* Purpose */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Purpose <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                rows={2}
                className="rounded-xl text-xs resize-none"
                placeholder="e.g., Basketball practice, Team meeting..."
              />
            </div>

            {/* Payment */}
            <div className="space-y-3 bg-muted/30 rounded-xl border border-border/40 p-4">
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Payment</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Method</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaymentMethod('cashier')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border text-xs font-bold transition-all",
                        paymentMethod === 'cashier'
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      Cash
                    </button>
                    <button
                      onClick={() => setPaymentMethod('qr_manual')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border text-xs font-bold transition-all",
                        paymentMethod === 'qr_manual'
                          ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      QR
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Amount (₱) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="rounded-xl h-11 text-xs"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              {paymentMethod === 'cashier' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Receipt Number <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    value={receiptNumber}
                    onChange={e => setReceiptNumber(e.target.value)}
                    className="rounded-xl h-11 text-xs"
                    placeholder="e.g., RCP-001"
                  />
                </div>
              )}
            </div>

            {/* Error display */}
            {error && (
              <p className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl h-11 font-bold uppercase text-xs tracking-wide"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                disabled={!isFormValid || submitting}
                onClick={handleSubmit}
                className="flex-1 rounded-xl h-11 font-bold uppercase text-xs tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><UserPlus className="w-3.5 h-3.5 mr-2" /> Create & Collect</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
