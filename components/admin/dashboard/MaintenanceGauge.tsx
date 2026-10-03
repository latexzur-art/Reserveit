'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Wrench } from 'lucide-react'
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'

export interface MaintenanceRow {
  id: string
  name: string
  cumulativeHours: number
  maxSafeHours: number
  wearPercent: number
}

function colorFor(pct: number): string {
  if (pct > 85) return '#ef4444'
  if (pct > 50) return '#FACC15'
  return '#22c55e'
}

function Gauge({ row }: { row: MaintenanceRow }) {
  const color = colorFor(row.wearPercent)
  const data = [{ name: row.name, value: row.wearPercent, fill: color }]
  return (
    <div className="flex flex-col items-center p-4 rounded-2xl bg-card/40 dark:bg-[#050d36]/10 border border-border">
      <div className="w-full h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="65%" outerRadius="95%" startAngle={210} endAngle={-30} data={data}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={10} background={{ fill: 'var(--muted)' }} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center -mt-12 mb-4 pointer-events-none">
        <div className="text-2xl font-black" style={{ color }}>{row.wearPercent}%</div>
        <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Wear</div>
      </div>
      <div className="text-center mt-2">
        <div className="text-xs font-black uppercase tracking-tight text-foreground">{row.name}</div>
        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
          {row.cumulativeHours}/{row.maxSafeHours} hrs
        </div>
      </div>
    </div>
  )
}

export function MaintenanceGauge({ data }: { data: MaintenanceRow[] }) {
  return (
    <Card className="p-8 rounded-[2.5rem] bg-card border border-border">
      <div className="flex items-center gap-2 mb-6">
        <Wrench className="w-4 h-4 text-[#FACC15] dark:text-[#0072bc]" />
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Predictive Maintenance</h3>
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest ml-auto">
          Green &lt;50% · Yellow 51–85% · Red &gt;85%
        </span>
      </div>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[180px] text-muted-foreground font-black text-sm uppercase text-center px-6">
          No facilities have `max_safe_hours` configured yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(row => <Gauge key={row.id} row={row} />)}
        </div>
      )}
    </Card>
  )
}
