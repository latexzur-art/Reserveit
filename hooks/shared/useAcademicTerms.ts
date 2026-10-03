import { useState, useEffect, useCallback } from 'react'

export type TermType = 'first_semester' | 'second_semester' | 'summer' | 'midyear'

export interface AcademicTerm {
  id: string
  term_code: string
  term_name: string
  academic_year: string
  term_type: TermType
  start_date: string
  end_date: string
  enrollment_start?: string
  enrollment_end?: string
  exam_start?: string
  exam_end?: string
  is_active: boolean
  is_schedule_locked: boolean
  created_at: string
  updated_at: string
}

export interface CreateTermData {
  term_code: string
  term_name: string
  academic_year: string
  term_type: TermType
  start_date: string
  end_date: string
  enrollment_start?: string
  enrollment_end?: string
  exam_start?: string
  exam_end?: string
  is_active?: boolean
}

export interface UpdateTermData extends CreateTermData {
  is_schedule_locked?: boolean
}

export function useAcademicTerms() {
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all terms
  const fetchTerms = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/academic-terms')
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to fetch terms')

      setTerms(data.terms || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTerms()
  }, [fetchTerms])

  // Create term
  const createTerm = useCallback(
    async (termData: CreateTermData) => {
      try {
        const res = await fetch('/api/admin/academic-terms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(termData),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to create term')

        await fetchTerms()
        return data.term
      } catch (err: any) {
        throw new Error(err.message)
      }
    },
    [fetchTerms]
  )

  // Update term
  const updateTerm = useCallback(
    async (id: string, termData: UpdateTermData) => {
      try {
        const res = await fetch(`/api/admin/academic-terms/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(termData),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update term')

        await fetchTerms()
        return data.term
      } catch (err: any) {
        throw new Error(err.message)
      }
    },
    [fetchTerms]
  )

  // Delete term
  const deleteTerm = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/academic-terms/${id}`, {
          method: 'DELETE',
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to delete term')

        await fetchTerms()
      } catch (err: any) {
        throw new Error(err.message)
      }
    },
    [fetchTerms]
  )

  // Set active term
  const setActiveTerm = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/academic-terms/${id}/set-active`, {
          method: 'POST',
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to set active term')

        await fetchTerms()
      } catch (err: any) {
        throw new Error(err.message)
      }
    },
    [fetchTerms]
  )

  const activeTerm = terms.find((t) => t.is_active)

  return {
    terms,
    activeTerm,
    loading,
    error,
    fetchTerms,
    createTerm,
    updateTerm,
    deleteTerm,
    setActiveTerm,
  }
}
