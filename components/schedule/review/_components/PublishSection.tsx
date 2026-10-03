'use client'

import {
    AlertTriangle,
    XCircle,
    Loader2,
    Rocket,
    ChevronDown,
    CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReservationImpactPreview } from '@/components/schedule/ReservationImpactPreview'

interface PublishSectionProps {
    counts: { approved: number; conflicts: number }
    showPublish: boolean
    setShowPublish: (v: boolean) => void
    publishResult: any
    publishError: string | null
    publishing: boolean
    hasApprovedErrors: boolean
    failedPublishRows: Set<number>
    impactCount: number
    setImpactCount: (n: number) => void
    setFilterStatus: (s: string) => void
    uploadId: string
    onPublish: () => Promise<void>
}

export function PublishSection({
    counts,
    showPublish,
    setShowPublish,
    publishResult,
    publishError,
    publishing,
    hasApprovedErrors,
    failedPublishRows,
    impactCount,
    setImpactCount,
    setFilterStatus,
    uploadId,
    onPublish,
}: PublishSectionProps) {
    if (counts.approved === 0) return null

    return (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Rocket className="h-4 w-4 text-ah-sti-cyan" />
                        Publish Approved Entries
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        {counts.approved} entries approved → push to live class schedules
                        {counts.conflicts > 0 && (
                            <span className="text-orange-400 ml-2 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-500" /> {counts.conflicts} unresolved conflict(s)
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={() => setShowPublish(!showPublish)}
                    className="flex items-center gap-2 px-4 py-2 bg-ah-sti-cyan/20 hover:bg-ah-sti-cyan/30 text-ah-sti-cyan rounded-lg text-xs font-medium border border-ah-sti-cyan/30 transition-colors"
                >
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showPublish && 'rotate-180')} />
                    {showPublish ? 'Hide' : 'Review Impact'}
                </button>
            </div>

            {showPublish && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                    <ReservationImpactPreview uploadId={uploadId} onCountChange={setImpactCount} />

                    {publishResult && (
                        <div className="space-y-3">
                            <div className={cn(
                                'border rounded-lg p-4 text-xs',
                                publishResult.entries_published > 0
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            )}>
                                <p className="font-medium text-sm">
                                    {publishResult.entries_published > 0 ? <span className="inline-flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500 inline" /> Publish Complete!</span> : <span className="inline-flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-500 inline" /> Publish ran but 0 entries were published</span>}
                                </p>
                                <div className="mt-2 space-y-1">
                                    <p>• {publishResult.entries_published} entries successfully published to live schedules.</p>
                                    <p>• {publishResult.reservations_cancelled} conflicting reservations were cancelled.</p>
                                </div>
                            </div>

                            {publishResult.errors?.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-xs text-red-400">
                                    <p className="font-semibold text-sm mb-2">Insert errors ({publishResult.errors.length}):</p>
                                    <ul className="space-y-1 list-disc list-inside">
                                        {publishResult.errors.map((e: string, i: number) => (
                                            <li key={i}>{e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {failedPublishRows.size > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-xs text-amber-400">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">Some entries were skipped due to overlaps</p>
                                            <p className="mt-1 text-amber-500/80 mb-3">
                                                These entries had the exact same room, day, and time as an existing class schedule, which violates the strict no-overlap rule.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setFilterStatus('publish_failed')
                                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                                }}
                                                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 rounded text-xs font-medium transition-colors"
                                            >
                                                Review Skipped Entries ({failedPublishRows.size})
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {publishError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-xs text-red-400 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-sm">Publish Failed</p>
                                <p className="mt-0.5">{publishError}</p>
                            </div>
                        </div>
                    )}

                    {hasApprovedErrors && !publishResult && !publishError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-xs text-red-400 flex items-start gap-3">
                            <XCircle className="h-5 w-5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-sm">Cannot Publish</p>
                                <p className="mt-0.5">Some entries marked as "Approved" have validation errors. Please edit and fix the errors or reject the entries.</p>
                            </div>
                        </div>
                    )}

                    {!publishResult && (
                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                            <p className="text-[10px] text-muted-foreground flex-1">
                                This action is irreversible. {impactCount > 0 ? `${impactCount} booking(s) will be cancelled.` : ''}
                            </p>
                            <button
                                onClick={onPublish}
                                disabled={publishing || hasApprovedErrors}
                                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                                {publishing ? 'Publishing...' : 'Publish to Live'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
