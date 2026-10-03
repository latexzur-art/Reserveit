"use client"

import type { useRentalBookingForm } from '@/app/client/_hooks/useGymBookingForm'
import { Loader2 } from 'lucide-react'

type Hook = ReturnType<typeof useRentalBookingForm>

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

interface FeesPanelProps {
  facilityRates: Hook['facilityRates']
  loadingRates?: boolean
  formData: Hook['formData']
  updateField: Hook['updateField']
  liveCost: Hook['liveCost']
}

export function FeesPanel({ facilityRates, loadingRates = false, formData, updateField, liveCost }: FeesPanelProps) {
  const addonsList = facilityRates?.addons ?? []

  const soundAddon = addonsList.find(a => a.name.toLowerCase().includes('sound'))
  const ledAddon = addonsList.find(a => a.name.toLowerCase().includes('led') || a.name.toLowerCase().includes('light'))
  const otherAddons = addonsList.filter(a =>
    !a.name.toLowerCase().includes('sound') && !a.name.toLowerCase().includes('led') && !a.name.toLowerCase().includes('light')
  )

  const amRate = facilityRates?.amRate ?? 580
  const pmRate = facilityRates?.pmRate ?? facilityRates?.amRate ?? 780
  const amCutoff = facilityRates?.amCutoffHour ?? 17
  const amCutoffLabel = `${amCutoff > 12 ? amCutoff - 12 : amCutoff}:00 ${amCutoff >= 12 ? 'PM' : 'AM'}`

  return (
    <div className="lg:col-span-1">
      <div className="sticky top-4 bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-3 flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase tracking-wide">Fees and Charges</h3>
          {loadingRates && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>

        {/* Add-on toggles */}
        <div className="px-5 py-4 space-y-3 border-b border-border/60">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add-ons</p>
          
          {loadingRates ? (
            <div className="space-y-2 py-1">
              <div className="h-9 bg-muted/60 rounded-xl animate-pulse" />
              <div className="h-9 bg-muted/60 rounded-xl animate-pulse" />
            </div>
          ) : addonsList.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1">No add-ons configured for this facility.</p>
          ) : (
            <>
              {soundAddon && (
                <label className="flex items-center justify-between cursor-pointer min-h-11 hover:opacity-90 transition-opacity">
                  <span className="text-sm font-medium text-foreground">{soundAddon.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{formatCurrency(soundAddon.amount)}</span>
                    <input
                      type="checkbox"
                      checked={formData.addon_sound}
                      onChange={e => updateField('addon_sound', e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>
                </label>
              )}

              {ledAddon && (
                <label className="flex items-center justify-between cursor-pointer min-h-11 hover:opacity-90 transition-opacity">
                  <span className="text-sm font-medium text-foreground">{ledAddon.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{formatCurrency(ledAddon.amount)}</span>
                    <input
                      type="checkbox"
                      checked={formData.addon_led}
                      onChange={e => updateField('addon_led', e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>
                </label>
              )}

              {otherAddons.map(addon => (
                <div key={addon.id} className="flex items-center justify-between text-muted-foreground min-h-8">
                  <span className="text-sm">{addon.name}</span>
                  <span className="text-xs font-semibold">{formatCurrency(addon.amount)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Breakdown table */}
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
                      <div className="font-medium text-foreground">{item.label}</div>
                      <div className="text-muted-foreground">{item.isFlatFee ? 'flat fee' : `₱${item.rate.toLocaleString()}/hr`}</div>
                    </td>
                    <td className="py-2 text-xs text-center text-muted-foreground">{item.isFlatFee ? '—' : item.hours.toFixed(1)}</td>
                    <td className="py-2 text-xs text-right font-medium">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 dark:border-slate-100">
                  <td colSpan={2} className="pt-3 font-bold text-sm uppercase">Total</td>
                  <td className="pt-3 font-bold text-sm text-right">{formatCurrency(liveCost.amount)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            {facilityRates?.amRate != null || facilityRates?.pmRate != null ? (
              <>
                {facilityRates.amRate != null && <p>• AM rate: ₱{facilityRates.amRate.toLocaleString()}/hr (before {amCutoffLabel})</p>}
                {facilityRates.pmRate != null ? (
                  <p>• PM rate: ₱{facilityRates.pmRate.toLocaleString()}/hr ({amCutoffLabel} onwards)</p>
                ) : (
                  <p>• PM rate: Same as AM rate (₱{facilityRates.amRate?.toLocaleString()}/hr)</p>
                )}
              </>
            ) : (
              <>
                <p>• AM rate: ₱{amRate.toLocaleString()}/hr (before {amCutoffLabel})</p>
                <p>• PM rate: ₱{pmRate.toLocaleString()}/hr ({amCutoffLabel} onwards)</p>
              </>
            )}
            <p>• Personnel fee managed separately</p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            Payment is required only after admin approval. You will be notified via the Notifications tab.
          </p>
        </div>
      </div>
    </div>
  )
}
