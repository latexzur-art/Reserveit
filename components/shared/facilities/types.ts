export interface FacilityCatalogAmenity {
  name: string
  displayName: string
  icon: string | null
  category: string
  quantity: number
  notes: string | null
}

/** Minimal shape accepted by FacilityDetailsSheet outside the full catalog (e.g. booking forms). */
export interface FacilityDetailsInput {
  id: string
  name: string
  capacity: number
  description?: string | null
  floorName?: string
  buildingName?: string
  facilityTypeName?: string
  amenities?: FacilityCatalogAmenity[]
}

export interface FacilityCatalogItem extends FacilityDetailsInput {
  id: string
  code: string
  name: string
  description: string | null
  roomNumber: string | null
  capacity: number
  status: string
  isAvailableForRental: boolean
  floorId: string
  floorName: string
  floorNumber: number
  buildingName: string
  facilityTypeId: string
  facilityTypeName: string
  coverPhotoUrl: string | null
  amenities: FacilityCatalogAmenity[]
  avgRating: number | null
  reviewCount: number
  hasActiveWarning: boolean
}
