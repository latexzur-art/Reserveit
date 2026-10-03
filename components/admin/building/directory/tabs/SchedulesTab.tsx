'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Loader2, Clock, MapPin } from 'lucide-react'
import type { DirectorySchedule } from '@/backend/admin/building/building.types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_COLORS = [
  'bg-red-100 text-red-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
]

interface Props {
  schedules: DirectorySchedule[]
  loading: boolean
}

export function SchedulesTab({ schedules, loading }: Props) {
  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
  }

  if (!schedules.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No class schedules found.</p>
  }

  // Group by day
  const byDay: Record<number, DirectorySchedule[]> = {}
  schedules.forEach(s => {
    if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = []
    byDay[s.dayOfWeek].push(s)
  })

  return (
    <ScrollArea className="h-72">
      <div className="space-y-4 pr-2">
        {Object.entries(byDay).map(([day, items]) => (
          <div key={day}>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={`text-[10px] border-none ${DAY_COLORS[parseInt(day)] ?? 'bg-muted text-muted-foreground'}`}>
                {DAY_NAMES[parseInt(day)]}
              </Badge>
            </div>
            <div className="space-y-2 ml-1">
              {items.map(s => (
                <div key={s.id} className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-sm font-semibold">{s.courseName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.courseCode} · Section {s.section}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                    </span>
                    {s.facilityName && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {s.facilityName}{s.roomNumber ? ` (${s.roomNumber})` : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
