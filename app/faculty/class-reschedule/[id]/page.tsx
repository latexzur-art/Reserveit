"use client"

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ConnectedTopBar } from '@/app/faculty/_components/ConnectedTopBar'
import { ROUTES } from '@/lib/routes'
import { formatTime } from '@/lib/formatTime'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, CheckCircle, AlertCircle, Clock, CalendarIcon, MapPin, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface OfferData {
  offer_id: string
  class_schedule_id: string
  course_code: string
  section: string
  affected_date: string
  original_start: string
  original_end: string
  duration_minutes: number
  original_facility: { id: string; name: string; room_number: string | null } | null
  deadline: string | null
  displaced_by: string | null
  alternative_facilities: { id: string; name: string; room_number: string | null; capacity: number | null }[]
  no_match_reason: string | null
  can_widen: boolean
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0')
  const min = (m % 60).toString().padStart(2, '0')
  return `${h}:${min}`
}

export default function ClassReschedulePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [offer, setOffer] = useState<OfferData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newDate, setNewDate] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newFacilityId, setNewFacilityId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showWidenPrompt, setShowWidenPrompt] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch offer
  useEffect(() => {
    fetch(`/api/class-schedules/reschedule-offer/${id}`)
      .then(r => { if (!r.ok) throw r; return r.json() })
      .then(d => {
        setOffer(d)
        setNewDate(d.affected_date)
        setNewStart(d.original_start)
        if (d.alternative_facilities?.length > 0) {
          setNewFacilityId(d.alternative_facilities[0].id)
        } else if (d.can_widen) {
          setShowWidenPrompt(true)
        }
      })
      .catch(async r => {
        const body = r.json ? await r.json().catch(() => null) : null
        setError(body?.error ?? 'Failed to load reschedule offer')
      })
      .finally(() => setLoading(false))
  }, [id])

  // Second pass: flexible matching
  const handleWiden = useCallback(async () => {
    setShowWidenPrompt(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/class-schedules/reschedule-offer/${id}?flexible=true`)
      if (!res.ok) throw res
      const d = await res.json()
      setOffer(prev => prev ? { ...prev, alternative_facilities: d.alternative_facilities, no_match_reason: d.no_match_reason } : prev)
      if (d.alternative_facilities?.length > 0) setNewFacilityId(d.alternative_facilities[0].id)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [id])

  const newEnd = offer && newStart
    ? minutesToTime(timeToMinutes(newStart) + offer.duration_minutes)
    : ''

  const handleSubmit = useCallback(async () => {
    if (!offer || !newDate || !newStart || !newFacilityId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/class-schedules/reschedule-offer/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: newDate, new_start: newStart, new_end: newEnd, new_facility_id: newFacilityId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setSubmitError(d?.error ?? 'Failed to reschedule')
        return
      }
      setSubmitted(true)
    } catch {
      setSubmitError('Network error')
    } finally {
      setSubmitting(false)
    }
  }, [id, offer, newDate, newStart, newEnd, newFacilityId])

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <ConnectedTopBar title="Reschedule Class" breadcrumbs={[{ label: 'Schedule', href: ROUTES.faculty.schedules }]} />
        <main className="p-4 sm:p-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        </main>
      </div>
    )
  }

  // ── Error ──
  if (error || !offer) {
    return (
      <div className="min-h-screen bg-background">
        <ConnectedTopBar title="Reschedule Class" breadcrumbs={[{ label: 'Schedule', href: ROUTES.faculty.schedules }]} />
        <main className="p-4 sm:p-8 max-w-2xl mx-auto">
          <div className="bg-card border border-border/80 rounded-2xl p-8 text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{error ?? 'Offer not found'}</p>
            <Button variant="outline" onClick={() => router.push(ROUTES.faculty.schedules)} className="mt-4">Back to Schedule</Button>
          </div>
        </main>
      </div>
    )
  }

  // ── Success ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <ConnectedTopBar title="Reschedule Class" breadcrumbs={[{ label: 'Schedule', href: ROUTES.faculty.schedules }]} />
        <main className="p-4 sm:p-8 max-w-2xl mx-auto">
          <div className="bg-card border border-border/80 rounded-2xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Class Rescheduled</h2>
            <p className="text-sm text-muted-foreground mb-1">{offer.course_code} {offer.section}</p>
            <p className="text-xs text-muted-foreground">Moved to {newDate} ({formatTime(newStart)} – {formatTime(newEnd)})</p>
            <p className="text-xs text-muted-foreground mt-1">The session has been auto-approved and added to your calendar.</p>
            <Button onClick={() => router.push(ROUTES.faculty.schedules)} className="mt-6">Back to Schedule</Button>
          </div>
        </main>
      </div>
    )
  }

  // ── Form ──
  return (
    <div className="min-h-screen bg-background">
      <ConnectedTopBar title="Reschedule Class" breadcrumbs={[{ label: 'Schedule', href: ROUTES.faculty.schedules }]} />
      <main className="p-4 sm:p-8 max-w-2xl mx-auto pb-24">
        <Button variant="ghost" size="sm" onClick={() => router.push(ROUTES.faculty.schedules)} className="gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Reschedule Displaced Class</h1>
        <p className="text-xs text-muted-foreground mb-6">Select a new room, date, and time for your class session.</p>

        {/* Original class info */}
        <section className="bg-card rounded-2xl border border-border/80 shadow-xs p-5 mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Original Session</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Course:</span> <strong>{offer.course_code} {offer.section}</strong></div>
            <div><span className="text-muted-foreground">Date:</span> <strong>{offer.affected_date}</strong></div>
            <div><span className="text-muted-foreground">Time:</span> <strong>{formatTime(offer.original_start)} – {formatTime(offer.original_end)}</strong></div>
            <div><span className="text-muted-foreground">Room:</span> <strong>{offer.original_facility?.name ?? 'N/A'}</strong></div>
          </div>
          {offer.displaced_by && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
              <AlertCircle className="inline w-3.5 h-3.5 mr-1" />
              Displaced by: {offer.displaced_by}
            </p>
          )}
          {offer.deadline && (
            <p className="text-xs text-destructive mt-1">
              <Clock className="inline w-3.5 h-3.5 mr-1" />
              Deadline: {new Date(offer.deadline).toLocaleString()}
            </p>
          )}
        </section>

        {/* Widen prompt — when no exact lab match found */}
        {showWidenPrompt && (
          <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">No Matching Rooms Available</h2>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mb-3">
              {offer.no_match_reason ?? 'No rooms of the same type are available at this time.'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">Was this a regular class (lecture/discussion) that could use a standard classroom?</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleWiden} className="text-xs rounded-xl">Yes, show classrooms</Button>
              <Button size="sm" variant="outline" onClick={() => setShowWidenPrompt(false)} className="text-xs rounded-xl">No, try different date</Button>
            </div>
          </section>
        )}

        {/* Alternative rooms */}
        {offer.alternative_facilities.length > 0 && (
          <section className="bg-card rounded-2xl border border-border/80 shadow-xs p-5 mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Suggested Rooms (available at original time)</h2>
            <div className="space-y-2">
              {offer.alternative_facilities.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setNewFacilityId(f.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all text-sm',
                    newFacilityId === f.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/80 hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-medium">{f.name}</p>
                      {f.room_number && <p className="text-xs text-muted-foreground">Room {f.room_number}</p>}
                    </div>
                  </div>
                  {f.capacity && <span className="text-xs text-muted-foreground">{f.capacity} cap</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Pick new room manually if no alternatives shown or user wants different */}
        <section className="bg-card rounded-2xl border border-border/80 shadow-xs p-5 mb-6 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Schedule</h2>

          {/* Facility ID input (manual fallback) */}
          {offer.alternative_facilities.length === 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Facility ID</label>
              <Input
                value={newFacilityId}
                onChange={e => setNewFacilityId(e.target.value)}
                placeholder="Paste facility UUID"
                className="text-xs rounded-xl"
              />
              <p className="text-xs text-muted-foreground mt-1">No alternative rooms found. Enter a facility ID manually.</p>
            </div>
          )}

          {/* Date picker */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">New Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-xs rounded-xl", !newDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDate ? format(new Date(newDate), "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate ? new Date(newDate) : undefined}
                  onSelect={d => {
                    if (d) {
                      const y = d.getFullYear()
                      const m = String(d.getMonth() + 1).padStart(2, '0')
                      const day = String(d.getDate()).padStart(2, '0')
                      setNewDate(`${y}-${m}-${day}`)
                    }
                  }}
                  disabled={d => d < today}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Start Time</label>
              <Input
                type="time"
                value={newStart}
                onChange={e => setNewStart(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">End Time (auto)</label>
              <Input
                type="time"
                value={newEnd}
                disabled
                className="text-xs rounded-xl bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">{offer.duration_minutes} min session</p>
            </div>
          </div>
        </section>

        {submitError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {submitError}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting || !newDate || !newStart || !newFacilityId}
          className="w-full h-11 text-xs font-semibold rounded-xl"
        >
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rescheduling...</> : 'Confirm Reschedule'}
        </Button>
      </main>
    </div>
  )
}
