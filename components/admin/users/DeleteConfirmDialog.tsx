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
import type { User } from '@/backend/admin/admin.types'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onConfirm: () => void
  isBulk?: boolean
  count?: number
  permanent?: boolean
}

export const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  user,
  onConfirm,
  isBulk = false,
  count = 0,
  permanent = false,
}: DeleteConfirmDialogProps) => {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {permanent
              ? (isBulk ? `Permanently Delete ${count} Users?` : 'Permanently Delete User?')
              : (isBulk ? `Delete ${count} Users?` : 'Delete User?')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {permanent ? (
              isBulk ? (
                <>
                  This action cannot be undone. <strong>{count} users</strong> and all their data will be permanently removed from the system.
                </>
              ) : user ? (
                <>
                  This action cannot be undone. <strong>{user.firstName} {user.lastName}</strong> ({user.email}) and all their data will be permanently removed from the system.
                </>
              ) : null
            ) : (
              isBulk ? (
                <>
                  You are about to deactivate <strong>{count} users</strong>.
                  Their accounts will be set to inactive and they will no longer be able to sign in.
                </>
              ) : user ? (
                <>
                  You are about to deactivate <strong>{user.firstName} {user.lastName}</strong> ({user.email}).
                  Their account will be set to inactive and they will no longer be able to sign in.
                </>
              ) : null
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {permanent ? 'Permanently Delete' : 'Delete'} {isBulk ? 'Users' : 'User'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
