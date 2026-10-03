'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import type { RestrictedUser } from '@/hooks/admin/useOversight'

interface RestrictedUsersTableProps {
  users: RestrictedUser[]
  onRefresh: () => void
}

type PendingAction = {
  type: 'lift' | 'end-probation'
  userId: string
  userName: string
} | null

export default function RestrictedUsersTable({ users, onRefresh }: RestrictedUsersTableProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function executeAction() {
    if (!pendingAction) return
    setLoading(true)
    setActionError(null)

    const endpoint =
      pendingAction.type === 'lift'
        ? `/api/admin/restricted-users/${pendingAction.userId}/lift`
        : `/api/admin/restricted-users/${pendingAction.userId}/end-probation`

    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setActionError(data.error ?? 'Action failed')
        return
      }

      setPendingAction(null)
      onRefresh()
    } catch {
      setActionError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
        <p className="font-medium">No restricted or probation users</p>
        <p className="text-sm mt-1">All accounts are in good standing.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-3 px-4 text-slate-500 font-medium">User</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Cancellations</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Since</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Appeal</th>
              <th className="text-right py-3 px-4 text-slate-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="py-3 px-4">
                  <p className="font-medium text-slate-700">{user.full_name}</p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </td>

                <td className="py-3 px-4">
                  {user.account_status === 'restricted' ? (
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                      <ShieldAlert className="h-3 w-3 mr-1" />
                      Restricted
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                      Probation
                    </Badge>
                  )}
                </td>

                <td className="py-3 px-4">
                  <span className="font-mono font-medium text-slate-700">
                    {user.consecutive_cancellations}
                  </span>
                </td>

                <td className="py-3 px-4">
                  <span className="text-slate-500 text-xs">
                    {user.restricted_at
                      ? new Date(user.restricted_at).toLocaleDateString()
                      : user.probation_started_at
                      ? new Date(user.probation_started_at).toLocaleDateString()
                      : '—'}
                  </span>
                </td>

                <td className="py-3 px-4">
                  {user.appeal_submitted_at ? (
                    <div>
                      <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-xs">Submitted</Badge>
                      {user.appeal_reason && (
                        <p className="text-xs text-slate-400 mt-0.5 max-w-[180px] truncate" title={user.appeal_reason}>
                          {user.appeal_reason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">None</span>
                  )}
                </td>

                <td className="py-3 px-4 text-right space-x-2">
                  {user.account_status === 'restricted' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() =>
                        setPendingAction({ type: 'lift', userId: user.id, userName: user.full_name })
                      }
                    >
                      Lift → Probation
                    </Button>
                  )}
                  {user.account_status === 'probation' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() =>
                        setPendingAction({ type: 'end-probation', userId: user.id, userName: user.full_name })
                      }
                    >
                      End Probation
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'lift' ? 'Lift Restriction' : 'End Probation'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'lift'
                ? `Move ${pendingAction?.userName} from Restricted to Probation? They will be able to make bookings again, but all bookings will require manual approval.`
                : `Fully restore ${pendingAction?.userName}'s account to Active? Auto-approval will be available again and consecutive cancellations will be reset to 0.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100">
              {actionError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction} disabled={loading}>
              {loading ? 'Processing…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
