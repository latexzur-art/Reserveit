'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DashboardReservation, DashboardStats, DashboardNotification } from '@/hooks/faculty/useFacultyDashboard'
import { useRefetchOnFocus } from '@/hooks/shared/useRefetchOnFocus'

interface FacilityItem {
  id: string
  name: string
  capacity: number
  facility_types?: { name: string }
  floors?: { floor_number: number; buildings?: { name: string } }
}

interface BookingItem {
  id: string
  booking_reference: string
  booking_date: string
  start_time: string
  end_time: string
  current_status: string
  booking_facilities: {
    facility: {
      name: string
      room_number: string
      floors: { floor_number: number; buildings: { name: string } }
    }
  }[]
  booking_course_code: string | null
  course_name: string | null
  is_elective: boolean
  elective_type: string | null
}

export interface CurriculumUploadItem {
  id: string
  upload_status: string
  upload_mode: string
  total_entries: number
  approved_count: number
  rejected_count: number
  pending_count: number
  department_name?: string
  uploader_name?: string
  created_at: string
  submitted_at?: string
  review_notes?: string
}

export interface ProgramHeadStats extends DashboardStats {
  pendingChangeRequests: number
  approvedSchedules: number
  pendingUploadsCount: number
}

function toConfirmedStatus(status: string): DashboardReservation['status'] {
  if (['auto_approved', 'approved', 'overridden'].includes(status)) return 'confirmed'
  if (status === 'completed') return 'completed'
  if (status === 'cancelled') return 'cancelled'
  if (['auto_declined', 'rejected'].includes(status)) return 'declined'
  return 'pending'
}

function toDisplayBooking(b: BookingItem): DashboardReservation {
  const facility = b.booking_facilities?.[0]?.facility
  return {
    id: b.id,
    facility: facility?.name ?? 'Unknown Facility',
    building: facility?.floors?.buildings?.name ?? '',
    date: b.booking_date,
    time: `${b.start_time.slice(0, 5)} - ${b.end_time.slice(0, 5)}`,
    status: toConfirmedStatus(b.current_status),
    course_code: b.booking_course_code ?? null,
    course_name: b.course_name ?? null,
    is_elective: b.is_elective ?? false,
    elective_type: b.elective_type ?? null,
  }
}

export function useProgramHeadDashboard() {
  const [recentBookings, setRecentBookings] = useState<DashboardReservation[]>([])
  const [stats, setStats] = useState<ProgramHeadStats>({
    totalReservations: 0,
    pendingRequests: 0,
    upcomingBookings: 0,
    activeReservations: 0,
    totalClasses: 0,
    activeToday: 0,
    pendingChangeRequests: 0,
    approvedSchedules: 0,
    pendingUploadsCount: 0,
  })
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [facilities, setFacilities] = useState<FacilityItem[]>([])
  const [pendingUploads, setPendingUploads] = useState<CurriculumUploadItem[]>([])
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [myClasses, setMyClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    try {
      const results = await Promise.all([
        fetch('/api/bookings?pageSize=5'),
        fetch('/api/bookings?status=pending,flagged,pending_faculty_response&pageSize=1'),
        fetch(`/api/bookings?status=pending,auto_approved,approved&dateFrom=${today}&pageSize=1`),
        fetch('/api/notifications?limit=3'),
        fetch('/api/facilities'),
        fetch('/api/schedules/my-classes'),
        fetch('/api/schedules/change-requests?status=pending').catch(() => null),
        fetch('/api/schedules/live').catch(() => null),
        fetch('/api/courses/upload/history?limit=5').catch(() => null),
      ])

      const [recentRes, pendingRes, upcomingRes, notifRes, facilRes, myClassesRes, changeReqRes, schedulesRes, uploadsRes] = results

      let pendingChangeRequests = 0
      let approvedSchedules = 0
      let pendingUploadsCount = 0

      if (changeReqRes?.ok) {
        const data = await changeReqRes.json()
        pendingChangeRequests = (data.change_requests ?? []).length
      }

      if (schedulesRes?.ok) {
        const data = await schedulesRes.json()
        approvedSchedules = (data.schedules ?? []).length
      }

      // Curriculum uploads
      if (uploadsRes?.ok) {
        const data = await uploadsRes.json()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uploads: CurriculumUploadItem[] = (data.uploads ?? []).map((u: any) => ({
          id: u.id,
          upload_status: u.upload_status,
          upload_mode: u.upload_mode,
          total_entries: u.total_entries ?? 0,
          approved_count: u.approved_count ?? 0,
          rejected_count: u.rejected_count ?? 0,
          pending_count: u.pending_count ?? 0,
          department_name: u.department_name,
          uploader_name: u.uploader_name,
          created_at: u.created_at,
          submitted_at: u.submitted_at,
          review_notes: u.review_notes,
        })).filter((u: CurriculumUploadItem) => u.upload_status !== 'deleted')
        setPendingUploads(uploads)
        pendingUploadsCount = uploads.filter(u => u.upload_status === 'submitted').length
      }

      let totalReservations = 0
      let activeReservations = 0
      let upcomingCount = 0
      let pendingCount = 0

      if (recentRes.ok) {
        const data = await recentRes.json()
        const bookings: BookingItem[] = data.bookings ?? []
        setRecentBookings(bookings.map(toDisplayBooking))
        totalReservations = data.total ?? 0
        activeReservations = bookings.filter(
          b =>
            b.booking_date === today &&
            ['auto_approved', 'approved', 'overridden'].includes(b.current_status)
        ).length
      }

      if (upcomingRes.ok) upcomingCount = (await upcomingRes.json()).total ?? 0
      if (pendingRes.ok) pendingCount = (await pendingRes.json()).total ?? 0

      let totalClasses = 0
      let classesToday = 0

      if (myClassesRes?.ok) {
        const myClassesData = await myClassesRes.json()
        const classes = myClassesData.classes || []
        setMyClasses(classes)
        totalClasses = classes.length
        const dayMap: Record<string, number> = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 }
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
        const todayIdx = dayMap[todayName]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        classesToday = classes.filter((c: any) => c.day_of_week === todayIdx).length
      }

      setStats({
        totalReservations,
        pendingRequests: pendingCount,
        upcomingBookings: upcomingCount,
        activeReservations,
        totalClasses,
        activeToday: activeReservations + classesToday,
        pendingChangeRequests,
        approvedSchedules,
        pendingUploadsCount,
      })

      if (notifRes.ok) {
        const data = await notifRes.json()
        setNotifications(data.notifications ?? [])
      }

      if (facilRes.ok) {
        const data = await facilRes.json()
        setFacilities((data.facilities ?? []).slice(0, 5))
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useRefetchOnFocus(fetchAll)

  return { recentBookings, stats, notifications, facilities, pendingUploads, myClasses, loading, refresh: fetchAll }
}
