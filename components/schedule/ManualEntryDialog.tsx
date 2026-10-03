'use client'

/**
 * ManualEntryDialog — Modal for adding a single schedule entry manually.
 * Uses searchable comboboxes backed by live data (courses, facilities,
 * instructors, prior sections) with a typed-fallback for values not yet in
 * the system.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { X, Plus, Clock, BookOpen, Users, MapPin, AlertTriangle, Loader2 } from 'lucide-react'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'

const DAY_OPTIONS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' },
]

interface ManualEntry {
    course_code: string
    course_name: string
    section: string
    instructor: string
    room: string
    session_type: string
    day_of_week: number
    start_time: string
    end_time: string
}

interface ManualEntryDialogProps {
    open: boolean
    onClose: () => void
    onSubmit: (entry: ManualEntry) => void
    /** Entries already added to the current upload batch (for in-batch overlap detection). */
    existingEntries?: ManualEntry[]
}

interface ConflictRow {
    source: 'live' | 'pending' | 'batch'
    match: 'room' | 'instructor' | 'section'
    course_code: string
    course_name: string | null
    section: string
    room: string | null
    instructor: string | null
    day_of_week: number
    start_time: string
    end_time: string
    department_code?: string | null
}

interface CourseRow {
    course_code: string
    course_name: string
    department_code?: string | null
}
interface FacilityRow {
    id: string
    code: string | null
    name: string
    room_number: string | null
}
interface InstructorRow {
    id: string
    full_name: string
    employee_id: string | null
    department_code: string | null
}

const EMPTY_FORM: ManualEntry = {
    course_code: '',
    course_name: '',
    section: '',
    instructor: '',
    room: '',
    session_type: '',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '09:00',
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string) {
    return s1 < e2 && e1 > s2
}

function isMeaningful(v?: string | null) {
    if (!v) return false
    const upper = v.toUpperCase().trim()
    return upper.length > 0 && upper !== 'TBD' && upper !== 'TBA' && upper !== 'NONE'
}

