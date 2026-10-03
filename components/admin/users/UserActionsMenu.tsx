'use client'

import { MoreVertical, Pencil, KeyRound, Mail, LogOut, CheckCircle, Ban, Trash2, Wallet, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { User } from '@/backend/admin/admin.types'

interface UserActionsMenuProps {
  user: User
  onEdit: () => void
  onAssignRole?: () => void
  onResetPassword?: () => void
  onSendMessage: () => void
  onForceLogout: () => void
  onToggleStatus: () => void
  onDelete: () => void
  onIssueCredit?: () => void
}

export const UserActionsMenu = ({
  user,
  onEdit,
  onAssignRole,
  onResetPassword,
  onSendMessage,
  onForceLogout,
  onToggleStatus,
  onDelete,
  onIssueCredit,
}: UserActionsMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${user.firstName} ${user.lastName}`}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" /> Edit Profile
        </DropdownMenuItem>
        {onAssignRole && (
          <DropdownMenuItem onClick={onAssignRole}>
            <UserCheck className="mr-2 h-4 w-4" /> Assign Role
          </DropdownMenuItem>
        )}
        {onResetPassword && (
          <DropdownMenuItem onClick={onResetPassword}>
            <KeyRound className="mr-2 h-4 w-4" /> Reset Password
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onSendMessage}>
          <Mail className="mr-2 h-4 w-4" /> Send Message
        </DropdownMenuItem>
        {onIssueCredit && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuItem onClick={onIssueCredit}>
                  <Wallet className="mr-2 h-4 w-4" /> Issue Session Credit
                </DropdownMenuItem>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px] text-xs">Add session time credit for force majeure events or manual admin adjustments.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleStatus}>
          {user.status === 'Active' ? (
            <><Ban className="mr-2 h-4 w-4" /> Suspend User</>
          ) : (
            <><CheckCircle className="mr-2 h-4 w-4" /> Activate User</>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onForceLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Force Logout
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Delete User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
