'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart, Legend } from 'recharts'
import { TrendingUp } from 'lucide-react'

export interface ForecastPoint {
  name: string
  volume: number | null
  forecast: number | null
}

export interface ForecastData {
  series: ForecastPoint[]
  maxCapacity: number
  forecastedPeak: number
}

export function ForecastLineChart({ data }: { data: ForecastData }) {
  return (
    <Card className="p-8 rounded-[2.5rem] bg-card border border-border">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-4 h-4 text-[#0072bc]" />
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Capacity Forecast</h3>
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest ml-auto">
          6mo history · 2mo SMA projection
        </span>
      </div>
      <div className="h-[320px] w-full">
        {data.series.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground font-black text-sm uppercase">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  fontSize: '11px',
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                formatter={v => (
                  <span className="text-foreground font-black text-[9px] uppercase tracking-widest ml-1">{v}</span>
                )}
              />
              <ReferenceLine
                y={data.maxCapacity}
                stroke="#ef4444"
                strokeDasharray="6 4"
                label={{ value: 'Capacity', position: 'right', fontSize: 9, fontWeight: 900, fill: '#ef4444' }}
              />
              <Area type="monotone" dataKey="volume" name="Historical" stroke="#0072bc" fill="#0072bc" fillOpacity={0.2} strokeWidth={3} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#FACC15" strokeWidth={3} strokeDasharray="6 4" dot={{ r: 5 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
