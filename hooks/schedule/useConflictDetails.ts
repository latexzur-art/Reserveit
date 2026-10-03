import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ConflictDetail {
    entry_id: string
    conflict_type: 'internal' | 'external' | 'cross_department'
    conflicting_entry_id?: string
    conflicting_schedule_id?: string
    facility_id: string
    day_of_week: number
    start_time: string
    end_time: string
    name?: string
    course_code?: string
    section?: string
}

export function useConflictDetails(entry: any) {
    const [conflicts, setConflicts] = useState<ConflictDetail[]>([])
    const [loading, setLoading] = useState(false)

    const fetchConflicts = useCallback(async () => {
        if (!entry || (!entry.has_internal_conflict && !entry.has_external_conflict)) {
            setConflicts([])
            return
        }
        setLoading(true)
        try {
            const supabase = createClient()
            const fetchedConflicts: ConflictDetail[] = []

            if (entry.has_internal_conflict && entry.conflict_entry_ids?.length > 0) {
                const { data: conflictEntries } = await supabase
                    .from('schedule_entries_staging')
                    .select('id, course_code, section, facility_id, day_of_week, start_time, end_time, facilities(name)')
                    .in('id', entry.conflict_entry_ids)

                for (const ce of (conflictEntries ?? [])) {
                    fetchedConflicts.push({
                        entry_id: entry.id,
                        conflict_type: 'internal',
                        conflicting_entry_id: ce.id,
                        facility_id: ce.facility_id ?? '',
                        day_of_week: ce.day_of_week,
                        start_time: ce.start_time,
                        end_time: ce.end_time,
                        name: (ce as any).facilities?.name ?? '',
                        course_code: ce.course_code,
                        section: ce.section,
                    })
                }
            }

            if (entry.has_external_conflict && entry.conflict_schedule_ids?.length > 0) {
                const { data: conflictSchedules } = await supabase
                    .from('class_schedules')
                    .select('id, course_code, section, facility_id, day_of_week, start_time, end_time, facilities(name), departments(name, code)')
                    .in('id', entry.conflict_schedule_ids)

                for (const cs of (conflictSchedules ?? [])) {
                    fetchedConflicts.push({
                        entry_id: entry.id,
                        conflict_type: 'external',
                        conflicting_schedule_id: cs.id,
                        facility_id: cs.facility_id ?? '',
                        day_of_week: cs.day_of_week,
                        start_time: cs.start_time,
                        end_time: cs.end_time,
                        name: `${(cs as any).facilities?.name ?? ''} (${(cs as any).departments?.code ?? 'Live'})`,
                        course_code: cs.course_code,
                        section: cs.section,
                    })
                }
            }

            // Fallback
            if (fetchedConflicts.length === 0) {
                if (entry.has_internal_conflict) {
                    fetchedConflicts.push({
                        entry_id: entry.id, conflict_type: 'internal', facility_id: entry.facility_id ?? '',
                        day_of_week: entry.day_of_week, start_time: entry.start_time, end_time: entry.end_time,
                        name: 'Same upload', course_code: 'Another entry', section: 'in this upload',
                    })
                }
                if (entry.has_external_conflict) {
                    fetchedConflicts.push({
                        entry_id: entry.id, conflict_type: 'external', facility_id: entry.facility_id ?? '',
                        day_of_week: entry.day_of_week, start_time: entry.start_time, end_time: entry.end_time,
                        name: 'Live schedule', course_code: 'Existing class', section: 'in database',
                    })
                }
            }
            setConflicts(fetchedConflicts)
        } catch (err) {
            console.error('Failed to fetch conflict details:', err)
        }
        setLoading(false)
    }, [entry])

    useEffect(() => {
        fetchConflicts()
    }, [fetchConflicts])

    return { conflicts, loadingConflicts: loading }
}
