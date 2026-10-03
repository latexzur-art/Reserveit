'use client'

import { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export interface FacilityOption {
  id: string
  name: string
  room_number: string
}

interface FacilityMultiSelectProps {
  facilities: FacilityOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  loading?: boolean
}

export function FacilityMultiSelect({ facilities, selectedIds, onChange, loading }: FacilityMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return facilities
    const q = search.toLowerCase()
    return facilities.filter((f) => f.name.toLowerCase().includes(q) || f.room_number.toLowerCase().includes(q))
  }, [facilities, search])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allChecked = facilities.length > 0 && facilities.every((f) => selectedSet.has(f.id))
  const someChecked = facilities.some((f) => selectedSet.has(f.id))
  const selectAllState: boolean | 'indeterminate' = allChecked ? true : someChecked ? 'indeterminate' : false

  const toggleFacility = (id: string) => {
    onChange(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  const toggleSelectAll = () => {
    onChange(allChecked ? [] : facilities.map((f) => f.id))
  }

  const selectNone = () => {
    onChange([])
  }

  const triggerLabel =
    selectedIds.length === 0
      ? 'Select facilities...'
      : selectedIds.length === facilities.length
        ? `All ${facilities.length} facilities selected`
        : `${selectedIds.length} facilit${selectedIds.length === 1 ? 'y' : 'ies'} selected`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          className="h-11 w-full justify-between rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-sm font-normal text-left shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <span className="truncate text-slate-700 dark:text-slate-200 font-medium">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xl overflow-hidden" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search venue name or room..." value={search} onValueChange={setSearch} className="h-11 text-xs" autoFocus />
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectAllState}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all facilities"
                id="facility-select-all"
              />
              <label htmlFor="facility-select-all" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                Select All ({facilities.length})
              </label>
            </div>
            {selectedIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectNone}
                className="h-6 px-2 text-[11px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-medium"
              >
                Clear
              </Button>
            )}
          </div>
          <CommandList className="max-h-[220px]">
            <CommandEmpty className="py-5 text-xs text-slate-400 text-center">No matching venues found.</CommandEmpty>
            {filtered.map((fac) => {
              const checked = selectedSet.has(fac.id)
              return (
                <CommandItem
                  key={fac.id}
                  onSelect={() => toggleFacility(fac.id)}
                  className="py-2.5 px-3 text-xs cursor-pointer font-medium flex items-center gap-2.5 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                >
                  <Checkbox checked={checked} aria-label={fac.name} className="pointer-events-none" />
                  <span className="font-semibold text-slate-900 dark:text-white">{fac.name}</span>
                  <span className="text-slate-400 ml-1 font-mono">({fac.room_number})</span>
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

