'use client'

import { BookOpen, GraduationCap, ArrowUpRight } from "lucide-react"
import { useDataStore } from "@/lib/data-store"
import { cn } from "@/lib/utils"
import { getTodaysClassSchedules } from "./classSchedulesTodayUtils"

export const ClassSchedulesToday = () => {
  const { classSchedules, facilities } = useDataStore()
  const today = new Date()
  const classes = getTodaysClassSchedules(classSchedules ?? [], facilities ?? [], today)

  return (
    <div className={cn(
      "relative rounded-xl p-6 transition-all duration-300",
      "bg-white dark:bg-[#15181E]",
      "border border-slate-200 dark:border-white/[0.08]"
    )}>
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Classes Today
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {classes.length} Scheduled {classes.length === 1 ? 'Class' : 'Classes'}
          </p>
        </div>
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <ArrowUpRight size={16} className="text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>

      <div className="space-y-3 relative z-10">
        {classes.length === 0 ? (
          <div className={cn(
            "py-10 flex flex-col items-center justify-center rounded-xl",
            "border border-dashed border-slate-200 dark:border-white/10",
            "bg-slate-50/50 dark:bg-white/[0.01]"
          )}>
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <GraduationCap className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No Classes Today
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              No scheduled classes for today
            </p>
          </div>
        ) : (
          classes.slice(0, 4).map((c) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
                "bg-slate-50/50 dark:bg-white/[0.02]",
                "border border-slate-100 dark:border-white/[0.04]",
                "hover:border-emerald-500/30 dark:hover:border-emerald-500/20 hover:scale-[1.02]"
              )}
            >
              <div className={cn(
                "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center",
                "bg-emerald-600/5 dark:bg-emerald-600/10",
                "border border-emerald-600/10 dark:border-emerald-600/20"
              )}>
                <BookOpen size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold truncate text-slate-900 dark:text-white">
                  {c.courseName}
                </h4>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5 uppercase tracking-tight">
                  {c.courseCode} — {c.section}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    {c.startTime}–{c.endTime}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate uppercase tracking-tight">
                    {c.facilityName}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {classes.length > 4 && (
        <div className="mt-5 pt-4 border-t border-dashed border-slate-200 dark:border-white/10 text-center">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            + {classes.length - 4} more classes today
          </p>
        </div>
      )}
    </div>
  )
}
