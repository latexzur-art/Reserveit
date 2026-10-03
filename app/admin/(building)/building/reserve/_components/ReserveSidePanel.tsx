"use client"

import { Clock, CheckCircle, CheckCircle2 } from 'lucide-react'
import { formatTime } from '@/lib/formatTime'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

interface ReserveSidePanelProps {
  facilityId: string | null
  activeDate: string
  loadingAvailability: boolean
  availability: any
  showSchoolForm: boolean
  selectedFacility: any
  bookingDate: string
  startTime: string
  endTime: string
  purposeLabel: string | undefined
  selfFacilitationConfirmed: boolean
  facilitatorName: string
  useType: string | null
  soundAddon: any
  ledAddon: any
  addonSound: boolean
  setAddonSound: (v: boolean) => void
  addonLed: boolean
  setAddonLed: (v: boolean) => void
  liveCost: { hasTime: boolean; amount: number; breakdown: { label: string; rate: number; hours: number; subtotal: number; isFlatFee?: boolean }[] }
  amRate: number
  pmRate: number
  amCutoffLabel: string
}

export function ReserveSidePanel({
  facilityId,
  activeDate,
  loadingAvailability,
  availability,
  showSchoolForm,
  selectedFacility,
  bookingDate,
  startTime,
  endTime,
  purposeLabel,
  selfFacilitationConfirmed,
  facilitatorName,
  useType,
  soundAddon,
  ledAddon,
  addonSound,
  setAddonSound,
  addonLed,
  setAddonLed,
  liveCost,
  amRate,
  pmRate,
  amCutoffLabel,
}: ReserveSidePanelProps) {
  return (
              <div className="space-y-5">

                {/* Availability Panel */}
                <section className="bg-card rounded-2xl shadow-sm border border-border p-5">
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 uppercase tracking-wide">
                    <Clock className="w-4 h-4 text-sti-blue dark:text-accent-light" /> Availability Check
                  </h3>
                  {!facilityId || !activeDate ? (
                    <div className="py-10 text-center bg-muted rounded-xl border border-dashed border-border">
                      <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-xs text-muted-foreground italic px-4">Select room and date to check for conflicts</p>
                    </div>
                  ) : loadingAvailability ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
                    </div>
                  ) : availability ? (
                    <div className="space-y-4">
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                        Operating: {formatTime(availability.operating_hours.open)} – {formatTime(availability.operating_hours.close)}
                      </p>
                      {availability.blocked_ranges.length > 0 ? (
                        availability.blocked_ranges.map((block: any, i: number) => (
                          <div key={i} className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-xl">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-xs font-black text-red-700 dark:text-red-400">{formatTime(block.start)} – {formatTime(block.end)}</span>
                              <span className="text-[10px] uppercase font-black text-red-400 border border-red-200 px-2 py-0.5 rounded-full">Taken</span>
                            </div>
                            {block.reason && <p className="text-xs text-red-600 dark:text-red-300/70 truncate">{block.reason}</p>}
                          </div>
                        ))
                      ) : (
                        <div className="p-5 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-center">
                          <CheckCircle className="w-10 h-10 text-sti-blue mx-auto mb-2" />
                          <p className="text-sm font-bold text-sti-blue dark:text-blue-300">Time Slot Open</p>
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 uppercase font-black tracking-tighter">No conflicts detected</p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>

                {/* Summary — school */}
                {showSchoolForm && (
                  <section className="bg-card rounded-2xl p-5 shadow-sm border border-border text-foreground relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sti-blue/10 rounded-full translate-x-10 -translate-y-10" />
                    <h3 className="text-xs font-black mb-5 relative z-10 uppercase tracking-widest text-sti-blue dark:text-accent-light">Summary</h3>
                    <div className="space-y-3.5 relative z-10 text-xs">
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground">Facility</span>
                        <span className="font-bold text-foreground text-right max-w-[140px] truncate">{selectedFacility?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-bold text-foreground">{bookingDate || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Schedule</span>
                        <span className="font-bold text-foreground">{startTime && endTime ? `${startTime} – ${endTime}` : '—'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Purpose</span>
                        <span className="font-bold text-foreground">{purposeLabel || '—'}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground">Facilitator</span>
                        <span className="font-bold text-foreground text-right max-w-[140px] truncate">
                          {selfFacilitationConfirmed ? 'Self (Building Head)' : facilitatorName || '—'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-border relative z-10">
                      <div className="flex items-center gap-3 p-3 bg-sti-blue/10 dark:bg-sti-blue/20 border border-sti-blue/20 rounded-xl">
                        <div className="w-8 h-8 bg-sti-blue rounded-lg flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-[10px] font-bold">
                          <p className="text-sti-blue dark:text-accent-light">Auto-Approval Active</p>
                          <p className="text-muted-foreground mt-0.5 font-medium">Building Head Privilege</p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Fees — paid */}
                {facilityId && useType === 'paid' && (
                  <section className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                    <div className="bg-muted/60 border-b border-border text-foreground px-5 py-3">
                      <h3 className="font-bold text-sm uppercase tracking-wide">Fees and Charges</h3>
                    </div>
                    {(soundAddon || ledAddon) && (
                      <div className="px-5 py-4 space-y-3 border-b border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add-ons</p>
                        {soundAddon && (
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm">{soundAddon.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{formatCurrency(soundAddon.amount)}</span>
                              <input type="checkbox" checked={addonSound} onChange={e => setAddonSound(e.target.checked)} className="h-4 w-4 rounded border-border" />
                            </div>
                          </label>
                        )}
                        {ledAddon && (
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm">{ledAddon.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{formatCurrency(ledAddon.amount)}</span>
                              <input type="checkbox" checked={addonLed} onChange={e => setAddonLed(e.target.checked)} className="h-4 w-4 rounded border-border" />
                            </div>
                          </label>
                        )}
                      </div>
                    )}
                    <div className="px-5 py-4">
                      {!liveCost.hasTime ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Select start and end time to see the fee breakdown</p>
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
                                <td className="py-2 text-xs">
                                  <div>{item.label}</div>
                                  <div className="text-muted-foreground">{item.isFlatFee ? 'flat fee' : `₱${item.rate.toLocaleString()}/hr`}</div>
                                </td>
                                <td className="py-2 text-xs text-center text-muted-foreground">{item.isFlatFee ? '—' : item.hours.toFixed(1)}</td>
                                <td className="py-2 text-xs text-right font-medium">{formatCurrency(item.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-foreground">
                              <td colSpan={2} className="pt-3 font-bold text-sm uppercase">Total</td>
                              <td className="pt-3 font-bold text-sm text-right">{formatCurrency(liveCost.amount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                      <div className="mt-4 text-xs text-muted-foreground space-y-1">
                        <p>• AM rate: ₱{amRate.toLocaleString()}/hr (before {amCutoffLabel})</p>
                        <p>• PM rate: ₱{pmRate.toLocaleString()}/hr ({amCutoffLabel} onwards)</p>
                      </div>
                    </div>
                    <div className="px-5 pb-5">
                      <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        Payment is required only after Building Head approval. You will be notified via the Notifications tab.
                      </p>
                    </div>
                  </section>
                )}
              </div>
  )
}
