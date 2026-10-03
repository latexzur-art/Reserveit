'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimeSlotPicker } from '@/components/ui/TimeSlotPicker'
import { PAID_PURPOSE_OPTIONS, FieldError } from '@/components/admin/building/reservations/self-booking/constants'
import type { Availability } from '@/hooks/admin/useSelfBookingForm'

interface Props {
  today: string
  paidPurpose: 'personal' | 'community' | 'commercial'
  setPaidPurpose: (v: 'personal' | 'community' | 'commercial') => void
  paidEventName: string
  setPaidEventName: (v: string) => void
  paidDescription: string
  setPaidDescription: (v: string) => void
  paidDate: string
  setPaidDate: (v: string) => void
  paidStartTime: string
  setPaidStartTime: (v: string) => void
  paidEndTime: string
  setPaidEndTime: (v: string) => void
  paidAttendees: string
  setPaidAttendees: (v: string) => void
  paidOrgName: string
  setPaidOrgName: (v: string) => void
  paidContact: string
  setPaidContact: (v: string) => void
  paidSpecialReqs: string
  setPaidSpecialReqs: (v: string) => void
  availability: Availability | null
  touched: Set<string>
  err: (key: string) => string | undefined
  touch: (...keys: string[]) => void
}

export function PaidFormSection({
  today,
  paidPurpose, setPaidPurpose,
  paidEventName, setPaidEventName,
  paidDescription, setPaidDescription,
  paidDate, setPaidDate,
  paidStartTime, setPaidStartTime,
  paidEndTime, setPaidEndTime,
  paidAttendees, setPaidAttendees,
  paidOrgName, setPaidOrgName,
  paidContact, setPaidContact,
  paidSpecialReqs, setPaidSpecialReqs,
  availability,
  touched,
  err, touch,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
        <Clock className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Payment is required after submission. Go to <strong>My Payments</strong> to complete payment.</span>
      </div>

      {/* Renter Information */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Renter Information</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Organization / Company <span className="text-muted-foreground">(optional)</span></Label>
            <Input placeholder="e.g. Sports Club" value={paidOrgName} onChange={e => setPaidOrgName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Contact Number <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              type="tel" placeholder="09XX-XXX-XXXX"
              value={paidContact}
              onChange={e => { setPaidContact(e.target.value); if (touched.has('paidContact')) touch('paidContact') }}
              onBlur={() => { if (paidContact.trim()) touch('paidContact') }}
              className={cn(err('paidContact') && 'border-red-500')}
            />
            <FieldError msg={err('paidContact')} />
          </div>
        </div>
      </section>

      {/* Rental Details */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Rental Details</h2>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Purpose of Use <span className="text-red-500">*</span></Label>
          <div className="grid grid-cols-3 gap-2">
            {PAID_PURPOSE_OPTIONS.map(opt => (
              <button
                key={opt.value} type="button"
                onClick={() => { setPaidPurpose(opt.value as any); touch('paidPurpose') }}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm border text-left transition-colors',
                  paidPurpose === opt.value
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                )}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event / Activity Name <span className="text-red-500">*</span></Label>
          <Input
            placeholder="e.g. Basketball Tournament"
            value={paidEventName}
            onChange={e => { setPaidEventName(e.target.value); if (touched.has('paidEventName')) touch('paidEventName') }}
            onBlur={() => touch('paidEventName')}
            className={cn(err('paidEventName') && 'border-red-500')}
          />
          <FieldError msg={err('paidEventName')} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description <span className="text-red-500">*</span></Label>
          <Textarea
            rows={2}
            placeholder="Brief description of the activity..."
            value={paidDescription}
            onChange={e => { setPaidDescription(e.target.value); if (touched.has('paidDescription')) touch('paidDescription') }}
            onBlur={() => touch('paidDescription')}
            className={cn(err('paidDescription') && 'border-red-500')}
          />
          <div className="flex items-start justify-between gap-2">
            <FieldError msg={err('paidDescription')} />
            <span className={cn('text-xs shrink-0 ml-auto', paidDescription.trim().length >= 10 ? 'text-emerald-600' : 'text-muted-foreground')}>
              {paidDescription.trim().length}/10 min
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date <span className="text-red-500">*</span></Label>
            <Input type="date" min={today} value={paidDate} onChange={e => setPaidDate(e.target.value)} onBlur={() => touch('paidDate')} className={cn(err('paidDate') && 'border-red-500')} />
            <FieldError msg={err('paidDate')} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected Attendees <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Input type="number" min={1} max={200} placeholder="e.g. 10" value={paidAttendees} onChange={e => { setPaidAttendees(e.target.value); if (touched.has('paidAttendees')) touch('paidAttendees') }} onBlur={() => { if (paidAttendees) touch('paidAttendees') }} className={cn(err('paidAttendees') && 'border-red-500')} />
            <FieldError msg={err('paidAttendees')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TimeSlotPicker
            label="Start Time"
            value={paidStartTime}
            onChange={t => { setPaidStartTime(t); touch('paidStartTime', 'paidEndTime') }}
            blockedRanges={availability?.blocked_ranges}
            onBlockedClick={() => {}}
            variant="academic"
            error={err('paidStartTime')}
          />
          <TimeSlotPicker
            label="End Time"
            value={paidEndTime}
            onChange={t => { setPaidEndTime(t); touch('paidEndTime') }}
            blockedRanges={availability?.blocked_ranges}
            onBlockedClick={() => {}}
            minTime={paidStartTime}
            variant="academic"
            error={err('paidEndTime')}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Special Requests <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea rows={2} placeholder="List any equipment or special requests..." value={paidSpecialReqs} onChange={e => setPaidSpecialReqs(e.target.value)} />
        </div>
      </section>
    </div>
  )
}
