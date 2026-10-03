'use client'

/**
 * ReservationImpactPreview — Shows bookings that would be cancelled by publishing a schedule upload.
 */

import { useState, useEffect } from 'react'
import {
    AlertTriangle,
    Calendar,
    Clock,
    User,
    MapPin,
    Loader2,
    ShieldAlert,
    BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AffectedBooking {
    booking_id: string
    booking_title: string
    booking_date: string
    start_time: string
    end_time: string
    booked_by_name: string
    facility_name: string
    current_status: string
    conflict_course: string
    conflict_section: string
}

interface ReservationImpactPreviewProps {
    uploadId: string
    className?: string
    onCountChange?: (count: number) => void
}

export function ReservationImpactPreview({ uploadId, className, onCountChange }: ReservationImpactPreviewProps) {
    const [loading, setLoading] = useState(true)
    const [affected, setAffected] = useState<AffectedBooking[]>([])
    const [totalAffected, setTotalAffected] = useState(0)

    useEffect(() => {
        async function fetchImpact() {
            setLoading(true)
            try {
                const res = await fetch(`/api/schedules/review/${uploadId}/impact`)
                const data = await res.json()
                setAffected(data.affected_bookings ?? [])
                setTotalAffected(data.total_affected ?? 0)
                onCountChange?.(data.total_affected ?? 0)
            } catch {
                console.error('Failed to fetch impact preview')
            }
            setLoading(false)
        }

        if (uploadId) fetchImpact()
    }, [uploadId, onCountChange])

    if (loading) {
        return (
            <div className={cn('flex items-center justify-center py-8', className)}>
                <Loader2 className="h-6 w-6 text-ah-sti-cyan animate-spin" />
                <span className="ml-2 text-sm text-slate-400">Analyzing impact...</span>
            </div>
        )
    }

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header Banner */}
            <div className={cn(
                'rounded-xl border p-4',
                totalAffected > 0
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-emerald-500/5 border-emerald-500/20',
            )}>
                <div className="flex items-center gap-3">
                    {totalAffected > 0 ? (
                        <ShieldAlert className="h-6 w-6 text-amber-400 flex-shrink-0" />
                    ) : (
                        <ShieldAlert className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                    )}
                    <div>
                        <p className={cn(
                            'text-sm font-semibold',
                            totalAffected > 0 ? 'text-amber-400' : 'text-emerald-400',
                        )}>
                            {totalAffected > 0
                                ? `${totalAffected} reservation${totalAffected > 1 ? 's' : ''} will be automatically cancelled`
                                : 'No reservations will be affected'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {totalAffected > 0
                                ? 'Class schedules have priority. These bookings conflict with approved entries.'
                                : 'Publishing this schedule will not cancel any existing bookings.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Affected Bookings List */}
            {affected.length > 0 && (
                <div className="space-y-2">
                    {affected.map(booking => (
                        <div
                            key={booking.booking_id}
                            className="bg-white/[0.02] border border-white/10 rounded-lg p-4 hover:bg-white/[0.04] transition-colors"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                        {booking.booking_title}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <User className="h-3 w-3" /> {booking.booked_by_name}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> {booking.facility_name}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" /> {new Date(booking.booking_date).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> {booking.start_time?.slice(0, 5)} – {booking.end_time?.slice(0, 5)}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-right flex-shrink-0">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        Will cancel
                                    </span>
                                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-500">
                                        <BookOpen className="h-2.5 w-2.5" />
                                        Conflicts with {booking.conflict_course} {booking.conflict_section}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
