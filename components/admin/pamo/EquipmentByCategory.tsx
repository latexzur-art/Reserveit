'use client'

import { useEffect, useState, useCallback } from "react";
import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type CategoryData = {
  id: string;
  name: string;
  count: number;
  available: number;
  inUse: number;
  maintenance: number;
};

export const EquipmentByCategory = () => {
  const [data, setData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/pamo/equipment/by-category');
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json.categories || []);
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
          Equipment
          <span className="text-emerald-600 dark:text-emerald-400">Breakdown</span>
        </h3>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
          Inventory by asset category
        </p>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider animate-pulse">
            Loading…
          </p>
        </div>
      ) : error || data.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2">
          <PackageOpen size={20} className="text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            No categories found
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.map(cat => {
            const pct = cat.count > 0 ? (cat.available / cat.count) * 100 : 0;
            return (
              <div
                key={cat.id || cat.name}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150",
                  "hover:bg-emerald-500/[0.04]"
                )}
              >
                {/* Name */}
                <span className="text-xs font-bold uppercase tracking-tight text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate">
                  {cat.name}
                </span>

                {/* Bar */}
                <div className="w-24 h-1 bg-slate-200/60 dark:bg-white/[0.06] rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                  />
                </div>

                {/* Count */}
                <span className="text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400 w-16 text-right shrink-0">
                  {cat.available}/{cat.count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
