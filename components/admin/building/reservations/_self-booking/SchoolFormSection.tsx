'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TimeSlotPicker } from '@/components/ui/TimeSlotPicker'
import { AlertCircle, CheckCircle, Users as UsersIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SCHOOL_PURPOSE_OPTIONS, FieldError } from '@/components/admin/building/reservations/self-booking/constants'
import type { Availability, DepartmentCourses } from '@/hooks/admin/useSelfBookingForm'

interface Props {
  today: string
  bookingDate: string
  setBookingDate: (v: string) => void
  expectedAttendees: string
  setExpectedAttendees: (v: string) => void
  startTime: string
  setStartTime: (v: string) => void
  endTime: string
  setEndTime: (v: string) => void
  availability: Availability | null
  bookingPurpose: string
  setBookingPurpose: (v: string) => void
  departmentCourses: DepartmentCourses[]
  loadingCourses: boolean
  bookingDeptCode: string
  setBookingDeptCode: (v: string) => void
  bookingCourseCode: string
  setBookingCourseCode: (v: string) => void
  sessionType: string
  setSessionType: (v: string) => void
  selectedDeptCourses: { course_code: string; course_name: string; delivery_mode: string; is_assigned?: boolean; is_elective?: boolean; elective_type?: string | null }[]
  selectedCourseDeliveryMode: string | null
  facilityMismatchWarning: string | null
  facilityMatchGood: boolean
  err: (key: string) => string | undefined
  touch: (...keys: string[]) => void
}

export function SchoolFormSection({
  today,
  bookingDate, setBookingDate,
  expectedAttendees, setExpectedAttendees,
  startTime, setStartTime,
  endTime, setEndTime,
  availability,
  bookingPurpose, setBookingPurpose,
  departmentCourses, loadingCourses,
  bookingDeptCode, setBookingDeptCode,
  bookingCourseCode, setBookingCourseCode,
  sessionType, setSessionType,
  selectedDeptCourses, selectedCourseDeliveryMode,
  facilityMismatchWarning, facilityMatchGood,
  err, touch,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Date + Attendees */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Date <span className="text-red-500">*</span>
          </Label>
          <Input
            type="date" min={today}
            value={bookingDate}
            onChange={e => setBookingDate(e.target.value)}
            onBlur={() => touch('bookingDate')}
            className={cn(err('bookingDate') && 'border-red-500')}
          />
          <FieldError msg={err('bookingDate')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendees</Label>
          <div className="relative">
            <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="number" min={1} placeholder="e.g. 30"
              value={expectedAttendees}
              onChange={e => setExpectedAttendees(e.target.value)}
              onBlur={() => { if (expectedAttendees) touch('expectedAttendees') }}
              className={cn('pl-9', err('expectedAttendees') && 'border-red-500')}
            />
          </div>
          <FieldError msg={err('expectedAttendees')} />
        </div>
      </div>

      {/* Time Pickers */}
      <div className="grid grid-cols-2 gap-3">
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
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Booking Purpose <span className="text-red-500">*</span>
        </Label>
        <select
          value={bookingPurpose}
          onChange={e => setBookingPurpose(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {SCHOOL_PURPOSE_OPTIONS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Course Information — academic only */}
      {bookingPurpose === 'academic' && (
        <div className="space-y-3 pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course Information (Optional)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Department</Label>
              <select
                value={bookingDeptCode}
                onChange={e => { setBookingDeptCode(e.target.value); setBookingCourseCode(''); setSessionType('') }}
                disabled={loadingCourses}
                className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select dept</option>
                {departmentCourses.map(d => (
                  <option key={d.department_code} value={d.department_code}>
                    {d.department_name} ({d.department_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Course</Label>
              <select
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
                className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <Label className="text-xs text-slate-500">Session Type</Label>
              <select
                value={sessionType}
                onChange={e => setSessionType(e.target.value)}
                disabled={!bookingCourseCode || selectedCourseDeliveryMode !== 'both'}
                className={cn(
                  'flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
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
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40">
              <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700 dark:text-yellow-400">{facilityMismatchWarning}</p>
            </div>
          )}
          {facilityMatchGood && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700 dark:text-green-400">Facility matches session type — good to go.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
