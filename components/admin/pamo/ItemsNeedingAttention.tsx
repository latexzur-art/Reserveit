'use client'

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, Wrench, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MaintenanceItem = {
  id: string;
  code: string;
  name: string;
  facilityName: string;
  statusName: string;
};

type WarrantyItem = {
  id: string;
  code: string;
  name: string;
  warrantyExpiry: string;
};

type AttentionData = {
  maintenance: MaintenanceItem[];
  warrantyExpiring: WarrantyItem[];
  maintenanceCount: number;
  warrantyCount: number;
};

export const ItemsNeedingAttention = () => {
  const [data, setData] = useState<AttentionData>({ maintenance: [], warrantyExpiring: [], maintenanceCount: 0, warrantyCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/pamo/equipment/attention');
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json || { maintenance: [], warrantyExpiring: [], maintenanceCount: 0, warrantyCount: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasItems = (data.maintenance?.length ?? 0) > 0 || (data.warrantyExpiring?.length ?? 0) > 0;

  return (
    <div className={cn(
      "relative rounded-2xl p-5 transition-all duration-300",
      "bg-white dark:bg-[#15181E]",
      "border border-slate-200 dark:border-white/[0.06]",
      "shadow-sm dark:shadow-xl dark:shadow-blue-900/5",
      "overflow-hidden"
    )}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
            Needs
            <span className="text-amber-600 dark:text-amber-500">Attention</span>
          </h3>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
            Items requiring action
          </p>
        </div>
        {hasItems && !loading && (
          <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-amber-500/10 shrink-0">
            <AlertTriangle size={13} className="text-amber-500" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider animate-pulse">
            Loading…
          </p>
        </div>
      ) : error || !hasItems ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2">
          <CheckCircle2 size={20} className="text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            No items need attention
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
          {/* Maintenance Items */}
          {data.maintenance?.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 transition-colors duration-150 hover:bg-red-500/[0.03]"
            >
              <Wrench size={13} className="text-red-500 dark:text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase truncate tracking-tight text-slate-700 dark:text-slate-200">
                  {item.code} — {item.name}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate">
                  {item.facilityName}
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] font-bold uppercase px-1.5 py-0 h-5 rounded shrink-0 border-red-200/60 dark:border-red-500/20 text-red-600 dark:text-red-400 bg-transparent"
              >
                {item.statusName}
              </Badge>
            </div>
          ))}

          {/* Warranty Items */}
          {data.warrantyExpiring?.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 transition-colors duration-150 hover:bg-orange-500/[0.03]"
            >
              <ShieldAlert size={13} className="text-orange-500 dark:text-orange-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase truncate tracking-tight text-slate-700 dark:text-slate-200">
                  {item.code} — {item.name}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  Expires {item.warrantyExpiry}
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] font-bold uppercase px-1.5 py-0 h-5 rounded shrink-0 border-orange-200/60 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 bg-transparent"
              >
                Warranty
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
