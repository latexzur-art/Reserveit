'use client'

import { AlertTriangle } from 'lucide-react'

interface ConfirmationModalProps {
    confirmAction: { type: string; id?: string; label: string; action: () => Promise<void> } | null
    onCancel: () => void
    onConfirm: () => Promise<void>
}

export function ConfirmationModal({ confirmAction, onCancel, onConfirm }: ConfirmationModalProps) {
    if (!confirmAction) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Confirm Action</h3>
                </div>
                <p className="text-sm text-slate-400 mb-6">
                    {confirmAction.label}
                </p>
                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-amber-500/20"
                    >
                        Proceed
                    </button>
                </div>
            </div>
        </div>
    )
}
