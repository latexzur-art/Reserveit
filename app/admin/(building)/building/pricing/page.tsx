"use client"

import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Pencil, Trash2, Tag, Building2, Info } from "lucide-react"
import { useBuildingPricing } from "@/hooks/admin/building"
import { toast } from 'sonner'
import { TimePicker } from "@/components/ui/time-picker"
import type { CreateRateInput, RentalRate, FeeCategory, RateType, TimePeriod } from "@/backend/admin/building/building.types"
import { validateRateForm } from "@/backend/admin/building/rate-validation"
import { cn } from "@/lib/utils"
import { feeCategoryLabel } from "@/lib/enum-labels"
import { formatTime } from "@/lib/formatTime"


// ─── helpers ────────────────────────────────────────────────────────────────

function formatPHP(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function timePeriodLabel(p: TimePeriod) {
  if (p === 'am') return 'AM'
  if (p === 'pm') return 'PM'
  return 'All Day'
}

// ─── Rate Dialog (shared for create + edit) ─────────────────────────────────

interface RateDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: CreateRateInput & { isActive?: boolean }) => Promise<boolean>
  saving: boolean
  initial?: RentalRate | null
  facilityId: string
  facilityName: string
  isAddon: boolean
}

function RateDialog({ open, onClose, onSave, saving, initial, facilityId, facilityName, isAddon }: RateDialogProps) {
  const [rateName, setRateName] = useState(initial?.rateName ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(initial?.timePeriod ?? (isAddon ? 'all_day' : 'am'))
  const [feeCategory, setFeeCategory] = useState<FeeCategory>(initial?.feeCategory ?? (isAddon ? 'energy' : 'rental'))
  const [startTime, setStartTime] = useState(initial?.applicableStartTime ?? '')
  const [endTime, setEndTime] = useState(initial?.applicableEndTime ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [err, setErr] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  // Required-field errors surface only after a save attempt, never while the
  // user is still filling an untouched field. Format errors (bad amount) can
  // still validate on blur since they only fire on genuinely invalid input.
  const [submitted, setSubmitted] = useState(false)

  function validateAmountFormat(value: string) {
    const amt = parseFloat(value)
    setFieldErrors(prev => {
      const next = { ...prev }
      if (value && (isNaN(amt) || amt < 0)) next.amount = 'Enter a valid amount'
      else delete next.amount
      return next
    })
  }

  React.useEffect(() => {
    if (open) {
      setRateName(initial?.rateName ?? '')
      setAmount(initial ? String(initial.amount) : '')
      setTimePeriod(initial?.timePeriod ?? (isAddon ? 'all_day' : 'am'))
      setFeeCategory(initial?.feeCategory ?? (isAddon ? 'energy' : 'rental'))
      setStartTime(initial?.applicableStartTime ?? '')
      setEndTime(initial?.applicableEndTime ?? '')
      setDescription(initial?.description ?? '')
      setIsActive(initial?.isActive ?? true)
      setErr(null)
      setFieldErrors({})
      setSubmitted(false)
    }
  }, [open, initial, isAddon])

  async function handleSave() {
    setSubmitted(true)
    const result = validateRateForm({ rateName, amount, timePeriod, startTime, endTime, isAddon })
    if (!result.ok) {
      if (result.field === 'time') {
        setErr(result.message)
        setFieldErrors(prev => { const n = { ...prev }; delete n.rateName; delete n.amount; return n })
      } else {
        setErr(null)
        setFieldErrors(prev => ({ ...prev, [result.field]: result.message }))
      }
      return
    }
    setErr(null)
    setFieldErrors({})
    const amt = parseFloat(amount)
    const ok = await onSave({
      facilityId,
      feeCategory,
      rateName: rateName.trim(),
      rateType: (isAddon ? 'flat' : 'hourly') as RateType,
      timePeriod,
      amount: amt,
      applicableStartTime: isAddon ? undefined : (startTime || undefined),
      applicableEndTime: isAddon ? undefined : (endTime || undefined),
      description: description || undefined,
      isAddon,
      isActive,
    })
    if (ok) {
      onClose()
    }
    return ok
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card text-card-foreground border-border max-w-md shadow-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit' : 'Add'} {isAddon ? 'Add-on' : 'Rate'}</DialogTitle>
          <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-sti-blue bg-sti-blue/10 dark:bg-sti-blue/20 w-fit px-2.5 py-0.5 rounded-full">
            <Building2 className="w-3 h-3 shrink-0" />
            <span>{facilityName}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rate-name" className="text-xs text-muted-foreground uppercase font-black">Name</Label>
            <Input
              id="rate-name"
              value={rateName}
              onChange={e => {
                const v = e.target.value
                setRateName(v)
                if (fieldErrors.rateName && v.trim()) {
                  setFieldErrors(prev => { const n = { ...prev }; delete n.rateName; return n })
                }
              }}
              placeholder={isAddon ? 'e.g. Sound System' : 'e.g. AM Hourly Rate'}
              aria-invalid={!!fieldErrors.rateName}
              aria-describedby={fieldErrors.rateName ? 'rate-name-error' : undefined}
              className={cn("bg-background border-input text-foreground", fieldErrors.rateName && "border-destructive")}
            />
            {fieldErrors.rateName && <p id="rate-name-error" className="text-xs text-destructive">{fieldErrors.rateName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rate-amount" className="text-xs text-muted-foreground uppercase font-black">Amount (₱)</Label>
              <Input
                id="rate-amount"
                type="number"
                min="0"
                value={amount}
                onChange={e => {
                  const val = e.target.value
                  if (val === '' || parseFloat(val) >= 0) setAmount(val)
                }}
                onBlur={() => validateAmountFormat(amount)}
                placeholder="0"
                aria-invalid={!!fieldErrors.amount}
                aria-describedby={fieldErrors.amount ? 'rate-amount-error' : undefined}
                className={cn("bg-background border-input text-foreground", fieldErrors.amount && "border-destructive")}
              />
              {fieldErrors.amount && <p id="rate-amount-error" className="text-xs text-destructive">{fieldErrors.amount}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate-category" className="text-xs text-muted-foreground uppercase font-black">Category</Label>
              <Select value={feeCategory} onValueChange={v => setFeeCategory(v as FeeCategory)}>
                <SelectTrigger id="rate-category" className="bg-background border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  <SelectItem value="rental">Rental</SelectItem>
                  <SelectItem value="energy">Energy</SelectItem>
                  <SelectItem value="personnel">Personnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isAddon && (
            <div className="space-y-1.5">
              <Label htmlFor="rate-time-period" className="text-xs text-muted-foreground uppercase font-black">Time Period</Label>
              <Select value={timePeriod} onValueChange={v => setTimePeriod(v as TimePeriod)}>
                <SelectTrigger id="rate-time-period" className="bg-background border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  <SelectItem value="am">AM</SelectItem>
                  <SelectItem value="pm">PM</SelectItem>
                  <SelectItem value="all_day">All Day</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sets the pricing category. Optionally narrow when it applies with a window below.</p>
            </div>
          )}

          {!isAddon && (
            <div className="space-y-3 pt-1 border-t border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase font-black">Time Window</Label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setStartTime('07:00'); setEndTime('17:00'); setTimePeriod('am'); }}
                    className="text-[10px] font-bold text-sti-blue hover:underline bg-sti-blue/10 dark:bg-sti-blue/20 px-2 py-0.5 rounded-full transition-colors"
                  >
                    AM (7:00–5:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStartTime('17:00'); setEndTime('22:00'); setTimePeriod('pm'); }}
                    className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full transition-colors"
                  >
                    PM (5:00–10:00)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-semibold">Start Time</Label>
                  <TimePicker
                    id="rate-start-time"
                    ariaLabel="Start time"
                    value={startTime}
                    onChange={setStartTime}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground font-semibold">End Time</Label>
                  <TimePicker
                    id="rate-end-time"
                    ariaLabel="End time"
                    value={endTime}
                    onChange={setEndTime}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Optional — leave blank to apply all period.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rate-description" className="text-xs text-muted-foreground uppercase font-black">Description (optional)</Label>
            <Input
              id="rate-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description"
              className="bg-background border-input text-foreground"
            />
          </div>

          {initial && (
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 bg-muted/20">
              <Label htmlFor="rate-active" className="text-sm">Active</Label>
              <Switch id="rate-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-sti-blue hover:bg-sti-blue-dark text-white">
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {initial ? 'Save Changes' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PricingPage() {
  const {
    rates,
    facilities,
    rentableFacilities,
    facilityRatesMap,
    loadingRates,
    loadingFacilities,
    togglingFacility,
    fetchFacilityRates,
    createRate,
    updateRate,
    deleteRate,
    toggleRentalAvailability,
  } = useBuildingPricing()

  // Dialog state — rate create/edit
  const [rateDialog, setRateDialog] = useState<{
    open: boolean
    isAddon: boolean
    facilityId: string
    facilityName: string
    editing: RentalRate | null
  }>({ open: false, isAddon: false, facilityId: '', facilityName: '', editing: null })
  const [rateSaving, setRateSaving] = useState(false)

  // Facility filter
  const [facilityFilter, setFacilityFilter] = useState<'all' | 'rentable' | 'not_rentable'>('all')
  const [floorFilter, setFloorFilter] = useState<string>('all')

  // Distinct floors present in the facility list, sorted numerically
  const floorOptions = Array.from(
    new Set(facilities.map(f => f.floorNumber).filter((n): n is number => n != null))
  ).sort((a, b) => a - b)

  const filteredFacilities = facilities
    .filter(f => {
      if (facilityFilter === 'rentable' && !f.isAvailableForRental) return false
      if (facilityFilter === 'not_rentable' && f.isAvailableForRental) return false
      if (floorFilter !== 'all' && String(f.floorNumber) !== floorFilter) return false
      return true
    })
    .sort((a, b) => (b.isAvailableForRental ? 1 : 0) - (a.isAvailableForRental ? 1 : 0))

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; rate: RentalRate | null }>({ open: false, rate: null })
  const [deleteLoading, setDeleteLoading] = useState(false)

  function openAddRate(facilityId: string, facilityName: string, isAddon: boolean) {
    setRateDialog({ open: true, isAddon, facilityId, facilityName, editing: null })
  }

  function openEditRate(rate: RentalRate) {
    const fac = facilities.find(f => f.id === rate.facilityId)
    setRateDialog({ open: true, isAddon: rate.isAddon, facilityId: rate.facilityId, facilityName: fac?.name ?? rate.facilityName ?? '', editing: rate })
  }

  async function handleSaveRate(data: CreateRateInput & { isActive?: boolean }) {
    setRateSaving(true)
    let ok: boolean
    if (rateDialog.editing) {
      ok = await updateRate(rateDialog.editing.id, data)
    } else {
      ok = await createRate(data)
    }
    setRateSaving(false)
    if (ok) {
      await fetchFacilityRates({ facilityId: data.facilityId })
      toast.success(
        rateDialog.editing
          ? `"${data.rateName}" updated successfully`
          : `"${data.rateName}" rate added to ${rateDialog.facilityName}`
      )
    }
    return ok
  }

  async function handleDelete() {
    if (!deleteDialog.rate) return
    setDeleteLoading(true)
    const rateName = deleteDialog.rate.rateName
    await deleteRate(deleteDialog.rate.id)
    setDeleteLoading(false)
    setDeleteDialog({ open: false, rate: null })
    toast.success(`"${rateName}" has been removed`)
  }

  // Add-ons = rates where isAddon === true
  const addons = rates.filter(r => r.isAddon && r.isActive)
  const inactiveAddons = rates.filter(r => r.isAddon && !r.isActive)
  const allAddons = [...addons, ...inactiveAddons]

  return (
    <div className="space-y-6 p-6 text-foreground">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-5 h-5 text-sti-blue" />
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Pricing & <span className="text-accent-brand">Rates</span></h1>
        </div>
        <p className="text-sm text-muted-foreground">Manage facility rental rates, add-ons, and rentable facility designations.</p>
      </div>

      <Tabs defaultValue="facilities" className="space-y-4">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="facilities" className="data-[state=active]:bg-sti-blue dark:data-[state=active]:bg-primary data-[state=active]:text-white">
            Rentable Facilities
          </TabsTrigger>
          <TabsTrigger value="rates" className="data-[state=active]:bg-sti-blue dark:data-[state=active]:bg-primary data-[state=active]:text-white">
            Rental Rates
          </TabsTrigger>
          <TabsTrigger value="addons" className="data-[state=active]:bg-sti-blue dark:data-[state=active]:bg-primary data-[state=active]:text-white">
            Add-ons
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Rentable Facilities ── */}
        <TabsContent value="facilities">
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sti-blue" />
                <span className="font-semibold text-sm">All Facilities</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5" />
                  Toggle to include a facility in rental booking forms
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {([
                  { key: 'all', label: 'All', count: facilities.length, activeClass: 'bg-sti-blue text-white' },
                  { key: 'rentable', label: 'Rentable', count: rentableFacilities.length, activeClass: 'bg-sti-blue text-white' },
                  { key: 'not_rentable', label: 'Not Rentable', count: facilities.length - rentableFacilities.length, activeClass: 'bg-slate-600 text-white dark:bg-slate-700' },
                ] as const).map(({ key, label, count, activeClass }) => (
                  <button
                    key={key}
                    onClick={() => setFacilityFilter(key)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                      facilityFilter === key ? activeClass : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {label} <span className="ml-1 opacity-70">{count}</span>
                  </button>
                ))}

                {floorOptions.length > 0 && (
                  <Select value={floorFilter} onValueChange={setFloorFilter}>
                    <SelectTrigger className="ml-auto h-7 w-[140px] bg-background border-input text-xs text-foreground">
                      <SelectValue placeholder="All Floors" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground border-border">
                      <SelectItem value="all">All Floors</SelectItem>
                      {floorOptions.map(n => (
                        <SelectItem key={n} value={String(n)}>Floor {n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {loadingFacilities ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Facility</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Type</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Floor</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Capacity</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right pr-4">Rentable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFacilities.map(f => (
                    <TableRow key={f.id} className="border-border hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium text-sm text-foreground">
                        {f.name}
                        {f.roomNumber && <span className="ml-1.5 text-xs text-muted-foreground">({f.roomNumber})</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.facilityTypeName ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {f.floorNumber != null ? `Floor ${f.floorNumber}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {f.capacity != null ? `${f.capacity} pax` : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex w-8 items-center justify-end">
                            {togglingFacility[f.id] ? (
                              <Loader2 className="w-4 h-4 animate-spin text-sti-blue" />
                            ) : (
                              <span className={cn(
                                "text-[11px] font-bold tracking-wider uppercase transition-colors",
                                f.isAvailableForRental ? "text-sti-blue dark:text-accent-light" : "text-muted-foreground"
                              )}>
                                {f.isAvailableForRental ? "On" : "Off"}
                              </span>
                            )}
                          </div>
                          <Switch
                            checked={!!f.isAvailableForRental}
                            disabled={!!togglingFacility[f.id]}
                            onCheckedChange={v => toggleRentalAvailability(f.id, v)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredFacilities.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                        {facilityFilter === 'rentable'
                          ? 'No rentable facilities yet. Toggle any facility\'s switch to enable it.'
                          : facilityFilter === 'not_rentable'
                          ? 'All facilities are already marked as rentable.'
                          : 'No facilities found. Add facilities in Facility Management first.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Tab 2: Rental Rates ── */}
        <TabsContent value="rates" className="space-y-4">
          {loadingFacilities ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : rentableFacilities.length === 0 ? (
            <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm px-6 py-12 text-center">
              <Tag className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No rentable facilities yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Enable facilities as rentable in the Rentable Facilities tab first.</p>
            </div>
          ) : (
            rentableFacilities.map(facility => {
              const fRates = facilityRatesMap[facility.id]
              const nonAddonRates = fRates?.rawRates?.filter(r => !r.isAddon && r.isActive) ?? []
              const addonRates = fRates?.rawRates?.filter(r => r.isAddon && r.isActive) ?? []

              return (
                <div key={facility.id} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
                  {/* Facility header */}
                  <div className="px-5 py-4 border-b border-border flex items-center gap-3 bg-muted/20">
                    <Building2 className="w-4 h-4 text-sti-blue" />
                    <span className="font-semibold text-sm text-foreground">{facility.name}</span>
                    {facility.roomNumber && <span className="text-xs text-muted-foreground">({facility.roomNumber})</span>}
                    <div className="ml-auto flex items-center gap-2">
                      {fRates && (
                        <>
                          {fRates.amRate != null && (
                            <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40">
                              AM {formatPHP(fRates.amRate)}/hr
                            </Badge>
                          )}
                          {fRates.pmRate != null && (
                            <Badge variant="outline" className="text-xs border-purple-500/40 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40">
                              PM {formatPHP(fRates.pmRate)}/hr
                            </Badge>
                          )}
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2.5 text-xs text-sti-blue hover:text-sti-blue hover:bg-sti-blue/10"
                        onClick={() => openAddRate(facility.id, facility.name, false)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Rate
                      </Button>
                    </div>
                  </div>

                  {/* Rental rates */}
                  {nonAddonRates.length === 0 ? (
                    <div className="px-5 py-4 text-center text-xs text-muted-foreground border-b border-border">
                      No rates configured yet. Click &quot;Add Rate&quot; to set AM/PM rates.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Period</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Amount</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Window</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Category</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nonAddonRates.map(rate => (
                          <TableRow key={rate.id} className="border-border hover:bg-muted/50 transition-colors">
                            <TableCell className="text-sm font-medium text-foreground">{rate.rateName}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  rate.timePeriod === 'am' && "border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40",
                                  rate.timePeriod === 'pm' && "border-purple-500/40 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40",
                                  rate.timePeriod === 'all_day' && "border-sti-blue/40 text-sti-blue dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40",
                                )}
                              >
                                {timePeriodLabel(rate.timePeriod)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-foreground">{formatPHP(rate.amount)}/hr</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {rate.applicableStartTime && rate.applicableEndTime
                                ? `${formatTime(rate.applicableStartTime)} – ${formatTime(rate.applicableEndTime)}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{feeCategoryLabel(rate.feeCategory)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:text-sti-blue" onClick={() => openEditRate(rate)} aria-label={`Edit ${rate.rateName}`}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:text-red-600 dark:hover:text-red-400" onClick={() => setDeleteDialog({ open: true, rate })} aria-label={`Delete ${rate.rateName}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Add-ons for this facility */}
                  <div className="border-t border-border">
                    <div className="px-5 py-2.5 flex items-center gap-2 bg-muted/30">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add-ons</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-6 px-2 text-xs text-sti-blue hover:text-sti-blue hover:bg-sti-blue/10"
                        onClick={() => openAddRate(facility.id, facility.name, true)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Add-on
                      </Button>
                    </div>
                    {addonRates.length === 0 ? (
                      <div className="px-5 py-3 text-xs text-muted-foreground">
                        No add-ons configured for this facility.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                            <TableHead className="text-muted-foreground text-xs">Amount</TableHead>
                            <TableHead className="text-muted-foreground text-xs">Category</TableHead>
                            <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {addonRates.map(addon => (
                            <TableRow key={addon.id} className="border-border hover:bg-muted/50 transition-colors">
                              <TableCell className="text-sm font-medium text-foreground">{addon.rateName}</TableCell>
                              <TableCell className="text-sm text-foreground">{formatPHP(addon.amount)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{feeCategoryLabel(addon.feeCategory)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:text-sti-blue" onClick={() => openEditRate(addon)} aria-label={`Edit ${addon.rateName}`}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:text-red-600 dark:hover:text-red-400" onClick={() => setDeleteDialog({ open: true, rate: addon })} aria-label={`Delete ${addon.rateName}`}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </TabsContent>

        {/* ── Tab 3: Add-ons ── */}
        <TabsContent value="addons">
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
              <Tag className="w-4 h-4 text-sti-blue" />
              <span className="font-semibold text-sm text-foreground">Add-ons</span>
              <span className="ml-auto text-xs text-muted-foreground">Manage add-ons per facility in the Rental Rates tab</span>
            </div>

            {loadingRates ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Facility</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Price</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Category</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAddons.map(rate => {
                    const fac = facilities.find(f => f.id === rate.facilityId)
                    return (
                      <TableRow key={rate.id} className="border-border hover:bg-muted/50 transition-colors">
                        <TableCell className="text-sm font-medium text-foreground">{rate.rateName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fac?.name ?? rate.facilityId}</TableCell>
                        <TableCell className="text-sm text-foreground">{formatPHP(rate.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{feeCategoryLabel(rate.feeCategory)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              rate.isActive
                                ? "border-sti-blue/40 text-sti-blue dark:text-accent-light bg-sti-blue/10"
                                : "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40"
                            )}
                          >
                            {rate.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:text-sti-blue" onClick={() => openEditRate(rate)} aria-label={`Edit ${rate.rateName}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:text-red-600 dark:hover:text-red-400" onClick={() => setDeleteDialog({ open: true, rate })} aria-label={`Delete ${rate.rateName}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {allAddons.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                        No add-ons configured. Click &quot;Add Add-on&quot; to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Tip: add-ons are managed per-facility in the Rental Rates tab */}
          {allAddons.length > 0 && (
            <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm px-5 py-3 mt-3">
              <p className="text-xs text-muted-foreground">
                To add or remove add-ons for a specific facility, go to the <strong className="text-foreground">Rental Rates</strong> tab and expand that facility.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rate Dialog */}
      <RateDialog
        open={rateDialog.open}
        onClose={() => setRateDialog(p => ({ ...p, open: false }))}
        onSave={handleSaveRate}
        saving={rateSaving}
        initial={rateDialog.editing}
        facilityId={rateDialog.facilityId}
        facilityName={rateDialog.facilityName}
        isAddon={rateDialog.isAddon}
      />

      {/* Delete Confirm */}
      <AlertDialog open={deleteDialog.open} onOpenChange={v => !v && setDeleteDialog({ open: false, rate: null })}>
        <AlertDialogContent className="bg-card text-card-foreground border-border max-w-md shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Rate</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              &quot;{deleteDialog.rate?.rateName}&quot; will be deactivated and hidden from booking forms. Historical records are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background border-border hover:bg-muted text-foreground" disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
