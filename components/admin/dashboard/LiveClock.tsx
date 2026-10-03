'use client'

import React, { useState, useEffect } from 'react';

export const LiveClock = () => {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Server SSR fallback / initial hydration match
  const dateFormatted = now 
    ? now.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : "Loading...";

  return (
    <div className="flex items-center gap-3 bg-card px-4 py-2.5 rounded-xl border border-border w-fit self-start md:self-auto shadow-sm">
      <div className="relative flex h-2.5 w-2.5 items-center justify-center">
        <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500/30" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-foreground font-bold">LIVE</span> — {dateFormatted}
      </span>
    </div>
  );
};
