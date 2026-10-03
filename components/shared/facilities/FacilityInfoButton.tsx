'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { FacilityDetailsSheet } from './FacilityDetailsSheet'
import type { FacilityDetailsInput } from './types'

interface FacilityInfoButtonProps {
  facility: FacilityDetailsInput | null
  className?: string
}

/**
 * Small "Details" trigger that opens the read-only FacilityDetailsSheet
 * (photos, active warnings, specs, reviews) for whichever facility is
 * currently selected in a booking form — without touching the form's
 * own facility-selection logic.
 */
export function FacilityInfoButton({ facility, className }: FacilityInfoButtonProps) {
  const [open, setOpen] = useState(false)

  if (!facility) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline'}
      >
        <Info className="w-3.5 h-3.5" /> Details
      </button>
      <FacilityDetailsSheet facility={facility} open={open} onOpenChange={setOpen} />
    </>
  )
}
