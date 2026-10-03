'use client'

import React, { useState, useCallback } from 'react'
import { Plus, Trash2, Download, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

const DELIVERY_MODES = [
    { value: 'lecture', label: 'Lecture' },
    { value: 'lab', label: 'Lab' },
    { value: 'both', label: 'Both' },
    { value: 'practicum', label: 'Practicum' },
]

export interface CourseManualEntry {
    department_code?: string
    course_code: string
    course_name: string
    units: string
    year_level: string
    term: string
    delivery_mode: string
    lecture_hours: string
    lab_hours: string
    is_elective: boolean
    elective_type: string
}

interface BulkManualCourseTableProps {
    rows: CourseManualEntry[]
    onChange: (rows: CourseManualEntry[]) => void
    isMixedMode?: boolean
}

const EMPTY_ROW: CourseManualEntry = {
    department_code: '',
    course_code: '',
    course_name: '',
    units: '3',
    year_level: '1',
    term: '1',
    delivery_mode: 'lecture',
    lecture_hours: '',
    lab_hours: '',
    is_elective: false,
    elective_type: '',
}

function hasRowError(row: CourseManualEntry, isMixedMode: boolean): string[] {
    const errors: string[] = []
    if (isMixedMode && !row.department_code?.trim()) errors.push('Dept Code is required in Mixed Mode')
    if (!row.course_code?.trim()) errors.push('Course Code is required')
    if (!row.course_name?.trim()) errors.push('Course Name is required')
    if (!row.units || isNaN(Number(row.units))) errors.push('Units must be a number')
    if (row.is_elective && !row.elective_type?.trim()) errors.push('Elective name required if marked as elective')
    return errors
}

export function BulkManualCourseTable({ rows, onChange, isMixedMode = false }: BulkManualCourseTableProps) {
    const addRow = useCallback(() => {
        onChange([...rows, { ...EMPTY_ROW }])
    }, [rows, onChange])

    const removeRow = useCallback((index: number) => {
        onChange(rows.filter((_, i) => i !== index))
    }, [rows, onChange])

    const updateCell = useCallback((index: number, field: keyof CourseManualEntry, value: string | boolean) => {
        const updated = rows.map((row, i) => {
            if (i !== index) return row
            const newRow = { ...row, [field]: value }
            
            // Auto-clear hours based on delivery mode
            if (field === 'delivery_mode') {
                if (value === 'lecture') newRow.lab_hours = ''
                else if (value === 'lab') newRow.lecture_hours = ''
                else if (value === 'practicum') { newRow.lecture_hours = ''; newRow.lab_hours = '' }
            }
            
            // Clear elective name if turned off
            if (field === 'is_elective' && !value) {
                newRow.elective_type = ''
            }
            return newRow
        })
        onChange(updated)
    }, [rows, onChange])

    const handlePaste = useCallback((e: React.ClipboardEvent, startRowIndex: number) => {
        const clipboardData = e.clipboardData.getData('Text')
        if (!clipboardData) return

        const isTabular = clipboardData.includes('\t') || clipboardData.includes('\n')
        if (!isTabular) return 

        e.preventDefault()
        e.stopPropagation()

        const pastedRows = clipboardData.split(/\r?\n/).filter(r => r.trim().length > 0).map(r => r.split('\t'))
        if (pastedRows.length === 0) return

        const updated = [...rows]
        
        const requiredRows = startRowIndex + pastedRows.length
        while (updated.length < requiredRows) {
            updated.push({ ...EMPTY_ROW })
        }

        pastedRows.forEach((pastedCols, i) => {
            const rowIndex = startRowIndex + i
            const row = { ...updated[rowIndex] }
            
            let colOffset = 0
            if (isMixedMode) {
                if (pastedCols[colOffset] !== undefined) row.department_code = pastedCols[colOffset].trim()
                colOffset++
            }

            if (pastedCols[colOffset] !== undefined) row.course_code = pastedCols[colOffset].trim()
            if (pastedCols[colOffset+1] !== undefined) row.course_name = pastedCols[colOffset+1].trim()
            if (pastedCols[colOffset+2] !== undefined) row.units = pastedCols[colOffset+2].trim()
            if (pastedCols[colOffset+3] !== undefined) row.year_level = pastedCols[colOffset+3].trim()
            if (pastedCols[colOffset+4] !== undefined) row.term = pastedCols[colOffset+4].trim()
            
            if (pastedCols[colOffset+5] !== undefined) {
               const mode = pastedCols[colOffset+5].trim().toLowerCase()
               const matched = DELIVERY_MODES.find(m => m.label.toLowerCase() === mode || m.value === mode)
               if (matched) row.delivery_mode = matched.value
            }
            
            if (pastedCols[colOffset+6] !== undefined) row.lecture_hours = pastedCols[colOffset+6].trim()
            if (pastedCols[colOffset+7] !== undefined) row.lab_hours = pastedCols[colOffset+7].trim()
            
            if (pastedCols[colOffset+8] !== undefined) {
                const isEl = pastedCols[colOffset+8].trim().toLowerCase()
                row.is_elective = ['yes', 'true', '1', 'y'].includes(isEl)
            }
            if (pastedCols[colOffset+9] !== undefined) row.elective_type = pastedCols[colOffset+9].trim()

            updated[rowIndex] = row
        })

        onChange(updated)
    }, [rows, onChange, isMixedMode])

    const exportCSV = useCallback(() => {
        if (rows.length === 0) return
        const headers = []
        if (isMixedMode) headers.push('Department Code')
        headers.push('Course Code', 'Course Name', 'Units', 'Year Level', 'Term', 'Delivery Mode', 'Lecture Hours', 'Lab Hours', 'Is Elective', 'Elective Name')
        
        const csvRows = rows.map(r => {
            const cols = []
            if (isMixedMode) cols.push(`"${r.department_code || ''}"`)
            cols.push(
                `"${r.course_code}"`, `"${r.course_name}"`, `"${r.units}"`, `"${r.year_level}"`, `"${r.term}"`,
                `"${r.delivery_mode}"`, `"${r.lecture_hours}"`, `"${r.lab_hours}"`,
                `"${r.is_elective ? 'Yes' : 'No'}"`, `"${r.elective_type}"`
            )
            return cols.join(',')
        })

        const csvContent = [headers.join(','), ...csvRows].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `course_entries_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [rows, isMixedMode])

    const filledRows = rows.filter(r => r.course_code || r.course_name)
    const validCount = filledRows.filter(r => hasRowError(r, isMixedMode).length === 0).length
    const errorCount = filledRows.length - validCount

    return (
        <div className="flex flex-col flex-1 space-y-4 h-full min-h-0">
            {/* Header bar */}
            <div className="flex flex-wrap gap-4 justify-between items-end shrink-0">
                <div>
                    <p className="text-sm font-medium">Manual Entry Grid</p>
                    <p className="text-xs text-muted-foreground">Fill out the rows or paste directly from Excel/CSV (Tab-Separated).</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={exportCSV}
                        disabled={rows.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium border border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Download className="h-3 w-3" /> Export
                    </button>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {validCount} valid
                    </Badge>
                    {errorCount > 0 && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300">
                            <XCircle className="h-3.5 w-3.5 mr-1" /> {errorCount} errors
                        </Badge>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="border rounded-md flex-1 overflow-auto shadow-sm min-h-[400px]">
                <Table className="min-w-max relative" style={{ minWidth: isMixedMode ? '1300px' : '1100px' }}>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                            <TableHead className="w-10 px-2 text-center">#</TableHead>
                            {isMixedMode && <TableHead className="w-[100px] text-xs">Dept Code *</TableHead>}
                            <TableHead className="w-[120px] text-xs">Course Code *</TableHead>
                            <TableHead className="w-[200px] text-xs">Course Name *</TableHead>
                            <TableHead className="w-[70px] text-xs text-center">Units</TableHead>
                            <TableHead className="w-[80px] text-xs text-center">Year</TableHead>
                            <TableHead className="w-[80px] text-xs text-center">Term</TableHead>
                            <TableHead className="w-[120px] text-xs">Mode</TableHead>
                            <TableHead className="w-[80px] text-xs text-center">Lec Hrs</TableHead>
                            <TableHead className="w-[80px] text-xs text-center">Lab Hrs</TableHead>
                            <TableHead className="w-[80px] text-xs text-center">Elective</TableHead>
                            <TableHead className="w-[160px] text-xs">Elective Name</TableHead>
                            <TableHead className="w-10"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={isMixedMode ? 13 : 12} className="py-8 text-center text-muted-foreground text-xs">
                                    No entries yet. Click &quot;+ Add Row&quot; to start.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row, i) => {
                                const isFilled = row.course_code || row.course_name
                                const errors = hasRowError(row, isMixedMode)
                                const hasError = isFilled && errors.length > 0

                                return (
                                    <TableRow
                                        key={i}
                                        className={cn(hasError ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-muted/30')}
                                        onPaste={(e) => handlePaste(e, i)}
                                    >
                                        <TableCell className="text-xs text-muted-foreground px-2 py-1 text-center border-r">
                                            {i + 1}
                                        </TableCell>
                                        {isMixedMode && (
                                            <TableCell className="p-1 border-r">
                                                <Input
                                                    className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent font-mono"
                                                    value={row.department_code || ''}
                                                    onChange={e => updateCell(i, 'department_code', e.target.value.toUpperCase())}
                                                    placeholder="CS"
                                                    title={hasError && errors.includes('Dept Code is required in Mixed Mode') ? 'Dept Code is required' : undefined}
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell className="p-1">
                                            <Input
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent font-mono uppercase"
                                                value={row.course_code}
                                                onChange={e => updateCell(i, 'course_code', e.target.value.toUpperCase())}
                                                placeholder="CS101"
                                                title={hasError && errors.includes('Course Code is required') ? 'Course Code is required' : undefined}
                                            />
                                        </TableCell>
                                        <TableCell className="p-1 border-l">
                                            <Input
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent"
                                                value={row.course_name}
                                                onChange={e => updateCell(i, 'course_name', e.target.value)}
                                                placeholder="Intro to Computing"
                                            />
                                        </TableCell>
                                        <TableCell className="p-1 border-l">
                                            <Input
                                                type="number" min="1" max="12"
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent text-center"
                                                value={row.units}
                                                onChange={e => updateCell(i, 'units', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell className="p-1 border-l">
                                            <Select value={row.year_level} onValueChange={v => updateCell(i, 'year_level', v)}>
                                                <SelectTrigger className="h-8 text-xs border-0 rounded-none focus:ring-1 bg-transparent">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[1,2,3,4].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="p-1 border-l">
                                            <Select value={row.term} onValueChange={v => updateCell(i, 'term', v)}>
                                                <SelectTrigger className="h-8 text-xs border-0 rounded-none focus:ring-1 bg-transparent">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[1,2,3].map(t => <SelectItem key={t} value={String(t)}>{t}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="p-1 border-l">
                                            <Select value={row.delivery_mode} onValueChange={v => updateCell(i, 'delivery_mode', v)}>
                                                <SelectTrigger className="h-8 text-xs border-0 rounded-none focus:ring-1 bg-transparent">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DELIVERY_MODES.map(m => (
                                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="p-1 border-l">
                                            <Input
                                                type="number" min="0" step="0.5"
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent text-center disabled:opacity-40"
                                                value={row.lecture_hours}
                                                onChange={e => updateCell(i, 'lecture_hours', e.target.value)}
                                                disabled={row.delivery_mode === 'lab' || row.delivery_mode === 'practicum'}
                                            />
                                        </TableCell>
                                        <TableCell className="p-1 border-l">
                                            <Input
                                                type="number" min="0" step="0.5"
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent text-center disabled:opacity-40"
                                                value={row.lab_hours}
                                                onChange={e => updateCell(i, 'lab_hours', e.target.value)}
                                                disabled={row.delivery_mode === 'lecture' || row.delivery_mode === 'practicum'}
                                            />
                                        </TableCell>
                                        <TableCell className="p-1 border-l flex items-center justify-center">
                                            <div className="flex h-8 items-center justify-center">
                                                <Switch 
                                                    checked={row.is_elective}
                                                    onCheckedChange={v => updateCell(i, 'is_elective', v)}
                                                    className="scale-75 data-[state=checked]:bg-emerald-500"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-1 border-l">
                                            <Input
                                                className={cn(
                                                    "h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent",
                                                    row.is_elective && !row.elective_type?.trim() ? "border-b border-red-500 focus-visible:ring-red-500" : ""
                                                )}
                                                value={row.elective_type}
                                                onChange={e => updateCell(i, 'elective_type', e.target.value)}
                                                disabled={!row.is_elective}
                                                placeholder={row.is_elective ? "e.g. Web Dev" : "—"}
                                                title={hasError && errors.includes('Elective name required if marked as elective') ? 'Elective Name is required' : undefined}
                                            />
                                        </TableCell>
                                        <TableCell className="p-1 border-l text-center">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                                                onClick={() => removeRow(i)}
                                                title="Remove row"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Add Row */}
            <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed shadow-sm"
                onClick={addRow}
            >
                <Plus className="h-4 w-4 mr-2" /> Add Row
            </Button>
        </div>
    )
}
