'use client'

import { CheckCircle2, XCircle, Clock, Loader2, Send, MessageSquare } from 'lucide-react'

interface SubmitWorkflowProps {
    upload: any
    validationCounts: { errors: number }
    submitting: boolean
    onSubmit: () => void
}

export function SubmitWorkflow({
    upload,
    validationCounts,
    submitting,
    onSubmit,
}: SubmitWorkflowProps) {
    // upload is already defined as a memo above — use it directly
    const status = upload?.upload_status
    const revisionNotes = upload?.review_notes

    if (status === 'submitted') {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg text-sm font-medium">
                <Clock className="h-4 w-4" />
                Awaiting Academic Head Review
            </div>
        )
    }
    if (status === 'approved') {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Approved
            </div>
        )
    }
    if (status === 'rejected') {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded-lg text-sm font-medium">
                <XCircle className="h-4 w-4" />
                Rejected
            </div>
        )
    }

    const hasErrors = validationCounts.errors > 0

    return (
        <div className="flex flex-col gap-3">
            {revisionNotes && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-orange-600">Revision Requested by Academic Head</p>
                        <p className="text-sm text-orange-600/80 mt-1">{revisionNotes}</p>
                    </div>
                </div>
            )}
            <div className="flex justify-end pt-4 border-t border-border mt-2">
                <button
                    onClick={onSubmit}
                    disabled={submitting || hasErrors}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    title={hasErrors ? `Fix ${validationCounts.errors} error(s) before submitting` : 'Submit for academic head review'}
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {submitting ? 'Submitting…' : 'Submit for Review'}
                </button>
            </div>
        </div>
    )
}
