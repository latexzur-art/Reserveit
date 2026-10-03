"use client"

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DropdownSelectOption {
  value: string
  label: string
  sublabel?: string
}

interface DropdownSelectProps {
  value: string
  onChange: (value: string) => void
  options: DropdownSelectOption[]
  placeholder?: string
  disabled?: boolean
  error?: boolean
  className?: string
}

/**
 * Click-to-open dropdown styled to match the searchable comboboxes on this form
 * (same trigger, panel, and selected-row treatment) but without a text input —
 * for fields where typing isn't useful (fixed option lists).
 */
export function DropdownSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  error = false,
  className,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        title={selected ? selected.label : placeholder}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 border border-border bg-background rounded-xl px-3 py-2 text-xs font-medium text-foreground outline-none transition-all focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-destructive ring-destructive'
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-muted-foreground/60')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 min-w-full w-max max-w-[28rem] sm:max-w-md max-w-[calc(100vw-2rem)] mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-card shadow-2xl p-1.5">
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                title={opt.label}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium rounded-lg transition-colors mb-0.5 last:mb-0',
                  isSelected
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'hover:bg-muted/60 text-foreground'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn('whitespace-normal break-words text-xs leading-normal', isSelected && 'font-bold text-primary')}>{opt.label}</p>
                  {opt.sublabel && <p className="text-[11px] text-muted-foreground whitespace-normal break-words mt-0.5">{opt.sublabel}</p>}
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
