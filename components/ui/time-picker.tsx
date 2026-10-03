'use client'

import * as React from 'react'
import { Clock, X } from 'lucide-react'
import { cn } from "@/lib/utils"

/** Combine 12h parts into the 24h `HH:mm` contract, or null if incomplete/invalid. */
export function to24h(hour: string, minute: string, period: string): string | null {
  const h = parseInt(hour, 10)
  const m = parseInt(minute, 10)
  if (!Number.isInteger(h) || h < 1 || h > 12) return null
  if (!Number.isInteger(m) || m < 0 || m > 59) return null
  let h24 = h % 12
  if (period.toUpperCase().startsWith('P')) h24 += 12
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Split a 24h `HH:mm` value into displayable 12h parts. */
export function from24h(value?: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
  if (!match) return { hour: '', minute: '', period: 'AM' }
  const h = parseInt(match[1], 10)
  const mi = parseInt(match[2], 10)
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return { hour: String(h12).padStart(2, '0'), minute: String(mi).padStart(2, '0'), period }
}

interface TimePickerProps {
  id?: string
  value?: string // 24h format HH:mm
  onChange?: (value: string) => void
  className?: string
  ariaLabel?: string
  disabled?: boolean
}

/**
 * Unified, production-grade 12-hour Time Picker component.
 * Features a single enclosed container shell, Clock icon affordance,
 * auto-advancing HH -> MM keyboard flow, segmented AM/PM toggle,
 * and 1-click clear button. Completely eliminates native HTML5 datalist popovers.
 */
export function TimePicker({ id, value, onChange, className, ariaLabel, disabled }: TimePickerProps) {
  const parsed = from24h(value)
  const [hour, setHour] = React.useState(parsed.hour)
  const [minute, setMinute] = React.useState(parsed.minute)
  const [period, setPeriod] = React.useState<'AM' | 'PM'>(parsed.period)

  const minuteRef = React.useRef<HTMLInputElement>(null)

  // Resync when controlled value changes
  React.useEffect(() => {
    const p = from24h(value)
    setHour(p.hour)
    setMinute(p.minute)
    setPeriod(p.period)
  }, [value])

  const nameFor = (part: string) => (ariaLabel ? `${ariaLabel} ${part}` : part)

  const emit = (h: string, m: string, p: string) => {
    if (h === '' && m === '') {
      onChange?.('')
      return
    }
    const next = to24h(h, m, p)
    if (next) onChange?.(next)
  }

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2)
    const num = parseInt(val, 10)
    if (!isNaN(num) && num > 12) val = '12'
    setHour(val)
    emit(val, minute, period)
    if (val.length === 2) {
      minuteRef.current?.focus()
    }
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2)
    const num = parseInt(val, 10)
    if (!isNaN(num) && num > 59) val = '59'
    setMinute(val)
    emit(hour, val, period)
  }

  const handlePeriodToggle = (p: 'AM' | 'PM') => {
    if (disabled) return
    setPeriod(p)
    emit(hour, minute, p)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setHour('')
    setMinute('')
    onChange?.('')
  }

  const hasValue = hour !== '' || minute !== ''

  return (
    <div
      id={id}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 transition-all shadow-sm focus-within:ring-2 focus-within:ring-sti-blue focus-within:border-transparent",
        disabled && "opacity-50 cursor-not-allowed bg-muted/30",
        className
      )}
    >
      <Clock className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />

      {/* Segmented Inputs Container */}
      <div className="flex items-center gap-1 text-foreground">
        {/* Hour Input */}
        <input
          type="text"
          aria-label={nameFor('hour')}
          inputMode="numeric"
          placeholder="HH"
          value={hour}
          disabled={disabled}
          onChange={handleHourChange}
          className="w-8 bg-transparent text-center text-sm font-semibold tracking-wider placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed"
        />

        <span className="text-muted-foreground font-bold text-xs" aria-hidden="true">:</span>

        {/* Minute Input */}
        <input
          ref={minuteRef}
          type="text"
          aria-label={nameFor('minutes')}
          inputMode="numeric"
          placeholder="MM"
          value={minute}
          disabled={disabled}
          onChange={handleMinuteChange}
          className="w-8 bg-transparent text-center text-sm font-semibold tracking-wider placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {/* Segmented AM/PM Toggle */}
      <div className="ml-auto flex items-center rounded-md bg-muted/60 p-0.5 border border-border/40">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handlePeriodToggle('AM')}
          className={cn(
            "px-2 py-0.5 text-[11px] font-bold uppercase rounded transition-all",
            period === 'AM'
              ? "bg-sti-blue text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          AM
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handlePeriodToggle('PM')}
          className={cn(
            "px-2 py-0.5 text-[11px] font-bold uppercase rounded transition-all",
            period === 'PM'
              ? "bg-sti-blue text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          PM
        </button>
      </div>

      {/* 1-Click Clear Button */}
      {hasValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          title="Clear time"
          className="ml-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
