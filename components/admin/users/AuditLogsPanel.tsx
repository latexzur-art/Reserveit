'use client'

import { ChevronLeft, ChevronRight, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAdminAuditLogs } from '@/hooks/admin/useAdminAuditLogs'
import { auditActionColors, auditActionLabels } from '@/backend/admin/admin.types'

function formatTimestamp(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDetails(details: Record<string, any>): string {
  if (!details || Object.keys(details).length === 0) return '—'
  const parts: string[] = []
  if (details.email) parts.push(details.email)
  if (details.full_name) parts.push(details.full_name)
  if (details.role_name) parts.push(`Role: ${details.role_name}`)
  if (details.old_status && details.new_status) parts.push(`${details.old_status} → ${details.new_status}`)
  if (details.subject) parts.push(`"${details.subject}"`)
  if (details.title) parts.push(`"${details.title}"`)
  if (details.target_audience) parts.push(`To: ${details.target_audience}`)
  if (details.count) parts.push(`${details.count} users`)
  if (parts.length === 0) return JSON.stringify(details)
  return parts.join(' · ')
}

const actionFilterOptions = [
  { value: 'all', label: 'All Actions' },
  { value: 'user.create', label: 'User Created' },
  { value: 'user.update', label: 'User Updated' },
  { value: 'user.delete', label: 'User Archived' },
  { value: 'user.permanent_delete', label: 'User Deleted' },
  { value: 'user.restore', label: 'User Restored' },
  { value: 'status.change', label: 'Status Changed' },
  { value: 'role.assign', label: 'Role Assigned' },
  { value: 'role.remove', label: 'Role Removed' },
  { value: 'message.send', label: 'Message Sent' },
  { value: 'broadcast.send', label: 'Broadcast Sent' },
]

export function AuditLogsPanel() {
  const {
    logs,
    totalLogs,
    loading,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    actionFilter,
    setActionFilter,
  } = useAdminAuditLogs()

  const startIndex = totalLogs === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalLogs)

  const getPageNumbers = () => {
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading activity logs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by action:</span>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px] h-8" aria-label="Filter by action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionFilterOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</TableHead>
              <TableHead className="w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actor</TableHead>
              <TableHead className="w-[150px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 rounded-full bg-sti-blue-light">
                      <FileText className="h-8 w-8 text-primary/50" />
                    </div>
                    <span>No activity logs found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTimestamp(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{log.actorName || 'System'}</span>
                      {log.actorEmail && (
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={log.actorEmail}>{log.actorEmail}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={auditActionColors[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'}>
                      {auditActionLabels[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={formatDetails(log.details)}>
                    {formatDetails(log.details)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalLogs > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1) }}>
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span>Showing {startIndex}-{endIndex} of {totalLogs}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {getPageNumbers().map(p => (
              <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p)} aria-label={`Page ${p}`}>
                {p}
              </Button>
            ))}
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
