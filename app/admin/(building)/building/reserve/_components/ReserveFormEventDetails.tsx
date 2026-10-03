'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Users as UsersIcon, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEnumLabel } from '@/lib/enum-labels'

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-500">{msg}</p>
}

interface StaffMember {
  id: string
  name: string
  category: string
}

interface ReserveFormEventDetailsProps {
  eventName: string
  setEventName: (v: string) => void
  purpose: string
  setPurpose: (v: string) => void
  specialRequests: string
  setSpecialRequests: (v: string) => void
  selfFacilitationConfirmed: boolean
  setSelfFacilitationConfirmed: (v: boolean) => void
  facilitatorName: string
  setFacilitatorName: (v: string) => void
  staffSearch: string
  setStaffSearch: (v: string) => void
  staffOpen: boolean
  setStaffOpen: (v: boolean) => void
  staffRef: React.RefObject<HTMLDivElement | null>
  loadingStaff: boolean
  filteredStaff: StaffMember[]
  submitAttempted: boolean
  touched: Set<string>
  err: (key: string) => string | undefined
  touch: (...keys: string[]) => void
}

export function ReserveFormEventDetails({
  eventName, setEventName,
  purpose, setPurpose,
  specialRequests, setSpecialRequests,
  selfFacilitationConfirmed, setSelfFacilitationConfirmed,
  facilitatorName, setFacilitatorName,
  staffSearch, setStaffSearch,
  staffOpen, setStaffOpen, staffRef,
  loadingStaff, filteredStaff,
  submitAttempted, touched,
  err, touch,
}: ReserveFormEventDetailsProps) {
  return (
    <section className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-5">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2">
        <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
        Event Details
      </h2>

      <div className="space-y-1.5">
        <Label htmlFor="reserve-event-name" className="text-xs font-semibold text-foreground">
          Event Name <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="reserve-event-name"
          placeholder="e.g. Faculty Meeting"
          value={eventName}
          onChange={e => setEventName(e.target.value)}
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reserve-purpose" className="text-xs font-semibold text-foreground">
          Purpose Statement <span className="text-red-500">*</span>
        </Label>
        <textarea
          id="reserve-purpose"
          rows={3}
          placeholder="Describe why this reservation is necessary..."
          value={purpose}
          onChange={e => { setPurpose(e.target.value); if (touched.has('purpose')) touch('purpose') }}
          onBlur={() => touch('purpose')}
          className={cn(
            'flex min-h-[100px] w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sti-blue transition-all resize-none',
            err('purpose') && 'border-red-500'
          )}
        />
        <div className="flex items-start justify-between gap-2">
          <FieldError msg={err('purpose')} />
          <span className={cn('text-xs shrink-0 ml-auto', purpose.trim().length >= 10 ? 'text-sti-blue dark:text-accent-light font-bold' : 'text-muted-foreground')}>
            {purpose.trim().length}/10 min
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reserve-special-requests" className="text-xs font-semibold text-foreground">
          Special Requests <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </Label>
        <textarea
          id="reserve-special-requests"
          rows={2}
          placeholder="e.g. Need additional chairs or audio setup"
          value={specialRequests}
          onChange={e => setSpecialRequests(e.target.value)}
          className="flex min-h-[80px] w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sti-blue transition-all resize-none"
        />
      </div>

      {/* Facilitator — shown by default, hidden when self-facilitating */}
      {!selfFacilitationConfirmed && (
        <div className="space-y-1.5">
          <Label htmlFor="reserve-facilitator-search" className="text-xs font-semibold text-foreground">
            Facilitator <span className="text-red-500">*</span>
          </Label>
          <div className="relative" ref={staffRef}>
            <UsersIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <input
              id="reserve-facilitator-search"
              type="text"
              value={staffSearch || facilitatorName}
              onChange={e => {
                setStaffSearch(e.target.value)
                setFacilitatorName('')
                setStaffOpen(true)
              }}
              onFocus={() => setStaffOpen(true)}
              placeholder="Search staff directory…"
              className="flex h-11 w-full rounded-lg border border-border bg-card pl-10 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sti-blue transition-all placeholder:text-muted-foreground"
              autoComplete="off"
            />
            {facilitatorName && (
              <button
                type="button"
                onClick={() => { setFacilitatorName(''); setStaffSearch('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              ><X className="w-4 h-4" /></button>
            )}
            {staffOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-52 overflow-auto rounded-lg border border-border bg-card shadow-xl">
                {loadingStaff ? (
                  <div className="px-4 py-4 text-center text-xs text-muted-foreground">Loading staff…</div>
                ) : filteredStaff.length === 0 ? (
                  <div className="px-4 py-4 text-center text-xs text-muted-foreground">No staff found</div>
                ) : (
                  filteredStaff.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setFacilitatorName(s.name)
                        setStaffSearch('')
                        setStaffOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-sti-blue/10 dark:hover:bg-sti-blue/20',
                        facilitatorName === s.name && 'bg-sti-blue/10 dark:bg-sti-blue/20'
                      )}
                    >
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold text-muted-foreground">
                        {s.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{formatEnumLabel(s.category)}</p>
                      </div>
                      {facilitatorName === s.name && <Check className="w-4 h-4 text-sti-blue shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {submitAttempted && !selfFacilitationConfirmed && !facilitatorName && (
            <p className="text-xs text-red-500 mt-1">Please select a facilitator or check the box below.</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id="self-facilitation"
          checked={selfFacilitationConfirmed}
          onCheckedChange={v => {
            setSelfFacilitationConfirmed(!!v)
            if (v) { setFacilitatorName(''); setStaffSearch('') }
          }}
        />
        <Label htmlFor="self-facilitation" className="text-sm font-normal cursor-pointer">
          I will facilitate this session myself
        </Label>
      </div>
    </section>
  )
}
