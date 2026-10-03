"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CalendarClock, ChevronRight, Clock, MapPin, User, BookOpen, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ClassScheduleItem {
  id: string
  course_code: string
  course_name: string
  section: string
  instructor_name?: string | null
  day_of_week: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
  start_time: string
  end_time: string
  facility?: {
    id: string
    name: string
    room_number?: string
    building?: string
  }
  department?: {
    id: string
    name: string
    code: string
  }
}

interface FixedClassSchedulesPreviewProps {
  initialClasses?: ClassScheduleItem[]
  className?: string
}

const DAYS = [
  { idx: 1, label: "Mon", fullLabel: "Monday" },
  { idx: 2, label: "Tue", fullLabel: "Tuesday" },
  { idx: 3, label: "Wed", fullLabel: "Wednesday" },
  { idx: 4, label: "Thu", fullLabel: "Thursday" },
  { idx: 5, label: "Fri", fullLabel: "Friday" },
  { idx: 6, label: "Sat", fullLabel: "Saturday" },
  { idx: 0, label: "Sun", fullLabel: "Sunday" },
]

function formatTime(timeStr: string): string {
  if (!timeStr) return ""
  const [hStr, mStr] = timeStr.split(":")
  let h = parseInt(hStr, 10)
  if (isNaN(h)) return timeStr
  const ampm = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return `${h}:${mStr ?? "00"} ${ampm}`
}

export function FixedClassSchedulesPreview({
  initialClasses,
  className,
}: FixedClassSchedulesPreviewProps) {
  const [classes, setClasses] = useState<ClassScheduleItem[]>(initialClasses || [])
  const [loading, setLoading] = useState<boolean>(!initialClasses)
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    return new Date().getDay()
  })

  useEffect(() => {
    if (initialClasses) {
      setClasses(initialClasses)
      setLoading(false)
      const today = new Date().getDay()
      const hasClassesToday = initialClasses.some((c) => c.day_of_week === today)
      if (!hasClassesToday && initialClasses.length > 0) {
        setSelectedDay(initialClasses[0].day_of_week)
      }
      return
    }

    let isMounted = true
    setLoading(true)
    fetch('/api/schedules/my-classes?scope=all')
      .then((res) => (res.ok ? res.json() : { classes: [] }))
      .then((data) => {
        if (isMounted) {
          const loadedClasses = data.classes || []
          setClasses(loadedClasses)
          const today = new Date().getDay()
          const hasClassesToday = loadedClasses.some((c: ClassScheduleItem) => c.day_of_week === today)
          if (!hasClassesToday && loadedClasses.length > 0) {
            setSelectedDay(loadedClasses[0].day_of_week)
          }
        }
      })
      .catch((err) => {
        console.error("[FixedClassSchedulesPreview] fetch error:", err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [initialClasses])

  const selectedDayInfo = DAYS.find((d) => d.idx === selectedDay) || DAYS[0]
  const dayClasses = classes.filter((c) => c.day_of_week === selectedDay)
  const totalClasses = classes.length

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-xs transition-all flex flex-col h-full",
        className
      )}
    >
      {/* HEADER WITH TITLE AND DIRECT BUTTON */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold text-foreground tracking-tight truncate">
                Fixed Class Schedules
              </h2>
              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                {totalClasses} Total
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {selectedDayInfo.fullLabel} Teaching Roster
            </p>
          </div>
        </div>

        <Link href="/academic/my-schedules" className="shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl font-semibold text-[11px] h-8 px-2.5 hover:border-primary/50 hover:text-primary transition-all group"
          >
            <span>View All</span>
            <ChevronRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </div>

      {/* DAY SELECTOR PILLS (Mon - Sun) */}
      <div className="flex items-center gap-1 py-2.5 border-b border-border/50 overflow-x-auto no-scrollbar">
        {DAYS.map((day) => {
          const count = classes.filter((c) => c.day_of_week === day.idx).length
          const isSelected = selectedDay === day.idx
          const isToday = new Date().getDay() === day.idx

          return (
            <button
              key={day.idx}
              onClick={() => setSelectedDay(day.idx)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all border",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              <span>{day.label}</span>
              {isToday && !isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
              )}
              {count > 0 && (
                <span
                  className={cn(
                    "px-1 rounded text-[9px] font-extrabold",
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-muted-foreground border border-border/60"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* CLASSES LIST FOR SELECTED DAY (CAPPED HEIGHT SCROLLABLE) */}
      <div className="pt-3 flex-1">
        {loading ? (
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 p-3 bg-muted/20 animate-pulse space-y-2"
              >
                <div className="h-3.5 w-24 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : dayClasses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-5 text-center bg-muted/10 my-2">
            <BookOpen className="w-6 h-6 text-muted-foreground/50 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-muted-foreground">
              No classes on {selectedDayInfo.fullLabel}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Select another day tab or click "View All".
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 text-xs">
            {dayClasses.map((item) => {
              const room =
                item.facility?.room_number ||
                item.facility?.name ||
                "Unassigned Room"
              const deptCode = item.department?.code

              return (
                <div
                  key={item.id}
                  className="group relative rounded-xl border border-border/70 bg-background p-3.5 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {item.course_code}
                        </span>
                        <h4 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {item.course_name}
                        </h4>
                      </div>
                      {deptCode && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-muted text-muted-foreground shrink-0">
                          {deptCode}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-foreground pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Layers className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                          <span>{item.section}</span>
                        </div>
                        <div className="flex items-center gap-1 text-foreground font-semibold">
                          <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                          <span>{room}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                        <span>
                          {formatTime(item.start_time)} – {formatTime(item.end_time)}
                        </span>
                      </div>

                      {item.instructor_name && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/90">
                          <User className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                          <span className="truncate">{item.instructor_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
