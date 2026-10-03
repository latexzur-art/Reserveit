'use client'

import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/lib/data-store";
import { Wrench, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const UpcomingMaintenance = () => {
  const { maintenance } = useDataStore();
  
  // Logic remains identical to preserve your data flow
  const safeMaintenance = Array.isArray(maintenance) ? maintenance : [];
  const scheduled = safeMaintenance.filter(m => m.status === "Scheduled");

  return (
    <div className={cn(
      "relative rounded-3xl p-6 sm:p-8 transition-all duration-500",
      "bg-white dark:bg-[#15181E]", // Rich Charcoal Surface
      "border border-slate-200 dark:border-white/[0.06]", // Ghost border
      "shadow-sm dark:shadow-2xl dark:shadow-blue-900/5",
      "overflow-hidden" // Prevents child elements from overflowing rounded corners
    )}>
      {/* Label Header - Updated to match Pending Approvals Bold style */}
      <div className="mb-6">
        <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
          Scheduled
          <span className="text-blue-600 dark:text-blue-400">Maintenance</span>
        </h3>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
          System and Facility Upkeep
        </p>
      </div>

      <div className="space-y-3">
        {scheduled.length === 0 ? (
          <div className={cn(
            "py-12 flex flex-col items-center justify-center rounded-2xl",
            "border border-dashed border-slate-200 dark:border-white/10",
            "bg-slate-50/30 dark:bg-white/[0.01]"
          )}>
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4">
               <ShieldCheck size={24} className="text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">
              All Systems Nominal
            </p>
            <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase mt-1.5">
              No pending maintenance tasks
            </p>
          </div>
        ) : (
          scheduled.slice(0, 3).map(m => (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
                "bg-amber-50/30 dark:bg-amber-400/[0.03]",
                "border border-amber-100/50 dark:border-amber-400/10",
                "hover:border-amber-400/30 dark:hover:border-amber-400/20 hover:translate-x-1"
              )}
            >
              {/* Icon Container */}
              <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-100/50 dark:bg-amber-400/10 shrink-0">
                <Wrench size={14} className="text-amber-600 dark:text-amber-400" />
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase truncate tracking-tight text-slate-800 dark:text-white">
                  {m.item}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold mt-1">
                  <Clock size={11} className="text-amber-500/50" /> 
                  <span className="tracking-wide">{m.scheduleDate}</span>
                </div>
              </div>

              {/* Status Badge */}
              <Badge
                variant="outline"
                className="text-[9px] font-black uppercase px-2 py-0.5 shrink-0 rounded-lg
                  border-amber-200/50 dark:border-amber-400/20
                  text-amber-600 dark:text-amber-400
                  bg-transparent"
              >
                {m.type}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
};