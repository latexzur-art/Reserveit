'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FacilityWarning } from '@/backend/admin/building/building.types'

export function useFacilityWarnings(facilityId: string | null | undefined) {
  const [warnings, setWarnings] = useState<FacilityWarning[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWarnings = useCallback(async () => {
    if (!facilityId) {
      setWarnings([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/facilities/${facilityId}/warnings`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch warnings')
      setWarnings(data.warnings || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [facilityId])

  useEffect(() => {
    fetchWarnings()
  }, [fetchWarnings])

  return { warnings, loading, error, refetch: fetchWarnings }
}
