'use client'

/**
 * Professor Assignment Review & Direct Class Assignment — Academic Head
 * Review program-head assignment lineups OR open the slide-over drawer to
 * directly assign professors to unassigned class sections.
 */
import { useState } from 'react'
import { ClipboardCheck, Plus, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { AssignmentLineupReview } from '@/components/schedule/assign/AssignmentLineupReview'
import { AssignmentLineupBuilder } from '@/components/schedule/assign/AssignmentLineupBuilder'

export default function AcademicAssignmentsReviewPage() {
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleAssignmentComplete = () => {
    // Refresh review queue & lineups after assignment
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-4 sm:px-6 py-8">
      {/* Top Header & Primary Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-[#050d36] dark:text-white">
            PROFESSOR <span className="text-accent-brand">ASSIGNMENTS</span>
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest">
            Review lineup proposals & assign professors to unassigned sections
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setAssignDrawerOpen(true)}
            className="h-11 px-5 bg-[#050d36] dark:bg-blue-600 hover:bg-[#050d36]/90 dark:hover:bg-blue-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all"
          >
            <Plus className="h-4 w-4" />
            Assign Classes
          </Button>

          <div className="hidden sm:flex items-center gap-2.5 bg-white dark:bg-[#15181E] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/[0.06] shadow-sm">
            <ClipboardCheck className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Lineup Review
            </span>
          </div>
        </div>
      </div>

      {/* Main Review Workspace */}
      <AssignmentLineupReview key={refreshKey} />

      {/* Slide-over Sheet (Drawer) for Class Assignment */}
      <Sheet open={assignDrawerOpen} onOpenChange={setAssignDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl overflow-y-auto bg-white dark:bg-[#0B0F17] p-6 sm:p-8"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <SheetHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
            <SheetTitle className="text-2xl font-black uppercase text-[#050d36] dark:text-white flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-blue-500" />
              ASSIGN <span className="text-accent-brand">CLASSES</span>
            </SheetTitle>
            <SheetDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Browse unassigned class sections, check professor availability, and publish assignments directly.
            </SheetDescription>
          </SheetHeader>

          <div className="py-6">
            <AssignmentLineupBuilder
              hideDirectory={true}
              onComplete={handleAssignmentComplete}
              onClose={() => setAssignDrawerOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
