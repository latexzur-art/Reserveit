'use client'

import { AlertTriangle } from 'lucide-react'
import { PLACEHOLDER_BY_TYPE } from './placeholders'

function placeholderFor(typeName: string) {
  const key = (typeName || '').toLowerCase()
  if (key.includes('lab')) return PLACEHOLDER_BY_TYPE.computer_lab
  if (key.includes('gym')) return PLACEHOLDER_BY_TYPE.gym
  if (key.includes('multi') || key.includes('mph')) return PLACEHOLDER_BY_TYPE.mph
  return PLACEHOLDER_BY_TYPE.classroom
}

interface FacilityRowThumbnailProps {
  coverPhotoUrl: string | null | undefined
  facilityTypeName?: string
  hasActiveWarning?: boolean
  className?: string
}

/** Small cover-photo preview for a dropdown/list row — real photo, placeholder fallback, warning dot. */
export function FacilityRowThumbnail({ coverPhotoUrl, facilityTypeName, hasActiveWarning, className }: FacilityRowThumbnailProps) {
  return (
    <div className={className ?? 'relative w-8 h-8 rounded-md overflow-hidden shrink-0 bg-muted'}>
      <img src={coverPhotoUrl || placeholderFor(facilityTypeName || '')} alt="" className="w-full h-full object-cover" />
      {hasActiveWarning && (
        <span className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5 ring-2 ring-white dark:ring-slate-800">
          <AlertTriangle className="w-2.5 h-2.5 text-white" />
        </span>
      )}
    </div>
  )
}
