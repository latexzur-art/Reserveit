"use client"

import { AcademicHeadSidebar } from "./AcademicHeadSidebar"
import { AcademicHeadHeader } from "./AcademicHeadHeader"
import { ErrorBoundary } from "@/components/errors/ErrorBoundary"
import { cn } from "@/lib/utils"
import { useUI } from "@/contexts/UIContext"

export default function AcademicHeadLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { textSizeEnlarged } = useUI()

    return (
        <div className={cn(
            "theme-academic flex h-screen w-full overflow-hidden transition-colors duration-500 font-sans",
            "bg-slate-50 dark:bg-[#0B0E11] text-slate-900 dark:text-slate-100",
            textSizeEnlarged && "text-enlarged"
        )}>
            <AcademicHeadSidebar />

            <div className="flex flex-1 flex-col min-w-0">
                <AcademicHeadHeader />

                <main className={cn(
                    "flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar",
                    "p-4 sm:p-8 lg:p-12",
                    "transition-all duration-200"
                )}>
                    <ErrorBoundary>
                        <div className="relative z-0">
                            {children}
                            {/* Spacer to prevent fixed floating actions from overlapping bottom content */}
                            <div className="h-24 shrink-0" aria-hidden="true" />
                        </div>
                    </ErrorBoundary>
                </main>
            </div>
        </div>
    )
}