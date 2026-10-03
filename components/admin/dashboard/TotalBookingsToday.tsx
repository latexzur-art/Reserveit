'use client'

import { Clock, CalendarCheck, ArrowUpRight, CalendarDays } from "lucide-react";
import { useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";

export const TotalBookingsToday = () => {
  const { bookings } = useDataStore();
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  
  // Get today's date in local ISO format
  const today = new Date().toISOString().split("T")[0];
  
  const active = safeBookings.filter(b =>
    b.date === today &&
    (b.status === "approved" || b.status === "auto_approved")
  );

  return (
    <div className={cn(
      "relative rounded-xl p-6 transition-all duration-300",
      "bg-white dark:bg-[#15181E]",
      "border border-slate-200 dark:border-white/[0.08]"
    )}>
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Confirmed Today
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {active.length} Active Reservations Scheduled
          </p>
        </div>
        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <ArrowUpRight size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div className="space-y-3 relative z-10">
        {active.length === 0 ? (
          <div className={cn(
            "py-10 flex flex-col items-center justify-center rounded-xl",
            "border border-dashed border-slate-200 dark:border-white/10",
            "bg-slate-50/50 dark:bg-white/[0.01]"
          )}>
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Schedule Clear
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              No confirmed bookings scheduled for today
            </p>
          </div>
        ) : (
          active.slice(0, 4).map((b) => (
            <div
              key={b.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
                "bg-slate-50/50 dark:bg-white/[0.02]",
                "border border-slate-100 dark:border-white/[0.04]",
                "hover:border-blue-500/30 dark:hover:border-blue-500/20 hover:scale-[1.02]"
              )}
            >
              <div className={cn(
                "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center",
                "bg-blue-600/5 dark:bg-blue-600/10",
                "border border-blue-600/10 dark:border-blue-600/20"
              )}>
                <Clock size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase truncate tracking-tight text-slate-900 dark:text-white">
                  {b.facilityName || b.facility}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    {b.startTime}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate uppercase tracking-tight">
                    {b.requester}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {active.length > 4 && (
        <div className="mt-5 pt-4 border-t border-dashed border-slate-200 dark:border-white/10 text-center">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            + {active.length - 4} more scheduled
          </p>
        </div>
      )}
    </div>
  );
};