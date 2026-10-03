'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  BookOpen,
  User,
  Clock,
  MapPin,
  Calendar,
  Layers,
  Search,
  Loader2,
  Building2,
  AlertCircle
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SectionBadgeIcon } from '@/components/sections/SectionBadgeIcon'

interface ClassSchedule {
  id: string
  course_code: string
  course_name: string
  section: string
  instructor_name?: string | null
  day_of_week?: number | string | null
  start_time?: string | null
  end_time?: string | null
  is_active: boolean
  facilities?: { id: string; name: string; room_number?: string | null } | null
  departments?: { id: string; name: string; code: string } | null
  academic_terms?: { id: string; term_name: string; term_code?: string; academic_year?: string } | null
}

interface SectionClassesModalProps {
  sectionName: string | null
  departmentName?: string
  departmentCode?: string
  isOpen: boolean
  onClose: () => void
}

const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
}

function formatDayOfWeek(day: number | string | null | undefined): string {
  if (day == null) return 'TBA'
  if (typeof day === 'number' && DAY_NAMES[day]) return DAY_NAMES[day]
  if (typeof day === 'string' && !isNaN(Number(day)) && DAY_NAMES[Number(day)]) {
    return DAY_NAMES[Number(day)]
  }
  return String(day)
}

function formatTime(timeStr?: string | null): string {
  if (!timeStr) return ''
  try {
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr
    let hour = parseInt(parts[0], 10)
    const min = parts[1]
    const ampm = hour >= 12 ? 'PM' : 'AM'
    hour = hour % 12 || 12
    return `${hour}:${min} ${ampm}`
  } catch {
    return timeStr
  }
}

export function SectionClassesModal({
  sectionName,
  departmentName,
  departmentCode,
  isOpen,
  onClose
}: SectionClassesModalProps) {
  const [classes, setClasses] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterSearch, setFilterSearch] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen || !sectionName) {
      setClasses([])
      setFilterSearch('')
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`/api/schedules/all?section=${encodeURIComponent(sectionName)}&limit=100`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch section classes')
        return res.json()
      })
      .then((data) => {
        setClasses(data.schedules ?? [])
      })
      .catch((err) => {
        console.error('Error fetching section classes:', err)
        setError('Failed to load class schedules for this section.')
      })
      .finally(() => setLoading(false))
  }, [isOpen, sectionName])

  if (!isOpen || !sectionName || !mounted) return null

  const filteredClasses = classes.filter((c) => {
    const q = filterSearch.toLowerCase().trim()
    if (!q) return true
    return (
      c.course_code?.toLowerCase().includes(q) ||
      c.course_name?.toLowerCase().includes(q) ||
      c.instructor_name?.toLowerCase().includes(q) ||
      c.facilities?.name?.toLowerCase().includes(q) ||
      c.facilities?.room_number?.toLowerCase().includes(q)
    )
  })

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <SectionBadgeIcon
              departmentCode={departmentCode}
              departmentName={departmentName}
              size="lg"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Section <span className="text-accent-brand">{sectionName}</span>
                </h2>
                {departmentCode && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                    {departmentCode}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                {departmentName || 'Associated Enrolled Classes & Schedules'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── TOOLBAR / SEARCH ── */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/10 bg-slate-100/50 dark:bg-black/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search course code, name, instructor, or room..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="pl-9 h-11 text-xs bg-white dark:bg-[#0B0F17] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-white/5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10">
              {filteredClasses.length} Class{filteredClasses.length !== 1 ? 'es' : ''} Listed
            </span>
          </div>
        </div>

        {/* ── BODY CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
              <p className="text-xs font-bold uppercase tracking-wider">Loading classes for {sectionName}...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-red-500 space-y-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 dark:bg-white/[0.01] rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10">
              <BookOpen className="w-10 h-10 mb-3 text-slate-300 dark:text-slate-600" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No classes found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {filterSearch
                  ? 'No classes match your search query.'
                  : `There are currently no active classes assigned to section ${sectionName}.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F17]">
                <table className="w-full min-w-[650px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-[#15181E] border-b border-slate-200 dark:border-white/10 sticky top-0 z-10">
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Course Code & Title
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Instructor
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Schedule
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Room / Facility
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredClasses.map((cls) => {
                      const dayStr = formatDayOfWeek(cls.day_of_week)
                      const timeStr =
                        cls.start_time && cls.end_time
                          ? `${formatTime(cls.start_time)} – ${formatTime(cls.end_time)}`
                          : ''
                      const roomName =
                        cls.facilities?.name ||
                        (cls.facilities?.room_number ? `Room ${cls.facilities.room_number}` : 'TBA')
                      const courseTitle = cls.course_name || 'Course Name Unspecified'

                      return (
                        <tr
                          key={cls.id}
                          className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
                                {cls.course_code}
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase mt-0.5">
                                {courseTitle}
                              </span>
                              {cls.academic_terms?.term_name && (
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                  {cls.academic_terms.term_name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{cls.instructor_name || 'Unassigned'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{dayStr}</span>
                              </div>
                              {timeStr && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 pl-5">
                                  {timeStr}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{roomName}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredClasses.map((cls) => {
                  const dayStr = formatDayOfWeek(cls.day_of_week)
                  const timeStr =
                    cls.start_time && cls.end_time
                      ? `${formatTime(cls.start_time)} – ${formatTime(cls.end_time)}`
                      : ''
                  const roomName =
                    cls.facilities?.name ||
                    (cls.facilities?.room_number ? `Room ${cls.facilities.room_number}` : 'TBA')
                  const courseTitle = cls.course_name || 'Course Name Unspecified'

                  return (
                    <div
                      key={cls.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0F17] space-y-2.5"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400 block">
                            {cls.course_code}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase mt-0.5">
                            {courseTitle}
                          </h4>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{cls.instructor_name || 'Unassigned'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">{roomName}</span>
                        </div>

                        <div className="col-span-2 flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>
                            {dayStr}{timeStr ? ` (${timeStr})` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white transition-colors h-11"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
