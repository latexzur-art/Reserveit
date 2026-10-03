'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Sparkles, Check, AlertTriangle } from 'lucide-react'
import { useScheduleEntries } from '@/hooks/academic-head/useScheduleUploads'
import { cn } from '@/lib/utils'
import { TIME_SLOTS, formatTimeDisplay, timeToMins, formatDuration } from '../_utils/time'
import { FacilitySelect } from './FacilitySelect'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function EditStagingEntryModal({
    entry,
    uploadId,
    onClose,
}: {
    entry: any
    uploadId: string
    onClose: (saved?: boolean) => void
}) {
    const { editEntry, splitEntry } = useScheduleEntries(uploadId)

    const [form, setForm] = useState({
        course_code: entry.course_code || '',
        course_name: entry.course_name || '',
        section: entry.section || '',
        session_type: entry.session_type || '',
        instructor_name: entry.instructor_name || '',
        day_of_week: entry.day_of_week ?? 0,
        start_time: entry.start_time?.slice(0, 5) ?? '',
        end_time: entry.end_time?.slice(0, 5) ?? '',
        facility_name_raw: entry.facility_name_raw || entry.facilities?.name || '',
    })
    const [saving, setSaving] = useState(false)

    // Split panel state
    const [splitOpen, setSplitOpen] = useState(false)
    const [splitting, setSplitting] = useState(false)
    const [splitError, setSplitError] = useState<string | null>(null)
    const [expectedHours, setExpectedHours] = useState<number | null>(null)
    const [s1, setS1] = useState({
        day_of_week: entry.day_of_week ?? 0,
        start_time: entry.start_time?.slice(0, 5) ?? '',
        end_time: entry.end_time?.slice(0, 5) ?? '',
        facility_name_raw: entry.facility_name_raw || entry.facilities?.name || '',
    })
    const [s2, setS2] = useState({ day_of_week: 1, start_time: '', end_time: '', facility_name_raw: '' })

    // Fetch expected hours for the course
    useEffect(() => {
        if (!entry.course_code) return
        fetch(`/api/courses?search=${encodeURIComponent(entry.course_code)}&approval_status=approved&limit=5`)
            .then(r => r.json())
            .then(data => {
                const courses: any[] = data.courses ?? data.data ?? []
                const match = courses.find((c: any) => c.course_code === entry.course_code)
                if (match) {
                    const h = match.delivery_mode === 'lab' ? match.lab_hours
                        : match.delivery_mode === 'lecture' ? match.lecture_hours
                            : (match.lecture_hours ?? match.lab_hours)
                    setExpectedHours(h ?? null)
                }
            })
            .catch(() => { })
    }, [entry.course_code])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await editEntry(entry.id, {
                ...form,
                start_time: form.start_time + ':00',
                end_time: form.end_time + ':00',
            })
            onClose(true)
        } catch (err: any) {
            alert(err.message)
        }
        setSaving(false)
    }

    const handleSplit = async () => {
        if (!s1.start_time || !s1.end_time || !s1.facility_name_raw) {
            setSplitError('Session 1 is incomplete.')
            return
        }
        if (!s2.start_time || !s2.end_time || !s2.facility_name_raw) {
            setSplitError('Session 2 is incomplete.')
            return
        }
        setSplitting(true)
        setSplitError(null)
        try {
            await splitEntry!(entry.id,
                { ...s1, start_time: s1.start_time + ':00', end_time: s1.end_time + ':00' },
                { ...s2, start_time: s2.start_time + ':00', end_time: s2.end_time + ':00' },
            )
            onClose(true)
        } catch (err: any) {
            setSplitError(err.message)
        }
        setSplitting(false)
    }

    // Duration summary (computed early so handleAutoFillS2 can use s1Mins)
    const s1Mins = s1.start_time && s1.end_time ? timeToMins(s1.end_time) - timeToMins(s1.start_time) : 0
    const s2Mins = s2.start_time && s2.end_time ? timeToMins(s2.end_time) - timeToMins(s2.start_time) : 0

    const [autoFixingTime, setAutoFixingTime] = useState(false)
    const [autoFixTimeError, setAutoFixTimeError] = useState<string | null>(null)

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
                const avail = (data.facilities ?? []).filter((f: any) => f.available)
                if (avail.length > 0) {
                    await editEntry(entry.id, {
                        ...form,
                        start_time: start + ':00',
                        end_time: end + ':00',
                        facility_name_raw: avail[0].name,
                    })
                    found = true
                    onClose(true)
                    break
                }
            } catch { break }
        }
        if (!found) setAutoFixTimeError('No available slot found on this day.')
        setAutoFixingTime(false)
    }

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
                const avail = (data.facilities ?? []).filter((f: any) => f.available)
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

    const selectCls = 'w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-ah-sti-cyan/50 focus:outline-none'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-bold text-white">Edit Schedule Entry</h2>
                        <p className="text-sm text-slate-400">Fix validation errors or update details</p>
                    </div>
                    <button onClick={() => onClose()} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {entry.validation_errors?.length > 0 && (
                        <div className="space-y-1.5">
                            {entry.validation_errors.map((ve: any, i: number) => {
                                const isDuration = ve.message?.toLowerCase().includes('duration') || ve.message?.toLowerCase().includes('hours')
                                return (
                                    <div key={i} className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400">
                                        <span>{ve.message}</span>
                                        {isDuration && expectedHours && (
                                            <button
                                                type="button"
                                                onClick={handleAutoFixTime}
                                                disabled={autoFixingTime}
                                                className="flex items-center gap-1 shrink-0 px-2 py-1 bg-ah-sti-cyan/20 hover:bg-ah-sti-cyan/30 text-ah-sti-cyan rounded text-[11px] font-medium border border-ah-sti-cyan/30 transition-colors disabled:opacity-40"
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
                            <label className="block text-xs text-slate-400 mb-1.5">Course Code</label>
                            <input value={form.course_code} onChange={e => setForm(p => ({ ...p, course_code: e.target.value }))} className={selectCls} required />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Section</label>
                            <input value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))} className={selectCls} required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Course Name</label>
                        <input value={form.course_name} onChange={e => setForm(p => ({ ...p, course_name: e.target.value }))} className={selectCls} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Instructor</label>
                            <input value={form.instructor_name} onChange={e => setForm(p => ({ ...p, instructor_name: e.target.value }))} className={selectCls} required />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Session Type</label>
                            <select value={form.session_type} onChange={e => setForm(p => ({ ...p, session_type: e.target.value }))} className={selectCls}>
                                <option value="" className="bg-slate-900">Unset</option>
                                <option value="lecture" className="bg-slate-900">Lecture (LEC)</option>
                                <option value="lab" className="bg-slate-900">Laboratory (LAB)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Day</label>
                            <select value={form.day_of_week} onChange={e => setForm(p => ({ ...p, day_of_week: parseInt(e.target.value) }))} className={selectCls}>
                                {DAY_NAMES.map((d, i) => i === 0 ? null : <option key={i} value={i}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Start</label>
                            <select value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className={selectCls} required>
                                <option value="">-- Start --</option>
                                {startOptions.map(t => <option key={t} value={t}>{formatTimeDisplay(t)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">
                                End{form.start_time && form.end_time && (
                                    <span className="ml-2 text-slate-500">{formatDuration(form.start_time, form.end_time)}</span>
                                )}
                            </label>
                            <select value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className={selectCls} required>
                                <option value="">-- End --</option>
                                {endOptions.filter(t => !form.start_time || t > form.start_time).map(t => <option key={t} value={t}>{formatTimeDisplay(t)}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleAutoFixTime}
                            disabled={autoFixingTime}
                            className="flex items-center gap-1.5 text-[11px] text-ah-sti-cyan hover:opacity-70 transition-opacity disabled:opacity-40"
                            title="Scan all time slots on this day to find the first available room"
                        >
                            {autoFixingTime ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Auto-fix time &amp; room
                        </button>
                        {autoFixTimeError && <span className="text-[11px] text-red-400">{autoFixTimeError}</span>}
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Facility / Room</label>
                        <FacilitySelect
                            dayOfWeek={form.day_of_week} startTime={form.start_time} endTime={form.end_time}
                            excludeEntryId={entry.id} value={form.facility_name_raw}
                            onChange={v => setForm(p => ({ ...p, facility_name_raw: v }))}
                            className={selectCls}
                        />
                        {(!form.start_time || !form.end_time) && (
                            <p className="mt-1 text-[11px] text-slate-500">Pick a day and time above to see available rooms.</p>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button type="button" onClick={() => onClose()} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-ah-sti-cyan hover:bg-ah-sti-cyan/80 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save & Re-Validate'}
                        </button>
                    </div>
                </form>

                {/* Split Session Panel */}
                <div className="border-t border-white/10 px-6 pb-6">
                    <button
                        type="button"
                        onClick={() => setSplitOpen(o => !o)}
                        className="mt-4 w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] text-sm text-slate-300 transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <span className="text-ah-sti-cyan">⇄</span>
                            Split into 2 sessions
                        </span>
                        <span className="text-slate-500 text-xs">{splitOpen ? '▲ collapse' : '▼ expand'}</span>
                    </button>

                    {splitOpen && (
                        <div className="mt-4 space-y-4">
                            <p className="text-xs text-slate-500">
                                Replace this entry with two separate sessions. Both are saved independently and conflict-checked.
                                {expectedHours && <span className="ml-1 text-slate-400">Expected: <strong className="text-white">{expectedHours}h</strong> total.</span>}
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Session 1 */}
                                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-semibold text-ah-sti-cyan">Session 1</p>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Day</label>
                                        <select value={s1.day_of_week} onChange={e => setS1(p => ({ ...p, day_of_week: parseInt(e.target.value) }))} className={selectCls}>
                                            {DAY_NAMES.map((d, i) => i === 0 ? null : <option key={i} value={i}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Start</label>
                                            <select value={s1.start_time} onChange={e => setS1(p => ({ ...p, start_time: e.target.value }))} className={selectCls}>
                                                <option value="">--</option>
                                                {TIME_SLOTS.filter(t => t !== '21:00').map(t => <option key={t} value={t}>{formatTimeDisplay(t)}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">
                                                End{s1.start_time && s1.end_time && <span className="ml-1 text-slate-500">{formatDuration(s1.start_time, s1.end_time)}</span>}
                                            </label>
                                            <select value={s1.end_time} onChange={e => setS1(p => ({ ...p, end_time: e.target.value }))} className={selectCls}>
                                                <option value="">--</option>
                                                {TIME_SLOTS.filter(t => t !== '07:00' && (!s1.start_time || t > s1.start_time)).map(t => <option key={t} value={t}>{formatTimeDisplay(t)}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Room</label>
                                        <FacilitySelect
                                            dayOfWeek={s1.day_of_week} startTime={s1.start_time} endTime={s1.end_time}
                                            excludeEntryId={entry.id} value={s1.facility_name_raw}
                                            onChange={v => setS1(p => ({ ...p, facility_name_raw: v }))}
                                            className={selectCls}
                                        />
                                    </div>
                                </div>

                                {/* Session 2 */}
                                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-ah-sti-cyan">Session 2</p>
                                        {expectedHours && s1Mins > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleAutoFillS2}
                                                disabled={autoFillingS2}
                                                className="flex items-center gap-1 text-[11px] text-ah-sti-cyan hover:opacity-70 transition-opacity disabled:opacity-40"
                                                title="Auto-fill time and room for session 2"
                                            >
                                                {autoFillingS2 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                                Auto-fill
                                            </button>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Day</label>
                                        <select value={s2.day_of_week} onChange={e => setS2(p => ({ ...p, day_of_week: parseInt(e.target.value) }))} className={selectCls}>
                                            {DAY_NAMES.map((d, i) => i === 0 ? null : <option key={i} value={i}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Start</label>
                                            <select value={s2.start_time} onChange={e => setS2(p => ({ ...p, start_time: e.target.value }))} disabled={autoFillingS2} className={selectCls}>
                                                <option value="">--</option>
                                                {TIME_SLOTS.filter(t => t !== '21:00').map(t => <option key={t} value={t}>{formatTimeDisplay(t)}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">
                                                End{s2.start_time && s2.end_time && <span className="ml-1 text-slate-500">{formatDuration(s2.start_time, s2.end_time)}</span>}
                                            </label>
                                            <select value={s2.end_time} onChange={e => setS2(p => ({ ...p, end_time: e.target.value }))} disabled={autoFillingS2} className={selectCls}>
                                                <option value="">--</option>
                                                {TIME_SLOTS.filter(t => t !== '07:00' && (!s2.start_time || t > s2.start_time)).map(t => <option key={t} value={t}>{formatTimeDisplay(t)}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Room</label>
                                        <FacilitySelect
                                            dayOfWeek={s2.day_of_week} startTime={s2.start_time} endTime={s2.end_time}
                                            excludeEntryId={entry.id} value={s2.facility_name_raw}
                                            onChange={v => setS2(p => ({ ...p, facility_name_raw: v }))}
                                            className={selectCls}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Duration summary */}
                            {totalMins > 0 && (
                                <div className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs border',
                                    durationOk === true ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        : durationOk === false ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                            : 'bg-white/5 border-white/10 text-slate-400'
                                )}>
                                    <span>
                                        {formatDuration(s1.start_time, s1.end_time) || '—'} + {formatDuration(s2.start_time, s2.end_time) || '—'} = <strong>{totalLabel}</strong>
                                        {expectedHours && durationOk === true && <span className="inline-flex items-center gap-1"> <Check className="w-3 h-3 text-green-500" /> matches expected</span>}
                                        {expectedHours && durationOk === false && <span className="inline-flex items-center gap-1"> <AlertTriangle className="w-3 h-3 text-amber-500" /> expected {expectedHours}h total</span>}
                                    </span>
                                </div>
                            )}

                            {splitError && (
                                <p className="text-xs text-red-400">{splitError}</p>
                            )}

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleSplit}
                                    disabled={splitting}
                                    className="px-4 py-2 bg-ah-sti-cyan hover:bg-ah-sti-cyan/80 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                >
                                    {splitting ? 'Splitting…' : 'Confirm Split'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
