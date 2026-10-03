'use client'

import { useFacilityWarnings } from '@/hooks/shared/useFacilityWarnings'
import { FacilityWarningBanner } from './FacilityWarningBanner'

export function FacilityWarningBannerInline({ facilityId }: { facilityId: string }) {
  const { warnings } = useFacilityWarnings(facilityId)

  if (!warnings.length) return null

  return <FacilityWarningBanner warnings={warnings} />
}
