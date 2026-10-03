'use client'

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/lib/data-store";

export const WeeklyUtilization = () => {
  const { bookings, classSchedules, facilities } = useDataStore();

  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    const today = new Date();
    
    // Total potential capacity per day (simple heuristic: rooms * 8 potential time blocks)
    const totalCapacity = (facilities?.length || 1) * 8;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayName = days[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];

      // Count bookings for this day
      const dailyBookings = bookings.filter(b => b.date === dateStr && (b.status === 'approved' || b.status === 'auto_approved')).length;
      
      // Count classes for this day of week
      const dayOfWeek = d.getDay();
      const dailyClasses = classSchedules.filter(s => s.dayOfWeek === dayOfWeek).length;

      const totalActive = dailyBookings + dailyClasses;
      const usage = totalCapacity > 0 ? Math.min(100, Math.round((totalActive / totalCapacity) * 100)) : 0;

      result.push({
        name: dayName,
        usage: usage || 5, 
      });
    }
    return result;
  }, [bookings, classSchedules, facilities]);

  return (
    <div className={cn(
      "relative rounded-3xl p-6 sm:p-8 transition-all duration-500",
      "bg-white dark:bg-[#15181E]",
      "border border-slate-200 dark:border-white/[0.06]",
      "shadow-sm dark:shadow-2xl dark:shadow-blue-900/5",
      "overflow-hidden"
    )}>
      <div className="mb-8">
        <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
          Weekly Utilization
          <span className="text-blue-600 dark:text-blue-400">Rates</span>
        </h3>
        <p className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
          Historical Resource Engagement
        </p>
      </div>

      <div className="h-44 sm:h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -35, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="4 4"
              vertical={false}
              stroke="currentColor"
              className="text-slate-100 dark:text-white/[0.03]"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fontWeight: 900, fill: 'currentColor' }}
              className="text-slate-400 dark:text-slate-600"
              dy={12}
            />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              cursor={{ fill: 'rgba(37,99,235,0.04)', radius: 8 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-[#1A1F26] border border-slate-200 dark:border-white/10 p-3 rounded-xl shadow-xl">
                      <p className="text-xxs font-black uppercase text-slate-400 dark:text-slate-500 mb-1">
                        {payload[0].payload.name}
                      </p>
                      <p className="text-xs font-black text-blue-600 dark:text-blue-400">
                        {payload[0].value}% <span className="text-micro text-slate-400 uppercase ml-1">Usage</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="usage" 
              radius={[6, 6, 0, 0]} 
              barSize={24}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  className="fill-blue-600 dark:fill-blue-600/80 hover:fill-blue-500 transition-colors duration-300" 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};