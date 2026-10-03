'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FacilityPhoto } from '@/backend/admin/building/building.types'

export function useFacilityPhotos(facilityId: string | null | undefined) {
  const [photos, setPhotos] = useState<FacilityPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPhotos = useCallback(async () => {
    if (!facilityId) {
      setPhotos([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/facilities/${facilityId}/photos`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch photos')
      setPhotos(data.photos || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [facilityId])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const uploadPhoto = useCallback(async (file: File, opts?: { caption?: string; isCover?: boolean }) => {
    if (!facilityId) throw new Error('facilityId is required')
    const form = new FormData()
    form.set('file', file)
    if (opts?.caption) form.set('caption', opts.caption)
    if (opts?.isCover) form.set('isCover', 'true')

    const res = await fetch(`/api/admin/building/facilities/${facilityId}/photos`, { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to upload photo')
    await fetchPhotos()
    return data as FacilityPhoto
  }, [facilityId, fetchPhotos])

  const updatePhoto = useCallback(async (photoId: string, updates: { caption?: string; isCover?: boolean; sortOrder?: number }) => {
    if (!facilityId) throw new Error('facilityId is required')
    const res = await fetch(`/api/admin/building/facilities/${facilityId}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to update photo')
    await fetchPhotos()
    return data as FacilityPhoto
  }, [facilityId, fetchPhotos])

  const deletePhoto = useCallback(async (photoId: string) => {
    if (!facilityId) throw new Error('facilityId is required')
    const res = await fetch(`/api/admin/building/facilities/${facilityId}/photos/${photoId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to delete photo')
    await fetchPhotos()
  }, [facilityId, fetchPhotos])

  return { photos, loading, error, refetch: fetchPhotos, uploadPhoto, updatePhoto, deletePhoto }
}
