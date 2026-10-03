'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import type { OversightBooking } from '@/hooks/admin/useOversight'
import OverrideDialog from './OverrideDialog'

interface OversightTableProps {
  bookings: OversightBooking[]
  onRefresh: () => void
}

export default function OversightTable({ bookings, onRefresh }: OversightTableProps) {
  const [selectedBooking, setSelectedBooking] = useState<OversightBooking | null>(null)

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
        <p className="font-medium">No bookings in oversight window</p>
        <p className="text-sm mt-1">All decisions have been finalized.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Reference</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Requester</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Facility</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Date / Time</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Score</th>
              <th className="text-left py-3 px-4 text-slate-500 font-medium">Window Expires</th>
              <th className="text-right py-3 px-4 text-slate-500 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => {
              const facility = booking.booking_facilities?.[0]?.facility
              const decision = booking.booking_decisions?.[0]
              const score = decision?.final_score ?? booking.decision_score
              const isFlagged = booking.current_status === 'flagged'
              const expiresAt = new Date(booking.oversight_expires_at)
              const hoursLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)))
              const minutesLeft = Math.max(0, Math.floor(((expiresAt.getTime() - Date.now()) % (1000 * 60 * 60)) / (1000 * 60)))

              return (
                <tr
                  key={booking.id}
                  className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isFlagged ? 'bg-amber-50/40' : ''}`}
                >
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs font-medium text-sti-navy">
                      {booking.booking_reference}
                    </span>
                    {isFlagged && (
                      <Badge className="ml-2 bg-amber-100 text-amber-700 border-amber-200 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Flagged
                      </Badge>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-700">{booking.user?.full_name}</p>
                    <p className="text-xs text-slate-400">{booking.user?.email}</p>
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-700">{facility?.name ?? '—'}</p>
                    {facility?.floors && (
                      <p className="text-xs text-slate-400">
                        {facility.floors.buildings?.name} · Floor {facility.floors.floor_number}
                      </p>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-700">{booking.booking_date}</p>
                    <p className="text-xs text-slate-400">
                      {booking.start_time} – {booking.end_time}
                    </p>
                  </td>

                  <td className="py-3 px-4">
                    <ScoreBadge score={score} />
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-slate-600">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className={hoursLeft < 4 ? 'text-red-600 font-medium' : ''}>
                        {hoursLeft}h {minutesLeft}m
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-200"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      Override
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedBooking && (
        <OverrideDialog
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onSuccess={() => {
            setSelectedBooking(null)
            onRefresh()
          }}
        />
      )}
    </>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400 text-xs">—</span>
  if (score >= 80) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{score}/100</Badge>
  if (score >= 50) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{score}/100</Badge>
  return <Badge className="bg-red-100 text-red-700 border-red-200">{score}/100</Badge>
}
