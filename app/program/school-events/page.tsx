'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { bookingStatusLabel } from '@/lib/enum-labels'
import { Loader2, Trash2 } from 'lucide-react'

interface Facility {
    id: string
    name: string
    room_number: string
}

interface SchoolEvent {
    id: string
    booking_date: string
    start_time: string
    end_time: string
    event_name: string
    current_status: string
    facilities: { name: string; room_number: string }
}

const STATUS_BADGE: Record<string, string> = {
    pending:       'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-600/20 dark:bg-yellow-500/10 dark:text-yellow-400 dark:ring-yellow-500/20',
    auto_approved: 'bg-green-50 text-green-800 ring-1 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20',
    completed:     'bg-blue-50 text-blue-800 ring-1 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
    cancelled:     'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

const STATUS_LABEL: Record<string, string> = {
    pending:       'Pending Approval',
    auto_approved: 'Approved',
    completed:     'Completed',
    cancelled:     'Cancelled',
}

export default function ProgramHeadSchoolEventsPage() {
    const [facilities, setFacilities] = useState<Facility[]>([])
    const [events, setEvents] = useState<SchoolEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const [eventName, setEventName] = useState('')
    const [selectedFacilities, setSelectedFacilities] = useState<string[]>([])
    const [eventDate, setEventDate] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [facRes, eventsRes] = await Promise.all([
                fetch('/api/facilities?all=true'),
                fetch('/api/program-head/schedule-events'),
            ])

            if (!facRes.ok) throw new Error((await facRes.json()).error || 'Failed to fetch facilities')
            if (!eventsRes.ok) throw new Error((await eventsRes.json()).error || 'Failed to fetch events')

            setFacilities((await facRes.json()).facilities || [])
            setEvents((await eventsRes.json()).events || [])
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const toggleFacility = (id: string) => {
        setSelectedFacilities(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!eventName || selectedFacilities.length === 0 || !eventDate || !startTime || !endTime) {
            toast.error('Please fill all required fields')
            return
        }
        if (endTime <= startTime) {
            toast.error('End time must be after start time')
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch('/api/program-head/schedule-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_name: eventName,
                    booking_date: eventDate,
                    start_time: startTime,
                    end_time: endTime,
                    facility_ids: selectedFacilities,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to submit request')

            toast.success('School event request submitted. Awaiting academic head approval.')
            setEventName('')
            setSelectedFacilities([])
            setEventDate('')
            setStartTime('')
            setEndTime('')
            fetchData()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err))
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (eventId: string) => {
        setDeletingId(eventId)
        try {
            const res = await fetch(`/api/program-head/schedule-events/${eventId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to cancel request')
            toast.success('Event request cancelled.')
            fetchData()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err))
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <ConnectedTopBar title="School Event Requests" />
            <main className="flex-1 p-6 space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">School Event <span className="text-accent-brand">Requests</span></h1>
                    <p className="text-muted-foreground mt-2">
                        Submit a school event request for academic head approval. Approved events will automatically override conflicting bookings and class schedules.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Request School Event</CardTitle>
                            <CardDescription>Fill in the event details to submit for approval.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="event-name">Event Name</Label>
                                    <Input
                                        id="event-name"
                                        value={eventName}
                                        onChange={(e) => setEventName(e.target.value)}
                                        placeholder="e.g. IT Week Opening"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Facilities</Label>
                                    {loading ? (
                                        <div className="flex items-center p-3 border rounded-md bg-muted">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            <span className="text-sm text-muted-foreground">Loading facilities...</span>
                                        </div>
                                    ) : (
                                        <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                                            {facilities.map((fac) => (
                                                <label key={fac.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFacilities.includes(fac.id)}
                                                        onChange={() => toggleFacility(fac.id)}
                                                        className="rounded"
                                                    />
                                                    {fac.name} ({fac.room_number})
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {selectedFacilities.length > 0 && (
                                        <p className="text-xs text-muted-foreground">{selectedFacilities.length} facility selected</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="event-date">Event Date</Label>
                                    <Input
                                        type="date"
                                        id="event-date"
                                        value={eventDate}
                                        onChange={(e) => setEventDate(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="start-time">Start Time</Label>
                                        <Input
                                            type="time"
                                            id="start-time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end-time">End Time</Label>
                                        <Input
                                            type="time"
                                            id="end-time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <Button type="submit" className="w-full" disabled={submitting || loading}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Request
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>My Event Requests</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center p-6">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : events.length === 0 ? (
                                <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground">
                                    No event requests submitted yet
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {events.map(event => {
                                        const status = event.current_status
                                        const busy = deletingId === event.id
                                        return (
                                            <div key={event.id} className="flex items-start justify-between p-4 border rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{event.event_name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {event.facilities?.name} ({event.facilities?.room_number}) &bull; {new Date(event.booking_date).toLocaleDateString()}
                                                        {event.start_time && event.end_time && event.start_time !== '00:00:00' && (
                                                            <> &bull; {event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)}</>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600'}`}>
                                                            {STATUS_LABEL[status] ?? bookingStatusLabel(status)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {status === 'pending' && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={busy}
                                                                className="text-red-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-destructive/10 shrink-0"
                                                                title="Cancel request"
                                                            >
                                                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Cancel this event request?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This will withdraw the request for &ldquo;{event.event_name}&rdquo;. This action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Keep Request</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(event.id)} className="bg-destructive hover:bg-destructive/90">
                                                                    Cancel Request
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
