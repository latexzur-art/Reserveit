'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle, MapPin, Users as UsersIcon, Check, AlertCircle, CheckCircle, ArrowRight, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimeSlotPicker } from '@/components/ui/TimeSlotPicker'
import type { Facility, DepartmentCourses, DeptCourse, Availability, UseType } from '@/hooks/admin/useReserveForm'
import { FacilityInfoButton } from '@/components/shared/facilities/FacilityInfoButton'
import { FacilityRowThumbnail } from '@/components/shared/facilities/FacilityRowThumbnail'
import { useFacilityCatalogLookup } from '@/hooks/shared/useFacilityCatalogLookup'

function facilityTypeNameOf(f: Facility): string | undefined {
  return Array.isArray(f.facility_types) ? f.facility_types[0]?.name : f.facility_types?.name
}

const SCHOOL_PURPOSE_OPTIONS = [
  { value: 'academic',       label: 'Academic / Class'  },
  { value: 'school_event',   label: 'School Event'      },
  { value: 'department_use', label: 'Department Use'    },
]

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-500">{msg}</p>
}

interface ReserveFormReservationDetailsProps {
  // locked facility
  lockedFacilityName: string | null
  isFacilityLocked: boolean
  // facility search
  loadingFacilities: boolean
  facilitySearch: string
  setFacilitySearch: (v: string) => void
  facilityOpen: boolean
  setFacilityOpen: (v: boolean) => void
  facilityRef: React.RefObject<HTMLDivElement | null>
  facilityId: string
  setFacilityId: (v: string) => void
  filteredFacilities: Facility[]
  // use type
  useType: UseType | null
  setUseType: (v: UseType) => void
  selectedFacility: Facility | null
  isRentable: boolean
  showSchoolForm: boolean
  // school fields
  today: string
  bookingDate: string
  setBookingDate: (v: string) => void
  expectedAttendees: string
  setExpectedAttendees: (v: string) => void
  availability: Availability | null
  startTime: string
  setStartTime: (v: string) => void
  endTime: string
  setEndTime: (v: string) => void
  bookingPurpose: string
  setBookingPurpose: (v: string) => void
  // course info
  loadingCourses: boolean
  departmentCourses: DepartmentCourses[]
  bookingDeptCode: string
  setBookingDeptCode: (v: string) => void
  bookingCourseCode: string
  setBookingCourseCode: (v: string) => void
  selectedDeptCourses: DeptCourse[]
  sessionType: string
  setSessionType: (v: string) => void
  selectedCourseDeliveryMode: string | null
  facilityMismatchWarning: string | null
  facilityMatchGood: boolean
  // validation
  err: (key: string) => string | undefined
  touch: (...keys: string[]) => void
}

