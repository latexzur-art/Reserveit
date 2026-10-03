"use client"

import { useDataStore, Booking } from "@/lib/data-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, ArrowRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ROUTES } from '@/lib/routes'
import { bookingTypeLabel } from '@/lib/enum-labels'

export const PendingApprovals = () => {
  const { bookings, updateBookingStatus } = useDataStore();
  
  // Ensure bookings is an array before filtering
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  
  // Filter for pending statuses based on your existing logic
  const pending = safeBookings.filter(b =>
    b.status === "pending" || b.status === "flagged"
  );

  // Action Handlers
  const handleAction = async (id: string, status: Booking['status']) => {
    try {
      await updateBookingStatus(id, status);
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  return (
    <div className={cn(
      "relative rounded-xl p-6 transition-all duration-300",
      "bg-white dark:bg-[#15181E]",
      "border border-slate-200 dark:border-white/[0.08]"
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Pending Approvals
            </h3>
            {pending.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                {pending.length} Action Required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Reservation requests awaiting administrative review
          </p>
        </div>
        
        <Link href={ROUTES.buildingAdmin.reservations} className="shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-semibold gap-1.5 h-8 px-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      <div className="space-y-2 pl-2">
        {pending.length > 0 ? (
          pending.slice(0, 2).map((request: Booking) => (
            <div
              key={request.id}
              className={cn(
                "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl transition-all duration-300",
                "bg-slate-50/50 dark:bg-white/[0.02]", 
                "border border-slate-100 dark:border-white/[0.04]",
                "hover:border-blue-500/30 dark:hover:border-blue-500/20 hover:translate-x-1"
              )}
            >
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase truncate text-slate-900 dark:text-white tracking-tight">
                    {request.facilityName || request.facility}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-micro font-black uppercase px-2 py-0.5 h-5
                      border-amber-200/50 dark:border-amber-500/20
                      bg-amber-50/50 dark:bg-amber-500/5
                      text-amber-600 dark:text-amber-400 rounded-lg"
                  >
                    {bookingTypeLabel(request.type)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-blue-500/60" /> {request.startTime} - {request.endTime}
                  </span>
                  <span className="truncate opacity-80">By: {request.requester}</span>
                  {request.booking_course_code && (
                    <span className="truncate opacity-80">
                      Course: {request.booking_course_code} — {request.course_name}
                      {request.is_elective && ` (Elective: ${request.elective_type})`}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:ml-4">
                <Button
                  size="icon"
                  onClick={() => handleAction(request.id, 'approved')}
                  className="h-9 w-9 rounded-xl border-0
                    bg-emerald-500/10 dark:bg-emerald-500/10
                    text-emerald-600 dark:text-emerald-400
                    hover:bg-emerald-500 hover:text-white
                    dark:hover:bg-emerald-500 dark:hover:text-white
                    shadow-sm shadow-emerald-500/10 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  onClick={() => handleAction(request.id, 'declined')}
                  className="h-9 w-9 rounded-xl border-0
                    bg-red-500/10 dark:bg-red-500/10
                    text-red-500 dark:text-red-400
                    hover:bg-red-500 hover:text-white
                    dark:hover:bg-red-500 dark:hover:text-white
                    shadow-sm shadow-red-500/10 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className={cn(
            "py-10 flex flex-col items-center justify-center rounded-xl",
            "border border-dashed border-slate-200 dark:border-white/10",
            "bg-slate-50/50 dark:bg-white/[0.01]"
          )}>
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <Inbox className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Inbox Zero
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              No pending requests requiring approval at this time
            </p>
          </div>
        )}
      </div>

      {pending.length > 2 && (
        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-white/5">
          <p className="text-center text-xxs font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest pl-2">
            + {pending.length - 2} more requests awaiting review
          </p>
        </div>
      )}
    </div>
  );
};