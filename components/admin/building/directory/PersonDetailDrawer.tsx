'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Pencil, UserX, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { DirectoryPerson } from '@/backend/admin/building/building.types'
import { usePersonDetail, useMaintenanceStaffMutations } from '@/hooks/admin/building/useBuildingDirectory'
import { AccountTab } from './tabs/AccountTab'
import { BookingsTab } from './tabs/BookingsTab'
import { PaymentsTab } from './tabs/PaymentsTab'
import { SchedulesTab } from './tabs/SchedulesTab'
import { AssignmentsTab } from './tabs/AssignmentsTab'
import { EditMaintenanceStaffDialog } from './EditMaintenanceStaffDialog'
import { cn } from '@/lib/utils'
import { formatEnumLabel } from '@/lib/enum-labels'

const CATEGORY_COLORS: Record<string, string> = {
  faculty: 'bg-blue-100 text-blue-700',
  program_head: 'bg-purple-100 text-purple-700',
  academic_head: 'bg-indigo-100 text-indigo-700',
  building_admin: 'bg-orange-100 text-orange-700',
  cashier: 'bg-yellow-100 text-yellow-700',
  it_admin: 'bg-cyan-100 text-cyan-700',
  external_client: 'bg-green-100 text-green-700',
  maintenance_staff: 'bg-slate-100 text-slate-700',
}

const CATEGORY_LABELS: Record<string, string> = {
  faculty: 'Faculty', program_head: 'Program Head', academic_head: 'Academic Head',
  building_admin: 'Building Admin', cashier: 'Cashier',
  it_admin: 'IT Admin', external_client: 'External Client', maintenance_staff: 'Maintenance',
}

const TEACHING_CATEGORIES = new Set(['faculty', 'program_head', 'academic_head'])

interface Props {
  person: DirectoryPerson | null
  onClose: () => void
  onRefreshList: () => void
}

export function PersonDetailDrawer({ person, onClose, onRefreshList }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  // Hooks always called at top level
  const { deactivate, deactivating, unassign } = useMaintenanceStaffMutations()

  const {
    detail, bookings, payments, schedules, assignments,
    loadingDetail, loadingBookings, loadingPayments, loadingSchedules, loadingAssignments,
    refreshAssignments, refreshDetail,
  } = usePersonDetail(person?.id ?? null, person?.source ?? null)

  const isMaintenance = person?.category === 'maintenance_staff'
  const isTeaching = person ? TEACHING_CATEGORIES.has(person.category) : false

  const handleDeactivate = async () => {
    if (!person) return
    const ok = await deactivate(person.id)
    if (ok) {
      setDeactivateOpen(false)
      onClose()
      onRefreshList()
    }
  }

  const handleUnassign = async (assignmentId: string) => {
    const ok = await unassign(assignmentId)
    if (ok) refreshAssignments()
  }

  return (
    <>
      <Sheet open={!!person} onOpenChange={open => { if (!open) onClose() }}>
        <SheetContent side="right" className="w-full sm:max-w-[460px] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <SheetHeader className="px-6 py-5 border-b border-border bg-muted/30">
            <div className="flex items-start gap-4">
              <Avatar className="w-14 h-14 border-2 border-border shrink-0">
                <AvatarImage src={person?.avatarUrl ?? undefined} />
                <AvatarFallback className="font-bold text-lg bg-muted">
                  {person?.name.substring(0, 2).toUpperCase() ?? '??'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-bold truncate">{person?.name}</SheetTitle>
                {person?.employeeId && (
                  <p className="text-xs font-mono text-muted-foreground">{person.employeeId}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge className={cn('text-[10px] border-none', CATEGORY_COLORS[person?.category ?? ''] ?? 'bg-muted text-muted-foreground')}>
                    {CATEGORY_LABELS[person?.category ?? ''] ?? formatEnumLabel(person?.category ?? '')}
                  </Badge>
                  {!person?.isActive && (
                    <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                  )}
                </div>
              </div>
              {loadingDetail && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
            </div>
            {/* Maintenance staff actions */}
            {isMaintenance && person?.isActive && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400" onClick={() => setDeactivateOpen(true)}>
                  <UserX className="w-3.5 h-3.5 mr-1.5" />Deactivate
                </Button>
              </div>
            )}
          </SheetHeader>

          {/* Tabs */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <Tabs defaultValue="account">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="account" className="flex-1 text-xs">Account</TabsTrigger>
                {!isMaintenance && <TabsTrigger value="bookings" className="flex-1 text-xs">Bookings</TabsTrigger>}
                {!isMaintenance && <TabsTrigger value="payments" className="flex-1 text-xs">Payments</TabsTrigger>}
                {isTeaching && <TabsTrigger value="schedules" className="flex-1 text-xs">Schedules</TabsTrigger>}
                {isMaintenance && <TabsTrigger value="assignments" className="flex-1 text-xs">Facilities</TabsTrigger>}
              </TabsList>

              <TabsContent value="account">
                {detail
                  ? <AccountTab detail={detail} />
                  : loadingDetail
                    ? <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    : null
                }
              </TabsContent>

              {!isMaintenance && (
                <TabsContent value="bookings">
                  <BookingsTab bookings={bookings} loading={loadingBookings} />
                </TabsContent>
              )}

              {!isMaintenance && (
                <TabsContent value="payments">
                  <PaymentsTab payments={payments} loading={loadingPayments} />
                </TabsContent>
              )}

              {isTeaching && (
                <TabsContent value="schedules">
                  <SchedulesTab schedules={schedules} loading={loadingSchedules} />
                </TabsContent>
              )}

              {isMaintenance && person && (
                <TabsContent value="assignments">
                  <AssignmentsTab
                    staffId={person.id}
                    assignments={assignments}
                    loading={loadingAssignments}
                    onUnassign={handleUnassign}
                    onAssigned={refreshAssignments}
                    onReassigned={refreshAssignments}
                  />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {detail && isMaintenance && (
        <EditMaintenanceStaffDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          detail={detail}
          onSuccess={() => { refreshDetail(); onRefreshList() }}
        />
      )}

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {person?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the staff member as inactive and remove them from all active facility assignments. The record and assignment history are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deactivating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
