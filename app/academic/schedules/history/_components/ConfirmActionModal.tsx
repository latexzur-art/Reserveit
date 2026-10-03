'use client'

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmAction {
    type: string
    id: string
    label: string
}

interface Props {
    confirmAction: ConfirmAction
    actionError: string | null
    actionLoading: string | null
    selectedSchedulesSize: number
    selectedUploadsSize: number
    selectedDraftsSize: number
    selectedRolledBackSize: number
    onConfirm: () => void
    onDismiss: () => void
}

export function ConfirmActionModal({
    confirmAction,
    actionError,
    actionLoading,
    selectedSchedulesSize,
    selectedUploadsSize,
    selectedDraftsSize,
    selectedRolledBackSize,
    onConfirm,
    onDismiss,
}: Props) {
    return (
        <AlertDialog open onOpenChange={(open) => { if (!open) onDismiss() }}>
            <AlertDialogContent className="bg-white dark:bg-[#0a0f1e] border-slate-200 dark:border-white/10 max-w-md">
                {actionError ? (
                    <>
                        <AlertDialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-lg">
                                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                                </div>
                                <AlertDialogTitle className="text-slate-900 dark:text-white">Cannot Delete</AlertDialogTitle>
                            </div>
                            <AlertDialogDescription className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line text-left">
                                {actionError}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction
                                onClick={onDismiss}
                                className="px-5 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-900 dark:text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                I Understand
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </>
                ) : (
                    <>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-slate-900 dark:text-white">
                                {confirmAction.type.includes('rollback') ? 'Rollback Action?' :
                                 confirmAction.type.includes('publish') ? 'Publish Action?' : 'Confirm Deletion?'}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-slate-500 dark:text-slate-400 text-left">
                                {confirmAction.type === 'rollback' || confirmAction.type === 'rollback-single'
                                    ? 'This will deactivate the selected published schedules. They will be moved back to the Drafts queue for revision.'
                                    : confirmAction.type === 'batch-rollback'
                                    ? `Are you sure you want to rollback ${selectedSchedulesSize} schedules? They will be moved back to Drafts.`
                                    : confirmAction.type === 'batch-delete-uploads'
                                    ? `Delete ${selectedUploadsSize} upload${selectedUploadsSize !== 1 ? 's' : ''}? Any published schedules will be rolled back first. This cannot be undone.`
                                    : confirmAction.type === 'batch-delete-drafts'
                                    ? `Are you sure you want to permanently delete ${selectedDraftsSize} drafts? This cannot be undone.`
                                    : confirmAction.type === 'batch-publish-drafts'
                                    ? `Are you sure you want to publish ${selectedDraftsSize} drafts? Overlapping schedules will fail to publish.`
                                    : confirmAction.type === 'batch-permanent-delete'
                                    ? `Permanently delete ${selectedRolledBackSize} rolled-back schedule(s)? This cannot be undone.`
                                    : confirmAction.type === 'publish-draft'
                                    ? `Are you sure you want to publish this draft schedule?`
                                    : `Are you sure you want to ${confirmAction.label}? This action cannot be undone.`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={onDismiss}
                                className="bg-transparent border-transparent px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-transparent dark:hover:bg-transparent transition-colors"
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => { e.preventDefault(); onConfirm() }}
                                disabled={!!actionLoading}
                                className={cn(
                                    'px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors',
                                    confirmAction.type.includes('rollback') ? 'bg-amber-500 hover:bg-amber-600' :
                                    confirmAction.type.includes('publish') ? 'bg-ah-sti-cyan hover:bg-ah-sti-cyan/80 text-[hsl(240,41%,12%)]' :
                                    'bg-red-500 hover:bg-red-600',
                                    actionLoading && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                {actionLoading ? 'Processing...' :
                                 confirmAction.type.includes('rollback') ? 'Rollback' :
                                 confirmAction.type.includes('publish') ? 'Publish' : 'Delete'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </>
                )}
            </AlertDialogContent>
        </AlertDialog>
    )
}
