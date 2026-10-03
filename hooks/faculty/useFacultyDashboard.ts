'use client'

import { useMemo } from 'react'
import useSWR from 'swr'

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

export interface DashboardReservation {
  id: string
  facility: string
  building: string
  date: string
  time: string
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'declined'
  course_code: string | null
  course_name: string | null
  is_elective: boolean
  elective_type: string | null
}

export interface DashboardClassSchedule {
  id: string
  course_code: string
  course_name: string
  section: string
  day_of_week: number
  start_time: string
  end_time: string
  facility: { name: string; room_number: string; building: string }
  department: { name: string; code: string }
}

export interface DashboardStats {
  totalReservations: number
  pendingRequests: number
  upcomingBookings: number
  activeReservations: number
  totalClasses: number
  activeToday: number  // combined classes + reservations happening today
}

export interface DashboardNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  created_at: string
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
    time: `${b.start_time?.slice(0, 5) ?? '--:--'} - ${b.end_time?.slice(0, 5) ?? '--:--'}`,
    status: toConfirmedStatus(b.current_status),
    course_code: b.booking_course_code ?? null,
    course_name: b.course_name ?? null,
    is_elective: b.is_elective ?? false,
    elective_type: b.elective_type ?? null,
  }
}

export function useFacultyDashboard() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const todayDow = useMemo(() => new Date().getDay(), [])

  const { data: recentData, isLoading: recentLoading, mutate: mutateRecent } = useSWR<any>('/api/bookings?pageSize=5')
  const { data: pendingData, mutate: mutatePending } = useSWR<any>('/api/bookings?status=pending,flagged,pending_faculty_response&pageSize=1')
  const { data: upcomingData, mutate: mutateUpcoming } = useSWR<any>(`/api/bookings?status=pending,auto_approved,approved&dateFrom=${today}&pageSize=1`)
  const { data: todayActiveData, mutate: mutateTodayActive } = useSWR<any>(`/api/bookings?status=auto_approved,approved,overridden&dateFrom=${today}&pageSize=50`)
  const { data: notifData, mutate: mutateNotif } = useSWR<any>('/api/notifications?limit=3')
  const { data: facilData, mutate: mutateFacil } = useSWR<any>('/api/facilities')
  const { data: classData, isLoading: classLoading, mutate: mutateClass } = useSWR<any>('/api/schedules/my-classes')

  const recentBookings: DashboardReservation[] = useMemo(() => {
    const bookings: BookingItem[] = recentData?.bookings ?? []
    return bookings.map(toDisplayBooking)
  }, [recentData])

  const classSchedules: DashboardClassSchedule[] = useMemo(() => {
    return classData?.classes ?? []
  }, [classData])

  const notifications: DashboardNotification[] = useMemo(() => {
    return notifData?.notifications ?? []
  }, [notifData])

  const facilities: FacilityItem[] = useMemo(() => {
    return (facilData?.facilities ?? []).slice(0, 5)
  }, [facilData])

  const stats: DashboardStats = useMemo(() => {
    const totalReservations = recentData?.total ?? 0
    const pendingRequests = pendingData?.total ?? 0
    const upcomingBookings = upcomingData?.total ?? 0
    const activeReservations = todayActiveData?.total ?? 0
    const totalClasses = classSchedules.length
    const classesToday = classSchedules.filter((c) => c.day_of_week === todayDow).length

    return {
      totalReservations,
      pendingRequests,
      upcomingBookings,
      activeReservations,
      totalClasses,
      activeToday: classesToday + activeReservations,
    }
  }, [recentData, pendingData, upcomingData, todayActiveData, classSchedules, todayDow])

  const loading = recentLoading || classLoading

  const refresh = async () => {
    await Promise.all([
      mutateRecent(),
      mutatePending(),
      mutateUpcoming(),
      mutateTodayActive(),
      mutateNotif(),
      mutateFacil(),
      mutateClass(),
    ])
  }

  return { recentBookings, classSchedules, stats, notifications, facilities, loading, refresh }
}
