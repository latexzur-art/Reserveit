"use client"

import { useMemo, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Clock, AlertCircle, ChevronDown, Check } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface BlockedRange {
    start: string
    end: string
    reason?: string
}

interface TimeSlotPickerProps {
    value: string
    onChange: (time: string) => void
    blockedRanges?: BlockedRange[]
    variant?: "academic" | "faculty"
    disabled?: boolean
    error?: string
    minTime?: string      // disable slots ≤ this time (for end-time picker)
    label?: string        // header label override (default: "Select Time")
    hideLabel?: boolean   // toggle label visibility
    displayAs?: "grid" | "dropdown"  // rendering mode (default: "grid")
    onBlockedClick?: (reason: string) => void
    className?: string // override input container styling
}

// Generate 30-minute slots from 7:00 to 19:00
function generateSlots(): { time: string; label: string; period: "morning" | "afternoon" }[] {
    const slots: { time: string; label: string; period: "morning" | "afternoon" }[] = []
    for (let h = 7; h <= 19; h++) {
        for (const m of [0, 30]) {
            if (h === 19 && m === 30) continue; // Stop exactly at 7:00 PM
            const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
            const hour12 = h > 12 ? h - 12 : h === 12 ? 12 : h
            const ampm = h >= 12 ? "PM" : "AM"
            const label = m === 0 ? `${hour12}:00 ${ampm}` : `${hour12}:30 ${ampm}`
            slots.push({ time, label, period: h < 12 ? "morning" : "afternoon" })
        }
    }
    return slots
}

function isBlocked(slotTime: string, blockedRanges: BlockedRange[]): { blocked: boolean; reason?: string } {
    for (const range of blockedRanges) {
        if (slotTime >= range.start && slotTime < range.end) {
            return { blocked: true, reason: range.reason }
        }
    }
    return { blocked: false }
}

export function TimeSlotPicker({
    value,
    onChange,
    blockedRanges = [],
    disabled = false,
    error,
    minTime,
    label = "Select Time",
    hideLabel = false,
    onBlockedClick: _onBlockedClick,
    className
}: TimeSlotPickerProps) {
    const slots = useMemo(() => generateSlots(), [])
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState("")

    const selectedSlot = useMemo(() => slots.find(s => s.time === value), [slots, value])

    useEffect(() => {
        setInputValue(selectedSlot?.label || "")
    }, [selectedSlot])

    const handleSelect = (slot: typeof slots[0]) => {
        const { blocked } = isBlocked(slot.time, blockedRanges)
        const isPastMinTime = !!(minTime && slot.time <= minTime)
        if (blocked || isPastMinTime) return

        onChange(slot.time)
        setOpen(false)
        setInputValue(slot.label)
    }

    const handleBlur = () => {
        setTimeout(() => {
            const match = slots.find(s => s.label.toLowerCase() === inputValue.toLowerCase() || s.time === inputValue)
            if (match && match.time !== value) {
                handleSelect(match)
            } else {
                setInputValue(selectedSlot?.label || "")
            }
        }, 150)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const match = filteredSlots.find(s => {
                const { blocked } = isBlocked(s.time, blockedRanges)
                const isPast = !!(minTime && s.time <= minTime)
                return !blocked && !isPast
            })
            if (match) handleSelect(match)
        }
        if (e.key === 'Escape') setOpen(false)
    }

    const filteredSlots = useMemo(() => {
        const search = inputValue.toLowerCase().trim()
        if (!search || search === selectedSlot?.label.toLowerCase()) return slots
        return slots.filter(s =>
            s.label.toLowerCase().includes(search) ||
            s.time.includes(search) ||
            s.label.replace(':', '').toLowerCase().includes(search.replace(':', ''))
        )
    }, [slots, inputValue, selectedSlot])

    return (
        <div className="space-y-1.5 w-full">
            {!hideLabel && (
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                    {label}
                </label>
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="relative group">
                        <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                        <input
                            type="text"
                            disabled={disabled}
                            placeholder="e.g. 7:00 AM"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value)
                                if (!open) setOpen(true)
                            }}
                            onFocus={() => setOpen(true)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            className={cn(
                                "flex h-10 w-full rounded-xl border border-border bg-background pl-10 pr-10 py-2 text-xs font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary",
                                error ? "border-destructive ring-destructive" : "hover:border-border/80",
                                disabled && "opacity-50 cursor-not-allowed bg-muted/50",
                                className
                            )}
                        />
                        <ChevronDown className={cn(
                            "absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-transform duration-200 pointer-events-none",
                            open && "rotate-180"
                        )} />
                    </div>
                </PopoverTrigger>
                <PopoverContent
                    className="p-1 w-[240px] border border-border bg-card shadow-lg rounded-xl overflow-hidden"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div 
                        className="max-h-[260px] overflow-y-auto p-1 custom-scrollbar"
                        onWheel={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                    >
                        {filteredSlots.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground font-medium">No slots match your search</div>
                        ) : (
                            filteredSlots.map((slot) => {
                                const { blocked, reason } = isBlocked(slot.time, blockedRanges)
                                const isPastMinTime = !!(minTime && slot.time <= minTime)
                                const isUnavailable = blocked || isPastMinTime
                                const isSelected = value === slot.time
                                const isSchoolEvent = blocked && reason?.toLowerCase().includes('school')

                                return (
                                    <button
                                        key={slot.time}
                                        type="button"
                                        disabled={isUnavailable}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleSelect(slot)}
                                        className={cn(
                                            "flex items-center justify-between w-full px-3 py-2 text-left text-xs font-medium rounded-lg transition-colors mb-0.5 last:mb-0",
                                            !isUnavailable && (
                                                isSelected
                                                    ? "bg-primary/10 text-primary font-bold"
                                                    : "hover:bg-muted/60 text-foreground"
                                            ),
                                            isUnavailable && "opacity-45 cursor-not-allowed select-none bg-muted/20 text-muted-foreground"
                                        )}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className={cn(isUnavailable && "line-through decoration-1")}>{slot.label}</span>
                                            {blocked && (
                                                <span className={cn(
                                                    "text-[10px] font-semibold",
                                                    isSchoolEvent ? "text-amber-600 dark:text-amber-400" : "text-destructive"
                                                )}>
                                                    {isSchoolEvent ? "School Event" : "Occupied"}
                                                </span>
                                            )}
                                            {isPastMinTime && !blocked && (
                                                <span className="text-[10px] font-medium text-muted-foreground">Unavailable</span>
                                            )}
                                        </div>
                                        {isSelected && !isUnavailable && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                        {blocked && (
                                            <AlertCircle className={cn("w-3.5 h-3.5 shrink-0 opacity-70", isSchoolEvent ? "text-amber-600" : "text-destructive")} />
                                        )}
                                    </button>
                                )
                            })
                        )}
                    </div>
                </PopoverContent>
            </Popover>

            {error && (
                <p className="mt-1 text-xs text-destructive font-semibold">{error}</p>
            )}
        </div>
    )
}
