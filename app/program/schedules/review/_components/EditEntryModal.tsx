'use client'

/**
 * Schedule Review Page — Program Head
 * View staged entries, resolve conflicts, then submit to academic head review queue.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { z } from 'zod'
import { useScheduleEntries } from '@/hooks/academic-head/useScheduleUploads'
import { Combobox } from '@/components/ui/combobox'
import { TimeSlotPicker } from '@/components/ui/TimeSlotPicker'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    ArrowLeftRight,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Loader2,
    Sparkles,
    ChevronDown,
    ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useConflictDetails } from '@/hooks/schedule/useConflictDetails'


export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const TIME_SLOTS: string[] = (() => {
    const slots: string[] = []
    for (let min = 7 * 60; min <= 21 * 60; min += 30) {
        const h = Math.floor(min / 60)
        const m = min % 60
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
    return slots
})()

export function formatTime(raw: string): string {
    if (!raw) return '—'
    const [h, m] = raw.split(':').map(Number)
    const suffix = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function extractYearLevel(section: string): string {
    const match = section.match(/\d/)
    if (!match) return ""
    const digit = match[0]
    switch (digit) {
        case '1': return "1st Year"
        case '2': return "2nd Year"
        case '3': return "3rd Year"
        case '4': return "4th Year"
        default: return ""
    }
}

export function formatTimeDisplay(t: string) {
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function timeToMins(t: string) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
}

export function formatDuration(startHHMM: string, endHHMM: string) {
    if (!startHHMM || !endHHMM) return ''
    const mins = timeToMins(endHHMM) - timeToMins(startHHMM)
    if (mins <= 0) return ''
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function useAvailableFacilitiesPH(dayOfWeek: number, startTime: string, endTime: string, excludeEntryId: string) {
    const [facilities, setFacilities] = useState<{ id: string; name: string; room_number: string; available: boolean }[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!startTime || !endTime) return
        // eslint-disable-next-line react-hooks/exhaustive-deps
        setLoading(true)
        const params = new URLSearchParams({
            day_of_week: String(dayOfWeek),
            start_time: startTime,
            end_time: endTime,
            exclude_entry_id: excludeEntryId,
        })
        fetch(`/api/schedules/slot-availability?${params}`)
            .then(r => r.json())
            .then(data => { if (data.facilities) setFacilities(data.facilities) })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [dayOfWeek, startTime, endTime, excludeEntryId])

    return { facilities: facilities.filter(f => f.available), loading }
}

function FacilitySelectPH({
    dayOfWeek, startTime, endTime, excludeEntryId, value, onChange, className,
}: {
    dayOfWeek: number; startTime: string; endTime: string; excludeEntryId: string
    value: string; onChange: (v: string) => void; className?: string
}) {
    const { facilities, loading } = useAvailableFacilitiesPH(dayOfWeek, startTime, endTime, excludeEntryId)

    useEffect(() => {
        if (!value || facilities.length === 0) return
        const exact = facilities.find(f => f.name === value)
        if (exact) return
        const byRoom = facilities.find(f => f.room_number === value)
        if (byRoom) onChange(byRoom.name)
    }, [facilities, value, onChange])

    const isCurrentInList = facilities.some(f => f.name === value)
    const showCurrentAsOriginal = value && !isCurrentInList && startTime && endTime

    return (
        <>
            <select value={value} onChange={e => onChange(e.target.value)} className={className} required>
                <option value="">
                    {loading ? 'Loading rooms…' : startTime && endTime ? '— Select room —' : '— Pick a time first —'}
                </option>
                {showCurrentAsOriginal && (
                    <option value={value}>{value} (current — unavailable)</option>
                )}
                {facilities.map(f => (
                    <option key={f.id} value={f.name}>
                        {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                    </option>
                ))}
            </select>
            <div className="flex items-center justify-between mt-0.5">
                {!loading && startTime && endTime && (
                    <span className="text-[11px] text-emerald-600">{facilities.length} available</span>
                )}
                {(!value || showCurrentAsOriginal) && (
                    <button
                        type="button"
                        onClick={() => facilities.length > 0 && onChange(facilities[0].name)}
                        disabled={!startTime || !endTime || facilities.length === 0}
                        className="flex items-center gap-1 text-[11px] text-amber-500 hover:opacity-70 transition-opacity ml-auto disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!startTime || !endTime ? 'Pick start and end time first' : facilities.length === 0 ? 'No available rooms for this slot' : 'Pick best available room'}
                    >
                        <Sparkles className="h-3 w-3" />
                        Use best available
                    </button>
                )}
            </div>
        </>
    )
}

export function EditEntryModal({
    entry,
    uploadId,
    onClose,
    onSaved,
}: {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    entry: Record<string, any>
    uploadId: string
    onClose: () => void
    onSaved: () => void
}) {
    const { editEntry, splitEntry } = useScheduleEntries(uploadId)

    const [form, setForm] = useState({
        course_code: entry.course_code || '',
        course_name: entry.course_name || '',
        section: entry.section || '',
        instructor_name: entry.instructor_name || '',
        day_of_week: entry.day_of_week ?? 1,
        start_time: entry.start_time?.slice(0, 5) ?? '',
        end_time: entry.end_time?.slice(0, 5) ?? '',
        facility_name_raw: entry.facility_name_raw || entry.facilities?.name || '',
    })
    const [saving, setSaving] = useState(false)
    const [autoFixingTime, setAutoFixingTime] = useState(false)
    const [autoFixTimeError, setAutoFixTimeError] = useState<string | null>(null)

    const { conflicts, loadingConflicts } = useConflictDetails(entry)

    // Split panel state
    const [splitOpen, setSplitOpen] = useState(false)
    const [splitting, setSplitting] = useState(false)
    const [splitError, setSplitError] = useState<string | null>(null)
    const [expectedHours, setExpectedHours] = useState<number | null>(null)
    const [s1, setS1] = useState({
        day_of_week: entry.day_of_week ?? 1,
        start_time: entry.start_time?.slice(0, 5) ?? '',
        end_time: entry.end_time?.slice(0, 5) ?? '',
        facility_name_raw: entry.facility_name_raw || entry.facilities?.name || '',
    })
    const [s2, setS2] = useState({ day_of_week: 1, start_time: '', end_time: '', facility_name_raw: '' })

    const [instructors, setInstructors] = useState<{ id: string, full_name: string, department_code: string }[]>([])
    const [instructorsLoading, setInstructorsLoading] = useState(false)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        setInstructorsLoading(true)
        fetch('/api/instructors')
            .then(r => r.json())
            .then(data => setInstructors(data.instructors || []))
            .catch(() => {})
            .finally(() => setInstructorsLoading(false))
    }, [])

    const instructorOptions = useMemo(() => instructors.map(i => ({
        value: i.full_name,
        label: i.full_name,
        sublabel: i.department_code || undefined
    })), [instructors])

    useEffect(() => {
        if (!entry.course_code) return
        fetch(`/api/courses?search=${encodeURIComponent(entry.course_code)}&approval_status=approved&limit=5`)
            .then(r => r.json())
            .then(data => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const courses: Array<{ course_code?: string; [key: string]: any }> = data.courses ?? data.data ?? []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const match = courses.find((c: { course_code?: string; [key: string]: any }) => c.course_code === entry.course_code)
                if (match) {
                    const h = match.delivery_mode === 'lab' ? match.lab_hours
                        : match.delivery_mode === 'lecture' ? match.lecture_hours
                        : (match.lecture_hours ?? match.lab_hours)
                    setExpectedHours(h ?? null)
                }
            })
            .catch(() => {})
    }, [entry.course_code])

    const isDirty = useMemo(() => {
        return form.course_code !== (entry.course_code || '') ||
            form.course_name !== (entry.course_name || '') ||
            form.section !== (entry.section || '') ||
            form.instructor_name !== (entry.instructor_name || '') ||
            form.day_of_week !== (entry.day_of_week ?? 1) ||
            form.start_time !== (entry.start_time?.slice(0, 5) ?? '') ||
            form.end_time !== (entry.end_time?.slice(0, 5) ?? '') ||
            form.facility_name_raw !== (entry.facility_name_raw || entry.facilities?.name || '')
    }, [form, entry])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await editEntry(entry.id, {
                ...form,
                start_time: form.start_time + ':00',
                end_time: form.end_time + ':00',
            })
            onSaved()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err))
        }
        setSaving(false)
    }

    const handleAutoFixTime = async () => {
        setAutoFixingTime(true)
        setAutoFixTimeError(null)
        const durationMins = expectedHours
            ? expectedHours * 60
            : form.start_time && form.end_time
                ? timeToMins(form.end_time) - timeToMins(form.start_time)
                : 90
        const starts = TIME_SLOTS.filter(t => t !== '21:00')
        let found = false
        for (const start of starts) {
            const endMins = timeToMins(start) + durationMins
            if (endMins > 21 * 60) break
            const endH = Math.floor(endMins / 60)
            const endM = endMins % 60
            const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
            try {
                const params = new URLSearchParams({
                    day_of_week: String(form.day_of_week),
                    start_time: start,
                    end_time: end,
                    exclude_entry_id: entry.id,
                })
                const res = await fetch(`/api/schedules/slot-availability?${params}`)
                const data = await res.json()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const avail = (data.facilities ?? []).filter((f: { available?: boolean; [key: string]: any }) => f.available)
                if (avail.length > 0) {
                    await editEntry(entry.id, {
                        ...form,
                        start_time: start + ':00',
                        end_time: end + ':00',
                        facility_name_raw: avail[0].name,
                    })
                    found = true
                    onSaved()
                    break
                }
            } catch { break }
        }
        if (!found) setAutoFixTimeError('No available slot found on this day.')
        setAutoFixingTime(false)
    }

    const handleSplit = async () => {
        if (!s1.start_time || !s1.end_time || !s1.facility_name_raw) { setSplitError('Session 1 is incomplete.'); return }
        if (!s2.start_time || !s2.end_time || !s2.facility_name_raw) { setSplitError('Session 2 is incomplete.'); return }
        setSplitting(true)
        setSplitError(null)
        try {
            await splitEntry!(entry.id,
                { ...s1, start_time: s1.start_time + ':00', end_time: s1.end_time + ':00' },
                { ...s2, start_time: s2.start_time + ':00', end_time: s2.end_time + ':00' },
            )
            onSaved()
        } catch (err: unknown) {
            setSplitError(err instanceof Error ? err.message : String(err))
        }
        setSplitting(false)
    }

    const s1Mins = s1.start_time && s1.end_time ? timeToMins(s1.end_time) - timeToMins(s1.start_time) : 0
    const s2Mins = s2.start_time && s2.end_time ? timeToMins(s2.end_time) - timeToMins(s2.start_time) : 0

    const [autoFillingS2, setAutoFillingS2] = useState(false)

    const handleAutoFillS2 = async () => {
        if (!expectedHours) return
        const remainingMins = expectedHours * 60 - s1Mins
        if (remainingMins <= 0) return
        setAutoFillingS2(true)
        const candidates = TIME_SLOTS.filter(t => t !== '21:00')
        for (const start of candidates) {
            const endMins = timeToMins(start) + remainingMins
            if (endMins > 21 * 60) break
            const endH = Math.floor(endMins / 60)
            const endM = endMins % 60
            const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
            const params = new URLSearchParams({
                day_of_week: String(s2.day_of_week),
                start_time: start,
                end_time: end,
                exclude_entry_id: entry.id,
            })
            try {
                const res = await fetch(`/api/schedules/slot-availability?${params}`)
                const data = await res.json()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const avail = (data.facilities ?? []).filter((f: { available?: boolean; [key: string]: any }) => f.available)
                if (avail.length > 0) {
                    setS2(p => ({ ...p, start_time: start, end_time: end, facility_name_raw: avail[0].name }))
                    break
                }
            } catch { break }
        }
        setAutoFillingS2(false)
    }

    const totalMins = s1Mins + s2Mins
    const totalH = Math.floor(totalMins / 60)
    const totalM = totalMins % 60
    const totalLabel = totalMins > 0 ? (totalM > 0 ? `${totalH}h ${totalM}m` : `${totalH}h`) : '—'
    const durationOk = expectedHours ? totalMins === expectedHours * 60 : null

    const startOptions = TIME_SLOTS.filter(t => t !== '21:00')
    const endOptions = TIME_SLOTS.filter(t => t !== '07:00')
    if (form.start_time && !startOptions.includes(form.start_time)) startOptions.unshift(form.start_time)
    if (form.end_time && !endOptions.includes(form.end_time)) endOptions.push(form.end_time)

    const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-sti-blue/50 hover:border-border/80 transition-colors'
    const comboCls = 'h-[42px] rounded-lg border-input bg-background text-sm font-normal text-foreground hover:border-border/80 focus:ring-sti-blue/50'
    const timeCls = 'h-[42px] rounded-lg border-input bg-background text-sm font-normal text-foreground hover:border-border/80 focus:ring-sti-blue/50 px-3'

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Schedule Entry</DialogTitle>
                    <DialogDescription>Fix errors or update schedule details</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isDirty && (entry.validation_errors?.length > 0 || conflicts.length > 0) && (
                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5" />
                            Unsaved changes. Click Save & Re-Validate to check for new conflicts.
                        </div>
                    )}
                    {!isDirty && conflicts.length > 0 && (
                        <div className="space-y-1.5">
                            {conflicts.map((c, i) => (
                                <div key={`conflict-${i}`} className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
                                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs text-orange-600 dark:text-orange-400 font-medium block">
                                            {c.conflict_type === 'internal' ? 'Internal Overlap' : c.conflict_type === 'cross_department' ? 'Cross-Dept Conflict' : 'Live Schedule Conflict'}
                                        </span>
                                        <p className="text-xs text-orange-600/80 dark:text-orange-400/80 mt-0.5">
                                            Section "{entry.section}" overlaps with <strong>"{c.course_code}"</strong> ({c.section}) on {DAY_NAMES[c.day_of_week]} at {formatTimeDisplay(c.start_time)}–{formatTimeDisplay(c.end_time)}.
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!isDirty && entry.validation_errors?.length > 0 && (
                        <div className="space-y-1.5">
                            {entry.validation_errors.map((ve: Record<string, unknown>, i: number) => {
                                const isDuration = (typeof ve.message === 'string') && (ve.message?.toLowerCase().includes('duration') || ve.message?.toLowerCase().includes('hours'))
                                return (
                                    <div key={i} className="flex items-center justify-between gap-3 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive">
                                        <span>{String(ve.message ?? '')}</span>
                                        {isDuration && expectedHours && (
                                            <button
                                                type="button"
                                                onClick={handleAutoFixTime}
                                                disabled={autoFixingTime}
                                                className="flex items-center gap-1 shrink-0 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 rounded text-[11px] font-medium border border-amber-500/30 transition-colors disabled:opacity-40"
                                            >
                                                {autoFixingTime ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                                Auto-fix
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-muted-foreground mb-1.5">Course Code</label>
                            <input value={form.course_code} onChange={e => setForm(p => ({ ...p, course_code: e.target.value }))} className={inputCls} required />
                        </div>
                        <div>
                            <label className="block text-xs text-muted-foreground mb-1.5">Section</label>
                            <input value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))} className={inputCls} required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Course Name</label>
                        <input value={form.course_name} onChange={e => setForm(p => ({ ...p, course_name: e.target.value }))} className={inputCls} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Instructor</label>
                        <Combobox
                            value={form.instructor_name}
                            onChange={(val) => setForm(p => ({ ...p, instructor_name: val }))}
                            options={instructorOptions}
                            loading={instructorsLoading}
                            allowCustom
                            variant="schedule"
                            className={comboCls}
                            placeholder="Select or type instructor..."
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-muted-foreground mb-1.5">Day</label>
                            <select value={form.day_of_week} onChange={e => setForm(p => ({ ...p, day_of_week: parseInt(e.target.value) }))} className={inputCls}>
                                {DAY_NAMES.map((d, i) => i === 0 ? null : <option key={i} value={i}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Start</label>
                            <TimeSlotPicker
                                value={form.start_time}
                                onChange={v => {
                                    setForm(p => {
                                        let nextEnd = p.end_time
                                        if (entry.start_time && entry.end_time && v) {
                                            const origDuration = timeToMins(entry.end_time.slice(0, 5)) - timeToMins(entry.start_time.slice(0, 5))
                                            if (origDuration > 0) {
                                                const newStartMins = timeToMins(v)
                                                const newEndMins = newStartMins + origDuration
                                                if (newEndMins <= 19 * 60) { // max 7:00 PM
                                                    const h = Math.floor(newEndMins / 60)
                                                    const m = newEndMins % 60
                                                    nextEnd = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                                                }
                                            }
                                        }
                                        return { ...p, start_time: v, end_time: nextEnd }
                                    })
                                }}
                                hideLabel
                                className={timeCls}
                                variant="faculty"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                End{form.start_time && form.end_time && (
                                    <span className="ml-2 text-muted-foreground/60">{formatDuration(form.start_time, form.end_time)}</span>
                                )}
                            </label>
                            <TimeSlotPicker
                                value={form.end_time}
                                onChange={v => setForm(p => ({ ...p, end_time: v }))}
                                minTime={form.start_time}
                                hideLabel
                                className={timeCls}
                                variant="faculty"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleAutoFixTime}
                            disabled={autoFixingTime}
                            className="flex items-center gap-1.5 text-[11px] text-amber-600 hover:opacity-70 transition-opacity disabled:opacity-40"
                            title="Scan all time slots on this day to find the first available room"
                        >
                            {autoFixingTime ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Auto-fix time & room
                        </button>
                        {autoFixTimeError && <span className="text-[11px] text-red-600 dark:text-red-400">{autoFixTimeError}</span>}
                    </div>

                    <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Facility / Room</label>
                        <FacilitySelectPH
                            dayOfWeek={form.day_of_week} startTime={form.start_time} endTime={form.end_time}
                            excludeEntryId={entry.id} value={form.facility_name_raw}
                            onChange={v => setForm(p => ({ ...p, facility_name_raw: v }))}
                            className={inputCls}
                        />
                        {(!form.start_time || !form.end_time) && (
                            <p className="mt-1 text-[11px] text-muted-foreground/70">Pick a day and time above to see available rooms.</p>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-sti-blue hover:bg-sti-blue/90 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save & Re-Validate'}
                        </button>
                    </div>
                </form>

                {/* Split Session Panel */}
                <div className="border-t pt-4">
                    <button
                        type="button"
                        onClick={() => setSplitOpen(o => !o)}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border hover:bg-accent text-sm text-foreground transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <ArrowLeftRight className="h-3.5 w-3.5 text-amber-500" />
                            Split into 2 sessions
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            {splitOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {splitOpen ? 'collapse' : 'expand'}
                        </span>
                    </button>

                    {splitOpen && (
                        <div className="mt-4 space-y-4">
                            <p className="text-xs text-muted-foreground">
                                Replace this entry with two separate sessions. Both are saved independently and conflict-checked.
                                {expectedHours && <span className="ml-1">Expected: <strong>{expectedHours}h</strong> total.</span>}
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Session 1 */}
                                <div className="border rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-semibold text-amber-500">Session 1</p>
                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">Day</label>
                                        <select value={s1.day_of_week} onChange={e => setS1(p => ({ ...p, day_of_week: parseInt(e.target.value) }))} className={inputCls}>
                                            {DAY_NAMES.map((d, i) => i === 0 ? null : <option key={i} value={i}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Start</label>
                                            <TimeSlotPicker
                                                value={s1.start_time}
                                                onChange={v => setS1(p => ({ ...p, start_time: v }))}
                                                hideLabel
                                                className={timeCls}
                                                variant="faculty"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                                End{s1.start_time && s1.end_time && <span className="ml-1 text-muted-foreground/60">{formatDuration(s1.start_time, s1.end_time)}</span>}
                                            </label>
                                            <TimeSlotPicker
                                                value={s1.end_time}
                                                onChange={v => setS1(p => ({ ...p, end_time: v }))}
                                                minTime={s1.start_time}
                                                hideLabel
                                                className={timeCls}
                                                variant="faculty"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">Room</label>
                                        <FacilitySelectPH
                                            dayOfWeek={s1.day_of_week} startTime={s1.start_time} endTime={s1.end_time}
                                            excludeEntryId={entry.id} value={s1.facility_name_raw}
                                            onChange={v => setS1(p => ({ ...p, facility_name_raw: v }))}
                                            className={inputCls}
                                        />
                                    </div>
                                </div>

                                {/* Session 2 */}
                                <div className="border rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-amber-500">Session 2</p>
                                        {expectedHours && s1Mins > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleAutoFillS2}
                                                disabled={autoFillingS2}
                                                className="flex items-center gap-1 text-[11px] text-amber-500 hover:opacity-70 transition-opacity disabled:opacity-40"
                                                title="Auto-fill time and room for session 2"
                                            >
                                                {autoFillingS2 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                                Auto-fill
                                            </button>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">Day</label>
                                        <select value={s2.day_of_week} onChange={e => setS2(p => ({ ...p, day_of_week: parseInt(e.target.value) }))} className={inputCls}>
                                            {DAY_NAMES.map((d, i) => i === 0 ? null : <option key={i} value={i}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Start</label>
                                            <TimeSlotPicker
                                                value={s2.start_time}
                                                onChange={v => setS2(p => ({ ...p, start_time: v }))}
                                                disabled={autoFillingS2}
                                                hideLabel
                                                className={timeCls}
                                                variant="faculty"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                                End{s2.start_time && s2.end_time && <span className="ml-1 text-muted-foreground/60">{formatDuration(s2.start_time, s2.end_time)}</span>}
                                            </label>
                                            <TimeSlotPicker
                                                value={s2.end_time}
                                                onChange={v => setS2(p => ({ ...p, end_time: v }))}
                                                minTime={s2.start_time}
                                                disabled={autoFillingS2}
                                                hideLabel
                                                className={timeCls}
                                                variant="faculty"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">Room</label>
                                        <FacilitySelectPH
                                            dayOfWeek={s2.day_of_week} startTime={s2.start_time} endTime={s2.end_time}
                                            excludeEntryId={entry.id} value={s2.facility_name_raw}
                                            onChange={v => setS2(p => ({ ...p, facility_name_raw: v }))}
                                            className={inputCls}
                                        />
                                    </div>
                                </div>
                            </div>

                            {totalMins > 0 && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                                    durationOk === true ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : durationOk === false ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-muted border-border text-muted-foreground'
                                }`}>
                                    {formatDuration(s1.start_time, s1.end_time) || '—'} + {formatDuration(s2.start_time, s2.end_time) || '—'} = <strong>{totalLabel}</strong>
                                    {expectedHours && durationOk === true && (
                                        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> matches expected</span>
                                    )}
                                    {expectedHours && durationOk === false && (
                                        <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> expected {expectedHours}h total</span>
                                    )}
                                </div>
                            )}

                            {splitError && <p className="text-xs text-red-600 dark:text-red-400">{splitError}</p>}

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleSplit}
                                    disabled={splitting}
                                    className="px-4 py-2 bg-sti-blue hover:bg-sti-blue/90 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                >
                                    {splitting ? 'Splitting…' : 'Confirm Split'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
