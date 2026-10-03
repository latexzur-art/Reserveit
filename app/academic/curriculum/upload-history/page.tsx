'use client'

import { useEffect, useState } from 'react'
import { useCurriculumManagement } from '@/hooks/academic-head/useCurriculumManagement'
import { useRefetchOnFocus } from '@/hooks/shared/useRefetchOnFocus'
import { useAuth } from '@/contexts/AuthContext'
import { BatchUploadList } from '@/components/curriculum/BatchUploadList'
import { CourseLogsFeed } from '@/components/curriculum/CourseLogsFeed'
import { Loader2, FileText, History, User, Clock, Building2, Layers, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkeletonList } from "@/components/ui/SkeletonList";


// High-contrast status mapping for the logs
const STATUS_STYLES: Record<string, string> = {
  Approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  sent_back: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
}

export default function UploadHistoryPage() {
  const {
    uploadHistory, uploadHistoryTotal, individualCourseHistory, uploadHistoryLoading, fetchUploadHistory,
    submitBatch, approveBatch, rejectBatch, sendBackBatch, deleteBatch, rollbackBatch, publishBatch,
    courseLogs, courseLogsTotal, courseLogsLoading, fetchCourseLogs,
  } = useCurriculumManagement()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'history' | 'logs'>('history')
  const [page, setPage] = useState(1)
  const [logsPage, setLogsPage] = useState(1)

  useEffect(() => {
    if (activeTab === 'history') fetchUploadHistory({ page })
  }, [activeTab, page, fetchUploadHistory])

  useEffect(() => {
    if (activeTab === 'logs') fetchCourseLogs({ page: logsPage })
  }, [activeTab, logsPage, fetchCourseLogs])

  const refreshBatches = () => fetchUploadHistory({ page })

  useRefetchOnFocus(() => {
    if (activeTab === 'logs') fetchCourseLogs({ page: logsPage })
    else fetchUploadHistory({ page })
  })

  // Transform status for display consistency
  const formattedIndividualHistory = individualCourseHistory.map((course: any) => ({
    ...course,
    displayStatus: course.approval_status === 'approved' ? 'Approved' : course.approval_status
  }))

  const hasAnyHistory = uploadHistory.length > 0 || individualCourseHistory.length > 0

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8 px-4 sm:px-6 py-6">
      
      {/* ── RESPONSIVE HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            Course <span className="text-accent-brand">History</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
            Submission Logs & Audit Trail
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start md:self-center px-4 py-2 bg-slate-100 dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.08] backdrop-blur-md">
          <History className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Total Records: {uploadHistoryTotal + individualCourseHistory.length}
          </span>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10">
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 border-b-2 text-[11px] font-black uppercase tracking-widest transition-colors',
            activeTab === 'history' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          )}
        >
          <History className="h-4 w-4" /> History
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 border-b-2 text-[11px] font-black uppercase tracking-widest transition-colors',
            activeTab === 'logs' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          )}
        >
          <ScrollText className="h-4 w-4" /> Logs
        </button>
      </div>

      {activeTab === 'logs' ? (
        <CourseLogsFeed
          logs={courseLogs}
          total={courseLogsTotal}
          loading={courseLogsLoading}
          page={logsPage}
          onPageChange={setLogsPage}
        />
      ) : uploadHistoryLoading ? (
        <SkeletonList />
      ) : !hasAnyHistory ? (
        <div className="flex flex-col items-center justify-center py-24 md:py-32 bg-slate-50 dark:bg-white/[0.01] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/[0.05]">
          <FileText className="h-12 w-12 mb-4 text-slate-300 dark:text-slate-800" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No submission records detected</p>
        </div>
      ) : (
        <div className="space-y-12">
          
          {/* ── INDIVIDUAL ENTRIES (Responsive Grid/Table) ── */}
          {formattedIndividualHistory.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <div className="h-4 w-1 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Individual Record Entries
                </h2>
              </div>

              {/* Mobile View: Cards */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {formattedIndividualHistory.map((course: any) => (
                  <div key={course.id} className="bg-white dark:bg-[#15181E] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black font-mono text-blue-600 dark:text-blue-400 leading-none mb-1">{course.course_code}</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase leading-tight">{course.course_name}</span>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                        STATUS_STYLES[course.displayStatus] || "bg-slate-100 text-slate-600"
                      )}>
                        {course.displayStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" /> {course.department_code}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> {course.created_at ? new Date(course.created_at).toLocaleDateString() : '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Terminal Table */}
              <div className="hidden md:block bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/[0.15]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#050d36] dark:bg-[#15181E] border-b border-white/5">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300">Course Metadata</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300">Origin</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300">Submitter</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300 text-center">Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-300 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {formattedIndividualHistory.map((course: any) => (
                      <tr key={course.id} className="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-default">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400 mb-0.5">{course.course_code}</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate max-w-[280px]">{course.course_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold uppercase tracking-wide">{course.department_code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <User className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold uppercase tracking-wide">{course.created_by_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight border transition-all",
                              STATUS_STYLES[course.displayStatus] || "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {course.displayStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-slate-400 dark:text-slate-500">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">
                              {course.created_at ? new Date(course.created_at).toLocaleDateString() : '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── BATCH UPLOADS (Responsive Integration) ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="h-4 w-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Bulk Batch History
              </h2>
            </div>
            
            <BatchUploadList
              batches={uploadHistory}
              total={uploadHistoryTotal}
              loading={uploadHistoryLoading}
              isAcademicHead={true}
              currentUserId={user?.id}
              page={page}
              onPageChange={setPage}
              onSubmitBatch={submitBatch}
              onApproveBatch={approveBatch}
              onRejectBatch={rejectBatch}
              onSendBackBatch={sendBackBatch}
              onDeleteBatch={deleteBatch}
              onRollbackBatch={rollbackBatch}
              onPublishBatch={publishBatch}
              onRefresh={refreshBatches}
            />
          </div>
        </div>
      )}
    </div>
  )
}