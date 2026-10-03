'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface AcademicStaffMember {
  id: string
  name: string
  email: string
  employeeId: string | null
  avatarUrl: string | null
  departmentId: string | null
  departmentName: string
  departmentCode: string
  roles: string[]
  isProgramHead: boolean
}

export function useAcademicStaff(departmentId?: string) {
  const { toast } = useToast()
  const [staff, setStaff] = useState<AcademicStaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (departmentId) params.set('department_id', departmentId)
      if (search) params.set('search', search)

      const res = await fetch(`/api/academic-head/academic-staff?${params}`)
      if (!res.ok) throw new Error('Failed to fetch staff')
      const data = await res.json()
      setStaff(data.staff ?? [])
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to load staff members.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [departmentId, search, toast])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  return {
    staff,
    loading,
    search,
    setSearch,
    refresh: fetchStaff,
  }
}
