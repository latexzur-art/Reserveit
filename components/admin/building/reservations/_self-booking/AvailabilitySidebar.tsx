'use client'

import { Clock, CheckCircle, CheckCircle2 } from 'lucide-react'
import { formatCurrency, SCHOOL_PURPOSE_OPTIONS } from '@/components/admin/building/reservations/self-booking/constants'
import { formatTime } from '@/lib/formatTime'
import type { Availability, Facility } from '@/hooks/admin/useSelfBookingForm'

interface LiveCost {
  amount: number
  breakdown: { label: string; isFlatFee?: boolean; rate: number; hours: number; subtotal: number }[]
  hasTime: boolean
}

interface Props {
  facilityId: string
  activeDate: string
  loadingAvailability: boolean
  availability: Availability | null
  showSchoolForm: boolean
  useType: 'school' | 'paid' | null
  selectedFacility: Facility | null
  bookingDate: string
  startTime: string
  endTime: string
  bookingPurpose: string
  // paid sidebar
  soundAddon: { name: string; amount: number } | undefined
  ledAddon:   { name: string; amount: number } | undefined
  addonSound: boolean
  setAddonSound: (v: boolean) => void
  addonLed: boolean
  setAddonLed: (v: boolean) => void
  liveCost: LiveCost
  amRate: number
  pmRate: number
  amCutoffLabel: string
}

export function AvailabilitySidebar({
  facilityId,
  activeDate,
  loadingAvailability,
  availability,
  showSchoolForm,
  useType,
  selectedFacility,
  bookingDate,
  startTime,
  endTime,
  bookingPurpose,
  soundAddon,
  ledAddon,
  addonSound, setAddonSound,
  addonLed,   setAddonLed,
  liveCost,
  amRate, pmRate, amCutoffLabel,
}: Props) {
  return (
    <div className="space-y-4">

      {/* Availability Panel */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Availability
        </h3>
        {!facilityId || !activeDate ? (
          <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
            <p className="text-xs text-slate-400 italic">Select room and date to check availability</p>
          </div>
        ) : loadingAvailability ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}
          </div>
        ) : availability ? (
          <div className="space-y-3">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
              Hours: {formatTime(availability.operating_hours.open)} – {formatTime(availability.operating_hours.close)}
            </p>
            {availability.blocked_ranges.length > 0 ? (
              availability.blocked_ranges.map((block, i) => (
                <div key={i} className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-lg">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-xs font-bold text-red-700 dark:text-red-400">{formatTime(block.start)} – {formatTime(block.end)}</span>
                    <span className="text-[10px] uppercase font-bold text-red-400 border border-red-200 px-1.5 py-0.5 rounded-full">Taken</span>
                  </div>
                  {block.reason && <p className="text-xs text-red-600 dark:text-red-300/70 truncate">{block.reason}</p>}
                </div>
              ))
            ) : (
              <div className="p-4 bg-green-50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/30 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-green-800 dark:text-green-400">Time Slot Open</p>
                <p className="text-[10px] text-green-600 dark:text-green-500 mt-0.5">No conflicts detected</p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Summary — school */}
      {showSchoolForm && (
        <section className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 text-white">
          <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-400 mb-3">Summary</h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Facility</span>
              <span className="font-medium text-right max-w-[130px] truncate">{selectedFacility?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Date</span>
              <span className="font-medium">{bookingDate || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Time</span>
              <span className="font-medium">{startTime && endTime ? `${startTime} – ${endTime}` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Purpose</span>
              <span className="font-medium">{SCHOOL_PURPOSE_OPTIONS.find(p => p.value === bookingPurpose)?.label || '—'}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2.5 p-2.5 bg-white/5 rounded-lg">
              <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div className="text-[10px] font-bold">
                <p className="text-emerald-400">Auto-Approval Active</p>
                <p className="text-slate-400 mt-0.5">Building Head Privilege</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Fees — paid */}
      {facilityId && useType === 'paid' && (
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-slate-900 dark:bg-slate-950 text-white px-4 py-2.5">
            <h3 className="font-bold text-xs uppercase tracking-wide">Fees & Charges</h3>
          </div>
          {(soundAddon || ledAddon) && (
            <div className="px-4 py-3 space-y-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add-ons</p>
              {soundAddon && (
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">{soundAddon.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatCurrency(soundAddon.amount)}</span>
                    <input type="checkbox" checked={addonSound} onChange={e => setAddonSound(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  </div>
                </label>
              )}
              {ledAddon && (
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">{ledAddon.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatCurrency(ledAddon.amount)}</span>
                    <input type="checkbox" checked={addonLed} onChange={e => setAddonLed(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  </div>
                </label>
              )}
            </div>
          )}
          <div className="px-4 py-3">
            {!liveCost.hasTime ? (
              <p className="text-xs text-muted-foreground text-center py-3">Select start and end time to see the fee breakdown</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 text-xs font-semibold text-muted-foreground">Item</th>
                    <th className="text-center py-1.5 text-xs font-semibold text-muted-foreground">Hrs</th>
                    <th className="text-right py-1.5 text-xs font-semibold text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {liveCost.breakdown.map((item, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 text-xs">
                        <div>{item.label}</div>
                        <div className="text-muted-foreground">{item.isFlatFee ? 'flat fee' : `₱${item.rate.toLocaleString()}/hr`}</div>
                      </td>
                      <td className="py-1.5 text-xs text-center text-muted-foreground">{item.isFlatFee ? '—' : item.hours.toFixed(1)}</td>
                      <td className="py-1.5 text-xs text-right font-medium">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 dark:border-slate-100">
                    <td colSpan={2} className="pt-2 font-bold text-sm uppercase">Total</td>
                    <td className="pt-2 font-bold text-sm text-right">{formatCurrency(liveCost.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
            <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
              <p>• AM rate: ₱{amRate.toLocaleString()}/hr (before {amCutoffLabel})</p>
              <p>• PM rate: ₱{pmRate.toLocaleString()}/hr ({amCutoffLabel} onwards)</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
