'use client'

import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  tooltip?: string;
  href?: string;
  onClick?: () => void;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

const variantMap = {
  default: { 
    icon: "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500",
    glow: "group-hover:shadow-slate-500/5",
    accent: "bg-slate-400 dark:bg-slate-500"
  },
  primary: { 
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    glow: "group-hover:shadow-blue-500/10",
    accent: "bg-blue-500"
  },
  success: { 
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    glow: "group-hover:shadow-emerald-500/10",
    accent: "bg-emerald-500"
  },
  warning: { 
    icon: "bg-yellow-400/10 text-yellow-600 dark:text-yellow-400",
    glow: "group-hover:shadow-yellow-400/10",
    accent: "bg-yellow-400"
  },
  destructive: { 
    icon: "bg-red-500/10 text-red-600 dark:text-red-400",
    glow: "group-hover:shadow-red-500/10",
    accent: "bg-red-500"
  },
};

import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";

export const StatsCard = ({
  title, value, subtitle, icon: Icon, tooltip, href, onClick, trend, variant = "default"
}: StatsCardProps) => {
  const router = useRouter();
  const v = variantMap[variant];

  const handleAction = () => {
    if (onClick) onClick();
    else if (href) router.push(href);
  };

  const isClickable = Boolean(href || onClick);

  const card = (
    <div
      onClick={handleAction}
      className={cn(
        "stats-card group relative rounded-xl p-5 transition-all duration-300 overflow-hidden",
        "bg-white dark:bg-[#15181E]",
        "border border-slate-200 dark:border-white/[0.08]",
        "hover:border-slate-300 dark:hover:border-white/20",
        isClickable && "cursor-pointer hover:shadow-md active:scale-[0.99]"
      )}
    >
      <div className="stats-card-body relative z-10 flex items-start justify-between gap-4">
        <div className="stats-card-content min-w-0 flex-1">
          <header className="mb-1.5 flex items-center justify-between">
            <p className="stats-card-title text-xs font-semibold text-slate-500 dark:text-slate-400">
              {title}
            </p>
            {isClickable && (
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
            )}
          </header>
          
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="stats-card-value text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white transition-colors">
              {value}
            </p>
            {trend && (
              <span className={cn(
                "flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold",
                trend.positive 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              )}>
                {trend.positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} {trend.value}
              </span>
            )}
          </div>

          {subtitle && (
            <p className="stats-card-subtitle text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
              {subtitle}
            </p>
          )}
        </div>

        <div className={cn(
          "stats-card-icon-wrapper p-3 rounded-xl shrink-0 transition-transform duration-300",
          v.icon,
          isClickable && "group-hover:scale-105"
        )}>
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
      </div>
    </div>
  );

  if (!tooltip) return card;
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-slate-900 dark:bg-[#1A1D23] text-white border-none rounded-xl text-xxs font-black uppercase tracking-widest px-3 py-2 shadow-2xl"
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};