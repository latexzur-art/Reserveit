"use client"

import { useState, useEffect } from 'react'
import { Search, Calendar, ArrowUpDown, MapPin } from 'lucide-react'
import { useAcademicReservations, type AcademicReservationItem } from '@/hooks/academic-head/useAcademicReservations'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ReservationInfoCard, type FacilityOption } from '@/app/academic/_components/ReservationInfoCard'
import { BookingDetailModal } from '@/components/academic/BookingDetailModal'
import { BookingActionModal } from '@/components/academic/BookingActionModal'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'auto_approved,approved,overridden', label: 'Approved' },
  { value: 'flagged,pending', label: 'Pending Review' },
  { value: 'pending_faculty_response,pending_user_response', label: 'Action Required' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancellation_requested', label: 'Cancel Requests' },
  { value: 'auto_declined,rejected', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
]

export default function AcademicFacilityReservationsPage() {
  const {
    bookings, departments, total, page, setPage, totalPages,
    statusFilter, setStatusFilter,
    departmentId, setDepartmentId,
    search, setSearch,
    sortBy, setSortBy,
    loading, refresh,
    cancelBooking, reviewBooking, proposeChanges, deleteBooking,
  } = useAcademicReservations()

  const [selectedBooking, setSelectedBooking] = useState<AcademicReservationItem | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showAction, setShowAction] = useState(false)

  const [facilities, setFacilities] = useState<FacilityOption[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/facilities', { signal: controller.signal })
      .then(r => r.ok ? r.json() : { facilities: [] })
      .then(d => setFacilities((d.facilities ?? []).map((f: any) => ({ id: f.id, name: f.name, room_number: f.room_number }))))
      .catch((err: any) => {
        if (err.name !== 'AbortError') console.error('[facilities] failed:', err)
      })
    return () => controller.abort()
  }, [])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Facility <span className="text-accent-brand">Reservations</span></h1>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
          {total} total facility reservations across STI College Lucena
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-xs space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search facility reservations"
            placeholder="Search by faculty, facility, reference code, or purpose..."
            className="w-full pl-10 pr-4 h-10 bg-background border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                statusFilter === opt.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-border/80'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 h-10 px-3 bg-background border border-border rounded-xl hover:border-border/80 transition-colors">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              aria-label="Filter by Department"
              className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer max-w-[130px] pr-1"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.code}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 h-10 px-3 bg-background border border-border rounded-xl hover:border-border/80 transition-colors">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              aria-label="Sort reservations"
              className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="date_asc">Oldest First</option>
              <option value="date_desc">Newest First</option>
              <option value="status">By Status</option>
              <option value="department">By Department</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-xs">
            <p className="text-sm font-semibold text-muted-foreground">Loading reservations…</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-xs">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold text-foreground">
              {search ? 'No matching reservations found' : 'No reservations recorded'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Try clearing filters or search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {bookings.map(booking => (
              <div key={booking.id} className="space-y-2">
                <ReservationInfoCard
                  booking={booking}
                  onCancel={async (id, reason) => { await cancelBooking(id, reason); refresh() }}
                  onDelete={async (id) => { await deleteBooking(id); refresh() }}
                  onReview={async (id, action, reason) => { await reviewBooking(id, action, reason); refresh() }}
                  onProposeChanges={async (id, changes) => { await proposeChanges(id, changes); refresh() }}
                  facilities={facilities}
                />
                <div className="flex justify-end gap-2 px-1">
                  {['pending', 'flagged', 'auto_approved', 'approved'].includes(booking.status) && (
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 shadow-sm"
                      onClick={() => { setSelectedBooking(booking); setShowAction(true) }}
                    >
                      Take Action
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold border-border text-foreground hover:bg-muted transition-all"
                    onClick={() => { setSelectedBooking(booking); setShowDetail(true) }}
                  >
                    Inspect Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 pt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-xl font-semibold text-xs h-9 px-4"
            >
              Previous
            </Button>
            <span className="text-xs font-semibold text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-xl font-semibold text-xs h-9 px-4"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Detail & Action Modals */}
      <BookingDetailModal
        booking={selectedBooking}
        open={showDetail}
        onClose={() => { setShowDetail(false); setSelectedBooking(null) }}
        onTakeAction={(b) => { setShowDetail(false); setSelectedBooking(b); setShowAction(true) }}
      />

      <BookingActionModal
        booking={selectedBooking}
        open={showAction}
        onClose={() => { setShowAction(false); setSelectedBooking(null) }}
        reviewBooking={reviewBooking}
        proposeChanges={proposeChanges}
        cancelBooking={cancelBooking}
        onSuccess={refresh}
      />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
