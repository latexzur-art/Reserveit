import { cn } from "@/lib/utils"

interface SkeletonListProps {
  count?: number
  className?: string
  cardClassName?: string
}

export function SkeletonList({ count = 4, className, cardClassName }: SkeletonListProps) {
  return (
    <div className={cn("space-y-4 w-full", className)}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={cn("bg-white dark:bg-slate-900/50 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800/50 animate-pulse", cardClassName)}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
            <div className="flex-1 space-y-3 py-1">
              <div className="h-4 w-2/3 max-w-[200px] bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-1/2 max-w-[150px] bg-slate-200 dark:bg-slate-800 rounded-md" />
              
              <div className="pt-2 flex gap-3">
                <div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
