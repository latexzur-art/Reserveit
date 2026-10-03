import { useState, useEffect } from 'react'

export function useAvailableFacilities(dayOfWeek: number, startTime: string, endTime: string, excludeEntryId: string) {
    const [facilities, setFacilities] = useState<{ id: string; name: string; room_number: string; available: boolean }[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!startTime || !endTime) return
        setLoading(true)
        const params = new URLSearchParams({
            day_of_week: String(dayOfWeek),
            start_time: startTime,
            end_time: endTime,
            exclude_entry_id: excludeEntryId,
        })
        fetch(`/api/schedules/slot-availability?${params}`)
            .then(r => r.json())
            .then(data => { if (data.facilities) setFacilities(data.facilities) })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [dayOfWeek, startTime, endTime, excludeEntryId])

    return { facilities: facilities.filter(f => f.available), loading }
}
