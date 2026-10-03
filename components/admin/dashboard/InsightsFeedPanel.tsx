'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { AlertTriangle, Lightbulb, Wrench, Sparkles } from 'lucide-react'

export interface Insight {
  id: string
  severity: 'warning' | 'alert' | 'tip'
  icon: string
  title: string
  body: string
}

function severityStyles(s: Insight['severity']) {
  switch (s) {
    case 'warning':
      return { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-800', accent: 'text-amber-600' }
    case 'alert':
      return { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-800', accent: 'text-red-600' }
    case 'tip':
      return { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800', accent: 'text-blue-600' }
  }
}

function iconFor(name: string) {
  if (name === 'warning') return AlertTriangle
  if (name === 'wrench') return Wrench
  if (name === 'lightbulb') return Lightbulb
  return Sparkles
}

export function InsightsFeedPanel({ data }: { data: Insight[] }) {
  return (
    <Card className="p-8 rounded-[2.5rem] bg-card border border-border">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-4 h-4 text-[#FACC15] dark:text-[#0072bc]" />
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Smart System Insights</h3>
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest ml-auto">
          Auto-generated recommendations
        </span>
      </div>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[120px] text-muted-foreground font-black text-sm uppercase">
          All systems nominal — no actions recommended
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map(insight => {
            const styles = severityStyles(insight.severity)
            const Icon = iconFor(insight.icon)
            return (
              <li
                key={insight.id}
                className={`flex gap-3 p-4 rounded-2xl border ${styles.bg} ${styles.border}`}
              >
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${styles.accent}`} />
                <div className="flex-1">
                  <div className={`text-[10px] font-black uppercase tracking-widest ${styles.accent}`}>
                    {insight.title}
                  </div>
                  <div className="text-xs text-foreground mt-1">{insight.body}</div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
