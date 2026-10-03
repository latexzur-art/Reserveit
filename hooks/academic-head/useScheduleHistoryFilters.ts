import { useMemo } from 'react'
import type { ScheduleRecord, DraftRecord } from './useScheduleHistory'

export function useScheduleHistoryFilters(
    schedules: ScheduleRecord[],
    drafts: DraftRecord[] | null | undefined,
    rolledBack: ScheduleRecord[],
    searchQuery: string,
) {
    const filteredSchedules = useMemo(() => {
        if (!searchQuery) return schedules
        const q = searchQuery.toLowerCase()
        return schedules.filter(s =>
            s.course_code.toLowerCase().includes(q) ||
            s.course_name.toLowerCase().includes(q) ||
            s.section.toLowerCase().includes(q) ||
            s.instructor_name.toLowerCase().includes(q) ||
            (s.facilities?.name ?? '').toLowerCase().includes(q) ||
            (s.departments?.name ?? '').toLowerCase().includes(q)
        )
    }, [schedules, searchQuery])

    const filteredDrafts = useMemo(() => {
        if (!searchQuery) return drafts || []
        const q = searchQuery.toLowerCase()
        return (drafts || []).filter(s =>
            s.course_code.toLowerCase().includes(q) ||
            s.course_name.toLowerCase().includes(q) ||
            s.section.toLowerCase().includes(q) ||
            s.instructor_name.toLowerCase().includes(q) ||
            (s.facilities?.name ?? '').toLowerCase().includes(q) ||
            (s.departments?.name ?? '').toLowerCase().includes(q)
        )
    }, [drafts, searchQuery])

    const filteredRolledBack = useMemo(() => {
        if (!searchQuery) return rolledBack
        const q = searchQuery.toLowerCase()
        return rolledBack.filter(s =>
            s.course_code.toLowerCase().includes(q) ||
            s.course_name.toLowerCase().includes(q) ||
            s.section.toLowerCase().includes(q) ||
            s.instructor_name.toLowerCase().includes(q) ||
            (s.facilities?.name ?? '').toLowerCase().includes(q) ||
            (s.departments?.name ?? '').toLowerCase().includes(q)
        )
    }, [rolledBack, searchQuery])

    return { filteredSchedules, filteredDrafts, filteredRolledBack }
}
