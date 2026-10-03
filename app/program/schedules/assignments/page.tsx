'use client'

/**
 * Professor Assignments — Program Head
 * Build a lineup assigning professors to Unassigned (TBD) live sections, then
 * submit for academic-head approval. (Academic heads reaching this page apply
 * their picks directly — the API branches by role.)
 */
import { ConnectedTopBar } from '../../_components/ConnectedTopBar'
import { AssignmentLineupBuilder } from '@/components/schedule/assign/AssignmentLineupBuilder'

export default function ProgramHeadAssignmentsPage() {
  return (
    <div className="min-h-screen">
      <ConnectedTopBar title="Professor Assignments" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">PROFESSOR <span className="text-accent-brand">ASSIGNMENTS</span></h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pick a professor for each unassigned section. Availability is checked against teaching, bookings, and other pending lineups — busy picks stay selectable but are flagged.
          </p>
        </div>
        <AssignmentLineupBuilder />
      </div>
    </div>
  )
}