export function ManualEntryDialog({ open, onClose, onSubmit, existingEntries = [] }: ManualEntryDialogProps) {
    const [form, setForm] = useState<ManualEntry>(EMPTY_FORM)
    const [errors, setErrors] = useState<string[]>([])

    // Reference data — fetched once per dialog open
    const [courses, setCourses] = useState<CourseRow[]>([])
    const [facilities, setFacilities] = useState<FacilityRow[]>([])
    const [instructors, setInstructors] = useState<InstructorRow[]>([])
    const [refLoading, setRefLoading] = useState(false)

    // Section typeahead — refetched per course
    const [sections, setSections] = useState<string[]>([])
    const [sectionsLoading, setSectionsLoading] = useState(false)

    // True when the course was picked from the dropdown (locks the name field)
    const [courseFromList, setCourseFromList] = useState(false)

    // Conflict preview
    const [serverConflicts, setServerConflicts] = useState<ConflictRow[]>([])
    const [conflictsLoading, setConflictsLoading] = useState(false)

    useEffect(() => {
        if (!open) return
        let cancelled = false
        setRefLoading(true)
        Promise.all([
            fetch('/api/courses?approval_status=approved&limit=500').then(r => r.ok ? r.json() : { courses: [] }),
            fetch('/api/facilities').then(r => r.ok ? r.json() : { facilities: [] }),
            fetch('/api/instructors').then(r => r.ok ? r.json() : { instructors: [] }),
        ]).then(([c, f, i]) => {
            if (cancelled) return
            setCourses(c.courses ?? [])
            setFacilities(f.facilities ?? [])
            setInstructors(i.instructors ?? [])
        }).catch(() => {
            if (!cancelled) {
                setCourses([]); setFacilities([]); setInstructors([])
            }
        }).finally(() => {
            if (!cancelled) setRefLoading(false)
        })
        return () => { cancelled = true }
    }, [open])

    // Section history — refetch when the course changes
    useEffect(() => {
        if (!open || !form.course_code.trim()) {
            setSections([])
            return
        }
        let cancelled = false
        setSectionsLoading(true)
        fetch(`/api/schedules/sections?courseCode=${encodeURIComponent(form.course_code)}`)
            .then(r => r.ok ? r.json() : { sections: [] })
            .then(d => { if (!cancelled) setSections(d.sections ?? []) })
            .catch(() => { if (!cancelled) setSections([]) })
            .finally(() => { if (!cancelled) setSectionsLoading(false) })
        return () => { cancelled = true }
    }, [open, form.course_code])

    // Server-side conflict preview against live class_schedules + pending staging entries.
    // Debounced so we don't fire on every keystroke.
    useEffect(() => {
        if (!open) { setServerConflicts([]); return }
        const { day_of_week, start_time, end_time, room, instructor, section } = form
        const haveKey = isMeaningful(room) || isMeaningful(instructor) || isMeaningful(section)
        if (!haveKey || !start_time || !end_time || start_time >= end_time) {
            setServerConflicts([])
            return
        }
        let cancelled = false
        const handle = setTimeout(() => {
            setConflictsLoading(true)
            fetch('/api/schedules/conflicts/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day_of_week, start_time, end_time, room, instructor, section }),
            })
                .then(r => r.ok ? r.json() : { conflicts: [] })
                .then(d => { if (!cancelled) setServerConflicts(d.conflicts ?? []) })
                .catch(() => { if (!cancelled) setServerConflicts([]) })
                .finally(() => { if (!cancelled) setConflictsLoading(false) })
        }, 350)
        return () => { cancelled = true; clearTimeout(handle) }
    }, [open, form.day_of_week, form.start_time, form.end_time, form.room, form.instructor, form.section])

    // In-batch conflicts: compare against other entries already added in this upload session.
    const batchConflicts: ConflictRow[] = useMemo(() => {
        if (!open) return []
        const { day_of_week, start_time, end_time, room, instructor, section } = form
        if (!start_time || !end_time || start_time >= end_time) return []
        const out: ConflictRow[] = []
        for (const e of existingEntries) {
            if (e.day_of_week !== day_of_week) continue
            if (!timesOverlap(start_time, end_time, e.start_time, e.end_time)) continue
            let match: 'room' | 'instructor' | 'section' | null = null
            if (isMeaningful(room) && isMeaningful(e.room) && e.room === room) match = 'room'
            else if (isMeaningful(instructor) && isMeaningful(e.instructor) && e.instructor === instructor) match = 'instructor'
            else if (isMeaningful(section) && isMeaningful(e.section) && e.section === section) match = 'section'
            if (!match) continue
            out.push({
                source: 'batch',
                match,
                course_code: e.course_code,
                course_name: e.course_name || null,
                section: e.section,
                room: e.room || null,
                instructor: e.instructor || null,
                day_of_week: e.day_of_week,
                start_time: e.start_time,
                end_time: e.end_time,
            })
        }
        return out
    }, [open, existingEntries, form])

    const allConflicts: ConflictRow[] = useMemo(
        () => [...batchConflicts, ...serverConflicts],
        [batchConflicts, serverConflicts],
    )

    const courseOptions: ComboboxOption[] = useMemo(() => courses.map(c => ({
        value: c.course_code,
        label: c.course_code,
        sublabel: c.course_name,
        keywords: c.course_name,
    })), [courses])

    const facilityOptions: ComboboxOption[] = useMemo(() => facilities.map(f => ({
        value: f.code ?? f.name,
        label: f.code ?? f.name,
        sublabel: f.room_number ? `${f.name} · Room ${f.room_number}` : f.name,
        keywords: f.name,
    })), [facilities])

    const instructorOptions: ComboboxOption[] = useMemo(() => instructors.map(i => ({
        value: i.full_name,
        label: i.full_name,
        sublabel: [i.employee_id, i.department_code].filter(Boolean).join(' · ') || undefined,
    })), [instructors])

    const sectionOptions: ComboboxOption[] = useMemo(() => sections.map(s => ({
        value: s,
        label: s,
    })), [sections])

    const onCourseChange = useCallback((nextCode: string) => {
        const match = courses.find(c => c.course_code === nextCode)
        setForm(prev => ({
            ...prev,
            course_code: nextCode,
            course_name: match?.course_name ?? '',
            section: '',
        }))
        setCourseFromList(Boolean(match))
        setErrors([])
    }, [courses])

    if (!open) return null

    const clearCourse = () => {
        setForm(prev => ({ ...prev, course_code: '', course_name: '', section: '' }))
        setCourseFromList(false)
    }

    const update = <K extends keyof ManualEntry>(field: K, value: ManualEntry[K]) => {
        setForm(prev => ({ ...prev, [field]: value }))
        setErrors([])
    }

    const validate = (): boolean => {
        const e: string[] = []
        if (!form.course_code.trim()) e.push('Course code is required')
        if (!form.section.trim()) e.push('Section is required')
        if (!form.room.trim()) e.push('Room is required')
        if (!form.start_time || !form.end_time) e.push('Time range is required')
        if (form.start_time >= form.end_time) e.push('End time must be after start time')
        setErrors(e)
        return e.length === 0
    }

    const handleSubmit = () => {
        if (!validate()) return
        if (allConflicts.length > 0) {
            const ok = window.confirm(
                `This entry overlaps ${allConflicts.length} existing schedule${allConflicts.length === 1 ? '' : 's'}. Add anyway? You can resolve conflicts on the review page.`,
            )
            if (!ok) return
        }
        onSubmit(form)
        setForm(EMPTY_FORM)
        setCourseFromList(false)
        setSections([])
        setServerConflicts([])
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a2332] border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Plus className="h-5 w-5 text-ah-sti-cyan" />
                        Add Manual Entry
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                    {errors.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 space-y-1">
                            {errors.map((e, i) => <p key={i}>• {e}</p>)}
                        </div>
                    )}

                    <ConflictPanel
                        conflicts={allConflicts}
                        loading={conflictsLoading}
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                <span className="flex items-center gap-1">
                                    <BookOpen className="h-3 w-3" /> Course Code *
                                </span>
                                {courseFromList && (
                                    <button
                                        type="button"
                                        onClick={clearCourse}
                                        className="text-[10px] text-ah-sti-cyan hover:underline"
                                    >
                                        clear
                                    </button>
                                )}
                            </label>
                            <Combobox
                                value={form.course_code}
                                onChange={onCourseChange}
                                options={courseOptions}
                                placeholder="Pick or type code"
                                searchPlaceholder="Search courses…"
                                emptyMessage="No courses match."
                                allowCustom
                                loading={refLoading}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                <BookOpen className="h-3 w-3" /> Course Name
                            </label>
                            <input
                                value={form.course_name}
                                onChange={e => update('course_name', e.target.value)}
                                placeholder={courseFromList ? '' : 'e.g. Intro to IT'}
                                disabled={courseFromList}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-600 outline-none focus:border-ah-sti-cyan/50 disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                <Users className="h-3 w-3" /> Section *
                            </label>
                            <Combobox
                                value={form.section}
                                onChange={v => update('section', v)}
                                options={sectionOptions}
                                placeholder={form.course_code ? 'Pick or type section' : 'Pick a course first'}
                                searchPlaceholder="Search or type new section…"
                                emptyMessage={form.course_code ? 'No prior sections — type to add.' : 'Pick a course first.'}
                                allowCustom
                                loading={sectionsLoading}
                                disabled={!form.course_code.trim()}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                <Users className="h-3 w-3" /> Instructor
                            </label>
                            <Combobox
                                value={form.instructor}
                                onChange={v => update('instructor', v)}
                                options={instructorOptions}
                                placeholder="Pick or type instructor"
                                searchPlaceholder="Search instructors…"
                                emptyMessage="No instructors match."
                                allowCustom
                                loading={refLoading}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                <MapPin className="h-3 w-3" /> Room / Facility *
                            </label>
                            <Combobox
                                value={form.room}
                                onChange={v => update('room', v)}
                                options={facilityOptions}
                                placeholder="Pick or type room"
                                searchPlaceholder="Search rooms…"
                                emptyMessage="No rooms match."
                                allowCustom
                                loading={refLoading}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                <MapPin className="h-3 w-3" /> Session Type
                            </label>
                            <select
                                value={form.session_type}
                                onChange={e => update('session_type', e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-ah-sti-cyan/50 appearance-none"
                            >
                                <option value="" className="bg-slate-900">Auto-detect</option>
                                <option value="lecture" className="bg-slate-900">Lecture (LEC)</option>
                                <option value="lab" className="bg-slate-900">Laboratory (LAB)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Day *</label>
                            <select
                                value={form.day_of_week}
                                onChange={e => update('day_of_week', parseInt(e.target.value))}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-ah-sti-cyan/50"
                            >
                                {DAY_OPTIONS.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                <Clock className="h-3 w-3" /> Start *
                            </label>
                            <input
                                type="time"
                                value={form.start_time}
                                onChange={e => update('start_time', e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-ah-sti-cyan/50"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                <Clock className="h-3 w-3" /> End *
                            </label>
                            <input
                                type="time"
                                value={form.end_time}
                                onChange={e => update('end_time', e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-ah-sti-cyan/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className={
                            allConflicts.length > 0
                                ? 'px-5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm font-medium border border-amber-500/30 transition-colors flex items-center gap-2'
                                : 'px-5 py-2 bg-ah-sti-cyan/20 hover:bg-ah-sti-cyan/30 text-ah-sti-cyan rounded-lg text-sm font-medium border border-ah-sti-cyan/30 transition-colors flex items-center gap-2'
                        }
                    >
                        {allConflicts.length > 0
                            ? <><AlertTriangle className="h-4 w-4" /> Add Anyway ({allConflicts.length})</>
                            : <><Plus className="h-4 w-4" /> Add Entry</>}
                    </button>
                </div>
            </div>
        </div>
    )
}

const DAY_LABEL: Record<number, string> = {
    0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
}
const SOURCE_LABEL: Record<ConflictRow['source'], string> = {
    live: 'Live schedule',
    pending: 'Pending upload',
    batch: 'This batch',
}
const MATCH_LABEL: Record<ConflictRow['match'], string> = {
    room: 'same room',
    instructor: 'same instructor',
    section: 'same section',
}

function ConflictPanel({ conflicts, loading }: { conflicts: ConflictRow[]; loading: boolean }) {
    if (loading) {
        return (
            <div className="bg-white/[0.02] border border-white/10 rounded-lg p-3 text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for overlaps…
            </div>
        )
    }
    if (conflicts.length === 0) return null
    return (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {conflicts.length} overlap{conflicts.length === 1 ? '' : 's'} detected
            </p>
            <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                {conflicts.map((c, i) => (
                    <li key={i} className="text-[11px] text-amber-100/90 leading-snug">
                        <span className="font-mono">{c.course_code}</span>
                        {c.section && <> · {c.section}</>}
                        {c.room && <> · {c.room}</>}
                        {c.instructor && <> · {c.instructor}</>}
                        <span className="text-amber-200/70">
                            {' '}({DAY_LABEL[c.day_of_week] ?? c.day_of_week} {c.start_time}–{c.end_time})
                        </span>
                        <span className="ml-1 text-amber-300/70">
                            — {SOURCE_LABEL[c.source]}, {MATCH_LABEL[c.match]}
                            {c.department_code ? ` · ${c.department_code}` : ''}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
