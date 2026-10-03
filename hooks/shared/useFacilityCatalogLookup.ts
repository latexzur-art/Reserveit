'use client'

import { useState, useEffect } from 'react'
import type { FacilityCatalogAmenity } from '@/components/shared/facilities/types'

export interface FacilityLookupEntry {
  coverPhotoUrl: string | null
  facilityTypeName: string
  hasActiveWarning: boolean
  avgRating: number | null
  /**
   * Equipment/amenities for this facility, straight from the catalog response.
   * Only present once the catalog fetch resolves — a facility id with no entry
   * in the returned Map (`lookup.get(id) === undefined`) means "not loaded yet",
   * which callers must NOT treat the same as a genuinely-empty `[]` here.
   */
  amenities: FacilityCatalogAmenity[]
}

/**
 * Lightweight per-facility lookup (cover photo, warning flag, rating) built from
 * the same /api/facilities/catalog data the brochure uses — for injecting a
 * thumbnail + warning dot into the hand-rolled booking-form dropdowns without
 * touching their selection/mismatch-detection logic.
 */
export function useFacilityCatalogLookup(rentalOnly = false) {
  const [lookup, setLookup] = useState<Map<string, FacilityLookupEntry>>(new Map())

  useEffect(() => {
    let cancelled = false
    fetch(`/api/facilities/catalog${rentalOnly ? '?rental=true' : ''}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const map = new Map<string, FacilityLookupEntry>()
        for (const f of data.facilities || []) {
          map.set(f.id, {
            coverPhotoUrl: f.coverPhotoUrl,
            facilityTypeName: f.facilityTypeName,
            hasActiveWarning: f.hasActiveWarning,
            avgRating: f.avgRating,
            amenities: f.amenities || [],
          })
        }
        setLookup(map)
      })
      .catch(() => { /* thumbnail is a nice-to-have; silent on failure */ })
    return () => { cancelled = true }
  }, [rentalOnly])

  return lookup
}
