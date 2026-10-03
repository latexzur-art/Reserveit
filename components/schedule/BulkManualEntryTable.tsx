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
import { TimeSlotPicker } from '@/components/ui/TimeSlotPicker'

const DAY_OPTIONS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' },
]

const DAY_LABELS: Record<number, string> = {
    0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
    4: 'Thursday', 5: 'Friday', 6: 'Saturday',
}

export interface ManualEntry {
    course_code: string
    course_name: string
    section: string
    instructor: string
    room: string
    session_type: string
    day_of_week: number
    start_time: string
    end_time: string
}

interface BulkManualEntryTableProps {
    rows: ManualEntry[]
    onChange: (rows: ManualEntry[]) => void
}

const EMPTY_ROW: ManualEntry = {
    course_code: '',
    course_name: '',
    section: '',
    instructor: '',
    room: '',
    session_type: '',
    day_of_week: 1,
    start_time: '08:00',
    end_time: '09:00',
}

function hasRowError(row: ManualEntry): string[] {
    const errors: string[] = []
    if (!row.course_code?.trim()) errors.push('Course Code is required')
    if (!row.section?.trim()) errors.push('Section is required')
    if (!row.room?.trim()) errors.push('Room is required')
    if (!row.start_time) errors.push('Start time is required')
    if (!row.end_time) errors.push('End time is required')
    if (row.start_time && row.end_time && row.start_time >= row.end_time) {
        errors.push('End time must be after start time')
    }
    // Operating hours: 7:00 AM (07:00) to 7:00 PM (19:00)
    if (row.start_time && row.start_time < '07:00') {
        errors.push(`Start time ${row.start_time} is before 7:00 AM — did you mean ${row.start_time.replace(/^0/, '1')} PM (${String(parseInt(row.start_time) + 12).padStart(2,'0')}:${row.start_time.split(':')[1]})?`)
    }
    if (row.end_time && row.end_time > '19:00') {
        errors.push('End time is after 7:00 PM')
    }
    return errors
}

