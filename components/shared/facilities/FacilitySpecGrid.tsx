'use client'

import { Wrench } from 'lucide-react'
import type { FacilityCatalogAmenity } from './types'

/**
 * `amenities` is `undefined` while the caller's data source (e.g.
 * useFacilityCatalogLookup) hasn't resolved yet — that must render as a
 * loading state, not as "no equipment", or a fast "Details" click would show
 * a false negative for facilities that do have equipment. A resolved, empty
 * `[]` means the facility genuinely has none.
 */
export function FacilitySpecGrid({ amenities }: { amenities: FacilityCatalogAmenity[] | undefined }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <Wrench className="w-3.5 h-3.5" aria-hidden="true" /> Equipment & Amenities
      </p>
      {amenities === undefined ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading equipment…</p>
      ) : amenities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No equipment listed yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {amenities.map(a => (
            <div key={a.name} className="text-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sti-blue shrink-0" />
              {a.displayName}{a.quantity > 1 ? ` (${a.quantity})` : ''}{a.notes && <span className="text-muted-foreground"> — {a.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
