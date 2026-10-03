'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#0072bc', '#FACC15', '#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#ef4444', '#6366f1']

export function DepartmentDistributionChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card className="p-8 rounded-[2.5rem] bg-card border border-border">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-4 h-4 text-[#0072bc]" />
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Departmental Resource Allocation</h3>
      </div>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[260px] text-muted-foreground font-black text-sm uppercase">No department data</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              stroke="none"
              paddingAngle={2}
            >
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              formatter={(value: number, _name, item) => {
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
                const label = (item?.payload as { name?: string } | undefined)?.name ?? ''
                return [`${value} bookings (${pct}%)`, label]
              }}
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                fontSize: '11px',
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              formatter={(value: string) => (
                <span className="text-foreground font-black text-[9px] uppercase tracking-widest ml-1">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
