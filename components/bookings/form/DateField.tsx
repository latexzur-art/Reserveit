"use client"

import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateFieldProps {
  /** ISO yyyy-mm-dd, or '' when unset */
  value: string
  onChange: (value: string) => void
  /** ISO yyyy-mm-dd lower bound (inclusive) */
  min?: string
  /** ISO yyyy-mm-dd upper bound (inclusive) */
  max?: string
  error?: boolean
  className?: string
  /** Whether Sunday selection is allowed (defaults to false) */
  allowSunday?: boolean
}

function parseLocalDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calendar date field styled to match the rest of the booking form's
 * dropdown panels — replaces the native <input type="date">, whose
 * browser-rendered calendar (locale-dependent, unstyled) clashes with
 * the form's theme.
 */
export function DateField({ value, onChange, min, max, error, className, allowSunday = false }: DateFieldProps) {
  const [open, setOpen] = useState(false)

  const selected = value ? parseLocalDate(value) : undefined
  const minDate = min ? parseLocalDate(min) : undefined
  const maxDate = max ? parseLocalDate(max) : undefined
  const today = parseLocalDate(toIsoDate(new Date()))
  const isTodaySunday = !allowSunday && today.getDay() === 0
  const todayDisabled = isTodaySunday || (minDate && today < minDate) || (maxDate && today > maxDate)

  const isDisabled = (date: Date) => {
    if (!allowSunday && date.getDay() === 0) return true
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 border border-border/60 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-left transition-colors hover:bg-muted/30 dark:hover:bg-slate-600/60',
            selected ? 'text-slate-900 dark:text-white' : 'text-muted-foreground',
            error && 'border-red-500',
            className
          )}
        >
          <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="truncate">{selected ? format(selected, 'PPP') : 'Pick a date'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0 rounded-lg border border-border bg-white dark:bg-slate-800 shadow-xl"
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate}
          onSelect={date => {
            onChange(date ? toIsoDate(date) : '')
            setOpen(false)
          }}
          disabled={isDisabled}
          initialFocus
        />
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={!!todayDisabled}
            onClick={() => {
              onChange(toIsoDate(today))
              setOpen(false)
            }}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-primary"
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
