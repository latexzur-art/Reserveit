'use client'

import { useState, useEffect, useCallback } from 'react'

export interface BucketUsage {
  bucket: string
  bytes: number
  fileCount: number
  exists: boolean
}

export interface StorageUsage {
  buckets: BucketUsage[]
  totalBytes: number
  totalFiles: number
}

export function useStorageUsage() {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/building/settings/storage-usage')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch storage usage')
      setUsage(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  return { usage, loading, error, refetch: fetchUsage }
}
