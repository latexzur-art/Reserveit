'use client'

import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'

interface PublishedConflictWarningProps {
    publishedConflicts: any[]
    rollingBackConflicts: boolean
    onRollbackConflicts: () => void
}

export function PublishedConflictWarning({
    publishedConflicts,
    rollingBackConflicts,
    onRollbackConflicts,
}: PublishedConflictWarningProps) {
    if (publishedConflicts.length === 0) return null

    return (
        <div className="flex items-center justify-between gap-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                    <strong>{publishedConflicts.length}</strong> published {publishedConflicts.length === 1 ? 'entry conflicts' : 'entries conflict'} with an existing live schedule and should be rolled back.
                </span>
            </div>
            <button
                onClick={onRollbackConflicts}
                disabled={rollingBackConflicts}
                className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium border border-red-500/30 transition-colors disabled:opacity-50"
            >
                {rollingBackConflicts ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                Rollback Conflicted
            </button>
        </div>
    )
}
