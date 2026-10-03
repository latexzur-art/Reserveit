'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type {
  RentalRate,
  FacilityRates,
  CreateRateInput,
  RentalRateFilters,
} from '@/backend/admin/building/building.types'
import type { BuildingFacility } from '@/backend/admin/building/building.types'
import { useToast } from '@/hooks/use-toast'

export function useBuildingPricing() {
  const { toast } = useToast()

  // All rates (flat list for add-ons tab & source of truth)
  const [rates, setRates] = useState<RentalRate[]>([])
  const [loadingRates, setLoadingRates] = useState(true)

  // Rentable facilities for the toggle tab
  const [facilities, setFacilities] = useState<BuildingFacility[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState(true)

  // Toggle loading per facility
  const [togglingFacility, setTogglingFacility] = useState<Record<string, boolean>>({})

  const error = null

  const fetchFacilities = useCallback(async () => {
    setLoadingFacilities(true)
    try {
      const res = await fetch('/api/admin/building/facilities?pageSize=1000')
      const data = await res.json()
      setFacilities(data.facilities ?? [])
    } catch {
      toast({ title: 'Failed to load facilities', variant: 'destructive' })
    } finally {
      setLoadingFacilities(false)
    }
  }, [toast])

  const fetchRates = useCallback(async (filters?: RentalRateFilters) => {
    setLoadingRates(true)
    try {
      const params = new URLSearchParams()
      if (filters?.facilityId) params.set('facilityId', filters.facilityId)
      if (filters?.isAddon !== undefined) params.set('isAddon', String(filters.isAddon))
      if (filters?.isActive !== undefined) params.set('isActive', String(filters.isActive))
      if (filters?.feeCategory) params.set('feeCategory', filters.feeCategory)
      const res = await fetch(`/api/admin/building/rates?${params}`)
      const data = await res.json()
      setRates(data.rates ?? [])
    } catch {
      toast({ title: 'Failed to load rates', variant: 'destructive' })
    } finally {
      setLoadingRates(false)
    }
  }, [toast])

  // Derive per-facility rates map deterministically from rates state
  const facilityRatesMap = useMemo(() => {
    const map: Record<string, FacilityRates> = {}
    for (const facility of facilities) {
      const fRates = rates.filter(r => r.facilityId === facility.id && r.isActive)
      const amRateRow = fRates.find(r => !r.isAddon && r.timePeriod === 'am')
      const pmRateRow = fRates.find(r => !r.isAddon && r.timePeriod === 'pm')
      const allDayRow = fRates.find(r => !r.isAddon && r.timePeriod === 'all_day')

      let amRate = amRateRow ? amRateRow.amount : (allDayRow ? allDayRow.amount : null)
      let pmRate = pmRateRow ? pmRateRow.amount : (allDayRow ? allDayRow.amount : null)
      let amCutoffHour = amRateRow?.applicableEndTime
        ? parseInt(amRateRow.applicableEndTime.split(':')[0], 10)
        : 17

      const addons = fRates
        .filter(r => r.isAddon)
        .map(r => ({ id: r.id, name: r.rateName, amount: r.amount, isAddon: true as const }))

      map[facility.id] = {
        facilityId: facility.id,
        facilityName: facility.name,
        amRate,
        pmRate,
        amCutoffHour,
        addons,
        rawRates: fRates,
      }
    }
    return map
  }, [facilities, rates])

  useEffect(() => {
    fetchFacilities()
    fetchRates()
  }, [fetchFacilities, fetchRates])

  const createRate = useCallback(async (data: CreateRateInput) => {
    const res = await fetch('/api/admin/building/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      toast({ title: 'Failed to create rate', description: err.error, variant: 'destructive' })
      return false
    }
    toast({ title: 'Rate created' })
    await fetchRates()
    return true
  }, [toast, fetchRates])

  const updateRate = useCallback(async (id: string, updates: Partial<CreateRateInput> & { isActive?: boolean }) => {
    const res = await fetch(`/api/admin/building/rates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const err = await res.json()
      toast({ title: 'Failed to update rate', description: err.error, variant: 'destructive' })
      return false
    }
    toast({ title: 'Rate updated' })
    await fetchRates()
    return true
  }, [toast, fetchRates])

  const deleteRate = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/building/rates/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast({ title: 'Failed to remove rate', variant: 'destructive' })
      return false
    }
    toast({ title: 'Rate removed' })
    await fetchRates()
    return true
  }, [toast, fetchRates])

  const toggleRentalAvailability = useCallback(async (facilityId: string, isAvailable: boolean) => {
    setTogglingFacility(prev => ({ ...prev, [facilityId]: true }))
    try {
      const res = await fetch(`/api/admin/building/facilities/${facilityId}/rental`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailableForRental: isAvailable }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        if (errData.error === 'no_rates_configured' || errData.error === 'inactive_rates_exist') {
          toast({
            title: 'Cannot enable rental',
            description: errData.message ?? 'This facility needs rental rates configured before enabling rental.',
            variant: 'destructive',
          })
          return false
        }
        toast({ title: 'Failed to update rental availability', variant: 'destructive' })
        return false
      }
      setFacilities(prev =>
        prev.map(f => f.id === facilityId ? { ...f, isAvailableForRental: isAvailable } : f)
      )
      toast({ title: isAvailable ? 'Facility marked as rentable' : 'Facility removed from rental' })
      return true
    } finally {
      setTogglingFacility(prev => ({ ...prev, [facilityId]: false }))
    }
  }, [toast])

  const rentableFacilities = facilities.filter(f => f.isAvailableForRental)

  return {
    // Data
    rates,
    facilities,
    rentableFacilities,
    facilityRatesMap,
    // Loading
    loadingRates,
    loadingFacilities,
    loadingFacilityRates: loadingRates,
    togglingFacility,
    error,
    // Actions
    fetchRates,
    fetchFacilities,
    fetchFacilityRates: fetchRates,
    createRate,
    updateRate,
    deleteRate,
    toggleRentalAvailability,
  }
}
