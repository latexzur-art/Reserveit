'use client'

import Link from 'next/link'
import { FileUp, PackageCheck, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { CurriculumUploadItem } from '@/app/program/_hooks/useProgramHeadDashboard'
import { uploadStatusLabel } from '@/lib/enum-labels'

// ── Status display helpers ─────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  parsing: 'Parsing',
  parsed: 'Parsed',
  validation_failed: 'Validation Failed',
  pending_submission: 'Pending Submission',
  submitted: 'Submitted',
  approved: 'Approved',
  partially_rejected: 'Partially Rejected',
  rejected: 'Rejected',
}

const STATUS_DOT_COLORS: Record<string, string> = {
  draft: 'bg-gray-400',
  parsing: 'bg-gray-400',
  parsed: 'bg-gray-400',
  validation_failed: 'bg-red-500',
  pending_submission: 'bg-yellow-500',
  submitted: 'bg-blue-500',
  approved: 'bg-green-500',
  partially_rejected: 'bg-orange-500',
  rejected: 'bg-red-500',
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  parsing: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  parsed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  validation_failed: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pending_submission: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  submitted: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  partially_rejected: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const MODE_LABELS: Record<string, string> = {
  file_upload: 'CSV',
  grid_entry: 'Grid',
  manual_entry: 'Manual',
}

interface PendingUploadsWidgetProps {
  uploads: CurriculumUploadItem[]
}

export function PendingUploadsWidget({ uploads }: PendingUploadsWidgetProps) {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3.5 border-b border-slate-200 dark:border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileUp size={16} strokeWidth={1.75} className="text-slate-800 dark:text-slate-200" />
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 m-0 tracking-[-0.01em]">
            Curriculum Uploads
          </h2>
        </div>
        {uploads.length > 0 && (
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-full px-2 py-0.5">
            {uploads.length}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {uploads.length === 0 ? (
          <div className="py-8 text-center">
            <PackageCheck size={32} strokeWidth={1.5} className="block mx-auto mb-2 opacity-40 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground m-0 mb-0.5">No uploads yet</p>
            <p className="text-xs text-muted-foreground m-0 opacity-70">
              Upload curriculum batches from the Curriculum page
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {uploads.map(u => {
              const statusDot = STATUS_DOT_COLORS[u.upload_status] ?? 'bg-gray-400'
              const badgeColor = STATUS_BADGE_COLORS[u.upload_status] ?? ''
              const statusLabel = STATUS_LABELS[u.upload_status] ?? uploadStatusLabel(u.upload_status)
              const modeLabel = MODE_LABELS[u.upload_mode] ?? u.upload_mode
              const isSubmitted = u.upload_status === 'submitted'

              return (
                <div
                  key={u.id}
                  className={`
                    flex items-start gap-3 p-3.5 rounded-lg border
                    ${isSubmitted
                      ? 'border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10'
                      : 'border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50'
                    }
                    hover:bg-white dark:hover:bg-card hover:shadow-sm
                    transition-all duration-200
                  `}
                >
                  {/* Status indicator dot */}
                  <div className="mt-1.5 shrink-0">
                    <div className="relative flex h-2.5 w-2.5">
                      {isSubmitted && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusDot} opacity-75`} />
                      )}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusDot}`} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[13px] font-semibold text-foreground m-0 truncate">
                        {u.department_name ?? 'Unknown Dept'}
                      </p>
                      <span className={`shrink-0 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${badgeColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground m-0 mb-1.5 leading-[1.55]">
                      {u.total_entries} course{u.total_entries !== 1 ? 's' : ''} · {modeLabel}
                      {u.approved_count > 0 && ` · ${u.approved_count} approved`}
                      {u.rejected_count > 0 && ` · ${u.rejected_count} rejected`}
                    </p>

                    {/* Review notes (sent back) */}
                    {u.review_notes && u.upload_status === 'draft' && (
                      <p className="text-[11px] text-orange-600 dark:text-orange-400 m-0 mb-1.5 italic line-clamp-2">
                        Note: {u.review_notes}
                      </p>
                    )}

                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(u.submitted_at ?? u.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="px-5 py-3 border-t border-slate-200 dark:border-border">
        <Link
          href="/program/curriculum"
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-200 no-underline"
        >
          View all uploads <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
