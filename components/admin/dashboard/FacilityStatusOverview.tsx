'use client'

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useDataStore } from "@/lib/data-store";
import { Activity, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from '@/lib/routes'

export const FacilityStatusOverview = () => {
  const router = useRouter();
  const { facilities } = useDataStore();
  
  // Logic preserved: Filter for occupied and non-deleted facilities
  const safeFacilities = Array.isArray(facilities) ? facilities : [];
  const occupied = safeFacilities.filter(f => f.status === "Occupied" && !f.deleted);

  return (
    <div className={cn(
      "relative rounded-3xl p-6 sm:p-8 transition-all duration-500",
      "bg-white dark:bg-[#15181E]", // Rich Charcoal Surface
      "border border-slate-200 dark:border-white/[0.06]", // Ghost border
      "shadow-sm dark:shadow-2xl dark:shadow-blue-900/5",
      "overflow-hidden" // Prevents child elements from overflowing
    )}>
      
      {/* Header Section - Matches Pending Approvals Bold style */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
            Facility
            <span className="text-blue-600 dark:text-blue-400">Activity</span>
          </h3>
          <p className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
            Real-time Occupancy Status
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xxs font-black h-8 px-3 uppercase text-blue-600 dark:text-blue-400 hover:bg-blue-600/10 rounded-xl"
          onClick={() => router.push(ROUTES.buildingAdmin.roomAvailability)}
        >
          Details
        </Button>
      </div>

      {occupied.length === 0 ? (
        /* Empty State / Schedule Clear */
        <div className={cn(
          "py-12 flex flex-col items-center justify-center rounded-2xl",
          "border border-dashed border-slate-200 dark:border-white/10",
          "bg-slate-50/30 dark:bg-white/[0.01]"
        )}>
          <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4">
            <LayoutGrid className="w-6 h-6 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-tiny font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em]">
            No Active Use
          </p>
          <p className="text-xxs font-bold text-slate-300 dark:text-slate-600 uppercase mt-1.5">
            All rooms are currently free
          </p>
        </div>
      ) : (
        /* Active Occupancy List */
        <div className="space-y-3">
          {occupied.slice(0, 4).map(f => (
            <div
              key={f.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl transition-all duration-300",
                "bg-red-50/30 dark:bg-red-500/[0.03]",
                "border border-red-100/50 dark:border-red-500/10",
                "hover:border-red-500/30 dark:hover:border-red-500/20 hover:translate-x-1"
              )}
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Visual indicator for "In Use" */}
                <div className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </div>
                
                <div className="min-w-0">
                  <p className="text-tiny font-black uppercase truncate tracking-tight text-slate-800 dark:text-white">
                    {f.roomNumber} - {f.name}
                  </p>
                  <p className="text-xxs text-slate-400 dark:text-slate-500 uppercase font-bold mt-1 tracking-wide">
                    Occupied
                  </p>
                </div>
              </div>

              <Badge
                className="text-micro font-black px-2.5 py-1 rounded-lg shrink-0 border-none
                  bg-red-500/10 dark:bg-red-500/20
                  text-red-600 dark:text-red-400 shadow-sm shadow-red-500/5"
              >
                BUSY
              </Badge>
            </div>
          ))}
        </div>
      )}
      
      {occupied.length > 4 && (
        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/5">
          <p className="text-center text-xxs font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            + {occupied.length - 4} more active rooms
          </p>
        </div>
      )}
    </div>
  );
};