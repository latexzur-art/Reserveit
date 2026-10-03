'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFacilityWarnings } from '@/hooks/shared/useFacilityWarnings'
import { useFacilityReviews } from '@/hooks/shared/useFacilityReviews'
import { useFacilityPhotos } from '@/hooks/shared/useFacilityPhotos'
import { FacilityPhotoCarousel } from './FacilityPhotoCarousel'
import { FacilityWarningBanner } from './FacilityWarningBanner'
import { FacilitySpecGrid } from './FacilitySpecGrid'
import { FacilityReviewsList } from './FacilityReviewsList'
import { PLACEHOLDER_BY_TYPE } from './placeholders'
import type { FacilityDetailsInput } from './types'

interface FacilityDetailsSheetProps<T extends FacilityDetailsInput> {
  facility: T | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReserve?: (facility: T) => void
}

function placeholderFor(typeName: string) {
  const key = typeName.toLowerCase()
  if (key.includes('lab')) return PLACEHOLDER_BY_TYPE.computer_lab
  if (key.includes('gym')) return PLACEHOLDER_BY_TYPE.gym
  if (key.includes('multi') || key.includes('mph')) return PLACEHOLDER_BY_TYPE.mph
  return PLACEHOLDER_BY_TYPE.classroom
}

export function FacilityDetailsSheet<T extends FacilityDetailsInput>({ facility, open, onOpenChange, onReserve }: FacilityDetailsSheetProps<T>) {
  const { warnings, loading: warningsLoading } = useFacilityWarnings(facility?.id)
  const { reviews, averageRating, loading: reviewsLoading } = useFacilityReviews(facility?.id)
  const { photos, loading: photosLoading } = useFacilityPhotos(facility?.id)

  if (!facility) return null

  const loading = warningsLoading || reviewsLoading || photosLoading

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-6 space-y-5">
        <SheetHeader className="p-0">
          <SheetTitle className="text-xl font-bold tracking-tight">{facility.name}</SheetTitle>
          <SheetDescription>
            {[facility.floorName, facility.buildingName].filter(Boolean).join(', ')}{facility.floorName || facility.buildingName ? ' · ' : ''}Capacity: {facility.capacity}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-5" aria-live="polite" aria-busy="true">
            <Skeleton className="w-full h-56 rounded-xl" />
            <Skeleton className="w-2/3 h-4 rounded" />
            <Skeleton className="w-full h-16 rounded-xl" />
            <Skeleton className="w-full h-20 rounded-xl" />
          </div>
        ) : (
          <>
            <FacilityPhotoCarousel photos={photos} fallbackImage={placeholderFor(facility.facilityTypeName || '')} alt={facility.name} />

            <FacilityWarningBanner warnings={warnings} />

            {facility.description && (
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/40 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-sti-blue">About Facility</p>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line font-medium">{facility.description}</p>
              </div>
            )}

            <FacilitySpecGrid amenities={facility.amenities} />
            <FacilityReviewsList reviews={reviews} avgRating={averageRating} />
          </>
        )}

        {onReserve && (
          <Button className="w-full h-11" onClick={() => onReserve(facility)}>Reserve This Room</Button>
        )}
      </SheetContent>
    </Sheet>
  )
}
