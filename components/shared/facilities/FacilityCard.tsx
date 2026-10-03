'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, AlertTriangle, CheckCircle2, Users, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FacilityCatalogItem } from './types'
import { PLACEHOLDER_BY_TYPE } from './placeholders'
import { formatEnumLabel } from '@/lib/enum-labels'

interface FacilityCardProps {
  facility: FacilityCatalogItem
  view: 'grid' | 'list'
  onViewDetails: (facility: FacilityCatalogItem) => void
  /** Omit to hide the Reserve action (e.g. a read-only admin brochure view) */
  onReserve?: (facility: FacilityCatalogItem) => void
}

function placeholderFor(typeName: string) {
  const key = typeName.toLowerCase()
  if (key.includes('lab')) return PLACEHOLDER_BY_TYPE.computer_lab
  if (key.includes('gym')) return PLACEHOLDER_BY_TYPE.gym
  if (key.includes('multi') || key.includes('mph')) return PLACEHOLDER_BY_TYPE.mph
  return PLACEHOLDER_BY_TYPE.classroom
}

/** Turn snake_case / raw DB type names into human-readable Title Case */
function formatTypeName(raw: string): string {
  return formatEnumLabel(raw)
}

export function FacilityCard({ facility, view, onViewDetails, onReserve }: FacilityCardProps) {
  const photo = facility.coverPhotoUrl || placeholderFor(facility.facilityTypeName)
  const equipmentBadges = facility.amenities.slice(0, 3)

  if (view === 'list') {
    return (
      <div className="flex items-center gap-4 p-3 rounded-xl border border-border/50 bg-card hover:shadow-sm transition-shadow">
        <img src={photo} alt={facility.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {facility.hasActiveWarning ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
            <p className="font-bold text-sm truncate">{facility.name}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {facility.buildingName} · {facility.floorName} · Cap: {facility.capacity}
          </p>
        </div>
        {facility.avgRating !== null && (
          <div className="flex items-center gap-1 text-xs font-semibold shrink-0">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            {facility.avgRating.toFixed(1)}
          </div>
        )}
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => onViewDetails(facility)}>
            <Info className="w-3.5 h-3.5 mr-1.5" /> Details
          </Button>
          {onReserve && <Button size="sm" onClick={() => onReserve(facility)}>Reserve</Button>}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="relative h-40 bg-muted">
        <img src={photo} alt={facility.name} className="w-full h-full object-cover" />
        <Badge
          className={cn(
            'absolute top-2 left-2 gap-1',
            facility.hasActiveWarning
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400'
              : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400'
          )}
        >
          {facility.hasActiveWarning ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          {facility.hasActiveWarning ? 'Notice' : 'Available'}
        </Badge>
        {facility.avgRating !== null && (
          <Badge className="absolute top-2 right-2 bg-black/70 text-white gap-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {facility.avgRating.toFixed(1)} ({facility.reviewCount})
          </Badge>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div>
          <p className="font-bold text-sm">{facility.name}</p>
          <p className="text-xs text-muted-foreground">{facility.buildingName} · {facility.floorName}</p>
        </div>
        {facility.description && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-snug font-normal">{facility.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Cap: {facility.capacity}</span>
          <span>{formatTypeName(facility.facilityTypeName)}</span>
        </div>
        {equipmentBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {equipmentBadges.map(a => (
              <Badge key={a.name} variant="secondary" className="text-[10px] font-medium">
                {a.displayName}{a.quantity > 1 ? ` (${a.quantity})` : ''}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-auto pt-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onViewDetails(facility)}>
            <Info className="w-3.5 h-3.5 mr-1.5" /> View Details
          </Button>
          {onReserve && <Button size="sm" className="flex-1" onClick={() => onReserve(facility)}>Reserve This Room</Button>}
        </div>
      </div>
    </div>
  )
}
