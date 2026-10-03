'use client'

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Archive, Building2, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

type FacilityDistributionItem = {
  facilityId: string | null;
  facilityName: string;
  count: number;
};

export const FacilityDistribution = () => {
  const [data, setData] = useState<FacilityDistributionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/pamo/equipment/by-facility');
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json.facilities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className={cn(
      "relative rounded-2xl p-5 transition-all duration-300",
      "bg-white dark:bg-[#15181E]",
      "border border-slate-200 dark:border-white/[0.06]",
      "shadow-sm dark:shadow-xl dark:shadow-blue-900/5",
      "overflow-hidden"
    )}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
          Facility
          <span className="text-blue-600 dark:text-blue-400">Distribution</span>
        </h3>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
          Asset deployment locations
        </p>
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider animate-pulse">
            Loading…
          </p>
        </div>
      ) : error || data.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2">
          <LayoutGrid size={20} className="text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            No equipment to distribute
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
          {data.map((item, index) => {
            const isStorage = item.facilityId === null;
            return (
              <div
                key={item.facilityId || `storage-${index}`}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 transition-colors duration-150 hover:bg-blue-500/[0.03]"
              >
                {isStorage ? (
                  <Archive size={13} className="text-blue-500 dark:text-blue-400 shrink-0" />
                ) : (
                  <Building2 size={13} className="text-blue-500 dark:text-blue-400 shrink-0" />
                )}
                <span className="text-xs font-bold uppercase truncate tracking-tight text-slate-700 dark:text-slate-200 flex-1 min-w-0">
                  {isStorage ? "Storage" : item.facilityName}
                </span>
                <Badge
                  className="text-[10px] font-bold tabular-nums px-2 py-0 h-5 rounded shrink-0 border-none bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                >
                  {item.count}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
