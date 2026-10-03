'use client'

/**
 * FileDropZone — CSV/Excel file drag & drop component.
 */

import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
    onFileSelected: (file: File) => void
    accept?: string
    maxSizeMB?: number
    className?: string
}

export function FileDropZone({
    onFileSelected,
    accept = '.csv,.xlsx,.xls',
    maxSizeMB = 10,
    className,
}: FileDropZoneProps) {
    const [dragActive, setDragActive] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const validateAndSelect = useCallback((file: File) => {
        setError(null)

        const validExtensions = accept.split(',').map(e => e.trim().toLowerCase())
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()
        if (!validExtensions.includes(ext)) {
            setError(`Invalid file type. Accepted: ${accept}`)
            return
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`File too large. Maximum: ${maxSizeMB}MB`)
            return
        }

        setSelectedFile(file)
        onFileSelected(file)
    }, [accept, maxSizeMB, onFileSelected])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(false)
        const file = e.dataTransfer.files[0]
        if (file) validateAndSelect(file)
    }, [validateAndSelect])

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(e.type === 'dragenter' || e.type === 'dragover')
    }, [])

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) validateAndSelect(file)
    }, [validateAndSelect])

    const clearFile = () => {
        setSelectedFile(null)
        setError(null)
        if (inputRef.current) inputRef.current.value = ''
    }

    return (
        <div className={cn('w-full', className)}>
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                    dragActive
                        ? 'border-ah-sti-cyan bg-ah-sti-cyan/5 scale-[1.01]'
                        : selectedFile
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]',
                )}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleChange}
                    className="hidden"
                />

                {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-emerald-400" />
                        <div className="text-left">
                            <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                            <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); clearFile() }}
                            className="ml-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <X className="h-4 w-4 text-slate-400" />
                        </button>
                    </div>
                ) : (
                    <>
                        <Upload className={cn(
                            'h-10 w-10 mx-auto mb-3 transition-colors',
                            dragActive ? 'text-ah-sti-cyan' : 'text-slate-500',
                        )} />
                        <p className="text-sm text-slate-300 mb-1">
                            {dragActive ? 'Drop your file here' : 'Drag & drop a schedule file here'}
                        </p>
                        <p className="text-xs text-slate-500">
                            or <span className="text-ah-sti-cyan underline">browse files</span> • CSV, XLSX up to {maxSizeMB}MB
                        </p>
                    </>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 mt-2 text-xs text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {error}
                </div>
            )}
        </div>
    )
}
