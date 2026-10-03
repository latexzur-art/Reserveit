'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Gauge } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export interface YieldRow {
  id: string
  name: string
  utilization: number
  ghostRate: number
  bookings: number
}

export function YieldAnalyzerChart({ data }: { data: YieldRow[] }) {
  // Bottom 3 (lowest utilization) flagged
  const sorted = [...data].sort((a, b) => b.utilization - a.utilization)
  const bottom3 = new Set(sorted.slice(-3).map(d => d.id))

  return (
    <Card className="p-8 rounded-[2.5rem] bg-card border border-border">
      <div className="flex items-center gap-2 mb-6">
        <Gauge className="w-4 h-4 text-[#FACC15] dark:text-[#0072bc]" />
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Opportunity Cost & Yield Analyzer</h3>
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest ml-auto">
          Bottom 3 highlighted for review
        </span>
      </div>
      {sorted.length === 0 ? (
        <div className="flex items-center justify-center h-[280px] text-muted-foreground font-black text-sm uppercase">No facility data</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(280, sorted.length * 36)}>
          <BarChart data={sorted} layout="vertical" margin={{ left: 20, right: 40 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fontWeight: 900, fill: 'currentColor' }}
              width={140}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              formatter={(value: number, _name, item) => {
                const row = item?.payload as YieldRow | undefined
                if (!row) return [`${value}%`, 'Utilization']
                return [
                  `${value}%`,
                  `Utilization · ${row.bookings} bookings · ${row.ghostRate}% ghost rate`,
                ]
              }}
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                fontSize: '11px',
              }}
            />
            <Bar dataKey="utilization" radius={[0, 6, 6, 0]} barSize={20}>
              {sorted.map(d => (
                <Cell key={d.id} fill={bottom3.has(d.id) ? '#ef4444' : '#0072bc'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
