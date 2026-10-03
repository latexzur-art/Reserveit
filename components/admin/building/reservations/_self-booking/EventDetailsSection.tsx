'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { FieldError } from '@/components/admin/building/reservations/self-booking/constants'

interface Props {
  eventName: string
  setEventName: (v: string) => void
  purpose: string
  setPurpose: (v: string) => void
  specialRequests: string
  setSpecialRequests: (v: string) => void
  selfFacilitationConfirmed: boolean
  setSelfFacilitationConfirmed: (v: boolean) => void
  touched: Set<string>
  err: (key: string) => string | undefined
  touch: (...keys: string[]) => void
}

export function EventDetailsSection({
  eventName, setEventName,
  purpose, setPurpose,
  specialRequests, setSpecialRequests,
  selfFacilitationConfirmed, setSelfFacilitationConfirmed,
  touched,
  err, touch,
}: Props) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
        <span className="w-1 h-5 bg-blue-500 rounded-full" />
        Event Details
      </h2>

      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Event Name <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          placeholder="e.g. Faculty Meeting"
          value={eventName}
          onChange={e => setEventName(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Purpose Statement <span className="text-red-500">*</span>
        </Label>
        <Textarea
          rows={3}
          placeholder="Describe why this reservation is necessary..."
          value={purpose}
          onChange={e => { setPurpose(e.target.value); if (touched.has('purpose')) touch('purpose') }}
          onBlur={() => touch('purpose')}
          className={cn(err('purpose') && 'border-red-500')}
        />
        <div className="flex items-start justify-between gap-2">
          <FieldError msg={err('purpose')} />
          <span className={cn('text-xs shrink-0 ml-auto', purpose.trim().length >= 10 ? 'text-emerald-600 font-semibold' : 'text-muted-foreground')}>
            {purpose.trim().length}/10 min
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Special Requests <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          rows={2}
          placeholder="e.g. Need additional chairs or audio setup"
          value={specialRequests}
          onChange={e => setSpecialRequests(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id="sb-facilitation"
          checked={selfFacilitationConfirmed}
          onCheckedChange={v => setSelfFacilitationConfirmed(!!v)}
        />
        <Label htmlFor="sb-facilitation" className="text-sm font-normal cursor-pointer">
          I will facilitate this session myself
        </Label>
      </div>
    </section>
  )
}
