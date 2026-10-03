'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { computeBookingAmount, type RateConfig } from '@/backend/booking/computeBookingAmount'
import { formatTime } from '@/lib/formatTime'

interface FacilityRatesResponse {
  amRate: number | null
  pmRate: number | null
  amCutoffHour: number
  addons: { id: string; name: string; amount: number }[]
}

interface ExtendBookingModalProps {
  bookingId: string
  bookingReference: string
  currentEndTime: string
  bookingDate: string
  facilityId?: string | null
  addonSound?: boolean
  addonLed?: boolean
  onClose: () => void
  onSuccess: (extensionRef: string) => void
}

const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const label = new Date(0, 0, 0, h, m).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  return { value, label }
})

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

export function ExtendBookingModal({
  bookingId,
  bookingReference,
  currentEndTime,
  facilityId,
  addonSound,
  addonLed,
  onClose,
  onSuccess,
}: ExtendBookingModalProps) {
  const [newEndTime, setNewEndTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rateConfig, setRateConfig] = useState<RateConfig | undefined>(undefined)

  const currentEnd = currentEndTime.slice(0, 5)

  // Fetch facility-specific rates when facilityId is available
  useEffect(() => {
    if (!facilityId) return
    let cancelled = false
    async function fetchRates() {
      try {
        const res = await fetch(`/api/facilities/${facilityId}/rates`)
        if (!res.ok) return // silently fall back to defaults
        const data: FacilityRatesResponse = await res.json()
        if (cancelled) return
        const config: RateConfig = {}
        if (data.amRate != null) config.amRatePerHour = data.amRate
        if (data.pmRate != null) config.pmRatePerHour = data.pmRate
        if (data.amCutoffHour) config.pmCutoffHour = data.amCutoffHour
        const soundAddon = data.addons?.find(a => a.name.toLowerCase().includes('sound'))
        if (soundAddon) config.addonSoundFee = soundAddon.amount
        const ledAddon = data.addons?.find(a => a.name.toLowerCase().includes('led'))
        if (ledAddon) config.addonLedFee = ledAddon.amount
        setRateConfig(config)
      } catch {
        // Network error — silently fall back to hardcoded defaults
      }
    }
    fetchRates()
    return () => { cancelled = true }
  }, [facilityId])

  const availableEndTimes = useMemo(() =>
    TIME_OPTIONS.filter(t => t.value > currentEnd && t.value <= '21:00'),
    [currentEnd]
  )

  const extensionCost = useMemo(() => {
    if (!newEndTime) return null
    return computeBookingAmount(currentEnd, newEndTime, {
      sound: addonSound,
      led: addonLed,
    }, rateConfig)
  }, [newEndTime, currentEnd, addonSound, addonLed, rateConfig])

  const handleSubmit = async () => {
    if (!newEndTime) {
      setError('Please select a new end time')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/bookings/${bookingId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_end_time: newEndTime }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Failed to submit extension request.')
        return
      }
      setSuccess(data.extension_booking_reference)
      onSuccess(data.extension_booking_reference)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-gray-900 dark:text-white">Extend Booking</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Extension Request Submitted!</h4>
            <p className="text-sm text-muted-foreground mb-1">Reference: <strong>{success}</strong></p>
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs text-yellow-800 dark:text-yellow-300">
              <Clock className="inline w-3.5 h-3.5 mr-1" />
              Pending building head approval. You will be notified to pay once approved.
            </div>
            <Button className="mt-5 w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Current booking info */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
              <p className="text-muted-foreground text-xs mb-1">Booking Reference</p>
              <p className="font-semibold text-gray-900 dark:text-white">{bookingReference}</p>
              <p className="text-muted-foreground mt-2 text-xs">Current end time</p>
              <p className="font-semibold text-gray-900 dark:text-white">{formatTime(currentEnd)}</p>
            </div>

            {/* New end time selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Extend until <span className="text-red-500">*</span>
              </label>
              {availableEndTimes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available time slots after {formatTime(currentEnd)}.</p>
              ) : (
                <select
                  value={newEndTime}
                  onChange={e => { setNewEndTime(e.target.value); setError(null) }}
                  className={cn(
                    'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    error && !newEndTime && 'border-red-500'
                  )}
                >
                  <option value="">Select new end time</option>
                  {availableEndTimes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Cost preview */}
            {extensionCost && newEndTime && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-wide">Estimated Extension Cost</p>
                <div className="space-y-1">
                  {extensionCost.breakdown.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.label} {item.hours !== 1 ? `(${item.hours.toFixed(1)}h)` : ''}</span>
                      <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-blue-200 dark:border-blue-700 pt-2 mt-2">
                    <span>Total</span>
                    <span>{formatCurrency(extensionCost.amount)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  • AM rate: {formatCurrency(rateConfig?.amRatePerHour ?? 580)}/hr (before {rateConfig?.pmCutoffHour ?? 5}:00 PM) &nbsp;•&nbsp; PM rate: {formatCurrency(rateConfig?.pmRatePerHour ?? 780)}/hr ({rateConfig?.pmCutoffHour ?? 5}:00 PM onwards)
                </p>
              </div>
            )}

            {/* Info notice */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Extension requires building head approval. Payment will be collected after approval — same process as the original booking.</span>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting || !newEndTime || availableEndTimes.length === 0}
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Request Extension'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
