'use client'

import { useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Clock, MapPin, ShieldCheck, Calendar } from 'lucide-react'
import { SchedulesTab } from '@/components/admin/building/directory/tabs/SchedulesTab'
import type { DirectorySchedule } from '@/backend/admin/building/building.types'
import { useStaffSchedules, type StaffScheduleClass } from '@/hooks/academic-head/useStaffSchedules'
import { useStaffBookings, type StaffBooking } from '@/hooks/academic-head/useStaffBookings'
import { cn } from '@/lib/utils'
import { bookingStatusLabel, userRoleLabel } from '@/lib/enum-labels'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AssignStaffClassModal } from './AssignStaffClassModal'

export interface DrawerStaff {
  id: string
  name: string
  email: string
  departmentCode: string
  roles: string[]
  isProgramHead: boolean
  avatarUrl: string | null
}

interface Props {
  staff: DrawerStaff | null
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  auto_approved: 'bg-green-100 text-green-700',
}

function toDirectorySchedule(c: StaffScheduleClass): DirectorySchedule {
  return {
    id: c.id,
    courseCode: c.course_code,
    courseName: c.course_name,
    section: c.section,
    dayOfWeek: c.day_of_week,
    startTime: c.start_time,
    endTime: c.end_time,
    facilityName: c.facility.name,
    facilityCode: null,
    roomNumber: c.facility.room_number || null,
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function BookingRow({ b }: { b: StaffBooking }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {b.eventName ?? b.purpose ?? b.bookingPurpose ?? 'Booking'}
          </p>
          <p className="text-xs text-muted-foreground font-mono">{b.referenceNumber}</p>
        </div>
        <Badge className={cn('text-[10px] border-none shrink-0', STATUS_COLORS[b.status] ?? 'bg-muted text-muted-foreground')}>
          {bookingStatusLabel(b.status)}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(b.bookingDate)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {b.startTime} – {b.endTime}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {b.facilityName}{b.roomNumber ? ` (${b.roomNumber})` : ''}
        </span>
      </div>
    </div>
  )
}

export function StaffScheduleDrawer({ staff, onClose }: Props) {
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const { schedules, meta, loading: loadingSchedules, refetch: refetchSchedules } = useStaffSchedules(staff?.id ?? null)
  const { bookings, loading: loadingBookings } = useStaffBookings(staff?.id ?? null)

  const directorySchedules = useMemo(
    () => schedules.map(toDirectorySchedule),
    [schedules]
  )

  return (
    <Sheet open={!!staff} onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col p-0 overflow-hidden">
        <SheetHeader className="px-6 py-5 border-b border-border bg-muted/30">
          <div className="flex items-start gap-4">
            <Avatar className="w-14 h-14 border-2 border-border shrink-0">
              <AvatarImage src={staff?.avatarUrl ?? undefined} />
              <AvatarFallback className="font-bold text-lg bg-muted">
                {staff?.name.substring(0, 2).toUpperCase() ?? '??'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-bold truncate">{staff?.name}</SheetTitle>
              <p className="text-xs text-muted-foreground truncate">{staff?.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {staff?.departmentCode && (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {staff.departmentCode}
                  </Badge>
                )}
                {staff?.isProgramHead && (
                  <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Program Head
                  </Badge>
                )}
                {staff?.roles.filter(r => !r.toLowerCase().includes('program')).map(r => (
                  <Badge key={r} variant="secondary" className="text-[10px] capitalize">
                    {userRoleLabel(r)}
                  </Badge>
                ))}
              </div>
              <div className="mt-3">
                <Button size="sm" onClick={() => setAssignModalOpen(true)} className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full">
                  <Plus className="w-3 h-3 mr-1" />
                  Assign Class
                </Button>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-6 py-4">
          <Tabs defaultValue="schedules">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="schedules" className="flex-1 text-xs">
                Schedules {meta && meta.total_classes > 0 ? `(${meta.total_classes})` : ''}
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex-1 text-xs">
                Bookings {bookings.length > 0 ? `(${bookings.length})` : ''}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedules">
              {meta && meta.total_classes > 0 && (
                <p className="text-xs text-muted-foreground mb-3">
                  {meta.total_classes} class{meta.total_classes === 1 ? '' : 'es'} ·{' '}
                  {meta.unique_courses} unique course{meta.unique_courses === 1 ? '' : 's'}
                </p>
              )}
              <SchedulesTab schedules={directorySchedules} loading={loadingSchedules} />
            </TabsContent>

            <TabsContent value="bookings">
              {loadingBookings ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No upcoming bookings.</p>
              ) : (
                <ScrollArea className="h-80">
                  <div className="space-y-2 pr-2">
                    {bookings.map(b => <BookingRow key={b.id} b={b} />)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        {staff && (
          <AssignStaffClassModal 
            staff={staff} 
            open={assignModalOpen} 
            onOpenChange={setAssignModalOpen} 
            onSuccess={() => refetchSchedules?.()}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
