'use client'

import { useState } from 'react'
import type { BatchWithCourses } from '@/types/course.types'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, FileText, User, Calendar, Hash } from 'lucide-react'
import { uploadStatusLabel } from '@/lib/enum-labels'

interface BatchCardProps {
  batch: BatchWithCourses
  onSelect: (batch: BatchWithCourses) => void
  selected?: boolean
}

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  partially_rejected: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  pending_submission: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export function BatchCard({ batch, onSelect, selected }: BatchCardProps) {
  const [expanded, setExpanded] = useState(false)

  const submittedDate = batch.submitted_at
    ? new Date(batch.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not submitted'

  const modeLabel = batch.upload_mode === 'file_upload' ? 'CSV Upload' : batch.upload_mode === 'grid_entry' ? 'Grid Entry' : 'Manual'

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        selected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'
      }`}
    >
      {/* Clickable header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(batch)}
        onKeyDown={e => e.key === 'Enter' && onSelect(batch)}
        className="w-full px-4 py-3 flex items-center gap-4 text-left bg-background hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{batch.department_name ?? 'Unknown Department'}</span>
            <Badge className={`text-[10px] ${statusColors[batch.upload_status] ?? statusColors.draft}`}>
              {uploadStatusLabel(batch.upload_status)}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{batch.uploader_name ?? 'Unknown'}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{submittedDate}</span>
            <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{batch.total_entries} courses</span>
            <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{modeLabel}</span>
          </div>
        </div>

        <button
          onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
          className="p-1 rounded hover:bg-muted"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expandable course preview */}
      {expanded && batch.courses.length > 0 && (
        <div className="border-t bg-muted/20">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">Code</th>
                <th className="text-left px-3 py-1.5 font-medium">Name</th>
                <th className="text-center px-3 py-1.5 font-medium">Units</th>
                <th className="text-center px-3 py-1.5 font-medium">Mode</th>
                <th className="text-center px-3 py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batch.courses.slice(0, 10).map(c => (
                <tr key={c.id} className="hover:bg-muted/10">
                  <td className="px-3 py-1.5 font-mono">{c.course_code}</td>
                  <td className="px-3 py-1.5">{c.course_name}</td>
                  <td className="px-3 py-1.5 text-center">{c.units}</td>
                  <td className="px-3 py-1.5 text-center capitalize">{c.delivery_mode}</td>
                  <td className="px-3 py-1.5 text-center">
                    <Badge variant={c.approval_status === 'approved' ? 'default' : c.approval_status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {c.approval_status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {batch.courses.length > 10 && (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">
              +{batch.courses.length - 10} more courses
            </div>
          )}

          {/* Stats bar */}
          <div className="px-3 py-2 border-t flex gap-4 text-xs text-muted-foreground">
            <span className="text-green-600">{batch.approved_count} approved</span>
            <span className="text-red-600">{batch.rejected_count} rejected</span>
            <span className="text-yellow-600">{batch.pending_count} pending</span>
          </div>
        </div>
      )}
    </div>
  )
}
