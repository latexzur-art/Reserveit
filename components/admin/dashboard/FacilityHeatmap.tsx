'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Flame } from 'lucide-react'

export interface HeatmapCell {
  day: string
  hour: string
  density: number
  count: number
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function densityClass(d: number): string {
  if (d >= 90) return 'bg-red-600 text-white'
  if (d >= 70) return 'bg-orange-500 text-white'
  if (d >= 50) return 'bg-orange-300 text-foreground'
  if (d >= 25) return 'bg-yellow-200 text-foreground'
  if (d > 0) return 'bg-emerald-100 text-foreground'
  return 'bg-muted/30 text-muted-foreground'
}

export function FacilityHeatmap({ data }: { data: HeatmapCell[] }) {
  // Build day → hour → cell lookup
  const byDay = new Map<string, HeatmapCell[]>()
  for (const d of DAYS) byDay.set(d, [])
  for (const cell of data) {
    if (byDay.has(cell.day)) byDay.get(cell.day)!.push(cell)
  }
  for (const arr of byDay.values()) arr.sort((a, b) => a.hour.localeCompare(b.hour))

  const hours = Array.from(new Set(data.map(c => c.hour))).sort()

  return (
    <Card className="p-8 rounded-[2.5rem] bg-card border border-border">
      <div className="flex items-center gap-2 mb-6">
        <Flame className="w-4 h-4 text-orange-500" />
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Facility Capacity Heatmap</h3>
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest ml-auto">
          Mon–Sun · 07:00–21:00
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid" style={{ gridTemplateColumns: `48px repeat(${hours.length}, minmax(28px, 1fr))` }}>
            <div />
            {hours.map(h => (
              <div key={h} className="text-[8px] font-black uppercase text-muted-foreground text-center pb-1">
                {h.slice(0, 2)}
              </div>
            ))}
            {DAYS.map(day => (
              <React.Fragment key={day}>
                <div className="text-[9px] font-black uppercase text-muted-foreground flex items-center pr-2">{day}</div>
                {(byDay.get(day) || []).map(cell => (
                  <div
                    key={`${day}-${cell.hour}`}
                    title={`${day} ${cell.hour} — ${cell.count} bookings (${cell.density}%)`}
                    className={`h-6 m-[1px] rounded-md ${densityClass(cell.density)} flex items-center justify-center text-[8px] font-black`}
                  >
                    {cell.count > 0 ? cell.count : ''}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <span className="text-[8px] font-black uppercase text-muted-foreground">Density</span>
        {[
          { label: '0', cls: 'bg-muted/30' },
          { label: '25', cls: 'bg-yellow-200' },
          { label: '50', cls: 'bg-orange-300' },
          { label: '70', cls: 'bg-orange-500' },
          { label: '90+', cls: 'bg-red-600' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${l.cls}`} />
            <span className="text-[8px] font-black text-muted-foreground">{l.label}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
