"use client"

import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useAcademicBooking } from '@/hooks/academic-head/useAcademicBooking'
import { useToast } from '@/hooks/use-toast'
import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import {
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    MapPin,
    Clock,
    Loader2,
    Calendar,
    Users as UsersIcon,
    Info,
    ArrowRight,
    Check,
    FileText,
    X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { TimeSlotPicker } from '@/components/ui/TimeSlotPicker'
import { ROUTES } from '@/lib/routes'
import { FacilityInfoButton } from '@/components/shared/facilities/FacilityInfoButton'
import { FacilityRowThumbnail } from '@/components/shared/facilities/FacilityRowThumbnail'
import { useFacilityCatalogLookup } from '@/hooks/shared/useFacilityCatalogLookup'
import { FacilityCatalog } from '@/components/shared/facilities/FacilityCatalog'
import { formatTime } from '@/lib/formatTime'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'


const BOOKING_PURPOSES = [
    { value: 'academic', label: 'Academic / Class' },
    { value: 'school_event', label: 'School Event' },
    { value: 'department_use', label: 'Department Use' },
]

function AcademicReservePageInner() {
    const router = useRouter()
    const { toast } = useToast()
    const {
        facilities,
        formData,
        updateField,
        durationMinutes,
        availability,
        loadingFacilities,
        loadingAvailability,
        loadingCourses,
        submitting,
        submitResult,
        submitError,
        validationErrors,
        selectedFacility,
        departmentCourses,
        selectedDeptCourses,
        selectedCourseDeliveryMode,
        facilityMismatchWarning,
        facilityMatchGood,
        submit,
        reset,
        activeTerm,
    } = useAcademicBooking()

    // Success handling
    useEffect(() => {
        if (!submitResult) return
        if (['auto_approved', 'flagged', 'approved', 'routed_to_manual'].includes(submitResult.status)) {
            const isApproved = ['auto_approved', 'approved'].includes(submitResult.status)
            toast({
                title: isApproved ? 'Booking Approved!' : 'Booking Submitted',
                description: submitResult.booking_reference
                    ? `Reference: ${submitResult.booking_reference}`
                    : 'Your booking is under review.',
                className: isApproved
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : undefined,
            })
            setTimeout(() => router.push(ROUTES.academic.dashboard), 1500)
        }
    }, [submitResult, router, toast])

    const [facilityOpen, setFacilityOpen] = useState(false)
    const [facilitySearch, setFacilitySearch] = useState('')
    const [pageTab, setPageTab] = useState<'form' | 'browse'>('form')
    const facilityLookup = useFacilityCatalogLookup()
    const facilityRef = useRef<HTMLDivElement>(null)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

    // QuickFill prefill state
    const searchParams = useSearchParams()
    const [estimatedScore, setEstimatedScore] = useState<number | null>(null)
    const [prefillNotes, setPrefillNotes] = useState<string | null>(null)
    const [prefillAttempted, setPrefillAttempted] = useState(false)
    const [pendingPrefill, setPendingPrefill] = useState<Record<string, any> | null>(null)
    const facilityAppliedRef = useRef(false)
    const coursesAppliedRef = useRef(false)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (facilityRef.current && !facilityRef.current.contains(e.target as Node)) {
                setFacilityOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Filter facilities based on search text
    const filteredFacilities = useMemo(() => {
        const q = facilitySearch.toLowerCase().trim()
        if (!q) return facilities
        return facilities.filter(f =>
            f.name.toLowerCase().includes(q) ||
            (f.room_number && f.room_number.toLowerCase().includes(q)) ||
            String(f.capacity).includes(q) ||
            (f.floors?.buildings?.name && f.floors.buildings.name.toLowerCase().includes(q))
        )
    }, [facilitySearch, facilities])

    // QuickFill: read ?prefill= param and populate form fields
    useEffect(() => {
        const prefillParam = searchParams.get('prefill')
        if (!prefillParam) return
        try {
            const prefill = JSON.parse(decodeURIComponent(prefillParam))
            if (prefill.facility_search_term && !prefill.facility_id) {
                setFacilitySearch(prefill.facility_search_term)
                setFacilityOpen(true)
            }
            if (prefill.booking_date)       updateField('booking_date', prefill.booking_date)
            if (prefill.start_time)         updateField('start_time', prefill.start_time)
            if (prefill.end_time)           updateField('end_time', prefill.end_time)
            if (prefill.booking_purpose)    updateField('booking_purpose', prefill.booking_purpose)
            if (prefill.expected_attendees) updateField('expected_attendees', prefill.expected_attendees)
            if (prefill.purpose_statement)  updateField('purpose', prefill.purpose_statement)
            if (prefill.special_requests)   updateField('special_requests', prefill.special_requests)
            if (typeof prefill.estimated_score === 'number') setEstimatedScore(prefill.estimated_score)
            if (prefill.notes) setPrefillNotes(prefill.notes)
            setPendingPrefill(prefill)
            setPrefillAttempted(true)
        } catch {
            console.warn('[QuickFill] Malformed prefill param, ignoring')
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    // Apply facility_id prefill once facilities have loaded
    useEffect(() => {
        if (facilityAppliedRef.current) return
        if (!pendingPrefill || loadingFacilities) return

        let match: typeof facilities[number] | undefined

        // 1. Try exact id match (most reliable)
        const wantedId = pendingPrefill.facility_id
        if (wantedId && typeof wantedId === 'string') {
            match = facilities.find(f => f.id === wantedId)
        }

        // 2. Fall back to name match
        if (!match) {
            const wantedName = pendingPrefill.facility_search_term
            if (wantedName && typeof wantedName === 'string') {
                const normalized = wantedName.toLowerCase().trim()
                match = facilities.find(f => f.name.toLowerCase() === normalized)
                    ?? facilities.find(f => f.name.toLowerCase().includes(normalized))
                    ?? facilities.find(f => normalized.includes(f.name.toLowerCase()))
            }
        }

        if (match) {
            updateField('facility_id', match.id)
            setFacilitySearch(`${match.name}${match.room_number ? ` (${match.room_number})` : ''}`)
            setFacilityOpen(false)
        }

        facilityAppliedRef.current = true
    }, [facilities, loadingFacilities, pendingPrefill, updateField])

    // Apply department / course / session_type prefill once course data has loaded
    useEffect(() => {
        if (coursesAppliedRef.current) return
        if (!pendingPrefill || loadingCourses) return
        const deptCode = pendingPrefill.department
        const courseCode = pendingPrefill.course
        const sessionType = pendingPrefill.session_type

        if (deptCode && typeof deptCode === 'string') {
            const dept = departmentCourses.find(d => d.department_code === deptCode)
            if (dept) {
                updateField('booking_department_code', dept.department_code)
                if (courseCode && typeof courseCode === 'string') {
                    const course = dept.courses.find(c => c.course_code === courseCode)
                    if (course) {
                        updateField('booking_course_code', course.course_code)
                        if (course.delivery_mode === 'both' && (sessionType === 'lecture' || sessionType === 'lab')) {
                            updateField('session_type', sessionType)
                        }
                    }
                }
            }
        }
        coursesAppliedRef.current = true
    }, [departmentCourses, loadingCourses, pendingPrefill, updateField])

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
            <style>{`
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(19,64,116,.3) transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(19,64,116,.3); border-radius: 9999px; }
      `}</style>

            <main className="max-w-7xl mx-auto space-y-6">
                <Tabs value={pageTab} onValueChange={v => setPageTab(v as 'form' | 'browse')}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Privileged <span className="text-accent-brand">Reservation</span></h1>
                        <p className="text-xs font-medium text-muted-foreground mt-1 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-primary" />
                            Academic Head bookings for STI College Lucena are automatically approved.
                        </p>
                    </div>
                    <TabsList className="bg-muted p-1 rounded-xl">
                        <TabsTrigger value="form" className="rounded-lg text-xs font-semibold">New Reservation</TabsTrigger>
                        <TabsTrigger value="browse" className="rounded-lg text-xs font-semibold">Browse Facilities</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="browse" className="mt-6">
                    <FacilityCatalog
                    onReserveSelect={(facility) => {
                        updateField('facility_id', facility.id)
                        setFacilitySearch(`${facility.name}${facility.roomNumber ? ` (${facility.roomNumber})` : ''}`)
                        setPageTab('form')
                    }}
                    />
                </TabsContent>

                <TabsContent value="form" className="mt-6 space-y-6">
                {/* QuickFill Score Banner */}
                {estimatedScore !== null && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                <span className="text-xs font-bold text-foreground">Quick-Fill Applied</span>
                            </div>
                            <span className={cn(
                                "text-xs font-semibold",
                                estimatedScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : estimatedScore >= 35 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                            )}>
                                {estimatedScore}/100 —{' '}
                                {estimatedScore >= 80 ? 'Will auto-approve' : estimatedScore >= 35 ? 'Needs review' : 'Likely declined'}
                            </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                            <div
                                className={cn("h-1.5 rounded-full transition-all duration-500", estimatedScore >= 80 ? 'bg-emerald-500' : estimatedScore >= 35 ? 'bg-amber-500' : 'bg-rose-500')}
                                style={{ width: `${estimatedScore}%` }}
                            />
                        </div>
                        {prefillNotes && <p className="text-xs text-muted-foreground mb-1">{prefillNotes}</p>}
                        <p className="text-[11px] text-muted-foreground">*Estimated score. Actual score calculated on submit.</p>
                    </div>
                )}

                {/* Facility confirmation warning */}
                {prefillAttempted && !formData.facility_id && searchParams.get('prefill') && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Facility suggestion pre-filled — please select from the dropdown to confirm your facility.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <section className="bg-card rounded-2xl border border-border p-6 shadow-xs space-y-6">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/50 pb-4">
                                <Calendar className="w-4 h-4 text-primary" />
                                Reservation Details
                            </h2>

                            <div className="space-y-5">
                                {/* Facility Selection */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Facility Selection <span className="text-destructive">*</span>
                                        </label>
                                        {loadingFacilities ? (
                                            <div className="h-10 rounded-xl bg-muted animate-pulse border border-border" />
                                        ) : (
                                            <div className="relative" ref={facilityRef}>
                                                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                                                <input
                                                    type="text"
                                                    value={facilitySearch}
                                                    onChange={e => {
                                                        setFacilitySearch(e.target.value)
                                                        setFacilityOpen(true)
                                                        if (formData.facility_id) {
                                                            updateField('facility_id', '')
                                                        }
                                                    }}
                                                    onFocus={() => setFacilityOpen(true)}
                                                    placeholder="Type to search rooms... e.g. Lab, MPH"
                                                    className={cn(
                                                        "flex h-10 w-full rounded-xl border border-border bg-background pl-10 pr-10 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:text-muted-foreground/60",
                                                        validationErrors.facility_id && "border-destructive ring-destructive"
                                                    )}
                                                    autoComplete="off"
                                                    aria-required="true"
                                                />
                                                {formData.facility_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            updateField('facility_id', '')
                                                            setFacilitySearch('')
                                                            setFacilityOpen(false)
                                                        }}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {facilityOpen && (
                                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                                                        {filteredFacilities.length === 0 ? (
                                                            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                                                                No facilities match &quot;{facilitySearch}&quot;
                                                            </div>
                                                        ) : (
                                                            filteredFacilities.map(f => {
                                                                const isSelected = formData.facility_id === f.id
                                                                return (
                                                                    <button
                                                                        key={f.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            updateField('facility_id', f.id)
                                                                            setFacilitySearch(`${f.name}${f.room_number ? ` (${f.room_number})` : ''}`)
                                                                            setFacilityOpen(false)
                                                                        }}
                                                                        className={cn(
                                                                            "flex w-full items-center gap-3 px-3.5 py-2 text-left text-xs transition-colors hover:bg-muted/50",
                                                                            isSelected && "bg-muted/80 font-bold text-foreground"
                                                                        )}
                                                                    >
                                                                        <FacilityRowThumbnail
                                                                          coverPhotoUrl={facilityLookup.get(f.id)?.coverPhotoUrl}
                                                                          facilityTypeName={facilityLookup.get(f.id)?.facilityTypeName}
                                                                          hasActiveWarning={facilityLookup.get(f.id)?.hasActiveWarning}
                                                                        />
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={cn("font-semibold truncate", isSelected && "text-foreground font-bold")}>
                                                                                {f.name} {f.room_number ? `(${f.room_number})` : ''}
                                                                            </p>
                                                                            <p className="text-[11px] text-muted-foreground">
                                                                                Capacity: {f.capacity}
                                                                                {f.floors?.buildings?.name ? ` · ${f.floors.buildings.name}` : ''}
                                                                            </p>
                                                                        </div>
                                                                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                                                                    </button>
                                                                )
                                                            })
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {validationErrors.facility_id && (
                                            <p className="mt-1.5 text-xs text-destructive font-semibold">{validationErrors.facility_id}</p>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-semibold text-foreground">
                                                Capacity
                                            </label>
                                            <FacilityInfoButton
                                                facility={selectedFacility ? {
                                                    id: selectedFacility.id,
                                                    name: selectedFacility.name,
                                                    capacity: selectedFacility.capacity,
                                                    buildingName: selectedFacility.floors?.buildings?.name,
                                                    facilityTypeName: selectedFacility.facility_types?.name,
                                                    amenities: facilityLookup.get(selectedFacility.id)?.amenities,
                                                } : null}
                                            />
                                        </div>
                                        <div className="h-10 px-3.5 rounded-xl bg-muted/40 border border-border flex items-center gap-2 text-xs font-semibold text-foreground select-none">
                                            <UsersIcon className="w-4 h-4 text-muted-foreground" />
                                            {selectedFacility ? `${selectedFacility.capacity} Pax` : '—'}
                                        </div>
                                    </div>
                                </div>

                                {/* Personal use gymnasium banner */}
                                {(() => {
                                    const isGym = selectedFacility && (
                                        selectedFacility.name.toLowerCase().includes('gym') ||
                                        (selectedFacility as any).facility_types?.name?.toLowerCase().includes('gym')
                                    )
                                    if (!isGym) return null
                                    return (
                                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Booking Gymnasium for personal use?</p>
                                                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                                                    Personal or commercial use requires building head approval and payment. Use this form for academic purposes only.
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="shrink-0 font-semibold text-xs h-8 px-3 rounded-lg"
                                                onClick={() => router.push(`/internal/personal-gym-booking?facility_id=${selectedFacility.id}&returnUrl=/academic/dashboard`)}
                                            >
                                                Book Personal
                                                <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                            </Button>
                                        </div>
                                    )
                                })()}

                                {/* Reservation Date */}
                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                                        Reservation Date <span className="text-destructive">*</span>
                                    </label>
                                    {activeTerm && (
                                        <p className="mb-1.5 text-xs text-muted-foreground flex items-center gap-1">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                                            {activeTerm.term_name} &mdash; {activeTerm.start_date} to {activeTerm.end_date}
                                        </p>
                                    )}
                                    <div className="relative">
                                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            type="date"
                                            min={activeTerm && !['school_event','personal','commercial','community'].includes(formData.booking_purpose) ? activeTerm.start_date : today}
                                            max={activeTerm && !['school_event','personal','commercial','community'].includes(formData.booking_purpose) ? activeTerm.end_date : undefined}
                                            value={formData.booking_date}
                                            onChange={e => updateField('booking_date', e.target.value)}
                                            className={cn("pl-10 h-10 rounded-xl bg-background border-border text-xs text-foreground", validationErrors.booking_date && "border-destructive")}
                                            aria-required="true"
                                        />
                                    </div>
                                    {validationErrors.booking_date && (
                                        <p className="mt-1.5 text-xs text-destructive font-semibold">{validationErrors.booking_date}</p>
                                    )}
                                </div>

                                {/* Time Pickers */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <TimeSlotPicker
                                        label="Select Start Time"
                                        value={formData.start_time}
                                        onChange={(t) => updateField('start_time', t)}
                                        blockedRanges={availability?.blocked_ranges}
                                        onBlockedClick={(reason) => updateField('start_time', '', reason)}
                                        error={validationErrors.start_time}
                                    />
                                    <TimeSlotPicker
                                        label="Select End Time"
                                        value={formData.end_time}
                                        onChange={(t) => updateField('end_time', t)}
                                        blockedRanges={availability?.blocked_ranges}
                                        onBlockedClick={(reason) => updateField('end_time', '', reason)}
                                        minTime={formData.start_time}
                                        error={validationErrors.end_time}
                                    />
                                </div>
                                {durationMinutes > 0 && (
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        Duration: {Math.floor(durationMinutes / 60) > 0 ? `${Math.floor(durationMinutes / 60)}h ` : ''}{durationMinutes % 60 > 0 ? `${durationMinutes % 60}m` : ''}
                                    </p>
                                )}

                                {/* Classification + Attendees */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Booking Purpose <span className="text-destructive">*</span>
                                        </label>
                                        <select
                                            value={formData.booking_purpose}
                                            onChange={e => updateField('booking_purpose', e.target.value)}
                                            className="flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:ring-2 focus:ring-primary outline-none"
                                            aria-required="true"
                                        >
                                            {BOOKING_PURPOSES.map(p => (
                                                <option key={p.value} value={p.value}>{p.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Expected Attendees
                                        </label>
                                        <div className="relative">
                                            <UsersIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                placeholder="e.g. 40"
                                                value={formData.expected_attendees}
                                                onChange={e => updateField('expected_attendees', e.target.value)}
                                                className={cn("pl-10 h-10 rounded-xl bg-background border-border text-xs text-foreground", validationErrors.expected_attendees && "border-destructive")}
                                            />
                                        </div>
                                        {validationErrors.expected_attendees && (
                                            <p className="mt-1 text-xs text-destructive font-semibold">{validationErrors.expected_attendees}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Course Information */}
                                {formData.booking_purpose === 'academic' && (
                                    <div className="space-y-3 pt-2">
                                        <h3 className="text-xs font-bold text-muted-foreground">
                                            Course Information <span className="font-normal">(Optional)</span>
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-foreground mb-1">Department</label>
                                                <select
                                                    value={formData.booking_department_code}
                                                    onChange={e => updateField('booking_department_code', e.target.value)}
                                                    disabled={loadingCourses}
                                                    className="flex h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:ring-2 focus:ring-primary outline-none"
                                                >
                                                    <option value="">Select department</option>
                                                    {departmentCourses.map(d => (
                                                        <option key={d.department_code} value={d.department_code}>
                                                            {d.department_name} ({d.department_code})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-foreground mb-1">Course</label>
                                                <select
                                                    value={formData.booking_course_code}
                                                    onChange={e => updateField('booking_course_code', e.target.value)}
                                                    disabled={!formData.booking_department_code}
                                                    className="flex h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:ring-2 focus:ring-primary outline-none"
                                                >
                                                    <option value="">Select course</option>
                                                    {(() => {
                                                        const assigned = selectedDeptCourses.filter((c: any) => c.is_assigned)
                                                        const other = selectedDeptCourses.filter((c: any) => !c.is_assigned)
                                                        return (
                                                            <>
                                                                {assigned.length > 0 && (
                                                                    <optgroup label="Your Courses">
                                                                        {assigned.map(c => (
                                                                            <option key={c.course_code} value={c.course_code}>
                                                                                {c.course_code} — {c.is_elective && c.elective_type ? c.elective_type : c.course_name}
                                                                            </option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                                {other.length > 0 && (
                                                                    <optgroup label="Other Courses">
                                                                        {other.map(c => (
                                                                            <option key={c.course_code} value={c.course_code}>
                                                                                {c.course_code} — {c.is_elective && c.elective_type ? c.elective_type : c.course_name}
                                                                            </option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                            </>
                                                        )
                                                    })()}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-foreground mb-1">Session Type</label>
                                                <select
                                                    value={formData.session_type}
                                                    onChange={e => updateField('session_type', e.target.value as any)}
                                                    disabled={!formData.booking_course_code || (selectedCourseDeliveryMode !== 'both')}
                                                    className={cn("flex h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:ring-2 focus:ring-primary outline-none", validationErrors.session_type && "border-destructive")}
                                                >
                                                    {selectedCourseDeliveryMode === 'both' ? (
                                                        <>
                                                            <option value="">Select session type</option>
                                                            <option value="lecture">Lecture</option>
                                                            <option value="lab">Lab</option>
                                                        </>
                                                    ) : formData.session_type ? (
                                                        <option value={formData.session_type}>{formData.session_type === 'lecture' ? 'Lecture' : 'Lab'}</option>
                                                    ) : (
                                                        <option value="">Auto-detected</option>
                                                    )}
                                                </select>
                                                {validationErrors.session_type && (
                                                    <p className="mt-1 text-xs text-destructive font-semibold">{validationErrors.session_type}</p>
                                                )}
                                            </div>
                                        </div>
                                        {facilityMismatchWarning && (
                                            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">{facilityMismatchWarning}</p>
                                            </div>
                                        )}
                                        {facilityMatchGood && (
                                            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Facility matches session type — ready to reserve.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="pt-4 border-t border-border/50 space-y-4">
                                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-primary" />
                                        Event Details
                                    </h3>

                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Purpose Statement <span className="text-destructive">*</span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={formData.purpose}
                                            onChange={e => updateField('purpose', e.target.value)}
                                            placeholder="Describe why this reservation is necessary..."
                                            className={cn(
                                                "flex min-h-[90px] w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:text-muted-foreground/60",
                                                validationErrors.purpose && "border-destructive ring-destructive"
                                            )}
                                        />
                                        <div className="flex items-start justify-between gap-2 mt-1">
                                            {validationErrors.purpose ? (
                                                <p className="text-xs text-destructive font-semibold">{validationErrors.purpose}</p>
                                            ) : <span />}
                                            <span className={cn('text-xs shrink-0 ml-auto font-medium', formData.purpose.trim().length >= 10 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground')}>
                                                {formData.purpose.trim().length}/10 min
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Special Requests <span className="font-normal text-muted-foreground">(Optional)</span>
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={formData.special_requests}
                                            onChange={e => updateField('special_requests', e.target.value)}
                                            placeholder="e.g. Need additional chairs or specific audio setup"
                                            className="flex min-h-[70px] w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:text-muted-foreground/60"
                                        />
                                    </div>
                                </div>

                                {submitError && (
                                    <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                                        <div className="text-xs text-destructive font-semibold">
                                            {submitError}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        onClick={() => router.back()}
                                        className="h-10 px-6 rounded-xl font-semibold text-xs"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={submit}
                                        disabled={submitting}
                                        className="h-10 px-6 rounded-xl font-semibold text-xs shadow-xs flex items-center gap-2"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                Submit Request
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </section>

                        {/* Administrative Policies */}
                        <section className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-3">
                            <h4 className="font-bold text-foreground text-xs">Administrative Policies</h4>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground list-disc list-inside">
                                <li>Privileged users are responsible for facility maintenance.</li>
                                <li>Instant approval is subject to administrative audit.</li>
                                <li>Conflicts must be resolved through official channels.</li>
                                <li>Academic Head oversight applies to all reservations.</li>
                            </ul>
                        </section>
                    </div>

                    {/* Right: Availability + Summary */}
                    <div className="space-y-6 lg:sticky lg:top-6 self-start">

                        {/* Availability Info */}
                        <section className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4">
                            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                Availability Check
                            </h3>

                            {!formData.facility_id || !formData.booking_date ? (
                                <div className="py-10 text-center bg-muted/40 rounded-xl border border-dashed border-border/60">
                                    <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                                    <p className="text-xs text-muted-foreground px-4">
                                        Select room and date to check for conflicts
                                    </p>
                                </div>
                            ) : loadingAvailability ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-10 bg-muted/60 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : availability ? (
                                <div className="space-y-3">
                                    <p className="text-[11px] font-medium text-muted-foreground">
                                        Operating Hours: {formatTime(availability.operating_hours.open)} – {formatTime(availability.operating_hours.close)}
                                    </p>
                                    {availability.blocked_ranges.length > 0 ? (
                                        availability.blocked_ranges.map((block, i) => (
                                            <div key={i} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400">{formatTime(block.start)} - {formatTime(block.end)}</span>
                                                    <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-md">Occupied</span>
                                                </div>
                                                <p className="text-xs text-rose-600 dark:text-rose-300 truncate">{block.reason}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                                            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                                            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Time Slot Available</p>
                                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">No schedule conflicts detected</p>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </section>

                        {/* Reservation Summary */}
                        <section className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4">
                            <h3 className="text-xs font-bold text-foreground flex items-center gap-2 border-b border-border/50 pb-3">
                                <FileText className="w-4 h-4 text-primary" />
                                Reservation Summary
                            </h3>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-medium text-muted-foreground">Facility</span>
                                    <span className="font-semibold text-foreground truncate max-w-[150px]">{selectedFacility?.name || '—'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-medium text-muted-foreground">Date</span>
                                    <span className="font-semibold text-foreground">{formData.booking_date || '—'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-medium text-muted-foreground">Schedule</span>
                                    <span className="font-semibold text-foreground">
                                        {formData.start_time && formData.end_time ? `${formatTime(formData.start_time)} - ${formatTime(formData.end_time)}` : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-medium text-muted-foreground">Type</span>
                                    <span className="font-semibold text-foreground capitalize">
                                        {BOOKING_PURPOSES.find(p => p.value === formData.booking_purpose)?.label || '—'}
                                    </span>
                                </div>

                                <div className="pt-3 border-t border-border/50">
                                    <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                        <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        <div className="text-xs">
                                            <p className="font-bold text-emerald-800 dark:text-emerald-300">Auto-Approval Active</p>
                                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Academic Head Privilege</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
                </TabsContent>
                </Tabs>
            </main>
        </div>
    )
}

export default function AcademicReservePage() {
    return (
        <Suspense>
            <AcademicReservePageInner />
        </Suspense>
    )
}
