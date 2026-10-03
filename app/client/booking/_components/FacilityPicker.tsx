"use client"

import { Building2 } from 'lucide-react'
import type { useRentalBookingForm } from '@/app/client/_hooks/useGymBookingForm'
import { FacilityInfoButton } from '@/components/shared/facilities/FacilityInfoButton'
import { FacilityRowThumbnail } from '@/components/shared/facilities/FacilityRowThumbnail'
import { useFacilityCatalogLookup } from '@/hooks/shared/useFacilityCatalogLookup'
import { formatEnumLabel } from '@/lib/enum-labels'

type Facilities = ReturnType<typeof useRentalBookingForm>['rentableFacilities']

export function FacilityPicker({
  rentableFacilities,
  onSelect,
}: {
  rentableFacilities: Facilities
  onSelect: (id: string) => void
}) {
  const facilityLookup = useFacilityCatalogLookup(true)

  return (
    <main className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Facility Rental
        </h1>
        <p className="text-xs font-medium text-muted-foreground mt-1">
          Select an available facility to begin your reservation request
        </p>
      </div>

      {rentableFacilities.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border/80 rounded-2xl p-8">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40 text-muted-foreground" />
          <p className="text-sm font-medium">No facilities are currently available for rental.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rentableFacilities.map(facility => (
            <div
              key={facility.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(facility.id)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect(facility.id)}
              className="relative text-left bg-card rounded-2xl border border-border/80 shadow-xs p-5 hover:border-primary/60 hover:shadow-sm transition-all group cursor-pointer"
            >
              <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                <FacilityInfoButton
                  facility={{
                    id: facility.id,
                    name: facility.name,
                    capacity: facility.capacity ?? 0,
                    facilityTypeName: facility.facility_types?.name,
                    amenities: facilityLookup.get(facility.id)?.amenities,
                  }}
                />
              </div>
              <FacilityRowThumbnail
                coverPhotoUrl={facilityLookup.get(facility.id)?.coverPhotoUrl}
                facilityTypeName={facilityLookup.get(facility.id)?.facilityTypeName ?? facility.facility_types?.name}
                hasActiveWarning={facilityLookup.get(facility.id)?.hasActiveWarning}
                className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-muted mb-3 border border-border/50"
              />
              <p className="font-semibold text-foreground text-sm mb-1">{facility.name}</p>
              {facility.room_number && <p className="text-xs text-muted-foreground mb-0.5">Room {facility.room_number}</p>}
              {facility.capacity && <p className="text-xs text-muted-foreground">Up to {facility.capacity} persons</p>}
              {facility.facility_types?.name && (
                <span className="inline-block mt-2.5 text-[10px] font-semibold bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md border border-border/40">
                  {formatEnumLabel(facility.facility_types.name)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
