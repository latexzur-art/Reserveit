'use client'

import { SchoolEventsPanel } from '@/components/shared/schedule-events/SchoolEventsPanel'

export default function AcademicSchoolEventsPage() {
    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-[#0B0F17] transition-colors duration-200">
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
                            School <span className="text-accent-brand">Events</span>
                        </h1>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                            Schedule institutional events, exam periods, and temporary venue overrides
                        </p>
                    </div>
                </div>

                <SchoolEventsPanel viewerRole="academic_head" />
            </div>
        </div>
    )
}
