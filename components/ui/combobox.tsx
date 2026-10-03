'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, ChevronDown, Loader2, Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  /** Stable value committed to the form */
  value: string
  /** Primary label shown in the trigger and list */
  label: string
  /** Optional secondary label (e.g. course name, room number) */
  sublabel?: string
  /** Extra haystack text included in search but not displayed */
  keywords?: string
  /** Optional status badge rendered next to the label (e.g. facility availability) */
  badge?: React.ReactNode
  /** Optional right-aligned action slot (e.g. a "Details" button), stops row selection when clicked */
  rightSlot?: React.ReactNode
}

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  /** When true, typed value with no match can be committed as-is via an "+ Use" row. */
  allowCustom?: boolean
  loading?: boolean
  disabled?: boolean
  className?: string
  variant?: 'dark' | 'schedule'
}

/**
 * Searchable single-select combobox styled for the schedule manual-entry dialog
 * (dark surface, cyan accent) or the schedules modal (theme-aware, blue accent). 
 * When `allowCustom` is true and the typed value doesn't match any option, 
 * an "+ Use: …" row lets the user commit it as-is.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches.',
  allowCustom = false,
  loading = false,
  disabled = false,
  className,
  variant = 'dark',
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const selectedOption = options.find(o => o.value === value)
  const trimmedQuery = query.trim()
  const exactMatch = options.some(
    o => o.value.toLowerCase() === trimmedQuery.toLowerCase() ||
         o.label.toLowerCase() === trimmedQuery.toLowerCase()
  )
  const showCustom = allowCustom && trimmedQuery.length > 0 && !exactMatch

  const commit = (next: string) => {
    onChange(next)
    setQuery('')
    setOpen(false)
  }

  const isDark = variant === 'dark'

  // Trigger styling
  const triggerCls = isDark
    ? cn(
        'flex w-full items-center justify-between gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-ah-sti-cyan/50 disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )
    : cn(
        'flex w-full h-11 items-center justify-between gap-2 px-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )

  const textCls = isDark
    ? cn('truncate text-left', !selectedOption && !value && 'text-slate-600')
    : cn('truncate text-left font-bold', !selectedOption && !value ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300')

  // Dropdown card styling
  const popoverContentCls = isDark
    ? 'p-0 w-[var(--radix-popover-trigger-width)] bg-[#1a2332] border border-white/10 text-white rounded-lg shadow-2xl'
    : 'p-0 w-[var(--radix-popover-trigger-width)] bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl shadow-2xl'

  const commandCls = isDark
    ? 'bg-transparent text-white'
    : 'bg-transparent text-slate-900 dark:text-white'

  const commandInputCls = isDark
    ? 'text-white placeholder:text-slate-500'
    : 'text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500'

  const itemCls = isDark
    ? 'cursor-pointer text-white aria-selected:bg-white/10 data-[selected=true]:bg-white/10 data-[selected=true]:text-white'
    : 'cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 aria-selected:bg-slate-100 dark:aria-selected:bg-white/5 data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-white/5 data-[selected=true]:text-slate-900 dark:data-[selected=true]:text-white'

  const checkColorCls = isDark
    ? 'text-ah-sti-cyan'
    : 'text-blue-600 dark:text-blue-500'

  const customItemCls = isDark
    ? 'cursor-pointer text-ah-sti-cyan aria-selected:bg-white/10 data-[selected=true]:bg-white/10'
    : 'cursor-pointer text-blue-600 dark:text-blue-500 hover:bg-slate-100 dark:hover:bg-white/5 aria-selected:bg-slate-100 dark:aria-selected:bg-white/5 data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-white/5'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={triggerCls}>
          <span className={textCls}>
            {selectedOption?.label || value || placeholder || ''}
          </span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 animate-spin shrink-0" />
          ) : isDark ? (
            <ChevronsUpDown className="h-4 w-4 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className={popoverContentCls}>
        <Command className={commandCls} shouldFilter={true}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            className={commandInputCls}
          />
          <CommandList className="max-h-60">
            {!loading && options.length === 0 && (
              <CommandEmpty className="text-slate-500">{emptyMessage}</CommandEmpty>
            )}
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />
              </div>
            )}
            {!loading && options.length > 0 && (
              <CommandGroup>
                {options.map(opt => (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.sublabel ?? ''} ${opt.keywords ?? ''} ${opt.value}`}
                    onSelect={() => commit(opt.value)}
                    className={itemCls}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0', checkColorCls)} />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate flex items-center gap-1.5">
                          {opt.label}
                          {opt.badge}
                        </p>
                        {opt.sublabel && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{opt.sublabel}</p>
                        )}
                      </div>
                      {opt.rightSlot && (
                        <div onClick={e => e.stopPropagation()} className="shrink-0">
                          {opt.rightSlot}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCustom && (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={`__custom__ ${trimmedQuery}`}
                  onSelect={() => commit(trimmedQuery)}
                  className={customItemCls}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Use “{trimmedQuery}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