export function ReserveFormReservationDetails({
  lockedFacilityName, isFacilityLocked,
  loadingFacilities, facilitySearch, setFacilitySearch, facilityOpen, setFacilityOpen,
  facilityRef, facilityId, setFacilityId, filteredFacilities,
  useType, setUseType, selectedFacility, isRentable, showSchoolForm,
  today, bookingDate, setBookingDate, expectedAttendees, setExpectedAttendees,
  availability, startTime, setStartTime, endTime, setEndTime,
  bookingPurpose, setBookingPurpose,
  loadingCourses, departmentCourses, bookingDeptCode, setBookingDeptCode,
  bookingCourseCode, setBookingCourseCode, selectedDeptCourses,
  sessionType, setSessionType, selectedCourseDeliveryMode,
  facilityMismatchWarning, facilityMatchGood,
  err, touch,
}: ReserveFormReservationDetailsProps) {
  const facilityLookup = useFacilityCatalogLookup()

  return (
    <section className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-5">
      <h2 className="text-base font-bold text-foreground flex items-center gap-2">
        <span className="w-1.5 h-6 bg-sti-blue dark:bg-accent-light rounded-full" />
        Reservation Details
      </h2>

      {/* Facility — type-to-search */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="reserve-facility-search" className="text-xs font-semibold text-foreground">
            Facility Selection <span className="text-red-500">*</span>
          </Label>
          <FacilityInfoButton
            facility={selectedFacility ? {
              id: selectedFacility.id,
              name: selectedFacility.name,
              capacity: selectedFacility.capacity ?? 0,
              facilityTypeName: facilityTypeNameOf(selectedFacility),
              amenities: facilityLookup.get(selectedFacility.id)?.amenities,
            } : null}
          />
        </div>
        {loadingFacilities ? (
          <div className="h-11 rounded-lg bg-muted animate-pulse" />
        ) : isFacilityLocked ? (
          /* Locked — came from "Book Now" on a specific room */
          <div className="flex items-center gap-3 h-11 px-4 rounded-lg border border-sti-blue/30 dark:border-sti-blue/50 bg-sti-blue/10">
            <MapPin className="w-4 h-4 text-sti-blue shrink-0" />
            <span className="text-sm font-semibold text-sti-blue dark:text-blue-300 flex-1 truncate">
              {lockedFacilityName ?? facilitySearch}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-sti-blue dark:text-accent-light bg-sti-blue/15 px-2 py-0.5 rounded-full">
              Pre-selected
            </span>
          </div>
        ) : (
          <div className="relative" ref={facilityRef}>
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <input
              id="reserve-facility-search"
              type="text"
              value={facilitySearch}
              onChange={e => {
                setFacilitySearch(e.target.value)
                setFacilityOpen(true)
                if (facilityId) setFacilityId('')
              }}
              onFocus={() => setFacilityOpen(true)}
              placeholder='Search rooms… e.g. "Room 2", "Lab", "MPH"'
              className={cn(
                'flex h-11 w-full rounded-lg border border-border bg-card pl-10 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sti-blue transition-all placeholder:text-muted-foreground',
                err('facilityId') && 'border-red-500'
              )}
              autoComplete="off"
            />
            {facilityId && (
              <button
                type="button"
                onClick={() => { setFacilityId(''); setFacilitySearch(''); setFacilityOpen(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              ><X className="w-4 h-4" /></button>
            )}
            {facilityOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-card shadow-xl">
                {filteredFacilities.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">No facilities found</div>
                ) : (
                  filteredFacilities.map(f => {
                    const isSelected = facilityId === f.id
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setFacilityId(f.id)
                          setFacilitySearch(`${f.name}${f.room_number ? ` (${f.room_number})` : ''}`)
                          setFacilityOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-sti-blue/10 dark:hover:bg-sti-blue/20',
                          isSelected && 'bg-sti-blue/10 dark:bg-sti-blue/20'
                        )}
                      >
                        <FacilityRowThumbnail
                          coverPhotoUrl={facilityLookup.get(f.id)?.coverPhotoUrl}
                          facilityTypeName={facilityLookup.get(f.id)?.facilityTypeName ?? facilityTypeNameOf(f)}
                          hasActiveWarning={facilityLookup.get(f.id)?.hasActiveWarning}
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn('font-medium truncate', isSelected && 'text-sti-blue dark:text-accent-light')}>
                            {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                            {f.is_available_for_rental && (
                              <span className="ml-1.5 text-[10px] text-amber-600 font-semibold">[PAID]</span>
                            )}
                          </p>
                          {f.capacity && (
                            <p className="text-xs text-muted-foreground">Capacity: {f.capacity}</p>
                          )}
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-sti-blue shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}
        <FieldError msg={err('facilityId')} />
      </div>

      {/* Paid facility banner — same style as faculty reservation form */}
      {facilityId && isRentable && !useType && (
        <div className="mt-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Booking {selectedFacility?.name} for personal use?
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Personal, community, and commercial use require Building Head approval and payment.
              School-use bookings are auto-approved and free.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="whitespace-nowrap border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              onClick={() => setUseType('school')}
            >
              School Use (Free)
            </Button>
            <Button
              type="button"
              size="sm"
              className="whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => setUseType('paid')}
            >
              Personal Use (Paid)
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── School fields ──────────────────────────────────────── */}
      {showSchoolForm && (
        <div className="space-y-5">
          {/* Date + Attendees */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="reserve-booking-date" className="text-xs font-semibold text-foreground">
                Reservation Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="reserve-booking-date"
                type="date" min={today}
                value={bookingDate}
                onChange={e => setBookingDate(e.target.value)}
                onBlur={() => touch('bookingDate')}
                className={cn('h-11', err('bookingDate') && 'border-red-500')}
              />
              <FieldError msg={err('bookingDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reserve-expected-attendees" className="text-xs font-semibold text-foreground">Attendees</Label>
              <div className="relative">
                <UsersIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reserve-expected-attendees"
                  type="number" min={1} placeholder="e.g. 30"
                  value={expectedAttendees}
                  onChange={e => setExpectedAttendees(e.target.value)}
                  onBlur={() => { if (expectedAttendees) touch('expectedAttendees') }}
                  className={cn('pl-10 h-11', err('expectedAttendees') && 'border-red-500')}
                />
              </div>
              <FieldError msg={err('expectedAttendees')} />
            </div>
          </div>

          {/* Time Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TimeSlotPicker
              value={startTime}
              onChange={t => setStartTime(t)}
              blockedRanges={availability?.blocked_ranges}
              onBlockedClick={() => {}}
              variant="academic"
              error={err('startTime')}
            />
            <TimeSlotPicker
              label="Select End Time"
              value={endTime}
              onChange={t => setEndTime(t)}
              blockedRanges={availability?.blocked_ranges}
              onBlockedClick={() => {}}
              minTime={startTime}
              variant="academic"
              error={err('endTime')}
            />
          </div>

          {/* Booking Purpose */}
          <div className="space-y-1.5">
            <Label htmlFor="reserve-booking-purpose" className="text-xs font-semibold text-foreground">
              Booking Purpose <span className="text-red-500">*</span>
            </Label>
            <select
              id="reserve-booking-purpose"
              value={bookingPurpose}
              onChange={e => setBookingPurpose(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-border bg-card px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sti-blue"
            >
              {SCHOOL_PURPOSE_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Course Information — academic only */}
          {bookingPurpose === 'academic' && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-foreground">
                Course Information (Optional)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="reserve-dept-code" className="text-xs font-bold text-muted-foreground">Department</Label>
                  <select
                    id="reserve-dept-code"
                    value={bookingDeptCode}
                    onChange={e => { setBookingDeptCode(e.target.value); setBookingCourseCode(''); setSessionType('') }}
                    disabled={loadingCourses}
                    className="flex h-11 w-full rounded-lg border border-border bg-card px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sti-blue"
                  >
                    <option value="">Select department</option>
                    {departmentCourses.map(d => (
                      <option key={d.department_code} value={d.department_code}>
                        {d.department_name} ({d.department_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reserve-course-code" className="text-xs font-bold text-muted-foreground">Course</Label>
                  <select
                    id="reserve-course-code"
                    value={bookingCourseCode}
                    onChange={e => {
                      const code = e.target.value
                      setBookingCourseCode(code)
                      const course = selectedDeptCourses.find(c => c.course_code === code)
                      if (course?.delivery_mode === 'lecture') setSessionType('lecture')
                      else if (course?.delivery_mode === 'lab') setSessionType('lab')
                      else setSessionType('')
                    }}
                    disabled={!bookingDeptCode}
                    className="flex h-11 w-full rounded-lg border border-border bg-card px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sti-blue"
                  >
                    <option value="">Select course</option>
                    {(() => {
                      const assigned = selectedDeptCourses.filter(c => c.is_assigned)
                      const other    = selectedDeptCourses.filter(c => !c.is_assigned)
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
                <div className="space-y-1">
                  <Label htmlFor="reserve-session-type" className="text-xs font-bold text-muted-foreground">Session Type</Label>
                  <select
                    id="reserve-session-type"
                    value={sessionType}
                    onChange={e => setSessionType(e.target.value)}
                    disabled={!bookingCourseCode || selectedCourseDeliveryMode !== 'both'}
                    className={cn(
                      'flex h-11 w-full rounded-lg border border-border bg-card px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sti-blue',
                      err('sessionType') && 'border-red-500'
                    )}
                  >
                    {selectedCourseDeliveryMode === 'both' ? (
                      <>
                        <option value="">Select type</option>
                        <option value="lecture">Lecture</option>
                        <option value="lab">Lab</option>
                      </>
                    ) : sessionType ? (
                      <option value={sessionType}>{sessionType === 'lecture' ? 'Lecture' : 'Lab'}</option>
                    ) : (
                      <option value="">Auto-detected</option>
                    )}
                  </select>
                  <FieldError msg={err('sessionType')} />
                </div>
              </div>
              {facilityMismatchWarning && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40">
                  <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">{facilityMismatchWarning}</p>
                </div>
              )}
              {facilityMatchGood && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
                  <CheckCircle className="w-4 h-4 text-sti-blue shrink-0 mt-0.5" />
                  <p className="text-sm text-sti-blue dark:text-blue-300">Facility matches session type — good to go.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
