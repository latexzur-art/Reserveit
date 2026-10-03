'use client'

import { ChevronLeft, ChevronRight, Trash2, Ban, Download, RotateCcw, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UserRow } from './UserRow'
import type { User } from '@/backend/admin/admin.types'

interface UsersTableProps {
  users: User[]
  selectedUsers: Set<string>
  onSelectUser: (id: string) => void
  onSelectAll: () => void
  onEditUser: (user: User) => void
  onAssignRole: (user: User) => void
  onDeleteUser: (user: User) => void
  onResetPassword: (id: string) => void
  onForceLogout: (user: User) => void
  onToggleStatus: (user: User) => void
  onSendMessage: (user: User) => void
  onBulkDelete: () => void
  onBulkSuspend: () => void
  onBulkActivate: () => void
  onExport: () => void
  currentPage: number
  totalPages: number
  pageSize: number
  totalUsers: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  archiveMode?: boolean
  onRestoreUser?: (user: User) => void
  onPermanentDeleteUser?: (user: User) => void
}

export const UsersTable = ({
  users,
  selectedUsers,
  onSelectUser,
  onSelectAll,
  onEditUser,
  onAssignRole,
  onDeleteUser,
  onResetPassword,
  onForceLogout,
  onToggleStatus,
  onSendMessage,
  onBulkDelete,
  onBulkSuspend,
  onBulkActivate,
  onExport,
  currentPage,
  totalPages,
  pageSize,
  totalUsers,
  onPageChange,
  onPageSizeChange,
  archiveMode = false,
  onRestoreUser,
  onPermanentDeleteUser,
}: UsersTableProps) => {
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalUsers)

  const getPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div className="space-y-4">
      {selectedUsers.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary">{selectedUsers.size} selected</span>
          <div className="flex gap-2">
            {archiveMode ? (
              <>
                <Button variant="outline" size="sm" onClick={onBulkDelete}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Restore
                </Button>
                <Button variant="destructive" size="sm" onClick={onBulkSuspend}>
                  <Trash2 className="h-4 w-4 mr-1" /> Permanently Delete
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={onBulkActivate}
                  className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Activate
                </Button>
                <Button variant="outline" size="sm" onClick={onBulkSuspend}>
                  <Ban className="h-4 w-4 mr-1" /> Suspend
                </Button>
                <Button variant="destructive" size="sm" onClick={onBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
                <Button variant="outline" size="sm" onClick={onExport}>
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={users.length > 0 && selectedUsers.size === users.length}
                  onCheckedChange={onSelectAll}
                  aria-label="Select all users on this page"
                />
              </TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">Name</TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">Sign-in Email</TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">Notification Email</TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">Role</TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">Type</TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">Dept/Org</TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="w-[160px] min-w-[160px] text-sm font-medium text-muted-foreground text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <td colSpan={9} className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">{archiveMode ? 'No archived users' : 'No users match your filters'}</p>
                  {!archiveMode && <p className="text-xs mt-1">Try adjusting your search or filters</p>}
                </td>
              </TableRow>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelected={selectedUsers.has(user.id)}
                  onSelect={onSelectUser}
                  onEdit={onEditUser}
                  onAssignRole={onAssignRole}
                  onDelete={onDeleteUser}
                  onResetPassword={onResetPassword}
                  onForceLogout={onForceLogout}
                  onToggleStatus={onToggleStatus}
                  onSendMessage={onSendMessage}
                  archiveMode={archiveMode}
                  onRestore={onRestoreUser}
                  onPermanentDelete={onPermanentDeleteUser}
                />
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="w-[70px] h-8" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 50].map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <span>Showing {startIndex}-{endIndex} of {totalUsers}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {getPageNumbers().map(p => (
            <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => onPageChange(p)} aria-label={`Page ${p}`}>
              {p}
            </Button>
          ))}
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