function parseTimeValue(timeStr: string): string {
    if (!timeStr) return ''
    const str = timeStr.trim().toUpperCase()
    
    // 24-hour format (e.g. 08:00, 14:30)
    const match24 = str.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/)
    if (match24) {
        let hours = parseInt(match24[1], 10)
        // Auto-correct 12:00 AM - 6:59 AM to PM (Operating hours are 7 AM to 7 PM)
        if (hours >= 0 && hours <= 6) {
            hours += 12
        }
        return `${hours.toString().padStart(2, '0')}:${match24[2]}`
    }

    // 12-hour format (e.g. 8:00 AM, 01:30 PM)
    const match12 = str.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/)
    if (match12) {
        let [_, hoursStr, minutes, period] = match12
        let hours = parseInt(hoursStr, 10)
        
        if (period === 'PM' && hours < 12) {
            hours += 12
        } else if (period === 'AM' && hours === 12) {
            hours = 0
        }
        
        // Auto-correct 12:00 AM - 6:59 AM to PM
        if (hours >= 0 && hours <= 6) {
            hours += 12
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes}`
    }

    return timeStr
}

export function BulkManualEntryTable({ rows, onChange }: BulkManualEntryTableProps) {
    const [isConfirmingClear, setIsConfirmingClear] = useState(false)
    const addRow = useCallback(() => {
        onChange([...rows, { ...EMPTY_ROW }])
    }, [rows, onChange])

    const removeRow = useCallback((index: number) => {
        onChange(rows.filter((_, i) => i !== index))
    }, [rows, onChange])

    const updateCell = useCallback((index: number, field: keyof ManualEntry, value: string | number) => {
        let finalValue = value;
        // Auto-correct times like 01:00 (1 AM) to 13:00 (1 PM) since operating hours are 7 AM - 7 PM
        if ((field === 'start_time' || field === 'end_time') && typeof value === 'string' && value) {
            const [hStr, mStr] = value.split(':');
            let hours = parseInt(hStr, 10);
            if (!isNaN(hours) && hours >= 0 && hours <= 6) {
                hours += 12;
                finalValue = `${hours.toString().padStart(2, '0')}:${mStr}`;
            }
        }

        const updated = rows.map((row, i) =>
            i === index ? { ...row, [field]: finalValue } : row
        )
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
            
            // Map: 0: Code, 1: Name, 2: Section, 3: Instructor, 4: Room, 5: Type, 6: Day, 7: Start, 8: End
            if (pastedCols[0] !== undefined) row.course_code = pastedCols[0].trim()
            if (pastedCols[1] !== undefined) row.course_name = pastedCols[1].trim()
            if (pastedCols[2] !== undefined) row.section = pastedCols[2].trim()
            if (pastedCols[3] !== undefined) row.instructor = pastedCols[3].trim()
            if (pastedCols[4] !== undefined) row.room = pastedCols[4].trim()
            
            if (pastedCols[5] !== undefined) {
               const type = pastedCols[5].trim().toLowerCase()
               row.session_type = type === 'lecture' ? 'lecture' : type === 'lab' ? 'lab' : ''
            }
            
            if (pastedCols[6] !== undefined) {
                const dayStr = pastedCols[6].trim().toLowerCase()
                const dayMatch = DAY_OPTIONS.find(d => d.label.toLowerCase() === dayStr)
                if (dayMatch) row.day_of_week = dayMatch.value
            }
            if (pastedCols[7] !== undefined) row.start_time = parseTimeValue(pastedCols[7])
            if (pastedCols[8] !== undefined) row.end_time = parseTimeValue(pastedCols[8])

            updated[rowIndex] = row
        })

        onChange(updated)
    }, [rows, onChange])

    const exportCSV = useCallback(() => {
        if (rows.length === 0) return
        const headers = ['Course Code', 'Course Name', 'Section', 'Instructor', 'Room', 'Type', 'Day', 'Start Time', 'End Time']
        const csvRows = rows.map(r => [
            `"${r.course_code}"`, `"${r.course_name}"`, `"${r.section}"`, `"${r.instructor}"`,
            `"${r.room}"`, `"${r.session_type}"`, `"${DAY_LABELS[r.day_of_week] ?? ''}"`,
            `"${r.start_time}"`, `"${r.end_time}"`,
        ].join(','))

        const csvContent = [headers.join(','), ...csvRows].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `manual_entries_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [rows])

    const filledRows = rows.filter(r => r.course_code || r.section || r.room)
    const validCount = filledRows.filter(r => hasRowError(r).length === 0).length
    const errorCount = filledRows.length - validCount

    return (
        <div className="flex flex-col flex-1 space-y-4 h-full min-h-0 w-full max-w-full overflow-hidden">
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
                    {isConfirmingClear ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                            <span className="text-xs text-muted-foreground mr-1">Sure?</span>
                            <button
                                onClick={() => {
                                    onChange([])
                                    setIsConfirmingClear(false)
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 rounded-lg text-xs font-medium border border-transparent transition-colors shadow-sm"
                            >
                                <CheckCircle2 className="h-3 w-3" /> Yes
                            </button>
                            <button
                                onClick={() => setIsConfirmingClear(false)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-medium border border-border transition-colors shadow-sm"
                            >
                                <XCircle className="h-3 w-3" /> No
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsConfirmingClear(true)}
                            disabled={rows.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 rounded-lg text-xs font-medium border border-red-200 dark:border-red-900/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="h-3 w-3" /> Clear All
                        </button>
                    )}
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
                <Table className="min-w-max relative" style={{ minWidth: '1200px' }}>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                            <TableHead className="w-10 px-2 text-center">#</TableHead>
                            <TableHead className="min-w-[120px] text-xs whitespace-nowrap">Course Code *</TableHead>
                            <TableHead className="min-w-[160px] text-xs whitespace-nowrap">Course Name</TableHead>
                            <TableHead className="min-w-[120px] text-xs whitespace-nowrap">Section *</TableHead>
                            <TableHead className="min-w-[160px] text-xs whitespace-nowrap">Instructor</TableHead>
                            <TableHead className="min-w-[120px] text-xs whitespace-nowrap">Room *</TableHead>
                            <TableHead className="min-w-[100px] text-xs whitespace-nowrap">Type</TableHead>
                            <TableHead className="min-w-[120px] text-xs whitespace-nowrap">Day *</TableHead>
                            <TableHead className="min-w-[100px] text-xs whitespace-nowrap">Start *</TableHead>
                            <TableHead className="min-w-[100px] text-xs whitespace-nowrap">End *</TableHead>
                            <TableHead className="w-10"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="py-8 text-center text-muted-foreground text-xs">
                                    No entries yet. Click &quot;+ Add Row&quot; to start.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row, i) => {
                                const isFilled = row.course_code || row.section || row.room
                                const errors = hasRowError(row)
                                const hasError = isFilled && errors.length > 0
                                const timeError = errors.find(e => e.includes('7:00 AM') || e.includes('7:00 PM') || e.includes('before') || e.includes('after start'))

                                return (
                                    <TableRow
                                        key={i}
                                        className={cn(hasError ? 'bg-red-50/50 dark:bg-red-950/20' : '')}
                                        onPaste={(e) => handlePaste(e, i)}
                                    >
                                        <TableCell className="text-xs text-muted-foreground px-3 py-2 text-center border-r">
                                            <div className="flex items-center justify-center gap-1">
                                                {i + 1}
                                                {hasError && (
                                                    <span title={errors.join('\n')} className="cursor-help">
                                                        <AlertCircle className="h-3 w-3 text-red-500" />
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Input
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent placeholder:text-muted-foreground/40 placeholder:italic"
                                                value={row.course_code}
                                                onChange={e => updateCell(i, 'course_code', e.target.value)}
                                                placeholder="e.g. IT101"
                                                title={hasError && errors.includes('Course Code is required') ? 'Course Code is required' : undefined}
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 border-l">
                                            <Input
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent placeholder:text-muted-foreground/40 placeholder:italic"
                                                value={row.course_name}
                                                onChange={e => updateCell(i, 'course_name', e.target.value)}
                                                placeholder="e.g. Intro to IT"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 border-l">
                                            <Input
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent placeholder:text-muted-foreground/40 placeholder:italic"
                                                value={row.section}
                                                onChange={e => updateCell(i, 'section', e.target.value)}
                                                placeholder="e.g. BSIT 1A"
                                                title={hasError && errors.includes('Section is required') ? 'Section is required' : undefined}
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 border-l">
                                            <Input
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent placeholder:text-muted-foreground/40 placeholder:italic"
                                                value={row.instructor}
                                                onChange={e => updateCell(i, 'instructor', e.target.value)}
                                                placeholder="e.g. J. Dela Cruz"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 border-l">
                                            <Input
                                                className="h-8 text-xs border-0 rounded-none focus-visible:ring-1 bg-transparent placeholder:text-muted-foreground/40 placeholder:italic"
                                                value={row.room}
                                                onChange={e => updateCell(i, 'room', e.target.value)}
                                                placeholder="e.g. Room 301"
                                                title={hasError && errors.includes('Room is required') ? 'Room is required' : undefined}
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 border-l">
                                            <Select value={row.session_type || 'auto'} onValueChange={v => updateCell(i, 'session_type', v === 'auto' ? '' : v)}>
                                                <SelectTrigger className="h-8 text-xs border-0 rounded-none focus:ring-1 bg-transparent">
                                                    <SelectValue placeholder="Auto" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="auto">Auto</SelectItem>
                                                    <SelectItem value="lecture">Lecture</SelectItem>
                                                    <SelectItem value="lab">Lab</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="p-2 border-l">
                                            <Select value={String(row.day_of_week)} onValueChange={v => updateCell(i, 'day_of_week', parseInt(v))}>
                                                <SelectTrigger className="h-8 text-xs border-0 rounded-none focus:ring-1 bg-transparent">
                                                    <SelectValue placeholder="Day" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DAY_OPTIONS.map(d => (
                                                        <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="p-2 border-l">
                                            <TimeSlotPicker
                                                hideLabel
                                                displayAs="dropdown"
                                                className={cn(
                                                    "h-8 text-xs border-0 rounded-none bg-transparent focus-visible:ring-1 pr-8",
                                                    isFilled && row.start_time && row.start_time < '07:00' && 'ring-1 ring-red-500 text-red-400'
                                                )}
                                                value={row.start_time}
                                                onChange={v => updateCell(i, 'start_time', v)}
                                            />
                                            {isFilled && row.start_time && row.start_time < '07:00' && (
                                                <p className="text-[10px] text-red-400 px-1 leading-tight">Before 7 AM</p>
                                            )}
                                        </TableCell>
                                        <TableCell className="p-2 border-l">
                                            <TimeSlotPicker
                                                hideLabel
                                                displayAs="dropdown"
                                                className={cn(
                                                    "h-8 text-xs border-0 rounded-none bg-transparent focus-visible:ring-1 pr-8",
                                                    isFilled && row.end_time && row.end_time > '19:00' && 'ring-1 ring-red-500 text-red-400'
                                                )}
                                                value={row.end_time}
                                                onChange={v => updateCell(i, 'end_time', v)}
                                            />
                                            {isFilled && row.end_time && row.end_time > '19:00' && (
                                                <p className="text-[10px] text-red-400 px-1 leading-tight">After 7 PM</p>
                                            )}
                                        </TableCell>
                                        <TableCell className="p-2 border-l text-center">
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

