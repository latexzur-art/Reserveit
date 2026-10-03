'use client'

import { Input } from '@/components/ui/input'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAID_PURPOSE_OPTIONS = [
  { value: 'personal',   label: 'Personal / Sports / Recreation' },
  { value: 'community',  label: 'Community Event'                },
  { value: 'commercial', label: 'Commercial / Business'          },
]

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-500">{msg}</p>
}

interface ReserveFormPaidDetailsProps {
  today: string
  paidPurpose: 'personal' | 'community' | 'commercial'
  setPaidPurpose: (v: 'personal' | 'community' | 'commercial') => void
  paidEventName: string
  setPaidEventName: (v: string) => void
  paidDescription: string
  setPaidDescription: (v: string) => void
  paidDate: string
  setPaidDate: (v: string) => void
  paidAttendees: string
  setPaidAttendees: (v: string) => void
  paidStartTime: string
  setPaidStartTime: (v: string) => void
  paidEndTime: string
  setPaidEndTime: (v: string) => void
  paidOrgName: string
  setPaidOrgName: (v: string) => void
  paidContact: string
  setPaidContact: (v: string) => void
  paidSpecialReqs: string
  setPaidSpecialReqs: (v: string) => void
  touched: Set<string>
  err: (key: string) => string | undefined
  touch: (...keys: string[]) => void
}

export function ReserveFormPaidDetails({
  today,
  paidPurpose, setPaidPurpose,
  paidEventName, setPaidEventName,
  paidDescription, setPaidDescription,
  paidDate, setPaidDate,
  paidAttendees, setPaidAttendees,
  paidStartTime, setPaidStartTime,
  paidEndTime, setPaidEndTime,
  paidOrgName, setPaidOrgName,
  paidContact, setPaidContact,
  paidSpecialReqs, setPaidSpecialReqs,
  touched, err, touch,
}: ReserveFormPaidDetailsProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <Clock className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Payment is required after submission. Go to <strong>My Payments</strong> to complete payment and confirm your reservation.</span>
      </div>

      {/* Renter Information */}
      <section className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-3">Renter Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="paid-org-name" className="block text-sm font-medium text-muted-foreground">
              Organization / Company <span className="text-xs text-muted-foreground/60">(optional)</span>
            </label>
            <Input id="paid-org-name" placeholder="e.g. Sports Club" value={paidOrgName} onChange={e => setPaidOrgName(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="paid-contact" className="block text-sm font-medium text-muted-foreground">
              Contact Number <span className="text-xs text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              id="paid-contact"
              type="tel" placeholder="09XX-XXX-XXXX"
              value={paidContact}
              onChange={e => { setPaidContact(e.target.value); if (touched.has('paidContact')) touch('paidContact') }}
              onBlur={() => { if (paidContact.trim()) touch('paidContact') }}
              className={cn('h-11', err('paidContact') && 'border-red-500')}
            />
            <FieldError msg={err('paidContact')} />
          </div>
        </div>
      </section>

      {/* Rental Details */}
      <section className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-5">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-3">Rental Details</h2>

        <div className="space-y-1.5">
          <label id="paid-purpose-label" className="block text-sm font-medium text-muted-foreground">
            Purpose of Rental / Event <span className="text-red-500">*</span>
          </label>
          <div role="radiogroup" aria-labelledby="paid-purpose-label" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PAID_PURPOSE_OPTIONS.map(opt => (
              <button
                key={opt.value} type="button"
                role="radio"
                aria-checked={paidPurpose === opt.value}
                onClick={() => { setPaidPurpose(opt.value as any); touch('paidPurpose') }}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-sm border text-left transition-colors',
                  paidPurpose === opt.value
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                )}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="paid-event-name" className="block text-sm font-medium text-muted-foreground">
            Event / Activity Name <span className="text-red-500">*</span>
          </label>
          <Input
            id="paid-event-name"
            placeholder="e.g. Basketball Tournament"
            value={paidEventName}
            onChange={e => { setPaidEventName(e.target.value); if (touched.has('paidEventName')) touch('paidEventName') }}
            onBlur={() => touch('paidEventName')}
            className={cn('h-11', err('paidEventName') && 'border-red-500')}
          />
          <FieldError msg={err('paidEventName')} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="paid-description" className="block text-sm font-medium text-muted-foreground">
            Description / Purpose <span className="text-red-500">*</span>
          </label>
          <textarea
            id="paid-description"
            rows={2}
            placeholder="Brief description of the event or activity..."
            value={paidDescription}
            onChange={e => { setPaidDescription(e.target.value); if (touched.has('paidDescription')) touch('paidDescription') }}
            onBlur={() => touch('paidDescription')}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none',
              err('paidDescription') && 'border-red-500'
            )}
          />
          <div className="flex items-start justify-between gap-2 mt-1">
            <FieldError msg={err('paidDescription')} />
            <span className={cn('text-xs shrink-0 ml-auto', paidDescription.trim().length >= 10 ? 'text-sti-blue dark:text-accent-light' : 'text-muted-foreground')}>
              {paidDescription.trim().length}/10 min
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="paid-date" className="block text-sm font-medium text-muted-foreground">
              Date Requested <span className="text-red-500">*</span>
            </label>
            <Input id="paid-date" type="date" min={today} value={paidDate} onChange={e => setPaidDate(e.target.value)} onBlur={() => touch('paidDate')} className={cn('h-11', err('paidDate') && 'border-red-500')} />
            <FieldError msg={err('paidDate')} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="paid-attendees" className="block text-sm font-medium text-muted-foreground">Expected Attendees</label>
            <Input id="paid-attendees" type="number" min={1} max={200} placeholder="e.g. 50" value={paidAttendees} onChange={e => { setPaidAttendees(e.target.value); if (touched.has('paidAttendees')) touch('paidAttendees') }} onBlur={() => { if (paidAttendees) touch('paidAttendees') }} className={cn('h-11', err('paidAttendees') && 'border-red-500')} />
            <FieldError msg={err('paidAttendees')} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="paid-start-time" className="block text-sm font-medium text-muted-foreground">Start Time <span className="text-red-500">*</span></label>
            <Input id="paid-start-time" type="time" value={paidStartTime} onChange={e => { setPaidStartTime(e.target.value); if (touched.has('paidStartTime') || touched.has('paidEndTime')) touch('paidStartTime', 'paidEndTime') }} onBlur={() => touch('paidStartTime', 'paidEndTime')} className={cn('h-11', err('paidStartTime') && 'border-red-500')} />
            <FieldError msg={err('paidStartTime')} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="paid-end-time" className="block text-sm font-medium text-muted-foreground">End Time <span className="text-red-500">*</span></label>
            <Input id="paid-end-time" type="time" value={paidEndTime} onChange={e => { setPaidEndTime(e.target.value); if (touched.has('paidEndTime')) touch('paidEndTime') }} onBlur={() => touch('paidEndTime')} className={cn('h-11', err('paidEndTime') && 'border-red-500')} />
            <FieldError msg={err('paidEndTime')} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="paid-special-reqs" className="block text-sm font-medium text-muted-foreground">
            Special Requests <span className="text-xs text-muted-foreground/60">(optional)</span>
          </label>
          <textarea
            id="paid-special-reqs"
            rows={2}
            placeholder="List any equipment or special requests..."
            value={paidSpecialReqs}
            onChange={e => setPaidSpecialReqs(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
      </section>
    </div>
  )
}
