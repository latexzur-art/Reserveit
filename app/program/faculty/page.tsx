'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FacultyDirectory } from '@/components/schedule/assign/FacultyDirectory'
import { Faculty } from '@/components/schedule/assign/types'
import { Users } from 'lucide-react'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { SkeletonList } from '@/components/ui/SkeletonList'

export default function ProgramFacultyPage() {
  const { user } = useAuth()
  const deptId = user?.department?.id ?? null

  const [faculty, setFaculty] = useState<Faculty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!deptId) return // Wait for user to load

    let active = true
    setLoading(true)
    
    // Fetch only the professors under the Program Head's department
    fetch(`/api/faculty/availability?department_id=${deptId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return
        if (data.error) throw new Error(data.error)
        setFaculty(data.faculty ?? [])
      })
      .catch((err) => active && setError(err.message || 'Failed to load faculty'))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [deptId])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-40">
        <ConnectedTopBar title="My Department Faculty" breadcrumbs={[{ label: 'Dashboard' }]} />
      </div>

      <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Department <span className="text-accent-brand">Faculty</span></h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            View schedules, teaching subjects, and reservations for professors in your program.
          </p>
        </div>
      </div>

      {loading && <SkeletonList />}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 text-sm font-medium">
          {error}
        </div>
      )}

      {!loading && !error && (
        <FacultyDirectory faculty={faculty} ownDepartmentId={deptId} />
      )}
      </div>
    </div>
  )
}
