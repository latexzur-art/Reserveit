import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse p-2 sm:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Skeleton className="h-8 w-48 sm:w-64 rounded-xl bg-slate-100 dark:bg-white/5" />
        <Skeleton className="h-8 w-28 rounded-xl bg-slate-100 dark:bg-white/5" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-3xl bg-slate-100/50 dark:bg-[#15181E]/50" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-80 rounded-3xl bg-slate-100/50 dark:bg-[#15181E]/50" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Skeleton className="h-44 rounded-3xl bg-slate-100/50 dark:bg-[#15181E]/50" />
            <Skeleton className="h-44 rounded-3xl bg-slate-100/50 dark:bg-[#15181E]/50" />
          </div>
          <Skeleton className="h-48 rounded-3xl bg-slate-100/50 dark:bg-[#15181E]/50" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-52 rounded-3xl bg-slate-100/50 dark:bg-[#15181E]/50" />
          <Skeleton className="h-full min-h-[400px] rounded-3xl bg-slate-100/50 dark:bg-[#15181E]/50" />
        </div>
      </div>
    </div>
  );
}