import { useState, useMemo, useCallback } from 'react'

type ClassSchedule = {
  id: string
  is_active: boolean
  [key: string]: unknown
}

export function useMasterScheduleFilters(schedules: ClassSchedule[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const allPageIds = useMemo(() => schedules.map(s => s.id), [schedules])
  const allSelected = allPageIds.length > 0 && allPageIds.every(id => selected.has(id))
  const someSelected = allPageIds.some(id => selected.has(id)) && !allSelected
  const selectedCount = selected.size

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (allPageIds.length > 0 && allPageIds.every(id => selected.has(id))) {
      setSelected(prev => {
        const next = new Set(prev)
        allPageIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => new Set([...prev, ...allPageIds]))
    }
  }, [allPageIds, selected])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const resetSelection = useCallback(() => setSelected(new Set()), [])

  const selectedSchedules = useMemo(
    () => schedules.filter(s => selected.has(s.id)),
    [schedules, selected]
  )
  const selectedActiveCount = useMemo(
    () => selectedSchedules.filter(s => s.is_active).length,
    [selectedSchedules]
  )
  const selectedInactiveCount = useMemo(
    () => selectedSchedules.filter(s => !s.is_active).length,
    [selectedSchedules]
  )

  return {
    selected,
    setSelected,
    allPageIds,
    allSelected,
    someSelected,
    selectedCount,
    toggleSelect,
    toggleAll,
    clearSelection,
    resetSelection,
    selectedSchedules,
    selectedActiveCount,
    selectedInactiveCount,
  }
}
