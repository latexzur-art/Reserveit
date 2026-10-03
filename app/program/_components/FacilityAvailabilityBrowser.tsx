'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building, Loader2 } from 'lucide-react'
import type { AvailabilityResponse } from '@/backend/booking/booking.types'
import { formatTime } from '@/lib/formatTime'

interface FacilityOption {
  id: string
  name: string
  room_number: string
  facility_types?: { name: string }
}

const BLOCK_LABELS: Record<string, string> = {
  class_schedule: 'Class Schedule',
  booking: 'Reserved',
  maintenance: 'Maintenance',
  admin_block: 'Admin Block',
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const ROW_H = 48 // px per hour

const TIMETABLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  class_schedule: { bg: 'bg-blue-500/15 dark:bg-blue-500/20', border: 'border-blue-400 dark:border-blue-500', text: 'text-blue-800 dark:text-blue-300' },
  booking:        { bg: 'bg-orange-500/15 dark:bg-orange-500/20', border: 'border-orange-400 dark:border-orange-500', text: 'text-orange-800 dark:text-orange-300' },
  maintenance:    { bg: 'bg-red-500/15 dark:bg-red-500/20', border: 'border-red-400 dark:border-red-500', text: 'text-red-800 dark:text-red-300' },
  admin_block:    { bg: 'bg-slate-500/15 dark:bg-slate-500/20', border: 'border-slate-400 dark:border-slate-500', text: 'text-slate-700 dark:text-slate-300' },
}

function TimetableGrid({
  availability,
  openMin,
  closeMin,
}: {
  availability: AvailabilityResponse
  openMin: number
  closeMin: number
}) {
  const openHour = Math.floor(openMin / 60)
  const closeHour = Math.ceil(closeMin / 60)
  const hours = Array.from({ length: closeHour - openHour + 1 }, (_, i) => openHour + i)
  const totalMinutes = closeMin - openMin

  return (
    <div className="overflow-y-auto max-h-80 rounded-lg border border-border/50 bg-card">
      <div className="relative" style={{ height: (totalMinutes / 60) * ROW_H }}>
        {/* Hour grid rows */}
        {hours.map((hour) => {
          const topPx = ((hour * 60 - openMin) / 60) * ROW_H
          if (topPx > totalMinutes / 60 * ROW_H) return null
          return (
            <div
              key={hour}
              className="absolute left-0 right-0 flex"
              style={{ top: topPx }}
            >
              {/* Time label */}
              <div className="w-14 shrink-0 pr-2 flex justify-end">
                <span className="text-[10px] text-muted-foreground -translate-y-2 leading-none">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              {/* Hour row divider */}
              <div className="flex-1 border-t border-border/30" />
            </div>
          )
        })}

        {/* Available background */}
        <div
          className="absolute bg-green-500/10 dark:bg-green-500/10"
          style={{ left: 56, right: 0, top: 0, bottom: 0 }}
        />

        {/* Blocked ranges */}
        {availability.blocked_ranges.map((range, i) => {
          const startMin = timeToMinutes(range.start)
          const endMin = timeToMinutes(range.end)
          const topPx = ((startMin - openMin) / 60) * ROW_H
          const heightPx = ((endMin - startMin) / 60) * ROW_H
          if (heightPx <= 0) return null

          const colors = TIMETABLE_COLORS[range.type] ?? TIMETABLE_COLORS.admin_block
          const label = BLOCK_LABELS[range.type] ?? range.type

          return (
            <div
              key={i}
              className={`absolute rounded-sm border-l-2 px-2 py-1 overflow-hidden ${colors.bg} ${colors.border}`}
              style={{ left: 56, right: 4, top: topPx + 1, height: heightPx - 2 }}
              title={`${label}: ${range.start}–${range.end}`}
            >
              <p className={`text-[10px] font-semibold leading-tight ${colors.text}`}>{label}</p>
              <p className={`text-[10px] leading-tight font-mono opacity-80 ${colors.text}`}>
                {range.start.slice(0, 5)}–{range.end.slice(0, 5)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FacilityAvailabilityBrowser() {
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingFacilities, setLoadingFacilities] = useState(true)

  useEffect(() => {
    fetch('/api/facilities')
      .then(r => r.json())
      .then(d => setFacilities(d.facilities ?? []))
      .catch(() => {})
      .finally(() => setLoadingFacilities(false))
  }, [])

  useEffect(() => {
    if (!selectedFacilityId || !selectedDate) {
      setAvailability(null)
      return
    }
    setLoading(true)
    fetch(`/api/facilities/${selectedFacilityId}/availability?date=${selectedDate}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setAvailability(d))
      .catch(() => setAvailability(null))
      .finally(() => setLoading(false))
  }, [selectedFacilityId, selectedDate])

  const openMin = availability ? timeToMinutes(availability.operating_hours.open) : 7 * 60
  const closeMin = availability ? timeToMinutes(availability.operating_hours.close) : 21 * 60

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Building className="w-5 h-5" />
          Facility Availability
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Check when a room is free — no booking info shown
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Facility selector */}
        {loadingFacilities ? (
          <div className="h-9 rounded-md bg-muted animate-pulse" />
        ) : (
          <select
            value={selectedFacilityId}
            onChange={e => setSelectedFacilityId(e.target.value)}
            className="w-full border border-border/60 rounded-md bg-muted/30 dark:bg-slate-700 px-3 py-2 text-sm text-foreground"
          >
            <option value="">— Choose a facility —</option>
            {facilities.map(f => (
              <option key={f.id} value={f.id}>
                {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                {f.facility_types ? ` · ${f.facility_types.name}` : ''}
              </option>
            ))}
          </select>
        )}

        {/* Date picker */}
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full border border-border/60 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-foreground"
        />

        {/* Availability display */}
        {!selectedFacilityId ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-center">
            <Building className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Select a facility to see its schedule</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !availability ? (
          <p className="text-sm text-muted-foreground text-center py-8">Could not load availability.</p>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Operating hours: {availability.operating_hours.open} – {availability.operating_hours.close}
            </p>

            {/* Timetable */}
            <TimetableGrid
              availability={availability}
              openMin={openMin}
              closeMin={closeMin}
            />

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/40" />
                <span className="text-muted-foreground">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700" />
                <span className="text-muted-foreground">Class</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700" />
                <span className="text-muted-foreground">Reserved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700" />
                <span className="text-muted-foreground">Maintenance</span>
              </div>
            </div>

            {availability.blocked_ranges.length === 0 && (
              <p className="text-sm text-green-700 dark:text-green-400 mt-3 font-medium">
                Fully available on this date!
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
