'use client'

import { ArrowLeft, FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'

interface ScheduleReviewHeaderProps {
    backHref: string
    upload: any
    entryCount: number
}

export function ScheduleReviewHeader({ backHref, upload, entryCount }: ScheduleReviewHeaderProps) {
    return (
        <div className="flex items-center gap-4">
            <Link
                href={backHref}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
            <div className="flex-1">
                <h1 className="text-xl font-bold text-foreground flex items-center gap-3">
                    <FileSpreadsheet className="h-6 w-6 text-ah-sti-cyan" />
                    {upload?.departments?.name ?? 'Schedule Review'}
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                    {upload?.source_file_name ?? 'Manual Entry'} • {upload?.users?.full_name} • {entryCount} entries
                </p>
            </div>
        </div>
    )
}
