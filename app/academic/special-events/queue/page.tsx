'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, XCircle, CalendarDays, Building2, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { eventApprovalStatusLabel } from '@/lib/enum-labels'

interface EventRequest {
  id: string
  event_name: string
  booking_date: string
  start_time: string
  end_time: string
  event_approval_status: string
  event_requested_by_role: string
  event_decision_notes: string | null
  event_decided_at: string | null
  created_at: string
  users: { full_name: string; email: string } | null
  event_decided_by_user: { full_name: string; email: string } | null
  booking_facilities: Array<{ facility_id: string; facilities: { name: string; room_number: string } | null }>
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-amber-500/10 text-amber-600 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  declined: 'bg-red-500/10 text-red-600 border-red-500/20',
}

function ReviewModal({
  event,
  onClose,
  onSuccess,
}: {
  event: EventRequest
  onClose: () => void
  onSuccess: () => void
}) {
  const [action, setAction] = useState<'approve' | 'decline' | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const facilityNames = event.booking_facilities
    .map((bf) => {
      const f = bf.facilities
      return f ? `${f.name}${f.room_number ? ` (${f.room_number})` : ''}` : ''
    })
    .filter(Boolean)
    .join(', ')

  async function handleSubmit() {
    if (!action) return
    if (action === 'decline' && !notes.trim()) {
      toast.error('Please provide a reason for declining.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/special-events/${event.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit review')
      toast.success(action === 'approve' ? 'Event approved successfully.' : 'Event declined.')
      onSuccess()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-xl p-6">
        <h3 className="text-lg font-bold text-ah-sti-blue dark:text-white mb-4">Review Event Request</h3>
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300 mb-4">
          <p><strong>Event:</strong> {event.event_name}</p>
          <p><strong>Date:</strong> {event.booking_date}</p>
          <p><strong>Time:</strong> {event.start_time} – {event.end_time}</p>
          <p><strong>Facilities:</strong> {facilityNames}</p>
          <p><strong>Requested by:</strong> {event.users?.full_name ?? event.users?.email ?? 'Program Head'}</p>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setAction('approve')}
            className={cn(
              'flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
              action === 'approve'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'
                : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400'
            )}
          >
            <CheckCircle className="w-4 h-4 inline mr-1" /> Approve
          </button>
          <button
            onClick={() => setAction('decline')}
            className={cn(
              'flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
              action === 'decline'
                ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30'
                : 'border-slate-200 dark:border-slate-700 hover:border-red-400'
            )}
          >
            <XCircle className="w-4 h-4 inline mr-1" /> Decline
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
            Notes {action === 'decline' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={action === 'decline' ? 'Reason for declining (required)…' : 'Optional notes…'}
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!action || submitting}
            className={cn(
              action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
              'text-white'
            )}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {action === 'approve' ? 'Confirm Approval' : 'Confirm Decline'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function SpecialEventQueuePage() {
  const [events, setEvents] = useState<EventRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'declined'>('pending')
  const [selectedEvent, setSelectedEvent] = useState<EventRequest | null>(null)

  async function fetchEvents() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/special-events?status=${filter}`)
      const data = await res.json()
      setEvents(data.events ?? [])
    } catch {
      toast.error('Failed to load event requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex flex-col p-6 gap-4 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Special Event <span className="text-accent-brand">Requests</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">Review and approve Program Head school event requests.</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'approved', 'declined'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors',
                filter === s ? STATUS_BADGE[s] + ' border' : 'border-slate-200 dark:border-slate-700 text-slate-500'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-ah-sti-blue" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
          <AlertTriangle className="w-8 h-8" />
          <p className="text-sm">No {filter} event requests.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => {
            const facilityNames = ev.booking_facilities
              .map((bf) => bf.facilities?.name)
              .filter(Boolean)
              .join(', ')

            return (
              <div
                key={ev.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-ah-sti-blue dark:text-white leading-tight">{ev.event_name}</h3>
                  <Badge className={cn('text-xs capitalize', STATUS_BADGE[ev.event_approval_status] ?? '')}>
                    {eventApprovalStatusLabel(ev.event_approval_status)}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <p className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                    {ev.booking_date}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    {ev.start_time} – {ev.end_time}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                    {facilityNames || '—'}
                  </p>
                  <p className="text-slate-500">
                    Requested by: <span className="font-medium">{ev.users?.full_name ?? 'Program Head'}</span>
                  </p>
                  {ev.event_decision_notes && (
                    <p className="italic text-slate-400">Note: {ev.event_decision_notes}</p>
                  )}
                </div>

                {ev.event_approval_status === 'pending' && (
                  <Button
                    size="sm"
                    className="w-full bg-ah-sti-blue hover:bg-ah-sti-blue/90 text-white"
                    onClick={() => setSelectedEvent(ev)}
                  >
                    Review
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedEvent && (
        <ReviewModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSuccess={() => { setSelectedEvent(null); fetchEvents() }}
        />
      )}
    </div>
  )
}
