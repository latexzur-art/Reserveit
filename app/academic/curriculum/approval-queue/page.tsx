'use client'

import { useEffect, useState } from 'react'
import { useCurriculumManagement } from '@/hooks/academic-head/useCurriculumManagement'
import { BatchReviewPanel } from '@/components/curriculum/BatchReviewPanel'
import { BatchCard } from '@/components/curriculum/BatchCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2, 
  Inbox, 
  Check, 
  X, 
  Search, 
  Layers, 
  FileText, 
  User, 
  Calendar,
  Zap
} from 'lucide-react'
import type { BatchWithCourses } from '@/types/course.types'
import { cn } from '@/lib/utils'
import { SkeletonList } from "@/components/ui/SkeletonList";


const DELIVERY_LABELS: Record<string, string> = {
  lecture: 'Lecture',
  lab: 'Lab',
  both: 'Both',
}

export default function ApprovalQueuePage() {
  const {
    pendingBatches, pendingIndividualCourses, pendingLoading, fetchPendingBatches,
    fetchBatchDetails, approveCourse,
    approveBatch, rejectBatchRows, rejectBatch, sendBackBatch,
  } = useCurriculumManagement()

  const [deptFilter, setDeptFilter] = useState('')
  const [selectedBatch, setSelectedBatch] = useState<BatchWithCourses | null>(null)
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPendingBatches(deptFilter || undefined)
  }, [deptFilter, fetchPendingBatches])

  const handleSelectBatch = async (batch: BatchWithCourses) => {
    if (selectedBatch?.id === batch.id) {
      setSelectedBatch(null)
      return
    }
    if (batch.courses.length === 0) {
      const full = await fetchBatchDetails(batch.id)
      setSelectedBatch(full ?? batch)
    } else {
      setSelectedBatch(batch)
    }
  }

  const handleDone = () => {
    setSelectedBatch(null)
    fetchPendingBatches(deptFilter || undefined)
  }

  const handleApproveCourse = async (courseId: string) => {
    setApprovingIds(prev => new Set(prev).add(courseId))
    const res = await approveCourse(courseId)
    if (!res.error) {
      fetchPendingBatches(deptFilter || undefined)
    }
    setApprovingIds(prev => {
      const next = new Set(prev)
      next.delete(courseId)
      return next
    })
  }

  const hasContent = pendingBatches.length > 0 || pendingIndividualCourses.length > 0

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 px-4 sm:px-6 py-8">
      {/* BRAND HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Approval <span className="text-accent-brand">Queue</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
            Governance & Curriculum Quality Assurance Terminal
          </p>
        </div>


        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="FILTER BY DEPT..."
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value.toUpperCase())}
              className="h-11 pl-10 pr-4 bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-xl text-nano font-black uppercase tracking-widest outline-none focus:ring-2 ring-blue-500/20 w-48 shadow-sm transition-all"
            />
          </div>
        </div>
      </div>

      {pendingLoading ? (
        <SkeletonList />
      ) : !hasContent ? (
        <div className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-[2rem] p-24 text-center">
          <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-full w-fit mx-auto mb-6">
            <Inbox className="h-12 w-12 text-slate-300 dark:text-slate-700" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Queue Clear</h3>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-2">All course submissions have been authorized</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10">
          
          {/* INDIVIDUAL SUBMISSIONS - INDUSTRIAL TABLE */}
          {pendingIndividualCourses.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 ml-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <h2 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                  Individual Submissions ({pendingIndividualCourses.length})
                </h2>
              </div>

              <div className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.06] rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.06]">
                        <th className="text-left px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Course Identifier</th>
                        <th className="text-left px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Metric</th>
                        <th className="text-left px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Placement</th>
                        <th className="text-left px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Delivery</th>
                        <th className="text-left px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Origin</th>
                        <th className="text-right px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Authorization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {pendingIndividualCourses.map(course => (
                        <tr key={course.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-900 dark:text-white tracking-tight uppercase">{course.course_code}</span>
                              <span className="text-nano font-bold text-slate-500 dark:text-slate-400 uppercase leading-none mt-1">{course.course_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                               <Badge variant="outline" className="text-[9px] font-black border-slate-200 dark:border-white/10 px-2 py-0.5">
                                 {course.units} UNITS
                               </Badge>
                               <span className="text-[9px] font-black text-blue-500 uppercase">{course.department_code}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                             <div className="flex items-center gap-2 text-nano font-black text-slate-500 dark:text-slate-400 uppercase">
                               <Calendar className="w-3 h-3" />
                               Y{course.year_level} / T{course.term}
                             </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black bg-blue-500/5 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md border border-blue-500/10 uppercase tracking-widest">
                              <Zap className="w-3 h-3" />
                              {DELIVERY_LABELS[course.delivery_mode] ?? course.delivery_mode}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                             <div className="flex items-center gap-2 text-nano font-black text-slate-600 dark:text-slate-400 uppercase">
                               <User className="w-3 h-3 text-slate-400" />
                               {course.created_by_name?.split(' ')[0]}
                             </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Button
                              size="sm"
                              disabled={approvingIds.has(course.id)}
                              onClick={() => handleApproveCourse(course.id)}
                              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all shadow-lg shadow-emerald-500/10"
                            >
                              {approvingIds.has(course.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                              ) : (
                                <Check className="h-3 w-3 mr-2" strokeWidth={4} />
                              )}
                              Authorize
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BATCH SUBMISSIONS */}
          {pendingBatches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 ml-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <h2 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
                  Curriculum Batches ({pendingBatches.length})
                </h2>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {pendingBatches.map(batch => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    onSelect={handleSelectBatch}
                    selected={selectedBatch?.id === batch.id}
                  />
                ))}
              </div>

              {selectedBatch && (
                <div className="mt-8 animate-in slide-in-from-bottom-4 duration-500">
                  <BatchReviewPanel
                    batch={selectedBatch}
                    onApprove={approveBatch}
                    onRejectRows={rejectBatchRows}
                    onRejectBatch={rejectBatch}
                    onSendBack={sendBackBatch}
                    onDone={handleDone}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}