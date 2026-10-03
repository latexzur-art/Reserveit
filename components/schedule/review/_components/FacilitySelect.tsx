'use client'

import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useAvailableFacilities } from '@/hooks/schedule/useAvailableFacilities'

export function FacilitySelect({
    dayOfWeek, startTime, endTime, excludeEntryId, value, onChange, className,
}: {
    dayOfWeek: number; startTime: string; endTime: string; excludeEntryId: string
    value: string; onChange: (v: string) => void; className?: string
}) {
    const { facilities, loading } = useAvailableFacilities(dayOfWeek, startTime, endTime, excludeEntryId)

    // Auto-match raw value (e.g. "103") to a loaded facility by room_number
    useEffect(() => {
        if (!value || facilities.length === 0) return
        const exact = facilities.find(f => f.name === value)
        if (exact) return
        const byRoom = facilities.find(f => f.room_number === value)
        if (byRoom) onChange(byRoom.name)
    }, [facilities, value, onChange])

    // If the current value isn't in the available list, show it as a pinned option
    const isCurrentInList = facilities.some(f => f.name === value)
    const showCurrentAsOriginal = value && !isCurrentInList && startTime && endTime

    return (
        <>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className={className}
                required
            >
                <option value="">
                    {loading ? 'Loading rooms…' : startTime && endTime ? '— Select room —' : '— Pick a time first —'}
                </option>
                {showCurrentAsOriginal && (
                    <option value={value}>{value} (current — unavailable)</option>
                )}
                {facilities.map(f => (
                    <option key={f.id} value={f.name}>
                        {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                    </option>
                ))}
            </select>
            <div className="flex items-center justify-between mt-0.5">
                {!loading && startTime && endTime && (
                    <span className="text-[11px] text-emerald-400">{facilities.length} available</span>
                )}
                {(!value || showCurrentAsOriginal) && (
                    <button
                        type="button"
                        onClick={() => facilities.length > 0 && onChange(facilities[0].name)}
                        disabled={!startTime || !endTime || facilities.length === 0}
                        className="flex items-center gap-1 text-[11px] text-ah-sti-cyan hover:opacity-70 transition-opacity ml-auto disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!startTime || !endTime ? 'Pick start and end time first' : facilities.length === 0 ? 'No available rooms for this slot' : 'Pick best available room'}
                    >
                        <Sparkles className="h-3 w-3" />
                        Use best available
                    </button>
                )}
            </div>
        </>
    )
}
