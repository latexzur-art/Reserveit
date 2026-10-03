'use client'

import { MapPin, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/admin/building/reservations/self-booking/constants'
import type { Facility } from '@/hooks/admin/useSelfBookingForm'

interface Props {
  loadingFacilities: boolean
  facilityRef: React.RefObject<HTMLDivElement | null>
  facilitySearch: string
  setFacilitySearch: (v: string) => void
  facilityOpen: boolean
  setFacilityOpen: (v: boolean) => void
  facilityId: string
  setFacilityId: (v: string) => void
  filteredFacilities: Facility[]
  err: (key: string) => string | undefined
}

export function FacilityPicker({
  loadingFacilities,
  facilityRef,
  facilitySearch,
  setFacilitySearch,
  facilityOpen,
  setFacilityOpen,
  facilityId,
  setFacilityId,
  filteredFacilities,
  err,
}: Props) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Facility <span className="text-red-500">*</span>
      </Label>
      {loadingFacilities ? (
        <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : (
        <div className="relative" ref={facilityRef}>
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            value={facilitySearch}
            onChange={e => {
              setFacilitySearch(e.target.value)
              setFacilityOpen(true)
              if (facilityId) setFacilityId('')
            }}
            onFocus={() => setFacilityOpen(true)}
            placeholder='Search rooms… e.g. "Room 2", "Lab", "MPH"'
            className={cn(
              'flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-muted-foreground',
              err('facilityId') && 'border-red-500'
            )}
            autoComplete="off"
          />
          {facilityId && (
            <button
              type="button"
              onClick={() => { setFacilityId(''); setFacilitySearch(''); setFacilityOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            ><X className="w-4 h-4" /></button>
          )}
          {facilityOpen && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl">
              {filteredFacilities.length === 0 ? (
                <div className="px-4 py-4 text-center text-sm text-muted-foreground">No facilities found</div>
              ) : (
                filteredFacilities.map(f => {
                  const isSelected = facilityId === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setFacilityId(f.id)
                        setFacilitySearch(`${f.name}${f.room_number ? ` (${f.room_number})` : ''}`)
                        setFacilityOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
                        isSelected && 'bg-emerald-50 dark:bg-emerald-950/20'
                      )}
                    >
                      <MapPin className={cn('w-4 h-4 shrink-0', isSelected ? 'text-emerald-600' : 'text-slate-400')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('font-medium truncate', isSelected && 'text-emerald-700 dark:text-emerald-400')}>
                          {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                          {f.is_available_for_rental && (
                            <span className="ml-1.5 text-[10px] text-amber-600 font-semibold">[PAID]</span>
                          )}
                        </p>
                        {f.capacity && (
                          <p className="text-xs text-muted-foreground">Capacity: {f.capacity}</p>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}
      <FieldError msg={err('facilityId')} />
    </div>
  )
}
