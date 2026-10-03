'use client'

import type { FC } from 'react'
import { cn } from '@/lib/utils'

type TabKey = 'uploads' | 'schedules' | 'drafts' | 'rolledback' | 'changelog' | 'activitylogs'

interface Tab {
    key: TabKey
    label: string
    icon: React.ElementType
    count?: number
}

interface Props {
    tabs: Tab[]
    activeTab: TabKey
    onTabChange: (key: TabKey) => void
}

export function HistoryHeader({ tabs, activeTab, onTabChange }: Props) {
    return (
        <>
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
                    Schedule <span className="text-accent-brand">History</span>
                </h1>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                    View upload history, manage published schedules, and track changes
                </p>
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Schedule history sections" className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-1.5">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        onClick={() => onTabChange(tab.key)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center',
                            activeTab === tab.key
                                ? 'bg-ah-sti-cyan/15 text-ah-sti-cyan border border-ah-sti-cyan/30 shadow-sm'
                                : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                        )}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className={cn(
                                'text-xs px-1.5 py-0.5 rounded-full',
                                activeTab === tab.key
                                    ? 'bg-ah-sti-cyan/20 text-ah-sti-cyan'
                                    : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                            )}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </>
    )
}
