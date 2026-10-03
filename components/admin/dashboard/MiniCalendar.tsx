'use client';

import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useDataStore } from "@/lib/data-store";

export const MiniCalendar = () => {
  const { calendarEvents } = useDataStore();
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className={cn(
      "relative rounded-3xl p-6 transition-all duration-500",
      "bg-white dark:bg-[#15181E]", // Rich Charcoal
      "border border-slate-200 dark:border-white/[0.06]",
      "shadow-sm dark:shadow-2xl dark:shadow-blue-900/5",
      "overflow-hidden"
    )}>
      {/* Month Nav */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5"
          onClick={prevMonth}
        >
          <ChevronLeft size={14} className="stroke-[2.5px]" />
        </Button>
        <h3 className="font-black text-[12px] uppercase tracking-[0.15em] text-[#0072bc] dark:text-[#0072bc]">
          {monthName} {year}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5"
          onClick={nextMonth}
        >
          <ChevronRight size={14} className="stroke-[2.5px]" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={`h-${i}`} className="text-[10px] font-black text-slate-300 dark:text-slate-700 pb-2">
            {d}
          </div>
        ))}
        {Array(firstDay).fill(null).map((_, i) => (
          <div key={`e-${i}`} className="h-9" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dateObj = new Date(year, month, day);
          const dateStr = dateObj.toISOString().split('T')[0];
          const isToday = today.toDateString() === dateObj.toDateString();
          const isSelected = selectedDate.toDateString() === dateObj.toDateString();
          
          // Check for events on this day
          const dayEvents = calendarEvents.filter(e => e.date === dateStr);
          const hasApproved = dayEvents.some(e => e.type === 'approved');
          const hasMaint = dayEvents.some(e => e.type === 'maintenance');
          const hasClass = dayEvents.some(e => e.type === 'class');

          return (
            <button
              key={`d-${day}`}
              onClick={() => setSelectedDate(dateObj)}
              className={cn(
                "h-9 w-full flex flex-col items-center justify-center text-[11px] font-bold rounded-xl transition-all relative",
                isSelected
                  ? "bg-[#0072bc] text-white shadow-lg shadow-[#0072bc]/20"
                  : isToday
                    ? "border-2 border-[#0072bc]/30 text-[#0072bc] dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white active:scale-90"
              )}
            >
              {day}
              {/* Event Dots */}
              <div className="flex gap-0.5 mt-0.5 absolute bottom-1.5">
                {hasApproved && <div className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-blue-500")} />}
                {hasClass && <div className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white/80" : "bg-purple-500")} />}
                {hasMaint && <div className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white/60" : "bg-amber-500")} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#0072bc] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">
            Today's Focus
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-tight">
          {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
};