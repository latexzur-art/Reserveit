'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { RoleDetail } from '@/backend/admin/admin.types'

interface DeactivateRoleDialogProps {
  open: boolean
  role: RoleDetail | null
  onConfirm: () => void
  onCancel: () => void
}

export const DeactivateRoleDialog = ({
  open,
  role,
  onConfirm,
  onCancel,
}: DeactivateRoleDialogProps) => {
  if (!role) return null

  return (
    <AlertDialog open={open} onOpenChange={v => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate Role</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to deactivate the <strong>{role.displayName}</strong> role?
            {role.userCount > 0 && (
              <>
                {' '}This role is currently assigned to <strong>{role.userCount}</strong> user{role.userCount !== 1 ? 's' : ''}.
                They will retain the assignment but it will be inactive.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
