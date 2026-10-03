'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RotateCcw, Trash2, KeyRound } from 'lucide-react'
import { UserActionsMenu } from './UserActionsMenu'
import { IssueCreditModal } from './IssueCreditModal'
import type { User } from '@/backend/admin/admin.types'
import { roleColors, statusColors } from '@/backend/admin/admin.types'
import { userRoleLabel, accountStatusLabel } from '@/lib/enum-labels'

interface UserRowProps {
  user: User
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: (user: User) => void
  onAssignRole: (user: User) => void
  onDelete: (user: User) => void
  onResetPassword: (id: string) => void
  onForceLogout: (user: User) => void
  onToggleStatus: (user: User) => void
  onSendMessage: (user: User) => void
  archiveMode?: boolean
  onRestore?: (user: User) => void
  onPermanentDelete?: (user: User) => void
}

export const UserRow = ({
  user,
  isSelected,
  onSelect,
  onEdit,
  onAssignRole,
  onDelete,
  onResetPassword,
  onForceLogout,
  onToggleStatus,
  onSendMessage,
  archiveMode = false,
  onRestore,
  onPermanentDelete,
}: UserRowProps) => {
  const [showIssueCreditModal, setShowIssueCreditModal] = useState(false)
  const fullName = `${user.firstName} ${user.lastName}`
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  const isPamoRole = ['PAMO', 'PAMO Officer', 'pamo_officer', 'pamo'].includes(user.role)

  return (
    <>
    {showIssueCreditModal && (
      <IssueCreditModal
        userId={user.id}
        userName={fullName}
        userEmail={user.email}
        onClose={() => setShowIssueCreditModal(false)}
      />
    )}
    <TableRow className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-sti-blue-light/50' : ''}`}>
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(user.id)} aria-label={`Select ${fullName}`} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{fullName}</span>
        </div>
      </TableCell>
      <TableCell className="text-slate-600 dark:text-slate-300 font-medium max-w-[200px]">
        <span className="truncate block" title={user.email}>{user.email}</span>
      </TableCell>
      <TableCell className="text-slate-600 dark:text-slate-300 max-w-[200px]">
        {user.type === 'External'
          ? <span className="text-sm text-slate-400 dark:text-slate-500">Uses sign-up email</span>
          : user.notificationEmail
            ? <span className="text-sm truncate block" title={user.notificationEmail}>{user.notificationEmail}</span>
            : <span className="text-sm text-amber-600/80 dark:text-amber-400/80 italic" title="No notification email configured — edit user to add one">Not set</span>
        }
      </TableCell>
      <TableCell>
        {isPamoRole ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className={`${roleColors[user.role] || 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'} hover:bg-opacity-80 cursor-help`}>
                  {userRoleLabel(user.role)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Property & Asset Management Office</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Badge variant="secondary" className={`${roleColors[user.role] || ''} hover:bg-opacity-80`}>
            {userRoleLabel(user.role)}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border/50">
          {user.type}
        </Badge>
      </TableCell>
      <TableCell className="text-slate-600 dark:text-slate-300 font-medium">
        {user.type === 'Internal' ? user.department : user.organization || '-'}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={`${statusColors[user.status] || ''} hover:bg-opacity-80`}>
          {accountStatusLabel(user.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-right pr-4">
        {archiveMode ? (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => onRestore?.(user)} className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:text-emerald-400" aria-label={`Restore ${fullName}`}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onPermanentDelete?.(user)} className="text-xs text-red-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400" aria-label={`Permanently delete ${fullName}`}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onResetPassword(user.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    aria-label={`Reset password for ${fullName}`}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Reset Password</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="ghost" size="sm" onClick={() => onAssignRole(user)} className="text-xs font-medium text-primary hover:bg-primary/10" aria-label={`Assign role to ${fullName}`}>
              Assign Role
            </Button>
            <UserActionsMenu
              user={user}
              onEdit={() => onEdit(user)}
              onAssignRole={() => onAssignRole(user)}
              onResetPassword={() => onResetPassword(user.id)}
              onSendMessage={() => onSendMessage(user)}
              onForceLogout={() => onForceLogout(user)}
              onToggleStatus={() => onToggleStatus(user)}
              onDelete={() => onDelete(user)}
              onIssueCredit={() => setShowIssueCreditModal(true)}
            />
          </div>
        )}
      </TableCell>
    </TableRow>
    </>
  )
}
