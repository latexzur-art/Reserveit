'use client'

import { useState, useEffect } from 'react'
import { Wallet, Loader2 } from 'lucide-react'

export function BookingCreditHistory({ bookingId }: { bookingId: string }) {
  const [entries, setEntries] = useState<Array<{ id: string; amount_centavos: number; event_type: string; reason: string | null; created_at: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/building/bookings/${bookingId}/credit-history`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setEntries(data?.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [bookingId])

  if (loading) {
    return <p className="text-[10px] text-muted-foreground italic">Loading...</p>
  }
  if (entries.length === 0) {
    return <p className="text-[10px] text-muted-foreground italic">No credits linked to this booking.</p>
  }
  return (
    <div className="space-y-2">
      {entries.map(e => (
        <div key={e.id} className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground truncate max-w-[220px]">{e.reason ?? e.event_type}</span>
          <span className={e.amount_centavos > 0 ? 'text-green-600 font-black' : 'text-red-500 font-black'}>
            {e.amount_centavos > 0 ? '+' : '−'}₱{Math.abs(e.amount_centavos / 100).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}
