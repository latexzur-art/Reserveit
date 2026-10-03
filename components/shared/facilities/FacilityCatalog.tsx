'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Grid, List, SlidersHorizontal } from 'lucide-react'
import { FacilityCard } from './FacilityCard'
import { FacilityDetailsSheet } from './FacilityDetailsSheet'
import type { FacilityCatalogItem } from './types'

interface FacilityCatalogProps {
  /** Optional header title for standalone page views */
  title?: string
  /** Optional header subtitle/description */
  description?: string
  /** Role-prefixed booking form path, e.g. "/faculty/form" (ignored when onReserveSelect is provided) */
  reserveBasePath?: string
  /** Override the reserve-navigation URL builder (default: `${reserveBasePath}?prefill=<json>`) */
  buildReserveUrl?: (facility: FacilityCatalogItem) => string
  /** When embedded as a same-page "Browse Facilities" tab, set the facility directly instead of navigating. */
  onReserveSelect?: (facility: FacilityCatalogItem) => void
  /** External clients only book rental-flagged facilities (mirrors /api/facilities?rental=true) */
  rentalOnly?: boolean
  /** Set false for a read-only browse view (e.g. building admin) — hides the Reserve action */
  showReserveAction?: boolean
}

export function FacilityCatalog({ title, description, reserveBasePath, buildReserveUrl, onReserveSelect, rentalOnly, showReserveAction = true }: FacilityCatalogProps) {
  const router = useRouter()
  const [facilities, setFacilities] = useState<FacilityCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [floorFilter, setFloorFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [minCapacity, setMinCapacity] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [detailsFacility, setDetailsFacility] = useState<FacilityCatalogItem | null>(null)

  const fetchFacilities = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/facilities/catalog${rentalOnly ? '?rental=true' : ''}`)
      const data = await res.json()
      if (res.ok) setFacilities(data.facilities || [])
    } finally {
      setLoading(false)
    }
  }, [rentalOnly])

  useEffect(() => {
    fetchFacilities()
  }, [fetchFacilities])

  const floors = useMemo(
    () => Array.from(new Map(facilities.map(f => [f.floorId, f.floorName])).entries()),
    [facilities]
  )
  const types = useMemo(
    () => Array.from(new Map(facilities.map(f => [f.facilityTypeId, f.facilityTypeName])).entries()),
    [facilities]
  )
  const equipmentOptions = useMemo(() => {
    const set = new Map<string, string>()
    for (const f of facilities) for (const a of f.amenities) set.set(a.name, a.displayName)
    return Array.from(set.entries())
  }, [facilities])

  const filtered = useMemo(() => {
    const activeEquipment = Object.entries(equipmentFilter).filter(([, v]) => v).map(([k]) => k)
    return facilities.filter(f => {
      const q = search.toLowerCase()
      const matchesSearch = !q || f.name.toLowerCase().includes(q) || (f.roomNumber?.toLowerCase().includes(q) ?? false)
      const matchesFloor = floorFilter === 'all' || f.floorId === floorFilter
      const matchesType = typeFilter === 'all' || f.facilityTypeId === typeFilter
      const matchesCapacity = !minCapacity || f.capacity >= Number(minCapacity)
      const matchesEquipment = activeEquipment.every(eq => f.amenities.some(a => a.name === eq))
      return matchesSearch && matchesFloor && matchesType && matchesCapacity && matchesEquipment
    })
  }, [facilities, search, floorFilter, typeFilter, minCapacity, equipmentFilter])

  const handleReserve = (facility: FacilityCatalogItem) => {
    if (onReserveSelect) {
      onReserveSelect(facility)
      return
    }
    if (buildReserveUrl) {
      router.push(buildReserveUrl(facility))
      return
    }
    const prefill = encodeURIComponent(JSON.stringify({ facility_id: facility.id, facility_search_term: facility.name }))
    router.push(`${reserveBasePath}?prefill=${prefill}`)
  }

  return (
    <div className="space-y-6">
      {title && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {title.includes(' ') ? (
                <>
                  {title.substring(0, title.lastIndexOf(' '))} <span className="text-yellow-600 dark:text-yellow-400">{title.substring(title.lastIndexOf(' ') + 1)}</span>
                </>
              ) : (
                title
              )}
            </h1>
            {description && (
              <p className="text-xs font-medium text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          {!loading && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-300 w-fit shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {facilities.length} Facilit{facilities.length === 1 ? 'y' : 'ies'} Available
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by room name or number..."
            className="pl-9.5 h-10 rounded-xl text-xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-card p-1">
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-lg" onClick={() => setView('grid')}>
            <Grid className="w-4 h-4" />
          </Button>
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-lg" onClick={() => setView('list')}>
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <aside className="space-y-4 bg-card border border-border/80 rounded-2xl p-4 h-fit">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground border-b border-border/50 pb-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Filters
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Floor</label>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                {floors.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {types.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Min Capacity</label>
            <Input type="number" min={0} placeholder="e.g. 30 seats" className="h-9 rounded-xl text-xs" value={minCapacity} onChange={e => setMinCapacity(e.target.value)} />
          </div>

          {equipmentOptions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <label className="text-xs font-medium text-muted-foreground">Equipment</label>
              {equipmentOptions.map(([name, displayName]) => (
                <div key={name} className="flex items-center gap-2">
                  <Checkbox
                    id={`eq-${name}`}
                    checked={!!equipmentFilter[name]}
                    onCheckedChange={c => setEquipmentFilter(prev => ({ ...prev, [name]: !!c }))}
                  />
                  <label htmlFor={`eq-${name}`} className="text-xs text-foreground cursor-pointer font-medium">{displayName}</label>
                </div>
              ))}
            </div>
          )}
        </aside>

        <div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-xs bg-card border border-border/80 rounded-2xl p-8">No facilities match your filters.</div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(f => (
                <FacilityCard key={f.id} facility={f} view="grid" onViewDetails={setDetailsFacility} onReserve={showReserveAction ? handleReserve : undefined} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(f => (
                <FacilityCard key={f.id} facility={f} view="list" onViewDetails={setDetailsFacility} onReserve={showReserveAction ? handleReserve : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>

      <FacilityDetailsSheet
        facility={detailsFacility}
        open={!!detailsFacility}
        onOpenChange={(open) => !open && setDetailsFacility(null)}
        onReserve={showReserveAction ? handleReserve : undefined}
      />
    </div>
  )
}
